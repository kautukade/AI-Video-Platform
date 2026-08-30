import {
  ApiError, Capability, Generation, Job, JobStatus, ProviderCredential, StageEvent, TaskType, User,
} from "../../lib/types";
import { nowIso, uid } from "../../lib/utils";
import { blobStore, blobUrl, db, getAdminSettings } from "../db";
import { auth, creditEngine } from "../auth";
import { adapterFor, providerDef, ADAPTERS, normalizeOllamaEndpoint } from "./providers";
import { vault } from "../db";

export interface Route { providerId: string; model: string; credential: ProviderCredential | null; billing: string; }

export const capabilityForTask = (t: TaskType): Capability =>
  t === "image" ? "image" : t === "video" ? "video" : t === "character" ? "video" : t === "poster" ? "image" : t === "audio" ? "audio" : "text";

const RETRYABLE = new Set(["NETWORK", "PROVIDER_DOWN", "RATE_LIMITED", "MODEL_LOADING", "TIMEOUT", "PROVIDER_ERROR", "EMPTY_OUTPUT", "UNSUPPORTED_OUTPUT", "ASSET_FETCH", "MODEL_UNAVAILABLE"]);

export async function decryptKey(cred: ProviderCredential): Promise<string | null> {
  if (!cred.keyEnc) return null;
  try { return (await vault.decryptJSON<{ k: string }>(cred.keyEnc)).k; } catch { return null; }
}

