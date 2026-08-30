// ─────────────────────────────────────────────────────────────────────────────
// Local AI layer: real machine detection (browser-truthful + optional desktop
// bridge), Ollama management (status / pull / delete / test), hardware-based
// model recommendations, and vision analysis. NO fake values — anything the
// browser can't know is reported as unknown with an honest warning.
// ─────────────────────────────────────────────────────────────────────────────
import { ApiError, GpuInfo, MachineProfile, ModelRecommendation, OllamaStatus } from "../lib/types";
import { nowIso } from "../lib/utils";
import { normalizeOllamaEndpoint } from "./ai/providers";

const BRIDGE = "http://127.0.0.1:8788";
const LS_HOST = "acs:ollama:host";
export const getOllamaHost = () => localStorage.getItem(LS_HOST) || "http://127.0.0.1:11434";
export const setOllamaHost = (h: string) => localStorage.setItem(LS_HOST, h);

// ── Bridge ──
export async function bridgeStatus(): Promise<{ online: boolean }> {
  try {
    const r = await fetch(`${BRIDGE}/health`, { signal: AbortSignal.timeout(1500) });
    return { online: r.ok };
  } catch { return { online: false }; }
}

// ── Hardware detection ──
async function browserGpus(): Promise<{ gpus: GpuInfo[]; webgpu: boolean }> {
  try {
    const nav = navigator as any;
    if (nav.gpu?.requestAdapter) {
      const ad = await nav.gpu.requestAdapter();
      if (ad) {
        let vram: number | null = null;
        try { vram = (await ad.requestAdapterInfo?.())?.device ? null : null; } catch { /* noop */ }
        const info = await (ad.requestAdapterInfo?.() ?? Promise.resolve({ vendor: "", device: "", description: "" }));
        return { gpus: [{ vendor: info.vendor || "WebGPU", name: info.description || info.device || "WebGPU adapter", vramMB: vram }], webgpu: true };
      }
    }
  } catch { /* fall through */ }
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl2") || c.getContext("webgl")) as WebGLRenderingContext | null;
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "WebGL adapter";
      const vendor = ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : "unknown";
      return { gpus: [{ vendor, name, vramMB: null }], webgpu: false };
    }
  } catch { /* noop */ }
  return { gpus: [], webgpu: false };
}

