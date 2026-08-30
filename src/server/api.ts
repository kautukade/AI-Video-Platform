import { z } from "zod";
import {
  AdminSettings, ApiError, Asset, AssetKind, Character, CreditTx, Generation, ModelInfo, Notification,
  PricingRule, ProviderCredential, TaskType, User,
} from "../lib/types";
import { fmtNum, maskKey, nowIso, uid } from "../lib/utils";
import { auth, creditEngine, localToken } from "./auth";
import { blobStore, blobUrl, db, ensureSeed, getAdminSettings } from "./db";
import { enqueueJob, onGenEvent, router, startWorker, capabilityForTask, defaultModelFor } from "./ai/router";
import { ADAPTERS, adapterFor, normalizeOllamaEndpoint, PROVIDER_REGISTRY } from "./ai/providers";

let booted = false;
export async function boot() {
  if (booted) return;
  await ensureSeed();
  startWorker();
  // Pollinations is free & keyless — auto-connect once so image/text work instantly.
  try { autoConnectPollinations(); } catch { /* optional */ }
  booted = true;
}
function autoConnectPollinations() {
  const admin = db.all<User>("users").find((x) => x.email === "admin@studio.local");
  if (!admin) return;
  const existing = db.where<ProviderCredential>("provider_credentials", (c) => c.providerId === "pollinations")[0];
  if (existing) return;
  db.insert("provider_credentials", {
    id: uid(), userId: admin.id, providerId: "pollinations", label: "Pollinations (free · auto)",
    keyEnc: null, endpoint: null, defaultModel: "flux", status: "connected", lastCheck: nowIso(),
    latencyMs: null, lastError: null, billing: "free", extra: {}, createdAt: nowIso(), updatedAt: nowIso(),
  });
}

export const subscribeGenerations = onGenEvent;
const T = () => localToken.get();

const GenerationDTO = z.object({
  type: z.enum(["image", "video", "poster", "character", "text", "audio"]),
  prompt: z.string().trim().min(3, "Describe what you want to create (min 3 characters).").max(6000),
  params: z.record(z.string(), z.any()).optional().default({} as Record<string, any>),
});

const UPLOAD_RULES: Record<AssetKind, { mimes: string[]; exts: string[] }> = {
  image: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: ["png", "jpg", "jpeg", "webp"] },
  video: { mimes: ["video/mp4", "video/quicktime", "video/webm"], exts: ["mp4", "mov", "webm"] },
  poster: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: ["png", "jpg", "jpeg", "webp"] },
  character_image: { mimes: ["image/png", "image/jpeg", "image/webp"], exts: ["png", "jpg", "jpeg", "webp"] },
  character_video: { mimes: ["video/mp4", "video/quicktime", "video/webm"], exts: ["mp4", "mov", "webm"] },
  logo: { mimes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"], exts: ["png", "jpg", "jpeg", "webp", "svg"] },
  audio: { mimes: ["audio/mpeg", "audio/wav", "audio/webm"], exts: ["mp3", "wav", "webm"] },
};

function notifyUser(userId: string, title: string, body: string, kind: Notification["kind"], link: string | null) {
  db.insert("notifications", { id: uid(), userId, title, body, kind, read: false, link, createdAt: nowIso() });
}

