// ─────────────────────────────────────────────────────────────────────────────
// API facade — mirrors a Fastify/Postgres backend. Every call enforces auth,
// row-level ownership and server-side pricing. Keys never reach page code.
// ─────────────────────────────────────────────────────────────────────────────
import { z } from "zod";
import {
  AdminSettings, ApiError, Asset, AssetKind, Character, Generation, Job, ModelInfo, Notification,
  PricingRule, ProviderCredential, TaskType, User,
} from "../lib/types";
import { hashPassword, maskKey, nowIso, uid } from "../lib/utils";
import { blobStore, blobUrl, db, ensureSeed, getAdminSettings, vault } from "./db";
import { auth, creditEngine, localToken } from "./auth";
import { adapterFor, normalizeOllamaEndpoint, PROVIDER_REGISTRY, providerDef } from "./ai/providers";
import { defaultModelFor, enqueueJob, onGenEvent, router, startWorker } from "./ai/router";

const T = () => localToken.get();
const GenerationDTO = z.object({
  type: z.enum(["image", "video", "poster", "character", "text", "audio"]),
  prompt: z.string().trim().min(3, "Describe what you want to create (min 3 characters).").max(6000, "Prompt too long.").
    default(""),
  params: z.record(z.string(), z.any()).optional().default({} as Record<string, any>),
});

const UPLOAD_RULES: Record<string, { mimes: string[]; exts: string[] }> = {
  image: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: [".png", ".jpg", ".jpeg", ".webp"] },
  video: { mimes: ["video/mp4", "video/quicktime", "video/webm"], exts: [".mp4", ".mov", ".webm"] },
  character_image: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: [".png", ".jpg", ".jpeg", ".webp"] },
  character_video: { mimes: ["video/mp4", "video/quicktime", "video/webm"], exts: [".mp4", ".mov", ".webm"] },
  logo: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: [".png", ".jpg", ".jpeg", ".webp"] },
  audio: { mimes: ["audio/mpeg", "audio/wav", "audio/webm"], exts: [".mp3", ".wav", ".webm"] },
  poster: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: [".png", ".jpg", ".jpeg", ".webp"] },
};

export async function boot() {
  await ensureSeed();
  startWorker();
  // Auto-connect Pollinations (free, no key) so image/text work out of the box.
  try {
    const adminId = "usr-admin";
    const existing = db.where<ProviderCredential>("provider_credentials", (c) => c.userId === adminId && c.providerId === "pollinations")[0];
    if (!existing) {
      db.insert("provider_credentials", {
        id: uid(), userId: adminId, providerId: "pollinations", label: "Pollinations", keyEnc: null, endpoint: null,
        defaultModel: "flux", status: "connected", lastCheck: nowIso(), latencyMs: null, lastError: null,
        billing: "free", extra: {}, createdAt: nowIso(), updatedAt: nowIso(),
      } satisfies ProviderCredential);
    }
  } catch { /* best-effort */ }
}

