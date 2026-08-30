// ─────────────────────────────────────────────────────────────────────────────
// Persistence: localStorage repositories (Postgres in production), IndexedDB
// blob store (S3 in production), AES-GCM secret vault with safe fallbacks.
// ─────────────────────────────────────────────────────────────────────────────
import { AdminSettings, ModelInfo, PricingRule, User } from "../lib/types";
import { hashPassword, nowIso, uid } from "../lib/utils";

const DB_KEY = "acs:db:v2";
type Tables = Record<string, any[]>;
let cache: Tables | null = null;
const listeners = new Set<() => void>();

export function onChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function emit() { listeners.forEach((cb) => { try { cb(); } catch { /* noop */ } }); }
function persist() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(cache)); } catch (e) { console.warn("[db] persist failed", e); }
  emit();
}
function load(): Tables {
  if (cache) return cache;
  try { const raw = localStorage.getItem(DB_KEY); cache = raw ? JSON.parse(raw) : {}; } catch { cache = {}; }
  return cache!;
}

export const db = {
  all<T>(table: string): T[] { return (load()[table] ?? []) as T[]; },
  get<T = any>(table: string, id: string): T | undefined { return this.all<any>(table).find((r) => r.id === id); },
  insert<T>(table: string, row: T): T { const t = load(); t[table] = t[table] ?? []; t[table].push(row); persist(); return row; },
  update<T = any>(table: string, id: string, patch: Record<string, any>): T | undefined {
    const t = load(); const rows = t[table] ?? [];
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return undefined;
    rows[i] = { ...rows[i], ...patch };
    persist(); return rows[i];
  },
  remove(table: string, id: string) { const t = load(); t[table] = (t[table] ?? []).filter((r) => r.id !== id); persist(); },
  where<T>(table: string, fn: (r: T) => boolean): T[] { return this.all<T>(table).filter(fn); },
  setMany(table: string, rows: any[]) { load()[table] = rows; persist(); },
};

