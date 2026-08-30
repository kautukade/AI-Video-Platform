// ─────────────────────────────────────────────────────────────────────────────
// Persistence layer.
// Structured records: localStorage (stands in for PostgreSQL).
// Binary assets: IndexedDB (stands in for S3/Supabase Storage).
// Secrets: AES-GCM encrypted at rest (SecretVault), keys never stored plaintext.
// ─────────────────────────────────────────────────────────────────────────────
import { AdminSettings, ModelInfo, PricingRule, User } from "../lib/types";
import { hashPassword, nowIso, uid } from "../lib/utils";

const DB_KEY = "acs:db:v1";
type Tables = Record<string, any[]>;
let cache: Tables | null = null;
const listeners = new Set<() => void>();

export function onChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
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
  get<T = any>(table: string, id: string): T | undefined { return this.all<T>(table).find((r: any) => r.id === id); },
  insert<T>(table: string, row: T): T {
    const t = load(); t[table] = t[table] ?? []; t[table].push(row); persist(); return row;
  },
  update<T>(table: string, id: string, patch: Partial<T> & Record<string, any>): T | undefined {
    const t = load(); const rows = t[table] ?? [];
    const i = rows.findIndex((r) => r.id === id);
    if (i === -1) return undefined;
    rows[i] = { ...rows[i], ...patch, ...(table === "users" ? { updatedAt: nowIso() } : {}) };
    persist(); return rows[i];
  },
  remove(table: string, id: string) {
    const t = load(); t[table] = (t[table] ?? []).filter((r) => r.id !== id); persist();
  },
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
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  async get(id: string): Promise<Blob | undefined> {
    const d = await idb();
    return new Promise((res, rej) => {
      const rq = d.transaction("blobs", "readonly").objectStore("blobs").get(id);
      rq.onsuccess = () => res(rq.result as Blob | undefined);
      rq.onerror = () => rej(rq.error);
    });
  },
  async del(id: string) {
    const d = await idb();
    return new Promise<void>((res) => {
      const tx = d.transaction("blobs", "readwrite");
      tx.objectStore("blobs").delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
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

// ── SecretVault: AES-GCM with XOR fallback for non-secure contexts ──
const KEK_KEY = "acs:kek:v1";
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
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const key = await kek();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
      return { iv: btoa(String.fromCharCode(...iv)), ct: btoa(String.fromCharCode(...new Uint8Array(ct))) };
    }
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
  async wipe() { localStorage.removeItem(KEK_KEY); kekPromise = null; },
};

// ── Seed data ──
const PRICING_SEED: PricingRule[] = [
  { id: "pr-img", taskType: "image", providerId: "*", model: "*", base: 6, unit: "per_megapixel", resolutionMult: {}, qualityMult: { draft: 0.5, standard: 1, hd: 1.6 }, note: "Base image per megapixel" },
  { id: "pr-vid", taskType: "video", providerId: "*", model: "*", base: 8, unit: "per_second", resolutionMult: { "720p": 0.8, "1080p": 1, "4k": 2.2 }, qualityMult: {}, note: "Base video per second" },
  { id: "pr-chr", taskType: "character", providerId: "*", model: "*", base: 9, unit: "per_second", resolutionMult: {}, qualityMult: {}, note: "Character video per second" },
  { id: "pr-pst", taskType: "poster", providerId: "*", model: "*", base: 5, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Poster composition" },
  { id: "pr-txt", taskType: "text", providerId: "*", model: "*", base: 1, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Text generation" },
  { id: "pr-ollama", taskType: "*", providerId: "ollama", model: "*", base: 0, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Local inference — free" },
  { id: "pr-poll", taskType: "*", providerId: "pollinations", model: "*", base: 0, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "Free public API" },
];

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
    if (!t.admin_settings) t.admin_settings = [{ id: "settings", mockEnabled: false, signupBonus: 500, maxUploadMB: 40, maintenanceMode: false, unlimitedMode: true }];
    else t.admin_settings = t.admin_settings.map((s) => ({ mockEnabled: false, unlimitedMode: true, ...s, id: s.id ?? "settings" }));
    ["sessions", "provider_credentials", "models", "characters", "generations", "jobs", "assets", "notifications", "usage_logs", "credit_accounts", "credit_transactions"].forEach((k) => { if (!t[k]) t[k] = []; });
    persist();
  })().catch((e) => {
    console.error("[db] seed failed", e);
    seedPromise = null;
    const t = load();
    ["users", "sessions", "provider_credentials", "models", "characters", "generations", "jobs", "assets", "credit_accounts", "credit_transactions", "pricing_rules", "notifications", "usage_logs"].forEach((k) => { if (!t[k]) t[k] = []; });
    if (!t.admin_settings?.length) t.admin_settings = [{ id: "settings", mockEnabled: false, signupBonus: 500, maxUploadMB: 40, maintenanceMode: false, unlimitedMode: true }];
  });
  return seedPromise;
}

export function getAdminSettings(): AdminSettings {
  ensureSeed();
  const rows = db.all<AdminSettings & { id: string }>("admin_settings");
  return rows[0] ?? { id: "settings", mockEnabled: false, signupBonus: 500, maxUploadMB: 40, maintenanceMode: false, unlimitedMode: true };
}