/** Best free-first default per provider & capability. */
const PROVIDER_DEFAULTS: Record<string, Record<string, string>> = {
  pollinations: { image: "flux", text: "openai" },
  ollama: { text: "llama3.2", vision: "llama3.2-vision" },
  huggingface: { image: "black-forest-labs/FLUX.1-schnell", text: "mistralai/Mistral-7B-Instruct-v0.3", video: "Lightricks/LTX-Video", audio: "microsoft/speecht5_tts" },
  google: { text: "gemini-2.5-flash", image: "gemini-2.5-flash-image-preview", vision: "gemini-2.5-flash" },
  openrouter: { text: "meta-llama/llama-3.3-70b-instruct:free", image: "google/gemini-2.5-flash-image" },
  groq: { text: "llama-3.3-70b-versatile" },
  cerebras: { text: "llama-3.3-70b" },
  deepseek: { text: "deepseek-chat" },
  mistral: { text: "mistral-small-latest" },
  together: { text: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  nvidia: { text: "meta/llama-3.1-70b-instruct", video: "lightricks/ltx-video" },
  replicate: { video: "lucataco/ltx-video-13b-distilled", image: "black-forest-labs/flux-schnell" },
  luma: { video: "photon-1" },
  custom: { text: "gpt-4o-mini" },
  simulator: { text: "studio-sim-v1", image: "studio-sim-v1", video: "studio-sim-v1", character: "studio-sim-v1", poster: "studio-sim-v1", audio: "studio-sim-v1" },
};

export function defaultModelFor(providerId: string, task: TaskType): string {
  const cap = capabilityForTask(task);
  const pinned = PROVIDER_DEFAULTS[providerId]?.[cap] ?? PROVIDER_DEFAULTS[providerId]?.[task];
  if (pinned) return pinned;
  const models = db.where<any>("models", (m) => m.providerId === providerId && m.enabled !== false);
  const withCap = models.filter((m) => m.capabilities.includes(cap));
  const free = withCap.find((m) => /FREE/i.test(m.pricingNote ?? ""));
  return free?.name ?? withCap[0]?.name ?? models[0]?.name ?? "";
}

// ── Realtime event bus (SSE/WebSocket analogue) ──
const subs = new Set<(genId: string) => void>();
export function onGenEvent(cb: (genId: string) => void): () => void {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
function emitGen(genId: string) { subs.forEach((cb) => { try { cb(genId); } catch { /* noop */ } }); }

export const router = {
  userCredentials(userId: string): ProviderCredential[] {
    return db.where<ProviderCredential>("provider_credentials", (c) => c.userId === userId && c.providerId !== "simulator");
  },
  providerSupports(providerId: string, task: TaskType): boolean {
    if (providerId === "simulator") return ["image", "video", "character", "text", "poster"].includes(task);
    const def = providerDef(providerId);
    if (!def) return false;
    return def.capabilities.includes(capabilityForTask(task));
  },

  candidates(userId: string, task: TaskType, requestedProvider: string | null, model: string | null, prefs: { allowPaid: boolean; defaultProvider?: string | null; defaultModel?: string | null }): { routes: Route[]; notes: string[] } {
    const routes: Route[] = [];
    const notes: string[] = [];
    const settings = getAdminSettings();
    const creds = this.userCredentials(userId);
    const pushCred = (c: ProviderCredential, mdl: string | null) => {
      const def = providerDef(c.providerId)!;
      if (def.billing === "paid" && !prefs.allowPaid) {
        notes.push(`${def.name} skipped — paid provider. Enable in Settings → Cost Safety.`);
        return;
      }
      routes.push({ providerId: c.providerId, model: mdl || c.defaultModel || defaultModelFor(c.providerId, task), credential: c, billing: def.billing });
    };

    if (requestedProvider && requestedProvider !== "auto") {
      if (requestedProvider === "simulator") {
        if (!settings.mockEnabled) throw new ApiError("SIM_DISABLED", "The Local Simulator is disabled by an administrator.", 403);
        routes.push({ providerId: "simulator", model: model ?? "studio-sim-v1", credential: null, billing: "free" });
        return { routes, notes };
      }
      const c = creds.find((x) => x.providerId === requestedProvider);
      if (!c) throw new ApiError("NOT_CONNECTED", `Connect ${providerDef(requestedProvider)?.name ?? requestedProvider} first in AI Providers.`, 412);
      pushCred(c, model);
      return { routes, notes };
    }

    // AUTO — capability first, best-result affinity, free before paid, latency.
    const aff = (pid: string): number => {
      const table: Record<string, Record<string, number>> = {
        image: { pollinations: 4, huggingface: 3, google: 2, openrouter: 1, replicate: 1 },
        poster: { pollinations: 4, huggingface: 3, google: 2, openrouter: 1 },
        text: { ollama: 4, pollinations: 3, google: 2, openrouter: 2, groq: 2, huggingface: 1 },
        video: { replicate: 5, luma: 4, nvidia: 4, huggingface: 2 },
        character: { replicate: 5, luma: 4, nvidia: 3, huggingface: 2 },
        audio: { huggingface: 3 },
      };
      return table[task]?.[pid] ?? 2;
    };
    const usable = creds.filter((c) => c.status !== "error" && this.providerSupports(c.providerId, task));
    usable
      .sort((a, b) => {
        if (aff(b.providerId) !== aff(a.providerId)) return aff(b.providerId) - aff(a.providerId);
        const pa = providerDef(a.providerId)?.billing === "free" ? 0 : 1;
        const pb = providerDef(b.providerId)?.billing === "free" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.latencyMs ?? 9999) - (b.latencyMs ?? 9999);
      })
      .forEach((c) => pushCred(c, model ?? (c.providerId === prefs.defaultProvider ? prefs.defaultModel ?? null : null)));
    if (settings.mockEnabled && this.providerSupports("simulator", task)) {
      routes.push({ providerId: "simulator", model: "studio-sim-v1", credential: null, billing: "free" });
    }
    return { routes, notes };
  },

  selectRoute(userId: string, task: TaskType, requestedProvider: string | null, model: string | null, prefs: { allowPaid: boolean; defaultProvider?: string | null; defaultModel?: string | null }): Route {
    const { routes, notes } = this.candidates(userId, task, requestedProvider, model ?? null, { allowPaid: prefs.allowPaid });
    if (!routes.length) {
      throw new ApiError(
        "NO_PROVIDER",
        `No connected provider supports ${task} generation${notes.length ? ` — ${notes[0]}` : ""}. ` +
          (task === "video" || task === "character"
            ? `Video ke liye ek free provider connect karo — studio ke Setup Wizard me Hugging Face, Replicate, Luma ya NVIDIA NIM ki free key daal do. Ollama text-only hai.`
            : `Connect ${task === "image" || task === "poster" ? "Pollinations, Hugging Face or OpenRouter" : "Pollinations, Ollama, Groq or OpenRouter"} in AI Providers — sab free hain.`),
        412
      );
    }
    return routes[0];
  },

  fallbackChain(userId: string, task: TaskType, requestedProvider: string | null, model: string | null, prefs: { allowPaid: boolean; allowPaidFallback: boolean }): Route[] {
    const { routes } = this.candidates(userId, task, requestedProvider, model, { allowPaid: prefs.allowPaid });
    if (requestedProvider && requestedProvider !== "auto") return routes; // explicit choice = no silent switching
    // Free routes always allowed; paid fallback only with explicit consent.
    const free = routes.filter((r) => r.billing === "free" || r.billing === "freemium");
    const paid = routes.filter((r) => r.billing === "paid");
    return [...free, ...(prefs.allowPaidFallback ? paid : [])];
  },

  async checkHealth(cred: ProviderCredential) {
    const adapter = adapterFor(cred.providerId);
    const key = await decryptKey(cred);
    return adapter.health({ apiKey: key, endpoint: cred.endpoint, model: null, extra: cred.extra ?? {} });
  },

  async generate(userId: string, route: Route, req: any, onStage: (s: string, honest?: boolean) => void) {
    const adapter = adapterFor(route.providerId);
    const cred = route.credential;
    const key = cred?.keyEnc ? await decryptKey(cred) : null;
    const user = db.get<{ prefs?: { allowPaid?: boolean } }>("users", userId);
    const cfg = {
      apiKey: key, endpoint: cred?.endpoint ?? null, model: route.model,
      extra: { ...(cred?.extra ?? {}), allowPaid: String(user?.prefs?.allowPaid ?? false) },
    };
    return adapter.generate(cfg, { ...req, modelHint: route.model }, onStage);
  },
};

// ── Job worker (in-browser queue; BullMQ analogue in production) ──
const running = new Map<string, AbortController>();

function patchGeneration(id: string, patch: Record<string, any>): Generation | undefined {
  const g = db.update<Generation>("generations", id, { ...patch, updatedAt: nowIso() } as any);
  if (g) emitGen(g.id);
  return g;
}
function addStage(gen: Generation, stage: string, honest = true) {
  const stages = [...gen.stages, { stage, at: nowIso(), honest } satisfies StageEvent];
  return patchGeneration(gen.id, { stages })!;
}
function notifyUser(userId: string, title: string, body: string, kind: "success" | "error" | "info" | "warning", link: string | null) {
  const u = db.get<User>("users", userId);
  if (!u) return;
  if (kind === "success" && !u.prefs.notifyJobDone) return;
  if (kind === "error" && !u.prefs.notifyJobFailed) return;
  db.insert("notifications", { id: uid(), userId, title, body, kind, read: false, link, createdAt: nowIso() });
}

export function enqueueJob(generationId: string) {
  const gen = db.get<Generation>("generations", generationId);
  if (!gen) return;
  queueMicrotask(() => void runJob(gen.jobId));
}

async function runJob(jobId: string) {
  const job0 = db.get<Job>("jobs", jobId);
  if (!job0 || job0.status !== "queued") return;
  const ac = new AbortController();
  running.set(jobId, ac);
  const t0 = Date.now();
  let gen = db.get<Generation>("generations", job0.generationId)!;
  const user = db.get<User>("users", job0.userId)!;
  const settings = getAdminSettings();

  db.update("jobs", jobId, { status: "preparing", stage: "Preparing", startedAt: nowIso() } as any);
  gen = patchGeneration(gen.id, { status: "preparing" })!;
  gen = addStage(gen, "Preparing your generation…");

  const chain = router.fallbackChain(user.id, gen.type, gen.params.providerId ?? "auto", gen.params.model ?? null, {
    allowPaid: user.prefs.allowPaid, allowPaidFallback: user.prefs.allowPaidFallback,
  });
  if (!chain.length) {
    failJob(jobId, gen, new ApiError("NO_PROVIDER", "No connected provider supports this task.", 412), user, gen.creditEstimate);
    return;
  }

  gen = addStage(gen, `Routing across ${chain.length} engine${chain.length > 1 ? "s" : ""}…`);
  let lastError: ApiError | null = null;
  for (let i = 0; i < chain.length; i++) {
    const route = chain[i];
    if (job0.requestedCancel || db.get<Job>("jobs", jobId)?.requestedCancel) { cancelJob(jobId, gen, user); return; }
    try {
      patchGeneration(gen.id, { providerId: route.providerId, model: route.model });
      await executeRoute(jobId, gen, route, user, ac, settings.mockEnabled, t0);
      return;
    } catch (e) {
      lastError = e instanceof ApiError ? e : new ApiError("PROVIDER_ERROR", (e as Error)?.message ?? "Generation failed.", 502);
      const code = (e as any)?.code ?? "";
      if (code === "CANCELLED") { cancelJob(jobId, gen, user); return; }
      const canRetry = RETRYABLE.has(code) && i < chain.length - 1 && (route.billing !== "paid" || user.prefs.allowPaidFallback);
      gen = db.get<Generation>("generations", gen.id)!;
      gen = addStage(gen, `${providerDef(route.providerId)?.name ?? route.providerId} failed — ${lastError.message}`, false);
      if (!canRetry) break;
      gen = addStage(gen, `Falling back to ${providerDef(chain[i + 1].providerId)?.name ?? chain[i + 1].providerId}…`);
    }
  }
  failJob(jobId, gen, lastError ?? new ApiError("FAILED", "Generation failed.", 502), user, gen.creditEstimate);
}

async function executeRoute(jobId: string, genIn: Generation, route: Route, user: User, ac: AbortController, mockEnabled: boolean, t0: number) {
  let gen = genIn;
  if (route.providerId === "simulator" && !mockEnabled) throw new ApiError("SIM_DISABLED", "Local Simulator is disabled by an administrator.", 403);

  db.update("jobs", jobId, { status: "generating", stage: "Generating" } as any);
  gen = patchGeneration(gen.id, { status: "generating" })!;

  // Resolve character image to a URL adapters can consume.
  let charUrl: string | undefined;
  if (gen.params.characterAssetId) {
    const a = db.get<any>("assets", gen.params.characterAssetId);
    if (a && a.userId === user.id) charUrl = a.url ?? (a.blobId ? (await blobUrl(a.blobId)) ?? undefined : undefined);
  }

  const cancelCheck = () => (db.get<Job>("jobs", jobId)?.requestedCancel ?? false) || ac.signal.aborted;
  const result = await router.generate(user.id, route, {
    type: gen.type, prompt: gen.prompt, negative: gen.params.negative,
    width: gen.params.width, height: gen.params.height, aspect: gen.params.aspect, duration: gen.params.duration,
    seed: gen.params.seed, style: gen.params.style, camera: gen.params.camera, language: gen.params.language,
    voice: gen.params.voice, quality: gen.params.quality, count: gen.params.count, temperature: gen.params.temperature,
    steps: gen.params.steps, cfg: gen.params.cfg, fps: gen.params.fps,
    characterImageUrl: charUrl, characterName: gen.params.characterName, expression: gen.params.expression,
    action: gen.params.action, background: gen.params.background, scenes: gen.params.scenes, script: gen.params.script,
    signal: ac.signal, cancelCheck,
  }, (stage, honest = true) => {
    if (cancelCheck()) { ac.abort(); throw new ApiError("CANCELLED", "Generation cancelled.", 499); }
    gen = db.get<Generation>("generations", gen.id)!;
    gen = addStage(gen, stage, honest);
  });

  if (cancelCheck()) { cancelJob(jobId, gen, user); return; }

  db.update("jobs", jobId, { status: "processing", stage: "Processing" } as any);
  gen = patchGeneration(gen.id, { status: "processing" })!;
  gen = addStage(gen, "Saving asset to your library…");

  let assetId: string | null = null;
  if (result.blob) {
    const blobId = uid();
    await blobStore.put(blobId, result.blob);
    const kind = gen.type === "video" || gen.type === "character" ? "video" : gen.type === "poster" ? "poster" : gen.type === "audio" ? "audio" : "image";
    const asset = db.insert("assets", {
      id: uid(), userId: user.id, kind, name: `${gen.type}-${gen.id.slice(0, 6)}`, mime: result.mime, size: result.blob.size,
      blobId, url: null, width: result.width ?? null, height: result.height ?? null, generationId: gen.id,
      meta: { ...(result.meta ?? {}), prompt: gen.prompt.slice(0, 200) }, createdAt: nowIso(),
    });
    assetId = asset.id;
  } else if (result.url) {
    const asset = db.insert("assets", {
      id: uid(), userId: user.id, kind: gen.type === "video" || gen.type === "character" ? "video" : "image",
      name: `${gen.type}-${gen.id.slice(0, 6)}`, mime: result.mime, size: 0, blobId: null, url: result.url,
      width: result.width ?? null, height: result.height ?? null, generationId: gen.id, meta: result.meta ?? {}, createdAt: nowIso(),
    });
    assetId = asset.id;
  }

  await creditEngine.finalize(user.id, gen.creditEstimate, gen.creditEstimate, gen.id, `${gen.type} completed`);
  db.update("jobs", jobId, { status: "completed", stage: "Completed", finishedAt: nowIso() } as any);
  patchGeneration(gen.id, { status: "completed", assetId, creditFinal: gen.creditEstimate });
  notifyUser(user.id, `${gen.type[0].toUpperCase()}${gen.type.slice(1)} ready`, `Your ${gen.type} finished.`, "success", "/library");
  db.insert("usage_logs", { id: uid(), userId: user.id, generationId: gen.id, providerId: route.providerId, model: route.model, status: "completed", durationMs: Date.now() - t0, createdAt: nowIso() });
}

function failJob(jobId: string, gen: Generation, err: ApiError, user: User, reserved: number) {
  db.update("jobs", jobId, { status: "failed", stage: "Failed", finishedAt: nowIso(), error: err.message } as any);
  patchGeneration(gen.id, { status: "failed", error: err.message, errorCode: err.code });
  void creditEngine.refund(user.id, reserved, gen.id, `${gen.type} failed`);
  if (user.prefs.notifyJobFailed) notifyUser(user.id, `${gen.type} failed`, err.message, "error", "/history");
  db.insert("usage_logs", { id: uid(), userId: user.id, generationId: gen.id, providerId: gen.providerId, model: gen.model, status: "failed", error: err.code, createdAt: nowIso() });
}
function cancelJob(jobId: string, gen: Generation, user: User) {
  db.update("jobs", jobId, { status: "cancelled", stage: "Cancelled", finishedAt: nowIso() } as any);
  patchGeneration(gen.id, { status: "cancelled" });
  void creditEngine.refund(user.id, gen.creditEstimate, gen.id, `${gen.type} cancelled`);
}

/** Recover jobs interrupted by a reload. */
export function startWorker() {
  db.where<Job>("jobs", (j) => ["queued", "preparing", "generating", "processing"].includes(j.status)).forEach((j) => {
    db.update("jobs", j.id, { status: "failed", stage: "Failed", finishedAt: nowIso(), error: "Interrupted by reload — credits refunded." } as any);
    const gen = db.get<Generation>("generations", j.generationId);
    if (gen) {
      patchGeneration(gen.id, { status: "failed", error: "Interrupted by reload — credits refunded.", errorCode: "INTERRUPTED" });
      const u = db.get<User>("users", j.userId);
      if (u) void creditEngine.refund(u.id, gen.creditEstimate, gen.id, "interrupted job");
    }
  });
}

export { normalizeOllamaEndpoint, ADAPTERS };