// ── Blob store (StorageProvider local adapter) ──
let idbPromise: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  idbPromise ??= new Promise((res, rej) => {
    const req = indexedDB.open("acs-blobs", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("blobs");
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return idbPromise;
}
export const blobStore = {
  async put(id: string, blob: Blob) {
    const d = await idb();
    return new Promise<void>((res, rej) => {
      const tx = d.transaction("blobs", "readwrite");
      tx.objectStore("blobs").put(blob, id);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  },
  async get(id: string): Promise<Blob | undefined> {
    const d = await idb();
    return new Promise((res, rej) => {
      const rq = d.transaction("blobs", "readonly").objectStore("blobs").get(id);
      rq.onsuccess = () => res(rq.result as Blob | undefined); rq.onerror = () => rej(rq.error);
    });
  },
  async del(id: string) {
    const d = await idb();
    return new Promise<void>((res) => {
      const tx = d.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(id);
      tx.oncomplete = () => res(); tx.onerror = () => res();
    });
  },
};

const urlCache = new Map<string, string>();
export async function blobUrl(blobId: string): Promise<string | null> {
  if (urlCache.has(blobId)) return urlCache.get(blobId)!;
  const b = await blobStore.get(blobId);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(blobId, u);
  return u;
}

// ── SecretVault ──
const KEK_KEY = "acs:kek:v2";
let kekPromise: Promise<CryptoKey> | null = null;
function kekRaw(): string {
  let raw = localStorage.getItem(KEK_KEY);
  if (!raw) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    raw = btoa(String.fromCharCode(...bytes));
    localStorage.setItem(KEK_KEY, raw);
  }
  return raw;
}
function kek(): Promise<CryptoKey> {
  kekPromise ??= (async () => {
    const bin = Uint8Array.from(atob(kekRaw()), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey("raw", bin, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  })();
  return kekPromise;
}
function xorBytes(data: Uint8Array, keyStr: string): Uint8Array {
  const kb = new TextEncoder().encode(keyStr.repeat(8));
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ kb[i % kb.length];
  return out;
}
export const vault = {
  async encryptJSON(obj: unknown): Promise<{ iv: string; ct: string }> {
    const plain = new TextEncoder().encode(JSON.stringify(obj));
    try {
      if (typeof crypto !== "undefined" && crypto.subtle) {
        const key = await kek();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
        return { iv: btoa(String.fromCharCode(...iv)), ct: btoa(String.fromCharCode(...new Uint8Array(ct))) };
      }
    } catch { /* fallback */ }
    return { iv: "x1", ct: btoa(String.fromCharCode(...xorBytes(plain, kekRaw()))) };
  },
  async decryptJSON<T>(enc: { iv: string; ct: string }): Promise<T> {
    const ct = Uint8Array.from(atob(enc.ct), (c) => c.charCodeAt(0));
    if (enc.iv === "x1") return JSON.parse(new TextDecoder().decode(xorBytes(ct, kekRaw()))) as T;
    const key = await kek();
    const iv = Uint8Array.from(atob(enc.iv), (c) => c.charCodeAt(0));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(pt)) as T;
  },
};

// ── Seeds ──
const MODEL_CATALOG: Omit<ModelInfo, "id" | "createdAt" | "userId" | "enabled" | "source">[] = [
  { providerId: "pollinations", name: "flux", displayName: "FLUX (Pollinations)", capabilities: ["image"], context: null, pricingNote: "FREE · no key needed", supports: { negativePrompt: true, seed: true } },
  { providerId: "pollinations", name: "turbo", displayName: "Turbo (Pollinations)", capabilities: ["image"], context: null, pricingNote: "FREE · fastest", supports: { seed: true } },
  { providerId: "pollinations", name: "openai", displayName: "GPT (Pollinations text)", capabilities: ["text"], context: null, pricingNote: "FREE · no key needed", supports: {} },
  { providerId: "ollama", name: "llama3.2", displayName: "Llama 3.2", capabilities: ["text"], context: 131072, pricingNote: "Local · free", supports: { seed: true } },
  { providerId: "ollama", name: "llama3.2-vision", displayName: "Llama 3.2 Vision", capabilities: ["text", "vision"], context: 131072, pricingNote: "Local · free", supports: {} },
  { providerId: "ollama", name: "qwen2.5vl", displayName: "Qwen 2.5 VL", capabilities: ["text", "vision"], context: 32768, pricingNote: "Local · free", supports: {} },
  { providerId: "huggingface", name: "black-forest-labs/FLUX.1-schnell", displayName: "FLUX.1 Schnell", capabilities: ["image"], context: null, pricingNote: "Free tier", supports: { negativePrompt: false, seed: true } },
  { providerId: "huggingface", name: "stabilityai/stable-diffusion-3.5-large", displayName: "Stable Diffusion 3.5", capabilities: ["image"], context: null, pricingNote: "Free tier", supports: { negativePrompt: true, seed: true } },
  { providerId: "huggingface", name: "Lightricks/LTX-Video", displayName: "LTX Video (HF)", capabilities: ["video"], context: null, pricingNote: "Free tier · slow", supports: { seed: true } },
  { providerId: "huggingface", name: "mistralai/Mistral-7B-Instruct-v0.3", displayName: "Mistral 7B", capabilities: ["text"], context: 32768, pricingNote: "Free inference", supports: { seed: true } },
  { providerId: "huggingface", name: "microsoft/speecht5_tts", displayName: "SpeechT5 TTS", capabilities: ["audio", "tts"], context: null, pricingNote: "Free inference", supports: { tts: true } },
  { providerId: "openrouter", name: "meta-llama/llama-3.3-70b-instruct:free", displayName: "Llama 3.3 70B (free)", capabilities: ["text"], context: 131072, pricingNote: "FREE", supports: { seed: true } },
  { providerId: "openrouter", name: "google/gemini-2.5-flash", displayName: "Gemini 2.5 Flash", capabilities: ["text", "vision"], context: 1048576, pricingNote: "Pay-per-token", supports: {} },
  { providerId: "openrouter", name: "google/gemini-2.5-flash-image", displayName: "Gemini 2.5 Flash Image", capabilities: ["text", "vision", "image"], context: 32768, pricingNote: "Pay-per-image", supports: {} },
  { providerId: "google", name: "gemini-2.5-flash", displayName: "Gemini 2.5 Flash", capabilities: ["text", "vision"], context: 1048576, pricingNote: "Free tier", supports: {} },
  { providerId: "google", name: "gemini-2.5-flash-image-preview", displayName: "Gemini Image", capabilities: ["text", "image"], context: 32768, pricingNote: "Free tier", supports: {} },
  { providerId: "groq", name: "llama-3.3-70b-versatile", displayName: "Llama 3.3 70B (Groq)", capabilities: ["text"], context: 128000, pricingNote: "Free tier", supports: {} },
  { providerId: "cerebras", name: "llama-3.3-70b", displayName: "Llama 3.3 70B (Cerebras)", capabilities: ["text"], context: 128000, pricingNote: "Free tier", supports: {} },
  { providerId: "deepseek", name: "deepseek-chat", displayName: "DeepSeek V3", capabilities: ["text"], context: 64000, pricingNote: "Near-zero cost", supports: {} },
  { providerId: "mistral", name: "mistral-small-latest", displayName: "Mistral Small", capabilities: ["text"], context: 32768, pricingNote: "Free tier", supports: {} },
  { providerId: "together", name: "meta-llama/Llama-3.3-70B-Instruct-Turbo", displayName: "Llama 3.3 70B (Together)", capabilities: ["text"], context: 131072, pricingNote: "Free credits", supports: {} },
  { providerId: "nvidia", name: "lightricks/ltx-video", displayName: "LTX Video (NIM)", capabilities: ["video"], context: null, pricingNote: "FREE NIM credits", supports: { seed: true } },
  { providerId: "nvidia", name: "meta/llama-3.1-70b-instruct", displayName: "Llama 3.1 70B (NIM)", capabilities: ["text"], context: 131072, pricingNote: "FREE NIM credits", supports: {} },
  { providerId: "replicate", name: "lucataco/ltx-video-13b-distilled", displayName: "LTX Video 13B", capabilities: ["video"], context: null, pricingNote: "Free daily", supports: { seed: true } },
  { providerId: "replicate", name: "chenxwh/wan2.1-1.3b", displayName: "Wan 2.1", capabilities: ["video"], context: null, pricingNote: "Free daily", supports: { seed: true } },
  { providerId: "replicate", name: "minimax/video-01", displayName: "MiniMax Video-01", capabilities: ["video"], context: null, pricingNote: "Free daily", supports: {} },
  { providerId: "replicate", name: "bytedance/omni-human-1.5", displayName: "OmniHuman 1.5 (character)", capabilities: ["video"], context: null, pricingNote: "Free daily", supports: {} },
  { providerId: "replicate", name: "black-forest-labs/flux-schnell", displayName: "FLUX (Replicate)", capabilities: ["image"], context: null, pricingNote: "Free daily", supports: { seed: true } },
  { providerId: "luma", name: "photon-1", displayName: "Luma Photon", capabilities: ["video"], context: null, pricingNote: "Free monthly", supports: {} },
  { providerId: "luma", name: "dream-machine", displayName: "Luma Dream Machine", capabilities: ["video"], context: null, pricingNote: "Free monthly", supports: {} },
  { providerId: "simulator", name: "studio-sim-v1", displayName: "Studio Simulator v1", capabilities: ["text", "image", "video", "tts"], context: null, pricingNote: "On-device · 0 credits", supports: { durations: [5, 10, 15], negativePrompt: true, seed: true, tts: true, maxImages: 4 } },
];

const PRICING_SEED: PricingRule[] = [
  { id: "pr-img", taskType: "image", providerId: "*", model: "*", base: 6, unit: "per_megapixel", resolutionMult: {}, qualityMult: { draft: 0.5, standard: 1, hd: 1.6 }, note: "Image per MP" },
  { id: "pr-vid", taskType: "video", providerId: "*", model: "*", base: 8, unit: "per_second", resolutionMult: { "720p": 0.8, "1080p": 1, "4k": 2.2 }, qualityMult: {}, note: "Video per second" },
  { id: "pr-chr", taskType: "character", providerId: "*", model: "*", base: 9, unit: "per_second", resolutionMult: { "720p": 0.8, "1080p": 1, "4k": 2.2 }, qualityMult: {}, note: "Character per second" },
  { id: "pr-pst", taskType: "poster", providerId: "*", model: "*", base: 5, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Poster" },
  { id: "pr-txt", taskType: "text", providerId: "*", model: "*", base: 1, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Text" },
  { id: "pr-ollama", taskType: "*", providerId: "ollama", model: "*", base: 0, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Local — free" },
  { id: "pr-poll", taskType: "*", providerId: "pollinations", model: "*", base: 0, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Free public API" },
];

const ADMIN_SETTINGS_SEED: AdminSettings = {
  mockEnabled: false, signupBonus: 500, maxUploadMB: 40, maintenanceMode: false, unlimitedMode: true,
};

let seedPromise: Promise<void> | null = null;
export function ensureSeed(): Promise<void> {
  seedPromise ??= (async () => {
    load();
    const t = cache!;
    if (!t.users || t.users.length === 0) {
      const salt = uid();
      const admin: User = {
        id: "usr-admin", email: "admin@studio.local", name: "Studio Admin", role: "admin",
        passHash: await hashPassword("admin1234", salt), salt, suspended: false, onboarded: true, purpose: "Business",
        prefs: { defaultProvider: null, defaultModel: null, defaultLanguage: "en", defaultAspect: "16:9", allowPaid: false, allowPaidFallback: false, notifyJobDone: true, notifyJobFailed: true, notifyCreditLow: true },
        createdAt: nowIso(), updatedAt: nowIso(),
      };
      t.users = [admin];
      t.credit_accounts = [{ userId: admin.id, balance: 100000, lifetime: 100000, used: 0, version: 0, updatedAt: nowIso() }];
      t.credit_transactions = [{ id: uid(), userId: admin.id, type: "bonus", amount: 100000, balanceAfter: 100000, note: "Initial allocation", refId: null, createdAt: nowIso() }];
    }
    if (!t.pricing_rules) t.pricing_rules = [...PRICING_SEED];
    t.admin_settings = [{ id: "settings", ...ADMIN_SETTINGS_SEED, ...(t.admin_settings?.[0] ?? {}), unlimitedMode: true, mockEnabled: (t.admin_settings?.[0]?.mockEnabled) ?? false }];
    if (!t.models) t.models = MODEL_CATALOG.map((m) => ({ ...m, id: `mdl-${m.providerId}-${m.name}`, userId: null, enabled: true, source: "catalog", createdAt: nowIso() }));
    ["sessions", "provider_credentials", "characters", "generations", "jobs", "assets", "notifications", "usage_logs"].forEach((k) => { if (!t[k]) t[k] = []; });
    persist();
  })().catch((e) => {
    console.error("[db] seed failed", e);
    seedPromise = null;
    const t = load();
    ["users", "sessions", "provider_credentials", "models", "characters", "generations", "jobs", "assets", "credit_accounts", "credit_transactions", "pricing_rules", "notifications", "usage_logs"].forEach((k) => { if (!t[k]) t[k] = []; });
    if (!t.admin_settings?.length) t.admin_settings = [{ id: "settings", ...ADMIN_SETTINGS_SEED }];
  });
  return seedPromise;
}

export function getAdminSettings(): AdminSettings {
  const rows = db.all<AdminSettings & { id: string }>("admin_settings");
  return rows[0] ?? { id: "settings", ...ADMIN_SETTINGS_SEED };
}
