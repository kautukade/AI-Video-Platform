export function cn(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

export function uid(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* non-secure context */ }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export const nowIso = () => new Date().toISOString();
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Minimal synchronous SHA-256 (fallback when crypto.subtle is unavailable).
export function sha256Sync(data: Uint8Array): Uint8Array {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = data.length;
  const total = Math.ceil((len + 9) / 64) * 64;
  const buf = new Uint8Array(total);
  buf.set(data); buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 4, (len * 8) >>> 0);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, H[i]);
  return out;
}

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const keyMat = await crypto.subtle.importKey("raw", enc.encode(`${salt}::${password}`), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode("acs"), iterations: 60000, hash: "SHA-256" }, keyMat, 256);
      return toHex(new Uint8Array(bits));
    }
  } catch { /* fall through */ }
  let buf: Uint8Array = enc.encode(`itcyber::${salt}::${password}`);
  for (let i = 0; i < 2048; i++) buf = sha256Sync(buf);
  return toHex(buf);
}

export function maskKey(key: string): string {
  if (!key) return "";
  const tail = key.slice(-4);
  return `${key.slice(0, key.length > 8 ? 3 : 1)}••••••••${tail}`;
}

export const fmtNum = (n: number) => new Intl.NumberFormat("en-IN").format(Math.round(n));
export const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function downloadBlob(blob: Blob, name: string) {
  const u = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = u; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(u), 4000);
}
export function downloadUrl(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url; a.download = name; a.target = "_blank"; a.rel = "noreferrer"; a.click();
}

export function friendlyError(e: unknown): { code: string; message: string } {
  const err = e as any;
  return { code: err?.code ?? "ERROR", message: err?.message ?? "Something went wrong." };
}

export const hashStr = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Creative constants ──
export const ASPECTS: Record<string, { w: number; h: number; label: string }> = {
  "16:9": { w: 1920, h: 1080, label: "Landscape" },
  "9:16": { w: 1080, h: 1920, label: "Portrait" },
  "1:1": { w: 1080, h: 1080, label: "Square" },
  "4:5": { w: 1080, h: 1350, label: "Social" },
  "3:4": { w: 1080, h: 1440, label: "Portrait 3:4" },
  "4:3": { w: 1440, h: 1080, label: "Classic" },
};
export const LANGUAGES = [
  { id: "auto", label: "Auto Detect" }, { id: "hi", label: "Hindi" }, { id: "en", label: "English" },
  { id: "mr", label: "Marathi" }, { id: "gu", label: "Gujarati" }, { id: "ta", label: "Tamil" },
  { id: "te", label: "Telugu" }, { id: "bn", label: "Bengali" }, { id: "kn", label: "Kannada" },
  { id: "ml", label: "Malayalam" }, { id: "pa", label: "Punjabi" }, { id: "ur", label: "Urdu" },
];
export const STYLES_IMAGE = ["Photorealistic", "Cinematic", "3D", "Anime", "Illustration", "Product", "Fashion", "Corporate", "Poster", "Fantasy", "Minimal"];
export const STYLES_VIDEO = ["Cinematic", "Realistic", "3D", "Anime", "Cartoon", "Corporate", "Advertisement", "Documentary", "Social Media", "Product Commercial", "Educational"];
export const CAMERAS = ["Static", "Pan", "Tilt", "Zoom", "Tracking", "Dolly", "Handheld", "Cinematic"];
export const EXPRESSIONS = ["Neutral", "Happy", "Serious", "Excited", "Professional", "Friendly"];
export const ACTIONS = ["Talking", "Walking", "Presenting", "Sitting", "Standing", "Explaining", "Product demonstration"];
export const TONES = ["Professional", "Friendly", "Energetic", "Educational", "Storytelling", "Marketing"];