export async function detectMachine(): Promise<MachineProfile> {
  const warnings: string[] = [];
  let base: MachineProfile = {
    os: "unknown", platform: navigator.platform || "unknown", architecture: "unknown", source: "browser",
    cpu: { name: "unknown", cores: navigator.hardwareConcurrency || 0, threads: null },
    ramMB: (navigator as any).deviceMemory ? (navigator as any).deviceMemory * 1024 : null,
    gpus: [], disk: { totalMB: null, freeMB: null }, webgpu: false, checkedAt: nowIso(), warnings,
  };
  if ((navigator as any).userAgentData) {
    const ua: any = (navigator as any).userAgentData;
    base.os = `${ua.platform ?? "unknown"}`;
    try {
      const hi = await ua.getHighEntropyValues(["architecture", "platformVersion", "fullVersionList"]);
      base.architecture = hi.architecture ?? "unknown";
      base.os = `${ua.platform} ${hi.platformVersion ?? ""}`.trim();
    } catch { warnings.push("High-entropy OS details unavailable."); }
  } else {
    base.os = /Windows/.test(navigator.userAgent) ? "Windows" : /Mac/.test(navigator.userAgent) ? "macOS" : /Linux/.test(navigator.userAgent) ? "Linux" : "unknown";
    warnings.push("OS details limited (no User-Agent client hints).");
  }
  const g = await browserGpus();
  base.gpus = g.gpus; base.webgpu = g.webgpu;
  if (!base.gpus.length) warnings.push("No GPU exposed to the browser.");
  if (base.ramMB == null) warnings.push("Device memory unavailable in this browser (Chrome reports a rounded value).");

  // Storage estimate = browser origin quota (honest, partial disk picture).
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) base.disk = { totalMB: Math.round(est.quota / 1e6), freeMB: Math.round(((est.quota ?? 0) - (est.usage ?? 0)) / 1e6) };
      warnings.push("Disk figures show this browser's storage quota — run the local bridge for real disk numbers.");
    }
  } catch { warnings.push("Storage estimate unavailable."); }

  // Desktop bridge (real OS data) — optional.
  try {
    const r = await fetch(`${BRIDGE}/system`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const s = await r.json();
      base = {
        ...base, source: "bridge+browser",
        os: s.os ?? base.os, platform: s.platform ?? base.platform, architecture: s.architecture ?? base.architecture,
        cpu: { name: s.cpu?.name ?? base.cpu.name, cores: s.cpu?.cores ?? base.cpu.cores, threads: s.cpu?.threads ?? null },
        ramMB: s.ram?.totalMB ?? base.ramMB,
        gpus: s.gpus?.length ? s.gpus : base.gpus,
        disk: s.disk?.totalMB ? { totalMB: s.disk.totalMB, freeMB: s.disk.freeMB ?? null } : base.disk,
      };
      const i = base.warnings.findIndex((w) => w.includes("local bridge"));
      if (i >= 0) base.warnings.splice(i, 1);
    }
  } catch {
    warnings.push("Local bridge offline — run: node local-bridge.mjs (for real GPU VRAM, RAM & disk).");
  }
  localStorage.setItem("acs:machine", JSON.stringify(base));
  return base;
}
export function loadMachine(): MachineProfile | null {
  try { const raw = localStorage.getItem("acs:machine"); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

// ── Ollama management (all via the REAL Ollama REST API) ──
export async function ollamaStatus(endpoint = getOllamaHost()): Promise<OllamaStatus> {
  const ep = normalizeOllamaEndpoint(endpoint);
  const t0 = performance.now();
  try {
    const ctrl = AbortSignal.timeout(5000);
    const [verRes, tagsRes] = await Promise.all([
      fetch(`${ep}/api/version`, { signal: ctrl }).catch(() => null),
      fetch(`${ep}/api/tags`, { signal: ctrl }).catch(() => null),
    ]);
    if (!verRes || !verRes.ok) throw new Error(`HTTP ${verRes?.status ?? "unreachable"}`);
    const ver = await verRes.json().catch(() => ({}));
    const tags = tagsRes?.ok ? await tagsRes.json().catch(() => ({ models: [] })) : { models: [] };
    return {
      endpoint: ep, reachable: true, installed: null, version: ver.version ?? null,
      latencyMs: Math.round(performance.now() - t0),
      models: (tags.models ?? []).map((m: any) => ({
        name: m.name, sizeMB: Math.round((m.size ?? 0) / 1e6),
        vision: /vision|vl|llava|moondream|bakllava/i.test(m.name), modified: m.modified_at ?? "",
      })),
      error: null,
    };
  } catch (e: any) {
    const refused = e instanceof TypeError || /fetch/i.test(String(e?.message));
    return {
      endpoint: ep, reachable: false, installed: null, version: null, latencyMs: null, models: [],
      error: refused
        ? `Ollama unreachable at ${ep}. Start it with "ollama serve" (browser mode needs OLLAMA_ORIGINS=*), or run "node local-bridge.mjs".`
        : `Ollama error: ${e?.message ?? e}`,
    };
  }
}

export async function ollamaPull(endpoint: string, model: string, onProgress: (p: { status: string; pct: number | null; doneMB: number | null; totalMB: number | null }) => void, signal?: AbortSignal) {
  const ep = normalizeOllamaEndpoint(endpoint);
  const res = await fetch(`${ep}/api/pull`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError("PULL_FAILED", `Ollama pull failed (HTTP ${res.status}): ${body.slice(0, 160)}`, res.status);
  }
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      try {
        const j = JSON.parse(line);
        if (j.error) throw new ApiError("PULL_FAILED", `Ollama: ${j.error}`, 502);
        const total = j.total ?? null;
        const comp = j.completed ?? null;
        onProgress({
          status: j.status ?? "working",
          pct: total ? Math.min(100, Math.round((comp / total) * 100)) : null,
          doneMB: comp != null ? Math.round(comp / 1e6) : null,
          totalMB: total != null ? Math.round(total / 1e6) : null,
        });
      } catch (pe) { if (pe instanceof ApiError) throw pe; }
    }
  }
}