export const api = {
  boot,
  subscribeGenerations: onGenEvent,

  platformMode() {
    const s = getAdminSettings();
    return { unlimited: s.unlimitedMode === true, simulatorEnabled: s.mockEnabled };
  },

  me: () => auth.me(T()),

  async autoLocalLogin() {
    const existing = auth.me(localToken.get());
    if (existing) return { token: localToken.get()!, user: existing };
    const local = db.all<User>("users").find((x) => x.email === "admin@studio.local");
    if (!local) throw new ApiError("NO_LOCAL", "Local workspace account is missing — clear site data and reload.", 500);
    return auth.login(local.email, "admin1234");
  },

  updateProfile(name: string, email: string) {
    const u = auth.requireUser(T());
    if (!name.trim()) throw new ApiError("INVALID", "Name cannot be empty.", 422);
    db.update("users", u.id, { name: name.trim(), email: email.trim().toLowerCase() });
  },
  updatePrefs(patch: Partial<User["prefs"]>) {
    const u = auth.requireUser(T());
    const full = db.get<User>("users", u.id)!;
    db.update("users", u.id, { prefs: { ...full.prefs, ...patch } });
  },
  changePassword: (cur: string, next: string) => auth.changePassword(T()!, cur, next),
  logout: () => auth.logout(T()),
  deleteAccount(confirmEmail: string) {
    const u = auth.requireUser(T());
    if (confirmEmail.trim().toLowerCase() !== u.email) throw new ApiError("MISMATCH", "Email does not match.", 422);
    ["provider_credentials", "characters", "generations", "assets", "notifications", "usage_logs"].forEach((tbl) => {
      db.where<any>(tbl, (r) => r.userId === u.id).forEach((r) => db.remove(tbl, r.id));
    });
    db.where<any>("jobs", (j) => j.userId === u.id).forEach((j) => db.remove("jobs", j.id));
    db.remove("users", u.id);
    auth.logout(T());
  },

  // ── Credits ──
  creditSummary() {
    const u = auth.requireUser(T());
    return creditEngine.account(u.id);
  },
  creditTransactions() {
    const u = auth.requireUser(T());
    return creditEngine.transactions(u.id);
  },
  estimate(dto: { type: TaskType; providerId: string | null; model: string | null; params: Record<string, any> }) {
    auth.requireUser(T());
    return creditEngine.calculate({
      taskType: dto.type, providerId: dto.providerId === "auto" ? null : dto.providerId, model: dto.model || null,
      durationSec: dto.params.duration, width: dto.params.width, height: dto.params.height,
      quality: dto.params.quality, resolution: dto.params.resolution, count: dto.params.count,
    });
  },

  // ── Generations ──
  async createGeneration(input: { type: TaskType; prompt: string; params: Record<string, any> }): Promise<Generation> {
    const u = auth.requireUser(T());
    const dto = GenerationDTO.parse(input);
    const params = dto.params ?? {};
    if (getAdminSettings().maintenanceMode && u.role !== "admin") throw new ApiError("MAINTENANCE", "The studio is in maintenance mode.", 503);

    const route = router.selectRoute(u.id, dto.type, params.providerId ?? "auto", params.model ?? null, { allowPaid: u.prefs.allowPaid });
    const pricingProvider = route.providerId;
    const est = creditEngine.calculate({
      taskType: dto.type, providerId: pricingProvider, model: route.model,
      durationSec: params.duration, width: params.width, height: params.height, quality: params.quality, count: params.count,
    });
    const genId = uid();
    await creditEngine.reserve(u.id, est.credits, genId, `${dto.type} (${route.providerId})`);

    const job: Job = { id: uid(), userId: u.id, generationId: genId, status: "queued", stage: "Queued", requestedCancel: false, createdAt: nowIso(), startedAt: null, finishedAt: null, error: null };
    db.insert("jobs", job);
    const gen: Generation = {
      id: genId, userId: u.id, jobId: job.id, type: dto.type, status: "queued",
      prompt: dto.prompt, params, providerId: route.providerId, model: route.model,
      simulated: route.providerId === "simulator", creditEstimate: est.credits, creditFinal: null, assetId: null,
      error: null, errorCode: null, stages: [{ stage: "Queued", at: nowIso(), honest: true }],
      createdAt: nowIso(), updatedAt: nowIso(),
    };
    db.insert("generations", gen);
    enqueueJob(genId);
    return gen;
  },
  listGenerations(opts: { type?: string; status?: string; q?: string; sort?: "newest" | "oldest"; page?: number; pageSize?: number } = {}) {
    const u = auth.requireUser(T());
    let rows = db.where<Generation>("generations", (g) => g.userId === u.id);
    if (opts.type && opts.type !== "all") rows = rows.filter((g) => g.type === opts.type);
    if (opts.status && opts.status !== "all") {
      rows = opts.status === "processing"
        ? rows.filter((g) => ["queued", "preparing", "generating", "processing"].includes(g.status))
        : rows.filter((g) => g.status === opts.status);
    }
    if (opts.q) rows = rows.filter((g) => g.prompt.toLowerCase().includes(opts.q!.toLowerCase()));
    rows.sort((a, b) => opts.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt));
    const page = opts.page ?? 1, pageSize = opts.pageSize ?? 24;
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
  },
  getGeneration(id: string) {
    const u = auth.requireUser(T());
    const g = db.get<Generation>("generations", id);
    if (!g || g.userId !== u.id) throw new ApiError("NOT_FOUND", "Generation not found.", 404);
    return g;
  },
  cancelGeneration(id: string) {
    const u = auth.requireUser(T());
    const g = this.getGeneration(id);
    if (!["queued", "preparing", "generating", "processing"].includes(g.status)) throw new ApiError("BAD_STATE", "This generation already finished.", 409);
    db.update("jobs", g.jobId, { requestedCancel: true } as any);
    return { ok: true };
  },
  async regenerate(id: string): Promise<Generation> {
    const g = this.getGeneration(id);
    return this.createGeneration({ type: g.type, prompt: g.prompt, params: g.params });
  },
  deleteGeneration(id: string) {
    const u = auth.requireUser(T());
    const g = this.getGeneration(id);
    if (g.assetId) {
      const a = db.get<any>("assets", g.assetId);
      if (a?.blobId) void blobStore.del(a.blobId);
      db.remove("assets", g.assetId);
    }
    db.remove("generations", id);
    db.remove("jobs", g.jobId);
  },

  // ── Assets ──
  listAssets(opts: { kind?: string; q?: string } = {}) {
    const u = auth.requireUser(T());
    let rows = db.where<Asset>("assets", (a) => a.userId === u.id);
    if (opts.kind && opts.kind !== "all") rows = rows.filter((a) => a.kind === opts.kind);
    if (opts.q) rows = rows.filter((a) => a.name.toLowerCase().includes(opts.q!.toLowerCase()) || (a.meta?.prompt ?? "").toLowerCase().includes(opts.q!.toLowerCase()));
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async uploadAsset(file: File, kind: AssetKind): Promise<Asset> {
    const u = auth.requireUser(T());
    const rules = UPLOAD_RULES[kind] ?? UPLOAD_RULES.image;
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!rules.exts.includes(ext)) throw new ApiError("BAD_EXT", `Unsupported file type "${ext}". Allowed: ${rules.exts.join(", ")}`, 415);
    if (!rules.mimes.includes(file.type)) throw new ApiError("BAD_MIME", `MIME "${file.type}" not allowed for ${kind}.`, 415);
    const maxMB = getAdminSettings().maxUploadMB;
    if (file.size > maxMB * 1024 * 1024) throw new ApiError("FILE_TOO_LARGE", `File too large (max ${maxMB} MB).`, 413);
    const blobId = uid();
    await blobStore.put(blobId, file);
    return db.insert("assets", {
      id: uid(), userId: u.id, kind, name: file.name.replace(/\.[^.]+$/, ""), mime: file.type, size: file.size,
      blobId, url: null, width: null, height: null, generationId: null, meta: {}, createdAt: nowIso(),
    });
  },
  deleteAsset(id: string) {
    const u = auth.requireUser(T());
    const a = db.get<Asset>("assets", id);
    if (!a || a.userId !== u.id) throw new ApiError("NOT_FOUND", "Asset not found.", 404);
    if (a.blobId) void blobStore.del(a.blobId);
    db.remove("assets", id);
  },
  getAsset(id: string): Asset {
    const u = auth.requireUser(T());
    const a = db.get<Asset>("assets", id);
    if (!a || a.userId !== u.id) throw new ApiError("NOT_FOUND", "Asset not found.", 404);
    return a;
  },
  async assetUrl(a: Asset): Promise<string | null> {
    if (a.url) return a.url;
    if (a.blobId) return blobUrl(a.blobId);
    return null;
  },
  downloadAsset: async (a: Asset) => {
    if (a.url) { window.open(a.url, "_blank"); return; }
    if (a.blobId) {
      const b = await blobStore.get(a.blobId);
      if (b) {
        const u = URL.createObjectURL(b);
        const el = document.createElement("a");
        el.href = u; el.download = `${a.name}.${a.mime.split("/")[1] ?? "bin"}`; el.click();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
      }
    }
  },

  // ── Characters ──
  listCharacters(): Character[] {
    const u = auth.requireUser(T());
    return db.where<Character>("characters", (c) => c.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  createCharacter(dto: { name: string; description: string; imageAssetId: string | null; videoAssetId: string | null; voice: string | null; meta: Record<string, any> }): Character {
    const u = auth.requireUser(T());
    if (!dto.name.trim()) throw new ApiError("INVALID", "Character name required.", 422);
    return db.insert("characters", {
      id: uid(), userId: u.id, name: dto.name.trim(), description: dto.description ?? "",
      imageAssetId: dto.imageAssetId, videoAssetId: dto.videoAssetId, voice: dto.voice,
      metadata: dto.meta ?? {}, createdAt: nowIso(), updatedAt: nowIso(),
    });
  },
  updateCharacter(id: string, patch: Partial<Character>) {
    const u = auth.requireUser(T());
    const c = db.get<Character>("characters", id);
    if (!c || c.userId !== u.id) throw new ApiError("NOT_FOUND", "Character not found.", 404);
    return db.update("characters", id, { ...patch, updatedAt: nowIso() } as any);
  },
  deleteCharacter(id: string) {
    const u = auth.requireUser(T());
    const c = db.get<Character>("characters", id);
    if (!c || c.userId !== u.id) throw new ApiError("NOT_FOUND", "Character not found.", 404);
    db.remove("characters", id);
  },

  // ── Providers ──
  providerRegistry: () => PROVIDER_REGISTRY,
  myConnections() {
    const u = auth.requireUser(T());
    return db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id)
      .map((c) => ({ ...c, keyMasked: c.keyEnc ? "••••••••" : null, keyEnc: undefined }));
  },
  async connectProvider(dto: { providerId: string; apiKey?: string; endpoint?: string; defaultModel?: string; extra?: Record<string, string> }) {
    const u = auth.requireUser(T());
    const def = providerDef(dto.providerId);
    if (!def) throw new ApiError("UNKNOWN_PROVIDER", "Unknown provider.", 404);
    const adapter = adapterFor(dto.providerId);
    const endpoint = dto.endpoint ? normalizeOllamaEndpoint(dto.endpoint) : null;
    const keyEnc = dto.apiKey ? await vault.encryptJSON({ k: dto.apiKey }) : null;
    const validation = await adapter.validate({ apiKey: dto.apiKey ?? null, endpoint, model: null, extra: dto.extra ?? {} });
    if (!validation.ok) throw new ApiError("VALIDATION_FAILED", validation.message, 400);

    const existing = db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id && c.providerId === dto.providerId)[0];
    let row: ProviderCredential;
    if (existing) {
      row = db.update("provider_credentials", existing.id, {
        keyEnc: keyEnc ?? existing.keyEnc, endpoint: endpoint ?? existing.endpoint,
        defaultModel: dto.defaultModel ?? existing.defaultModel, status: "connected", lastCheck: nowIso(), lastError: null,
        extra: { ...existing.extra, ...(dto.extra ?? {}) },
      } as any)!;
    } else {
      row = db.insert("provider_credentials", {
        id: uid(), userId: u.id, providerId: dto.providerId, label: def.name, keyEnc, endpoint,
        defaultModel: dto.defaultModel ?? null, status: "connected", lastCheck: nowIso(), latencyMs: null, lastError: null,
        billing: def.billing, extra: dto.extra ?? {}, createdAt: nowIso(), updatedAt: nowIso(),
      } satisfies ProviderCredential);
    }

    // Model discovery
    let discovered = 0;
    try {
      const models = await adapter.listModels({ apiKey: dto.apiKey ?? null, endpoint, model: null, extra: dto.extra ?? {} });
      db.where<ModelInfo>("models", (m) => m.providerId === dto.providerId && m.userId === u.id && m.source === "discovered")
        .forEach((m) => db.remove("models", m.id));
      models.slice(0, 250).forEach((m) => {
        db.insert("models", {
          id: `mdl-${u.id}-${dto.providerId}-${m.name}`, providerId: dto.providerId, userId: u.id,
          name: m.name, displayName: m.displayName, capabilities: m.capabilities, context: m.context ?? null,
          pricingNote: m.pricingNote ?? def.billing, supports: { seed: true }, enabled: true, source: "discovered", createdAt: nowIso(),
        });
        discovered++;
      });
      if (!row.defaultModel && dto.providerId === "ollama" && models.length) {
        db.update("provider_credentials", row.id, { defaultModel: models[0].name } as any);
      }
    } catch { /* best-effort */ }
    return { validation: validation.message, discovered };
  },
  async testConnection(credId: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    const res = await router.checkHealth(cred);
    db.update("provider_credentials", credId, { status: res.ok ? "connected" : "error", latencyMs: res.latencyMs, lastCheck: nowIso(), lastError: res.ok ? null : (res.message ?? "unreachable") } as any);
    if (!res.ok) throw new ApiError("HEALTH_FAIL", res.message ?? "Provider unreachable.", 503);
    return { latencyMs: res.latencyMs, message: `Healthy · ${res.latencyMs}ms` };
  },
  disconnectProvider(credId: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    db.where<ModelInfo>("models", (m) => m.providerId === cred.providerId && m.userId === u.id && m.source === "discovered")
      .forEach((m) => db.remove("models", m.id));
    db.remove("provider_credentials", credId);
  },
  async detectOllama(endpoint: string) {
    auth.requireUser(T());
    const adapter = adapterFor("ollama");
    const models = await adapter.listModels({ apiKey: null, endpoint: normalizeOllamaEndpoint(endpoint), model: null, extra: {} });
    return models;
  },
  listModels(filter: { providerId?: string; capability?: string } = {}) {
    const u = auth.requireUser(T());
    const connected = new Set(db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id).map((c) => c.providerId));
    const settings = getAdminSettings();
    let rows = db.where<ModelInfo>("models", (m) => m.userId === null || m.userId === u.id);
    rows = rows.filter((m) => {
      if (m.providerId === "simulator") return settings.mockEnabled;
      if (u.role === "admin") return true;
      return connected.has(m.providerId);
    });
    if (filter.providerId) rows = rows.filter((m) => m.providerId === filter.providerId);
    if (filter.capability) rows = rows.filter((m) => m.capabilities.includes(filter.capability as any));
    return rows.filter((m) => m.enabled !== false);
  },
  defaultModelFor: (providerId: string, task: TaskType) => defaultModelFor(providerId, task),

  async enhancePrompt(prompt: string, params: Record<string, any>): Promise<{ text: string; source: string }> {
    const u = auth.requireUser(T());
    const full = `Expand this into a structured professional prompt with Scene, Camera, Lighting, Character, Environment, Motion, Style sections. Request: ${prompt}`;
    try {
      const route = router.selectRoute(u.id, "text", params.providerId ?? "auto", params.model ?? null, { allowPaid: u.prefs.allowPaid });
      const result = await router.generate(u.id, route, { type: "text", prompt: full }, () => undefined);
      return { text: result.text ?? "", source: route.providerId };
    } catch {
      // Offline structured fallback
      return {
        text: `Scene: ${prompt}\nCamera: Cinematic slow dolly\nLighting: Soft key light, warm rim\nEnvironment: Detailed, atmospheric\nMotion: Smooth, purposeful\nStyle: Photorealistic, high detail`,
        source: "structured-template (no text provider connected)",
      };
    }
  },

  // ── Notifications & search ──
  notifications(): Notification[] {
    const u = auth.requireUser(T());
    return db.where<Notification>("notifications", (n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  unreadCount(): number {
    const u = auth.requireUser(T());
    return db.where<Notification>("notifications", (n) => n.userId === u.id && !n.read).length;
  },
  markNotificationsRead() {
    const u = auth.requireUser(T());
    db.where<Notification>("notifications", (n) => n.userId === u.id && !n.read).forEach((n) => db.update("notifications", n.id, { read: true } as any));
  },
  search(q: string) {
    const u = auth.requireUser(T());
    const ql = q.toLowerCase();
    return {
      gens: db.where<Generation>("generations", (g) => g.userId === u.id && g.prompt.toLowerCase().includes(ql)).slice(0, 5),
      chars: db.where<Character>("characters", (c) => c.userId === u.id && c.name.toLowerCase().includes(ql)).slice(0, 5),
    };
  },

  async savePoster(blob: Blob, meta: Record<string, any>) {
    const u = auth.requireUser(T());
    const blobId = uid();
    await blobStore.put(blobId, blob);
    return db.insert("assets", {
      id: uid(), userId: u.id, kind: "poster" as AssetKind, name: meta.title || "poster", mime: "image/png", size: blob.size,
      blobId, url: null, width: meta.width ?? null, height: meta.height ?? null, generationId: null, meta, createdAt: nowIso(),
    });
  },

  // ── Admin ──
  admin: {
    stats() {
      auth.requireAdmin(T());
      const gens = db.all<Generation>("generations");
      const users = db.all<User>("users");
      const byProvider: Record<string, number> = {};
      const byModel: Record<string, number> = {};
      gens.forEach((g) => {
        if (g.providerId) byProvider[g.providerId] = (byProvider[g.providerId] ?? 0) + 1;
        if (g.model) byModel[g.model] = (byModel[g.model] ?? 0) + 1;
      });
      return {
        users: users.length,
        activeUsers: users.filter((x) => !x.suspended).length,
        generations: gens.length,
        failed: gens.filter((g) => g.status === "failed").length,
        creditsUsed: db.all<any>("credit_accounts").reduce((s, a) => s + (a.used ?? 0), 0),
        byProvider, byModel,
      };
    },
    users() { auth.requireAdmin(T()); return db.all<User>("users"); },
    suspendUser(id: string, suspended: boolean) { auth.requireAdmin(T()); db.update("users", id, { suspended } as any); },
    async adjustCredits(userId: string, amount: number, note: string) {
      auth.requireAdmin(T());
      await creditEngine.credit(userId, amount, "admin_adjustment", note, true);
    },
    jobs() { auth.requireAdmin(T()); return db.all<Job>("jobs").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100); },
    pricing() { auth.requireAdmin(T()); return db.all<PricingRule>("pricing_rules"); },
    upsertPricing(rule: PricingRule) {
      auth.requireAdmin(T());
      if (rule.id && db.get("pricing_rules", rule.id)) db.update("pricing_rules", rule.id, rule as any);
      else db.insert("pricing_rules", { ...rule, id: rule.id || uid() });
    },
    deletePricing(id: string) { auth.requireAdmin(T()); db.remove("pricing_rules", id); },
    getSettings(): AdminSettings { auth.requireAdmin(T()); return getAdminSettings(); },
    updateSettings(patch: Partial<AdminSettings>) {
      auth.requireAdmin(T());
      const s = getAdminSettings();
      db.setMany("admin_settings", [{ id: "settings", ...s, ...patch }]);
    },
    allConnections() {
      auth.requireAdmin(T());
      return db.all<ProviderCredential>("provider_credentials").map((c) => ({ ...c, keyEnc: c.keyEnc ? "[encrypted]" : null }));
    },
  },
};

export type SafeUser = ReturnType<typeof api.me>;
export type SafeConnection = ReturnType<typeof api.myConnections>[number];