export const api = {
  boot,
  subscribeGenerations,

  platformMode() {
    const s = getAdminSettings();
    return { unlimited: s.unlimitedMode === true, simulatorEnabled: s.mockEnabled };
  },

  /** Local-first: no sign-in screen — opens the built-in workspace account. */
  async autoLocalLogin() {
    const existing = auth.me(localToken.get());
    if (existing) return { token: localToken.get()!, user: existing };
    const local = db.all<User>("users").find((x) => x.email === "admin@studio.local");
    if (!local) throw new ApiError("NO_LOCAL", "Local workspace account missing — clear site data & reload.", 500);
    return auth.login(local.email, "admin1234");
  },

  me: () => auth.me(T()),
  logout: () => auth.logout(T()),
  changePassword: (cur: string, next: string) => auth.changePassword(T()!, cur, next),

  updateProfile(name: string, email: string) {
    const u = auth.requireUser(T());
    if (!name.trim()) throw new ApiError("BAD_INPUT", "Name cannot be empty.", 422);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError("BAD_INPUT", "Invalid email.", 422);
    const dupe = db.where<User>("users", (x) => x.email.toLowerCase() === email.toLowerCase() && x.id !== u.id)[0];
    if (dupe) throw new ApiError("TAKEN", "Email already in use.", 409);
    db.update("users", u.id, { name: name.trim(), email });
  },
  updatePrefs(patch: Partial<User["prefs"]>) {
    const u = auth.requireUser(T());
    const full = db.get<User>("users", u.id)!;
    db.update("users", u.id, { prefs: { ...full.prefs, ...patch } });
  },
  completeOnboarding(purpose: string | null) {
    const u = auth.requireUser(T());
    db.update("users", u.id, { onboarded: true, purpose } as any);
  },
  deleteAccount(confirmEmail: string) {
    const u = auth.requireUser(T());
    const full = db.get<User>("users", u.id)!;
    if (confirmEmail.trim().toLowerCase() !== full.email.toLowerCase()) throw new ApiError("CONFIRM", "Email does not match — account not deleted.", 422);
    db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id).forEach((c) => db.remove("provider_credentials", c.id));
    db.where<Character>("characters", (c) => c.userId === u.id).forEach((c) => db.remove("characters", c.id));
    db.where<Generation>("generations", (g) => g.userId === u.id).forEach((g) => db.remove("generations", g.id));
    db.where<Asset>("assets", (a) => a.userId === u.id).forEach((a) => { if (a.blobId) void blobStore.del(a.blobId); db.remove("assets", a.id); });
    db.where<Notification>("notifications", (n) => n.userId === u.id).forEach((n) => db.remove("notifications", n.id));
    db.where<CreditTx>("credit_transactions", (t) => t.userId === u.id).forEach((t) => db.remove("credit_transactions", t.id));
    db.remove("credit_accounts", u.id as any);
    db.where<any>("sessions", (s) => s.userId === u.id).forEach((s) => db.remove("sessions", s.id));
    db.update("users", u.id, { email: `deleted-${u.id}@anonymized.local`, name: "Deleted User", passHash: "x", salt: "x", purpose: null });
    auth.logout(T());
  },

  creditSummary() {
    const u = auth.requireUser(T());
    const acc = creditEngine.account(u.id);
    return { balance: acc.balance, lifetime: acc.lifetime, used: acc.used };
  },
  creditTransactions(): CreditTx[] {
    const u = auth.requireUser(T());
    return creditEngine.transactions(u.id);
  },
  async devTopUp() {
    const u = auth.requireUser(T());
    await creditEngine.credit(u.id, 500, "bonus", "Development top-up");
  },

  estimate(dto: { type: TaskType; providerId: string | null; model: string | null; params: Record<string, any> }) {
    auth.requireUser(T());
    const pid = dto.providerId === "auto" || !dto.providerId ? null : dto.providerId;
    return creditEngine.calculate({
      taskType: dto.type, providerId: pid, model: dto.model,
      durationSec: dto.params.duration, width: dto.params.width, height: dto.params.height,
      quality: dto.params.quality, resolution: dto.params.resolution, count: dto.params.count,
    });
  },

  async createGeneration(input: { type: TaskType; prompt: string; params: Record<string, any> }): Promise<Generation> {
    const u = auth.requireUser(T());
    const dto = GenerationDTO.parse(input);
    const params = dto.params ?? {};
    const settings = getAdminSettings();
    if (settings.maintenanceMode && u.role !== "admin") throw new ApiError("MAINTENANCE", "Studio is in maintenance mode.", 503);

    const route = router.selectRoute(u.id, dto.type, params.providerId ?? "auto", params.model ?? null, {
      allowPaid: u.prefs.allowPaid, defaultProvider: u.prefs.defaultProvider, defaultModel: u.prefs.defaultModel,
    });
    const est = creditEngine.calculate({
      taskType: dto.type, providerId: route.providerId, model: route.model,
      durationSec: params.duration, width: params.width, height: params.height,
      quality: params.quality, resolution: params.resolution, count: params.count,
    });
    const genId = uid();
    await creditEngine.reserve(u.id, est.credits, genId, `${dto.type} · ${route.providerId}`);
    const job = db.insert("jobs", {
      id: uid(), userId: u.id, generationId: genId, status: "queued", stage: "Queued", requestedCancel: false,
      createdAt: nowIso(), startedAt: null, finishedAt: null, error: null,
    });
    const gen = db.insert("generations", {
      id: genId, userId: u.id, jobId: job.id, type: dto.type, status: "queued", prompt: dto.prompt, params,
      providerId: route.providerId, model: route.model, simulated: route.providerId === "simulator",
      creditEstimate: est.credits, creditFinal: null, assetId: null, error: null, errorCode: null,
      stages: [{ stage: "Queued", at: nowIso(), honest: true }], createdAt: nowIso(), updatedAt: nowIso(),
    } satisfies Generation);
    enqueueJob(gen.id);
    return gen;
  },

  listGenerations(opts: { type?: string; status?: string; q?: string; sort?: "newest" | "oldest"; page?: number; pageSize?: number } = {}) {
    const u = auth.requireUser(T());
    let rows = db.where<Generation>("generations", (g) => g.userId === u.id);
    if (opts.type) rows = rows.filter((g) => g.type === opts.type);
    if (opts.status) rows = rows.filter((g) => (opts.status === "processing" ? ["queued", "preparing", "generating", "processing"].includes(g.status) : g.status === opts.status));
    if (opts.q) rows = rows.filter((g) => g.prompt.toLowerCase().includes(opts.q!.toLowerCase()));
    rows.sort((a, b) => (opts.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
    const pageSize = opts.pageSize ?? 24;
    const page = opts.page ?? 1;
    return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length };
  },
  getGeneration(id: string): Generation {
    const u = auth.requireUser(T());
    const g = db.get<Generation>("generations", id);
    if (!g || g.userId !== u.id) throw new ApiError("NOT_FOUND", "Generation not found.", 404);
    return g;
  },
  cancelGeneration(id: string) {
    const u = auth.requireUser(T());
    const g = this.getGeneration(id);
    const job = db.get<any>("jobs", g.jobId);
    if (!job || ["completed", "failed", "cancelled"].includes(job.status)) throw new ApiError("DONE", "This job already finished.", 409);
    db.update("jobs", job.id, { requestedCancel: true } as any);
    if (job.status === "queued") {
      db.update("jobs", job.id, { status: "cancelled", finishedAt: nowIso() } as any);
      db.update("generations", id, { status: "cancelled", updatedAt: nowIso() } as any);
      void creditEngine.refund(u.id, g.creditEstimate, id, "cancelled before start");
    }
  },
  async regenerate(id: string): Promise<Generation> {
    const u = auth.requireUser(T());
    const g = this.getGeneration(id);
    return this.createGeneration({ type: g.type, prompt: g.prompt, params: { ...g.params, seed: g.params.seed != null ? g.params.seed + 1 : undefined } });
  },
  deleteGeneration(id: string) {
    const u = auth.requireUser(T());
    const g = this.getGeneration(id);
    if (g.assetId) {
      const a = db.get<Asset>("assets", g.assetId);
      if (a && a.userId === u.id) { if (a.blobId) void blobStore.del(a.blobId); db.remove("assets", a.id); }
    }
    db.remove("generations", id);
    db.remove("jobs", g.jobId);
  },

  listAssets(opts: { kind?: string; q?: string; sort?: string } = {}): Asset[] {
    const u = auth.requireUser(T());
    let rows = db.where<Asset>("assets", (a) => a.userId === u.id);
    if (opts.kind) rows = rows.filter((a) => a.kind === opts.kind || (opts.kind === "video" && a.kind === "character_video"));
    if (opts.q) rows = rows.filter((a) => a.name.toLowerCase().includes(opts.q!.toLowerCase()));
    rows.sort((a, b) => (opts.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
    return rows;
  },
  async uploadAsset(file: File, kind: AssetKind): Promise<Asset> {
    const u = auth.requireUser(T());
    const rule = UPLOAD_RULES[kind];
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!rule.exts.includes(ext)) throw new ApiError("BAD_EXT", `Unsupported file type ".${ext}". Allowed: ${rule.exts.join(", ")}.`, 415);
    if (!rule.mimes.includes(file.type) && file.type !== "") throw new ApiError("BAD_MIME", `MIME type "${file.type}" not allowed for ${kind.replace("_", " ")}.`, 415);
    const maxMB = getAdminSettings().maxUploadMB;
    if (file.size > maxMB * 1024 * 1024) throw new ApiError("FILE_TOO_LARGE", `File is ${(file.size / 1e6).toFixed(1)} MB — limit is ${maxMB} MB.`, 413);
    const blobId = uid();
    await blobStore.put(blobId, file);
    return db.insert("assets", {
      id: uid(), userId: u.id, kind, name: file.name.replace(/\.[^.]+$/, "").slice(0, 60), mime: file.type || `application/${ext}`,
      size: file.size, blobId, url: null, width: null, height: null, generationId: null, meta: { originalName: file.name }, createdAt: nowIso(),
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

  listCharacters(): Character[] {
    const u = auth.requireUser(T());
    return db.where<Character>("characters", (c) => c.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  createCharacter(input: { name: string; description: string; imageAssetId: string | null; videoAssetId: string | null; voice: string | null; metadata?: Record<string, any> }): Character {
    const u = auth.requireUser(T());
    if (!input.name.trim()) throw new ApiError("BAD_INPUT", "Character needs a name.", 422);
    return db.insert("characters", {
      id: uid(), userId: u.id, name: input.name.trim(), description: input.description, imageAssetId: input.imageAssetId,
      videoAssetId: input.videoAssetId, voice: input.voice, metadata: input.metadata ?? {}, createdAt: nowIso(), updatedAt: nowIso(),
    });
  },
  updateCharacter(id: string, patch: Partial<Character>) {
    const u = auth.requireUser(T());
    const c = db.get<Character>("characters", id);
    if (!c || c.userId !== u.id) throw new ApiError("NOT_FOUND", "Character not found.", 404);
    return db.update("characters", id, { ...patch, updatedAt: nowIso() });
  },
  deleteCharacter(id: string) {
    const u = auth.requireUser(T());
    const c = db.get<Character>("characters", id);
    if (!c || c.userId !== u.id) throw new ApiError("NOT_FOUND", "Character not found.", 404);
    db.remove("characters", id);
  },

  providerRegistry: () => PROVIDER_REGISTRY,
  myConnections() {
    const u = auth.requireUser(T());
    return db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id).map((c) => ({
      id: c.id, providerId: c.providerId, label: c.label, status: c.status, latencyMs: c.latencyMs,
      lastError: c.lastError, defaultModel: c.defaultModel, endpoint: c.endpoint, billing: c.billing,
      keyMask: c.keyEnc ? "•••• stored encrypted" : null, lastCheck: c.lastCheck,
    }));
  },

  async connectProvider(dto: { providerId: string; apiKey?: string; endpoint?: string; defaultModel?: string; extra?: Record<string, string> }) {
    const u = auth.requireUser(T());
    const def = PROVIDER_REGISTRY.find((p) => p.id === dto.providerId);
    if (!def) throw new ApiError("UNKNOWN_PROVIDER", `Unknown provider "${dto.providerId}".`, 404);
    const adapter = adapterFor(dto.providerId);
    const needsKey = def.auth !== "none";
    const existing = db.where<ProviderCredential>("provider_credentials", (c) => c.userId === u.id && c.providerId === dto.providerId)[0];
    if (needsKey && !dto.apiKey && !existing?.keyEnc) throw new ApiError("KEY_REQUIRED", `${def.name} needs an API key.`, 422);

    let keyEnc = existing?.keyEnc ?? null;
    if (dto.apiKey) keyEnc = await import("./db").then(({ vault }) => vault.encryptJSON({ k: dto.apiKey }));
    const endpoint = dto.endpoint ? (dto.providerId === "ollama" ? normalizeOllamaEndpoint(dto.endpoint) : dto.endpoint.replace(/\/+$/, "")) : existing?.endpoint ?? null;

    const validation = await adapter.validate({ apiKey: dto.apiKey ?? (keyEnc ? await (await import("./db")).vault.decryptJSON<{ k: string }>(keyEnc).then((x) => x.k).catch(() => null) : null), endpoint, model: null, extra: dto.extra ?? {} });
    if (!validation.ok) {
      if (existing) db.update("provider_credentials", existing.id, { status: "error", lastError: validation.message, lastCheck: nowIso() } as any);
      throw new ApiError("VALIDATION_FAILED", validation.message, 502);
    }

    let row: ProviderCredential;
    if (existing) {
      row = db.update("provider_credentials", existing.id, {
        keyEnc, endpoint, status: "connected", lastError: null, lastCheck: nowIso(),
        defaultModel: dto.defaultModel || existing.defaultModel || null, extra: { ...(existing.extra ?? {}), ...(dto.extra ?? {}) }, updatedAt: nowIso(),
      } as any)!;
    } else {
      row = db.insert("provider_credentials", {
        id: uid(), userId: u.id, providerId: dto.providerId, label: def.name, keyEnc,
        endpoint, defaultModel: dto.defaultModel || defaultModelFor(dto.providerId, "text") || null,
        status: "connected", lastCheck: nowIso(), latencyMs: null, lastError: null, billing: def.billing,
        extra: dto.extra ?? {}, createdAt: nowIso(), updatedAt: nowIso(),
      });
    }

    // Model discovery (best-effort).
    let discovered = 0;
    try {
      const key = keyEnc ? await (await import("./db")).vault.decryptJSON<{ k: string }>(keyEnc).then((x) => x.k) : null;
      const models = await adapter.listModels({ apiKey: key, endpoint, model: null, extra: dto.extra ?? {} });
      db.where<ModelInfo>("models", (m) => m.providerId === dto.providerId && m.userId === u.id && m.source === "discovered").forEach((m) => db.remove("models", m.id));
      models.slice(0, 250).forEach((m) => {
        db.insert("models", {
          id: `mdl-${u.id}-${dto.providerId}-${m.name}`, providerId: dto.providerId, userId: u.id, name: m.name,
          displayName: m.displayName, capabilities: m.capabilities, context: m.context ?? null, pricingNote: m.pricingNote ?? def.billing,
          supports: { seed: true }, enabled: true, source: "discovered", createdAt: nowIso(),
        });
        discovered++;
      });
      if (!row.defaultModel && dto.providerId === "ollama" && models.length) db.update("provider_credentials", row.id, { defaultModel: models[0].name } as any);
    } catch { /* catalog models remain */ }
    return { validation: validation.message, discovered };
  },

  async testConnection(credId: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    const res = await router.checkHealth(cred);
    db.update("provider_credentials", credId, { status: res.ok ? "connected" : "error", latencyMs: res.ok ? res.latencyMs : cred.latencyMs, lastCheck: nowIso(), lastError: res.ok ? null : res.message ?? "unreachable" } as any);
    if (!res.ok) throw new ApiError("HEALTH_FAIL", res.message ?? "Provider unreachable.", 503);
    return { latencyMs: res.latencyMs, message: `Connected · ${res.latencyMs}ms` };
  },
  async refreshModels(credId: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    const key = cred.keyEnc ? await (await import("./db")).vault.decryptJSON<{ k: string }>(cred.keyEnc).then((x) => x.k) : null;
    const adapter = adapterFor(cred.providerId);
    const models = await adapter.listModels({ apiKey: key, endpoint: cred.endpoint, model: null, extra: cred.extra });
    db.where<ModelInfo>("models", (m) => m.providerId === cred.providerId && m.userId === u.id && m.source === "discovered").forEach((m) => db.remove("models", m.id));
    models.forEach((m) => db.insert("models", {
      id: `mdl-${u.id}-${cred.providerId}-${m.name}`, providerId: cred.providerId, userId: u.id, name: m.name, displayName: m.displayName,
      capabilities: m.capabilities, context: m.context ?? null, pricingNote: m.pricingNote ?? "", supports: { seed: true }, enabled: true, source: "discovered", createdAt: nowIso(),
    }));
    return models.length;
  },
  disconnectProvider(credId: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    db.remove("provider_credentials", credId);
    db.where<ModelInfo>("models", (m) => m.providerId === cred.providerId && m.userId === u.id && m.source === "discovered").forEach((m) => db.remove("models", m.id));
  },
  async rotateKey(credId: string, newKey: string) {
    const u = auth.requireUser(T());
    const cred = db.get<ProviderCredential>("provider_credentials", credId);
    if (!cred || cred.userId !== u.id) throw new ApiError("NOT_FOUND", "Connection not found.", 404);
    const { vault } = await import("./db");
    db.update("provider_credentials", credId, { keyEnc: await vault.encryptJSON({ k: newKey }), status: "connected", lastError: null, updatedAt: nowIso() } as any);
  },
  async detectOllama(endpoint: string) {
    auth.requireUser(T());
    const adapter = adapterFor("ollama");
    return adapter.listModels({ apiKey: null, endpoint: normalizeOllamaEndpoint(endpoint), model: null, extra: {} });
  },

  listModels(filter: { providerId?: string; capability?: string } = {}): ModelInfo[] {
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

  async enhancePrompt(prompt: string, params: Record<string, any>): Promise<{ text: string; source: string }> {
    const u = auth.requireUser(T());
    const sys = `You are a professional AI video/image prompt engineer. Convert the user's brief into a structured production prompt with lines: SCENE, CAMERA, LIGHTING, CHARACTER, ENVIRONMENT, DIALOGUE, MOTION, STYLE. Keep it under 180 words, no markdown.`;
    const full = `${sys}\n\nBrief: ${prompt}\nContext: style=${params.style ?? "cinematic"}, duration=${params.duration ?? 10}s`;
    const route = router.selectRoute(u.id, "text", params.providerId ?? "auto", null, { allowPaid: u.prefs.allowPaid });
    const adapter = adapterFor(route.providerId);
    const key = route.credential?.keyEnc ? await (await import("./db")).vault.decryptJSON<{ k: string }>(route.credential.keyEnc).then((x) => x.k) : null;
    const res = await adapter.generate(
      { apiKey: key, endpoint: route.credential?.endpoint ?? null, model: route.model, extra: route.credential?.extra ?? {} },
      { type: "text", prompt: full, modelHint: route.model },
      () => undefined,
    );
    if (!res.text) throw new ApiError("EMPTY_OUTPUT", "The text engine returned nothing.", 502);
    return { text: res.text, source: `${route.providerId} · ${route.model}` };
  },

  notifications(): Notification[] {
    const u = auth.requireUser(T());
    return db.where<Notification>("notifications", (n) => n.userId === u.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  markNotificationsRead() {
    const u = auth.requireUser(T());
    db.where<Notification>("notifications", (n) => n.userId === u.id && !n.read).forEach((n) => db.update("notifications", n.id, { read: true } as any));
  },

  search(q: string) {
    const u = auth.requireUser(T());
    const needle = q.toLowerCase();
    return {
      gens: db.where<Generation>("generations", (g) => g.userId === u.id && g.prompt.toLowerCase().includes(needle)).slice(0, 6),
      chars: db.where<Character>("characters", (c) => c.userId === u.id && c.name.toLowerCase().includes(needle)).slice(0, 4),
    };
  },

  async savePoster(blob: Blob, meta: Record<string, any>): Promise<Asset> {
    const u = auth.requireUser(T());
    const blobId = uid();
    await blobStore.put(blobId, blob);
    return db.insert("assets", {
      id: uid(), userId: u.id, kind: "poster", name: meta.title ? String(meta.title).slice(0, 60) : "poster", mime: "image/png",
      size: blob.size, blobId, url: null, width: meta.width ?? null, height: meta.height ?? null, generationId: null, meta, createdAt: nowIso(),
    });
  },

  // ── Admin ──
  admin: {
    stats() {
      auth.requireAdmin(T());
      const users = db.all<User>("users");
      const gens = db.all<Generation>("generations");
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
        recent: db.all<any>("usage_logs").slice(-40).reverse(),
      };
    },
    users() {
      auth.requireAdmin(T());
      return db.all<User>("users").map((x) => ({ ...x, passHash: "•", salt: "•" }));
    },
    async adjustCredits(userId: string, amount: number, note: string) {
      auth.requireAdmin(T());
      if (!Number.isFinite(amount) || amount === 0) throw new ApiError("BAD_INPUT", "Amount must be a non-zero number.", 422);
      await creditEngine.credit(userId, amount, "admin_adjustment", note || "Admin adjustment", true);
    },
    setUserRole(userId: string, role: "user" | "admin") { auth.requireAdmin(T()); db.update("users", userId, { role }); },
    suspendUser(userId: string, suspended: boolean) { auth.requireAdmin(T()); db.update("users", userId, { suspended }); },
    jobs() {
      auth.requireAdmin(T());
      return db.all<any>("jobs").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 60);
    },
    allConnections() {
      auth.requireAdmin(T());
      return db.all<ProviderCredential>("provider_credentials").map((c) => ({ ...c, keyEnc: c.keyEnc ? "[encrypted]" : null }));
    },
    pricing(): PricingRule[] { auth.requireAdmin(T()); return db.all<PricingRule>("pricing_rules"); },
    upsertPricing(rule: PricingRule) {
      auth.requireAdmin(T());
      if (!rule.id) rule.id = uid();
      const ex = db.get<PricingRule>("pricing_rules", rule.id);
      if (ex) db.update("pricing_rules", rule.id, rule as any); else db.insert("pricing_rules", rule);
    },
    deletePricing(id: string) { auth.requireAdmin(T()); db.remove("pricing_rules", id); },
    setModelEnabled(modelId: string, enabled: boolean) { auth.requireAdmin(T()); db.update("models", modelId, { enabled } as any); },
    getSettings(): AdminSettings { auth.requireAdmin(T()); return getAdminSettings(); },
    updateSettings(patch: Partial<AdminSettings>) { auth.requireAdmin(T()); db.update("admin_settings", "settings", patch as any); },
    usageLogs() { auth.requireAdmin(T()); return db.all<any>("usage_logs").slice(-200).reverse(); },
  },
};

export type SafeUser = ReturnType<typeof api.me>;
export type SafeConnection = ReturnType<typeof api.myConnections>[number];
export { capabilityForTask, defaultModelFor, maskKey, fmtNum, ADAPTERS };