export async function ollamaDelete(endpoint: string, model: string) {
  const ep = normalizeOllamaEndpoint(endpoint);
  const res = await fetch(`${ep}/api/delete`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: model }) });
  if (!res.ok) throw new ApiError("DELETE_FAILED", `Could not delete ${model} (HTTP ${res.status}).`, res.status);
}

export async function ollamaTestModel(endpoint: string, model: string, vision: boolean): Promise<{ ok: boolean; latencyMs: number; detail: string }> {
  const ep = normalizeOllamaEndpoint(endpoint);
  const t0 = performance.now();
  const body: Record<string, any> = { model, stream: false, options: { num_predict: 16 } };
  if (vision) {
    // 1x1 red PNG as a real image input.
    body.prompt = "Describe this image in one short sentence.";
    body.images = ["iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="];
  } else {
    body.prompt = "Reply with exactly: ok";
  }
  try {
    const res = await fetch(`${ep}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
    const ms = Math.round(performance.now() - t0);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      if (/memory|out of|VRAM/i.test(txt)) return { ok: false, latencyMs: ms, detail: `Model could not load — insufficient memory/VRAM. Try a smaller model.` };
      return { ok: false, latencyMs: ms, detail: `HTTP ${res.status}: ${txt.slice(0, 120)}` };
    }
    const data = await res.json();
    if (!data.response && !data.done) return { ok: false, latencyMs: ms, detail: "No response body from Ollama." };
    return { ok: true, latencyMs: ms, detail: `Response received · ${ms}ms${vision ? " · vision input accepted" : ""}` };
  } catch (e: any) {
    return { ok: false, latencyMs: Math.round(performance.now() - t0), detail: e instanceof TypeError ? "Ollama stopped responding mid-test." : String(e?.message ?? e) };
  }
}

// ── Recommendation engine (hardware-based, honest) ──
const TEXT_MODELS = [
  { name: "qwen3:0.6b", sizeMB: 520, vramMB: 1200, tier: "Best" as const, note: "Tiny & quick — runs on almost anything" },
  { name: "llama3.2:1b", sizeMB: 1300, vramMB: 2000, tier: "Best" as const, note: "Small, balanced, great for agents" },
  { name: "qwen3:1.7b", sizeMB: 1400, vramMB: 2400, tier: "Good" as const, note: "Noticeably smarter, still light" },
  { name: "gemma3:4b", sizeMB: 3300, vramMB: 5000, tier: "Good" as const, note: "Strong reasoning for its size" },
  { name: "llama3.1:8b", sizeMB: 4700, vramMB: 6500, tier: "Good" as const, note: "The 8B sweet spot" },
  { name: "qwen3:8b", sizeMB: 5200, vramMB: 7000, tier: "Best" as const, note: "Top-tier quality at 8B" },
  { name: "mistral", sizeMB: 4100, vramMB: 5800, tier: "Good" as const, note: "Fast European 7B" },
  { name: "qwen3:14b", sizeMB: 9000, vramMB: 12000, tier: "Experimental" as const, note: "Big — needs a strong GPU" },
  { name: "llama3.1:70b", sizeMB: 40000, vramMB: 48000, tier: "Experimental" as const, note: "Flagship — multi-GPU territory" },
];
const VISION_MODELS = [
  { name: "moondream:1.8b", sizeMB: 1700, vramMB: 2600, tier: "Best" as const, note: "Smallest usable vision model" },
  { name: "llama3.2-vision:11b", sizeMB: 7900, vramMB: 10000, tier: "Good" as const, note: "Solid general vision" },
  { name: "qwen2.5vl:7b", sizeMB: 5400, vramMB: 7500, tier: "Best" as const, note: "Excellent OCR + scene detail" },
  { name: "minicpm-v", sizeMB: 5500, vramMB: 7600, tier: "Good" as const, note: "Great on-device multimodal" },
  { name: "qwen2.5vl:32b", sizeMB: 20000, vramMB: 26000, tier: "Experimental" as const, note: "Heavy — high-end GPUs only" },
];

export function recommendModels(profile: MachineProfile | null, installed: { name: string }[]): ModelRecommendation[] {
  const ramMB = profile?.ramMB ?? 8192;
  const vramMB = profile?.gpus?.reduce((m, g) => Math.max(m, g.vramMB ?? 0), 0) ?? 0;
  const diskFreeMB = profile?.disk?.freeMB ?? null;
  const inst = new Set(installed.map((i) => i.name.replace(/:latest$/, "")));
  const fits = (m: { sizeMB: number; vramMB: number }) => {
    if (diskFreeMB != null && m.sizeMB * 1.15 > diskFreeMB) return false;
    if (vramMB > 0) return m.vramMB <= vramMB * 0.92 || m.sizeMB <= ramMB * 0.4;
    return m.sizeMB <= ramMB * 0.55; // CPU-only: model must fit in ~half RAM
  };
  const build = (list: typeof TEXT_MODELS, category: "text" | "vision") =>
    list
      .filter(fits)
      .sort((a, b) => b.sizeMB - a.sizeMB)
      .slice(0, 3)
      .map((m) => ({ ...m, category, vision: category === "vision", installed: inst.has(m.name.split(":")[0]) || inst.has(m.name) }));
  return [...build(TEXT_MODELS, "text"), ...build(VISION_MODELS, "vision")];
}
export const ALL_PULLABLE = [...TEXT_MODELS, ...VISION_MODELS];

// ── Vision analysis (local-first, honest labelling) ──
export interface VisionEngine { kind: "local" | "cloud"; label: string; }
export function pickVisionEngine(): VisionEngine | null {
  try {
    const st = JSON.parse(localStorage.getItem("acs:vision-engine") || "null");
    if (st) return st;
  } catch { /* noop */ }
  return null;
}

const ANALYSIS_PROMPT = `Describe this image for an AI generation pipeline. Reply as strict JSON with keys: appearance, clothing, hair, face, style, identity_features (array). No markdown, JSON only.`;

export async function analyzeImageLocal(endpoint: string, model: string, imageDataUri: string): Promise<Record<string, any>> {
  const ep = normalizeOllamaEndpoint(endpoint);
  const b64 = imageDataUri.split(",")[1] ?? "";
  const res = await fetch(`${ep}/api/generate`, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(180000),
    body: JSON.stringify({ model, prompt: ANALYSIS_PROMPT, images: [b64], stream: false, options: { temperature: 0.2 } }),
  });
  if (!res.ok) throw new ApiError("VISION_FAILED", `Local vision model failed (HTTP ${res.status}).`, res.status);
  const data = await res.json();
  return parseProfile(data.response ?? "");
}

export async function analyzeImageCloud(providerId: "pollinations" | "openrouter", cfg: { apiKey: string | null; model?: string | null }, imageDataUri: string): Promise<Record<string, any>> {
  if (providerId === "openrouter" && cfg.apiKey) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST", signal: AbortSignal.timeout(120000),
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.model ?? "google/gemini-2.5-flash",
        messages: [{ role: "user", content: [{ type: "text", text: ANALYSIS_PROMPT }, { type: "image_url", image_url: { url: imageDataUri } }] }],
      }),
    });
    if (!res.ok) throw new ApiError("VISION_FAILED", `OpenRouter vision failed (HTTP ${res.status}).`, res.status);
    const data = await res.json();
    return parseProfile(data.choices?.[0]?.message?.content ?? "");
  }
  throw new ApiError("NO_VISION", "No cloud vision engine configured.", 412);
}

function parseProfile(raw: string): Record<string, any> {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new ApiError("BAD_OUTPUT", "The vision model did not return structured JSON.", 422);
  try {
    const j = JSON.parse(m[0]);
    return {
      appearance: j.appearance ?? "", clothing: j.clothing ?? "", hair: j.hair ?? "",
      face: j.face ?? "", style: j.style ?? "",
      identity_features: Array.isArray(j.identity_features) ? j.identity_features : [],
    };
  } catch { throw new ApiError("BAD_OUTPUT", "Vision model returned malformed JSON.", 422); }
}

export function profileToPrompt(p: Record<string, any>): string {
  return [p.appearance, p.clothing && `wearing ${p.clothing}`, p.hair && `${p.hair} hair`, p.style && `${p.style} style`, (p.identity_features ?? []).join(", ")]
    .filter(Boolean).join(", ");
}
