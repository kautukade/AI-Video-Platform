import {
  AIProviderAdapter, ApiError, Capability, DiscoveredModel, GenRequest, GenResult, HealthResult, ProviderCfg, ProviderDef,
} from "../../lib/types";
import { simCharacterVideo, simImage, simText, simVideo } from "./simulator";

export const PROVIDER_REGISTRY: ProviderDef[] = [
  { id: "pollinations", name: "Pollinations", tagline: "Free public FLUX image + GPT text · no account, no key", auth: "none", billing: "free", capabilities: ["text", "image"], docs: "https://pollinations.ai" },
  { id: "ollama", name: "Ollama (Local)", tagline: "Free private inference on your own laptop", auth: "none", billing: "free", capabilities: ["text", "vision"], docs: "https://ollama.com/download" },
  { id: "huggingface", name: "Hugging Face", tagline: "Free-tier Inference · images, video, text, audio", auth: "token", billing: "freemium", capabilities: ["text", "image", "video", "audio", "tts", "stt"], docs: "https://huggingface.co/settings/tokens" },
  { id: "google", name: "Google Gemini", tagline: "Generous free tier · text, vision & image", auth: "apikey", billing: "freemium", capabilities: ["text", "vision", "image"], docs: "https://aistudio.google.com/apikey" },
  { id: "openrouter", name: "OpenRouter", tagline: "300+ models · \":free\" variants auto-selected", auth: "apikey", billing: "freemium", capabilities: ["text", "vision", "image"], docs: "https://openrouter.ai/keys" },
  { id: "groq", name: "Groq", tagline: "Ultra-fast LPU inference · free tier", auth: "apikey", billing: "freemium", capabilities: ["text"], docs: "https://console.groq.com/keys" },
  { id: "cerebras", name: "Cerebras", tagline: "Blazing-fast open models · free tier", auth: "apikey", billing: "freemium", capabilities: ["text"], docs: "https://cloud.cerebras.ai/" },
  { id: "deepseek", name: "DeepSeek", tagline: "Top reasoning at near-zero cost", auth: "apikey", billing: "freemium", capabilities: ["text"], docs: "https://platform.deepseek.com/api_keys" },
  { id: "mistral", name: "Mistral", tagline: "European open models · free tier", auth: "apikey", billing: "freemium", capabilities: ["text"], docs: "https://console.mistral.ai/api-keys" },
  { id: "together", name: "Together AI", tagline: "Free credits · open text & image models", auth: "apikey", billing: "freemium", capabilities: ["text", "image"], docs: "https://api.together.xyz/settings/api-keys" },
  { id: "nvidia", name: "NVIDIA NIM", tagline: "Free NIM credits · LTX Video, Llama, Cosmos", auth: "apikey", billing: "freemium", capabilities: ["text", "vision", "image", "video"], docs: "https://build.nvidia.com" },
  { id: "replicate", name: "Replicate", tagline: "Free daily · LTX/Wan/MiniMax/OmniHuman video", auth: "token", billing: "freemium", capabilities: ["image", "video"], docs: "https://replicate.com/account/api-tokens" },
  { id: "luma", name: "Luma Dream Machine", tagline: "Cinematic text/image-to-video · free monthly", auth: "apikey", billing: "freemium", capabilities: ["video"], docs: "https://lumalabs.ai/dream-machine/api" },
  { id: "custom", name: "OpenAI-Compatible", tagline: "OpenAI, LM Studio, vLLM · any /v1 endpoint", auth: "apikey", billing: "paid", capabilities: ["text", "vision", "image"], docs: "https://platform.openai.com/api-keys" },
  { id: "simulator", name: "Local Simulator", tagline: "On-device engine · renders video offline (admin-gated)", auth: "none", billing: "free", capabilities: ["text", "image", "video", "tts"], docs: "Admin → Settings" },
];
export const providerDef = (id: string) => PROVIDER_REGISTRY.find((p) => p.id === id);

function mapProviderError(e: unknown, provider: string): ApiError {
  if (e instanceof ApiError) return e;
  const err = e as any;
  const status = err?.status ?? err?.response?.status;
  const msg = err?.message ?? String(e);
  if (status === 401 || status === 403) return new ApiError("INVALID_API_KEY", `${provider} rejected the API key (HTTP ${status}).`, 401);
  if (status === 402) return new ApiError("PROVIDER_BALANCE", `${provider} billing issue — no balance left.`, 402);
  if (status === 429) return new ApiError("RATE_LIMITED", `${provider} rate limit reached. Wait a moment and retry.`, 429);
  if (status === 404) return new ApiError("MODEL_UNAVAILABLE", `Model endpoint not found on ${provider}.`, 404);
  if (status >= 500) return new ApiError("PROVIDER_DOWN", `${provider} is having trouble (HTTP ${status}).`, 502);
  if (e instanceof TypeError) return new ApiError("NETWORK", `Could not reach ${provider}. Check network/CORS/endpoint.`, 0);
  return new ApiError("PROVIDER_ERROR", `${provider}: ${msg}`, 502);
}
async function timed<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const t0 = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t0) };
}
export async function urlToBlob(u: string, signal?: AbortSignal): Promise<Blob> {
  const r = await fetch(u, { signal });
  if (!r.ok) throw new ApiError("ASSET_FETCH", `Failed to download asset (HTTP ${r.status}).`, 502);
  return r.blob();
}
const blobToDataUri = (b: Blob) => new Promise<string>((res, rej) => {
  const fr = new FileReader();
  fr.onload = () => res(String(fr.result));
  fr.onerror = () => rej(new Error("read failed"));
  fr.readAsDataURL(b);
});

// ── Pollinations (free, zero-config) ──
export const pollinations: AIProviderAdapter = {
  id: "pollinations",
  async validate() {
    try {
      const { value: res, ms } = await timed(() => fetch("https://image.pollinations.ai/models", { signal: AbortSignal.timeout(10000) }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return { ok: true, message: `Pollinations reachable · free models live · ${ms}ms` };
    } catch (e) { return { ok: false, message: mapProviderError(e, "Pollinations").message }; }
  },
  async health(): Promise<HealthResult> {
    const t0 = performance.now();
    try {
      const res = await fetch("https://image.pollinations.ai/models", { signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(): Promise<DiscoveredModel[]> {
    return [
      { name: "flux", displayName: "FLUX (best quality)", capabilities: ["image"], pricingNote: "FREE · no key" },
      { name: "turbo", displayName: "Turbo (fastest)", capabilities: ["image"], pricingNote: "FREE · no key" },
      { name: "openai", displayName: "GPT text", capabilities: ["text"], pricingNote: "FREE · no key" },
    ];
  },
  async generate(_cfg, req, onStage): Promise<GenResult> {
    if (req.type === "image") {
      const model = req.modelHint && req.modelHint !== "openai" ? req.modelHint : "flux";
      const w = req.width ?? 1024, h = req.height ?? 1024;
      const seed = req.seed ?? Math.floor(Math.random() * 1e9);
      const prompt = `${req.prompt}${req.style ? `, ${req.style} style` : ""}${req.negative ? `. Avoid: ${req.negative}` : ""}`;
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&model=${encodeURIComponent(model)}&nologo=true&referrer=ai-creative-studio`;
      onStage(`Generating with Pollinations ${model} (free, no key)…`);
      let res: Response;
      try { res = await fetch(url, { signal: req.signal }); } catch (e) { throw mapProviderError(e, "Pollinations"); }
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Pollinations");
      onStage("Downloading your free image…");
      const blob = await res.blob();
      if (!blob.type.startsWith("image")) throw new ApiError("UNSUPPORTED_OUTPUT", "Pollinations returned a non-image response.", 422);
      return { blob, mime: blob.type, width: w, height: h, meta: { model, free: true, seed } };
    }
    if (req.type === "text") {
      const model = req.modelHint && !["flux", "turbo"].includes(req.modelHint) ? req.modelHint : "openai";
      onStage(`Generating text with Pollinations ${model} (free)…`);
      let res: Response;
      try { res = await fetch(`https://text.pollinations.ai/${encodeURIComponent(req.prompt.slice(0, 3500))}?model=${encodeURIComponent(model)}`, { signal: req.signal }); } catch (e) { throw mapProviderError(e, "Pollinations"); }
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Pollinations");
      const text = await res.text();
      if (!text.trim()) throw new ApiError("EMPTY_OUTPUT", "Pollinations returned an empty response.", 502);
      return { mime: "text/plain", text, meta: { model, free: true } };
    }
    throw new ApiError("UNSUPPORTED", `Pollinations supports image and text only — not ${req.type}.`, 422);
  },
};

// ── Ollama (local) ──
export function normalizeOllamaEndpoint(e: string): string {
  let ep = (e || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//.test(ep)) ep = `http://${ep}`;
  return ep;
}
export const ollama: AIProviderAdapter = {
  id: "ollama",
  async validate(cfg) {
    const ep = normalizeOllamaEndpoint(cfg.endpoint ?? "");
    try {
      const { value: res, ms } = await timed(() => fetch(`${ep}/api/tags`, { signal: AbortSignal.timeout(6000) }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const data = await res.json();
      const n = data.models?.length ?? 0;
      return { ok: true, message: `Ollama reachable · ${n} installed model${n === 1 ? "" : "s"} · ${ms}ms` };
    } catch (e) {
      return {
        ok: false,
        message: `Could not connect to Ollama at ${ep}. ` + (e instanceof TypeError
          ? "Unreachable from the browser — make sure Ollama is running (ollama serve) with OLLAMA_ORIGINS=*, or run the local bridge (node local-bridge.mjs)."
          : mapProviderError(e, "Ollama").message),
      };
    }
  },
  async health(cfg): Promise<HealthResult> {
    const ep = normalizeOllamaEndpoint(cfg.endpoint ?? "");
    const t0 = performance.now();
    try {
      const res = await fetch(`${ep}/api/tags`, { signal: AbortSignal.timeout(6000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(cfg): Promise<DiscoveredModel[]> {
    const ep = normalizeOllamaEndpoint(cfg.endpoint ?? "");
    const res = await fetch(`${ep}/api/tags`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Ollama");
    const data = await res.json();
    return (data.models ?? []).map((m: any) => ({
      name: m.name, displayName: m.name,
      capabilities: (/vision|vl|llava|moondream|bakllava/i.test(m.name) ? ["text", "vision"] : ["text"]) as Capability[],
      size: m.size ? `${(m.size / 1e9).toFixed(1)} GB` : undefined,
      pricingNote: "Local · free",
    }));
  },
  async generate(cfg, req, onStage) {
    if (req.type !== "text") {
      throw new ApiError("UNSUPPORTED",
        `Ollama runs text/vision language models — it does not support ${req.type} generation. Connect Replicate, Luma, NVIDIA NIM or Hugging Face for video/images.`, 422);
    }
    const ep = normalizeOllamaEndpoint(cfg.endpoint ?? "");
    const model = req.modelHint ?? cfg.model ?? "llama3.2";
    onStage(`Running ${model} on your local Ollama…`);
    let res: Response;
    try {
      res = await fetch(`${ep}/api/generate`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: req.signal,
        body: JSON.stringify({ model, prompt: req.prompt, stream: false, options: { temperature: req.temperature ?? 0.7, seed: req.seed } }),
      });
    } catch { throw new ApiError("OLLAMA_UNREACHABLE", `Ollama at ${ep} stopped responding. Is "ollama serve" running?`, 0); }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (/not found/i.test(body)) throw new ApiError("MODEL_UNAVAILABLE", `Model "${model}" not installed. Run: ollama pull ${model}`, 404);
      throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 140)}`), { status: res.status }), "Ollama");
    }
    const data = await res.json();
    if (!data.response) throw new ApiError("EMPTY_OUTPUT", "Ollama returned an empty response.", 502);
    return { mime: "text/plain", text: data.response, meta: { model, local: true } };
  },
};

// ── Hugging Face (Inference Providers route) ──
const HF_INFER = "https://router.huggingface.co/hf-inference/models";
export const huggingface: AIProviderAdapter = {
  id: "huggingface",
  async validate(cfg) {
    try {
      const { value: res, ms } = await timed(() => fetch("https://huggingface.co/api/whoami-v2", { headers: { Authorization: `Bearer ${cfg.apiKey}` } }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      const me = await res.json();
      return { ok: true, message: `Token verified · @${me.name ?? "user"} · ${ms}ms` };
    } catch (e) { return { ok: false, message: mapProviderError(e, "Hugging Face").message }; }
  },
  async health(cfg): Promise<HealthResult> {
    const t0 = performance.now();
    try {
      const res = await fetch("https://huggingface.co/api/models?limit=1", { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(): Promise<DiscoveredModel[]> {
    return [
      { name: "black-forest-labs/FLUX.1-schnell", displayName: "FLUX.1 Schnell", capabilities: ["image"], pricingNote: "Free tier" },
      { name: "Lightricks/LTX-Video", displayName: "LTX Video", capabilities: ["video"], pricingNote: "Free tier · slow" },
      { name: "mistralai/Mistral-7B-Instruct-v0.3", displayName: "Mistral 7B", capabilities: ["text"], pricingNote: "Free tier" },
      { name: "microsoft/speecht5_tts", displayName: "SpeechT5 TTS", capabilities: ["audio", "tts"], pricingNote: "Free tier" },
    ];
  },
  async generate(cfg, req, onStage) {
    const model = req.modelHint ?? cfg.model;
    const headers = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" };
    if (req.type === "image") {
      const imageModel = model && model.includes("/") ? model : "black-forest-labs/FLUX.1-schnell";
      onStage(`Queueing ${imageModel} on HF Inference…`);
      let res: Response;
      try {
        res = await fetch(`${HF_INFER}/${imageModel}`, {
          method: "POST", headers, signal: req.signal,
          body: JSON.stringify({ inputs: `${req.prompt}${req.style ? `, ${req.style} style` : ""}${req.negative ? `. Avoid: ${req.negative}` : ""}`, parameters: { negative_prompt: req.negative, seed: req.seed } }),
        });
      } catch (e) { throw mapProviderError(e, "Hugging Face"); }
      if (res.status === 503) throw new ApiError("MODEL_LOADING", `HF is loading ${imageModel} (cold start). Try again in ~30s.`, 503);
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Hugging Face");
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("image")) throw new ApiError("UNSUPPORTED_OUTPUT", "HF returned non-image data.", 422);
      onStage("Downloading image…");
      return { blob: await res.blob(), mime: ct, meta: { model: imageModel, free: true } };
    }
    if (req.type === "video") {
      const videoModel = model && model.includes("/") ? model : "Lightricks/LTX-Video";
      onStage(`Queueing ${videoModel} on HF (free tier — can be slow)…`);
      let res: Response;
      try {
        res = await fetch(`${HF_INFER}/${videoModel}`, { method: "POST", headers, signal: req.signal, body: JSON.stringify({ inputs: req.prompt, parameters: { seed: req.seed } }) });
      } catch (e) { throw mapProviderError(e, "Hugging Face"); }
      if (res.status === 503) throw new ApiError("MODEL_LOADING", `HF is loading ${videoModel} — video is slow on the free tier. Try Replicate or Luma, or retry shortly.`, 503);
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Hugging Face");
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("video") && !ct.includes("octet-stream")) throw new ApiError("UNSUPPORTED_OUTPUT", "HF did not return a video. Try Replicate, Luma or NVIDIA NIM.", 422);
      onStage("Downloading video…");
      return { blob: await res.blob(), mime: ct || "video/mp4", meta: { model: videoModel, free: true } };
    }
    if (req.type === "text") {
      const textModel = model && model.includes("/") ? model : "mistralai/Mistral-7B-Instruct-v0.3";
      onStage(`Generating text with ${textModel}…`);
      let res: Response;
      try {
        res = await fetch(`${HF_INFER}/${textModel}`, {
          method: "POST", headers, signal: req.signal,
          body: JSON.stringify({ inputs: req.prompt, parameters: { max_new_tokens: 512, temperature: req.temperature ?? 0.7, return_full_text: false } }),
        });
      } catch (e) { throw mapProviderError(e, "Hugging Face"); }
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Hugging Face");
      const data = await res.json();
      const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
      if (!text) throw new ApiError("EMPTY_OUTPUT", "HF returned an empty response.", 502);
      return { mime: "text/plain", text, meta: { model: textModel, free: true } };
    }
    throw new ApiError("UNSUPPORTED", `HF adapter does not support ${req.type}.`, 422);
  },
};

// ── OpenRouter ──
const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
export const openrouter: AIProviderAdapter = {
  id: "openrouter",
  async validate(cfg) {
    try {
      const { value: res, ms } = await timed(() => fetch(`${OPENROUTER_BASE}/key`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return { ok: true, message: `OpenRouter key verified · ${ms}ms` };
    } catch (e) { return { ok: false, message: mapProviderError(e, "OpenRouter").message }; }
  },
  async health(): Promise<HealthResult> {
    const t0 = performance.now();
    try {
      const res = await fetch(`${OPENROUTER_BASE}/models`, { signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(cfg): Promise<DiscoveredModel[]> {
    const res = await fetch(`${OPENROUTER_BASE}/models`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "OpenRouter");
    const data = await res.json();
    return (data.data ?? []).filter((m: any) => /image|vision|text/.test(m.architecture?.modality ?? "")).slice(0, 400).map((m: any) => {
      const modality: string = m.architecture?.modality ?? "text->text";
      const caps: Capability[] = ["text"];
      if (modality.split("->")[1]?.includes("image")) caps.push("image");
      if (modality.includes("image->")) caps.push("vision");
      const isFree = Number(m.pricing?.prompt) === 0 || m.id.endsWith(":free");
      return { name: m.id, displayName: m.name ?? m.id, capabilities: caps, context: m.context_length ?? null, pricingNote: isFree ? "FREE" : "paid" };
    });
  },
  async generate(cfg, req, onStage) {
    const headers = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", "HTTP-Referer": location.origin, "X-Title": "AI Creative Studio" };
    if (req.type === "image") {
      const imageModel = req.modelHint && /image/.test(req.modelHint) ? req.modelHint : "google/gemini-2.5-flash-image";
      onStage(`Requesting image from ${imageModel} via OpenRouter…`);
      let res: Response;
      try {
        res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST", headers, signal: req.signal,
          body: JSON.stringify({ model: imageModel, messages: [{ role: "user", content: `Generate an image: ${req.prompt}${req.style ? `. Style: ${req.style}` : ""}` }] }),
        });
      } catch (e) { throw mapProviderError(e, "OpenRouter"); }
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "OpenRouter");
      const data = await res.json();
      const parts: any = data.choices?.[0]?.message?.content;
      let imageUrl: string | null = null;
      if (typeof parts === "string") imageUrl = parts.match(/https?:\/\/[^\s")]+/)?.[0] ?? null;
      else if (Array.isArray(parts)) imageUrl = parts.find((p) => p.type === "image_url")?.image_url?.url ?? null;
      if (!imageUrl) throw new ApiError("UNSUPPORTED_OUTPUT", "That OpenRouter model did not return image data.", 422);
      onStage("Downloading generated image…");
      const blob = await urlToBlob(imageUrl, req.signal);
      return { blob, mime: blob.type || "image/png", meta: { model: imageModel } };
    }
    if (req.type === "text") {
      onStage("Generating text via OpenRouter…");
      let res: Response;
      try {
        res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST", headers, signal: req.signal,
          body: JSON.stringify({ model: req.modelHint ?? cfg.model ?? "meta-llama/llama-3.3-70b-instruct:free", temperature: req.temperature ?? 0.7, messages: [{ role: "user", content: req.prompt }] }),
        });
      } catch (e) { throw mapProviderError(e, "OpenRouter"); }
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "OpenRouter");
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) throw new ApiError("EMPTY_OUTPUT", "OpenRouter returned an empty response.", 502);
      return { mime: "text/plain", text, meta: { model: req.modelHint } };
    }
    throw new ApiError("UNSUPPORTED", `OpenRouter does not support ${req.type} generation.`, 422);
  },
};

// ── Generic OpenAI-compatible factory ──
function makeOpenAICompat(id: string, base: string, opts: { image?: boolean; vision?: boolean } = {}): AIProviderAdapter {
  const label = id.charAt(0).toUpperCase() + id.slice(1);
  return {
    id,
    async validate(cfg) {
      try {
        const { value: res, ms } = await timed(() => fetch(`${base}/models`, { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, signal: AbortSignal.timeout(8000) }));
        if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
        const data = await res.json().catch(() => ({}));
        return { ok: true, message: `${label} key verified · ${(data.data ?? []).length} models · ${ms}ms` };
      } catch (e) { return { ok: false, message: mapProviderError(e, label).message }; }
    },
    async health(cfg): Promise<HealthResult> {
      const t0 = performance.now();
      try {
        const res = await fetch(`${base}/models`, { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, signal: AbortSignal.timeout(6000) });
        return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
      } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
    },
    async listModels(cfg): Promise<DiscoveredModel[]> {
      const res = await fetch(`${base}/models`, { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), label);
      const data = await res.json();
      return (data.data ?? []).slice(0, 300).map((m: any) => {
        const mid = m.id ?? m.name;
        const caps: Capability[] = ["text"];
        if (opts.vision && /vision|gpt-4o|llava|gemini/i.test(mid)) caps.push("vision");
        if (opts.image && /dall|flux|sd|image|sdxl/i.test(mid)) caps.push("image");
        return { name: mid, displayName: mid, capabilities: caps, pricingNote: `${label} pricing` };
      });
    },
    async generate(cfg, req, onStage) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
      Object.entries(cfg.extra ?? {}).forEach(([k, v]) => { if (v && k !== "allowPaid" && k !== "imageEndpoint") headers[k] = v; });
      if (req.type === "image") {
        const ep = cfg.extra?.imageEndpoint?.trim() || `${base}/images/generations`;
        onStage(`Requesting image from ${ep}…`);
        let res: Response;
        try {
          res = await fetch(ep, { method: "POST", headers, signal: req.signal, body: JSON.stringify({ model: req.modelHint ?? cfg.model, prompt: req.prompt, n: 1, size: `${req.width ?? 1024}x${req.height ?? 1024}` }) });
        } catch (e) { throw mapProviderError(e, label); }
        if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), label);
        const data = await res.json();
        const item = data.data?.[0];
        let blob: Blob;
        if (item?.b64_json) blob = new Blob([Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0))], { type: "image/png" });
        else if (item?.url) blob = await urlToBlob(item.url, req.signal);
        else throw new ApiError("UNSUPPORTED_OUTPUT", "Endpoint returned no image data.", 422);
        return { blob, mime: blob.type || "image/png", meta: { model: req.modelHint ?? cfg.model } };
      }
      if (req.type === "text") {
        onStage(`Generating text via ${label}…`);
        let res: Response;
        try {
          res = await fetch(`${base}/chat/completions`, {
            method: "POST", headers, signal: req.signal,
            body: JSON.stringify({ model: req.modelHint ?? cfg.model, temperature: req.temperature ?? 0.7, messages: [{ role: "user", content: req.prompt }] }),
          });
        } catch (e) { throw mapProviderError(e, label); }
        if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), label);
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new ApiError("EMPTY_OUTPUT", `${label} returned an empty response.`, 502);
        return { mime: "text/plain", text, meta: { model: req.modelHint ?? cfg.model } };
      }
      throw new ApiError("UNSUPPORTED", `${label} does not support ${req.type} generation.`, 422);
    },
  };
}

export const openaiCompatible = makeOpenAICompat("custom", "", { image: true, vision: true });
export const groq = makeOpenAICompat("groq", "https://api.groq.com/openai/v1", { vision: true });
export const cerebras = makeOpenAICompat("cerebras", "https://api.cerebras.ai/v1");
export const deepseek = makeOpenAICompat("deepseek", "https://api.deepseek.com/v1");
export const mistral = makeOpenAICompat("mistral", "https://api.mistral.ai/v1");
export const together = makeOpenAICompat("together", "https://api.together.xyz/v1", { image: true });
export const google = makeOpenAICompat("google", "https://generativelanguage.googleapis.com/v1beta/openai", { image: true, vision: true });

// ── NVIDIA NIM (text via OpenAI-compat + LTX video) ──
const NIM_BASE = "https://integrate.api.nvidia.com/v1";
const nimText = makeOpenAICompat("nvidia", NIM_BASE, { vision: true });
export const nvidia: AIProviderAdapter = {
  id: "nvidia",
  validate: nimText.validate, health: nimText.health, listModels: nimText.listModels,
  async generate(cfg, req, onStage) {
    if (req.type !== "video" && req.type !== "character") return nimText.generate(cfg, req, onStage);
    const headers = { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Accept: "text/event-stream" };
    onStage("Rendering video on NVIDIA NIM (LTX Video)…");
    const w = Math.min(1280, req.width ?? 1216), h = Math.min(768, req.height ?? 704);
    const numFrames = Math.min(257, Math.max(9, Math.round((req.duration ?? 5) * 24) + 1));
    let res: Response;
    try {
      res = await fetch(`${NIM_BASE}/genai/lightricks/ltx-video`, {
        method: "POST", headers, signal: req.signal,
        body: JSON.stringify({ prompt: req.prompt, height: h, width: w, num_frames: numFrames, frame_rate: 24, seed: req.seed ?? 0, guidance_scale: 3 }),
      });
    } catch (e) { throw mapProviderError(e, "NVIDIA NIM"); }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 402 || /credit/i.test(body)) throw new ApiError("PROVIDER_BALANCE", "NIM free credits exhausted — they refresh monthly.", 402);
      throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 140)}`), { status: res.status }), "NVIDIA NIM");
    }
    const raw = await res.text();
    let videoUrl: string | null = null;
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("")) continue;
      try {
        const ev = JSON.parse(t.slice(5).trim());
        if (req.cancelCheck?.()) throw new ApiError("CANCELLED", "Generation cancelled.", 499);
        const cand = ev.content?.url ?? ev.content?.[0]?.url ?? ev.url ?? null;
        if (cand && typeof cand === "string") videoUrl = cand;
      } catch { /* partial */ }
    }
    if (!videoUrl) throw new ApiError("UNSUPPORTED_OUTPUT", "NIM finished without a video URL — model may be busy. Try Replicate or Luma.", 502);
    onStage("Downloading your NIM video…");
    const blob = await urlToBlob(videoUrl, req.signal);
    return { blob, mime: blob.type || "video/mp4", meta: { model: "lightricks/ltx-video", free: true } };
  },
};

// ── Replicate (async predictions; real video incl. OmniHuman) ──
const REP_BASE = "https://api.replicate.com/v1";
const repHeaders = (cfg: ProviderCfg) => ({ Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json", Prefer: "wait" });
async function repCreate(cfg: ProviderCfg, version: string, input: Record<string, any>, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(`${REP_BASE}/models/${version}/predictions`, { method: "POST", headers: repHeaders(cfg), signal, body: JSON.stringify({ input }) });
  } catch (e) { throw mapProviderError(e, "Replicate"); }
  if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Replicate");
  return res.json();
}
async function repPoll(cfg: ProviderCfg, pred: any, onStage: (s: string, honest?: boolean) => void, cancelCheck?: () => boolean) {
  let p = pred;
  let guard = 0;
  while (!["succeeded", "failed", "canceled"].includes(p.status)) {
    if (cancelCheck?.()) throw new ApiError("CANCELLED", "Generation cancelled.", 499);
    if (++guard > 240) throw new ApiError("TIMEOUT", "Replicate job timed out after ~8 min.", 504);
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`${REP_BASE}/predictions/${p.id}`, { headers: repHeaders(cfg) });
    if (!res.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}`), { status: res.status }), "Replicate");
    p = await res.json();
    onStage(`Replicate: ${p.status}${p.metrics?.predict_time ? ` · ${Math.round(p.metrics.predict_time)}s` : ""}…`, false);
  }
  if (p.status !== "succeeded") throw new ApiError("PROVIDER_ERROR", `Replicate job ${p.status}: ${p.error ?? "unknown error"}`, 502);
  return p.output;
}
const firstUrl = (out: any): string | null => {
  if (typeof out === "string") return out;
  if (Array.isArray(out)) return typeof out[0] === "string" ? out[0] : firstUrl(out[0]);
  if (out?.url) return out.url;
  if (out?.video?.url) return out.video.url;
  return null;
};
export const replicate: AIProviderAdapter = {
  id: "replicate",
  async validate(cfg) {
    try {
      const { value: res, ms } = await timed(() => fetch(`${REP_BASE}/account`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return { ok: true, message: `Replicate token verified · ${ms}ms` };
    } catch (e) { return { ok: false, message: mapProviderError(e, "Replicate").message }; }
  },
  async health(cfg): Promise<HealthResult> {
    const t0 = performance.now();
    try {
      const res = await fetch(`${REP_BASE}/account`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(): Promise<DiscoveredModel[]> {
    return [
      { name: "lucataco/ltx-video-13b-distilled", displayName: "LTX Video 13B", capabilities: ["video"], pricingNote: "Free daily" },
      { name: "chenxwh/wan2.1-1.3b", displayName: "Wan 2.1", capabilities: ["video"], pricingNote: "Free daily" },
      { name: "bytedance/omni-human-1.5", displayName: "OmniHuman 1.5 (character)", capabilities: ["video"], pricingNote: "Free daily" },
      { name: "black-forest-labs/flux-schnell", displayName: "FLUX Schnell", capabilities: ["image"], pricingNote: "Free daily" },
    ];
  },
  async generate(cfg, req, onStage) {
    const model = req.modelHint ?? cfg.model ?? "lucataco/ltx-video-13b-distilled";
    if (req.type === "image") {
      onStage(`Generating image with ${model} on Replicate…`);
      const pred = await repCreate(cfg, model, { prompt: req.prompt, aspect_ratio: req.aspect ?? "16:9", seed: req.seed }, req.signal);
      const out = await repPoll(cfg, pred, onStage, req.cancelCheck);
      const url = firstUrl(out);
      if (!url) throw new ApiError("UNSUPPORTED_OUTPUT", "Replicate returned no image URL.", 422);
      onStage("Downloading image…");
      const blob = await urlToBlob(url, req.signal);
      return { blob, mime: blob.type || "image/png", meta: { model, free: true } };
    }
    if (req.type === "video") {
      onStage(`Queueing ${model} on Replicate (free tier)…`);
      const input: Record<string, any> = { prompt: req.prompt, seed: req.seed };
      if (/ltx/i.test(model)) { input.width = Math.min(1280, req.width ?? 1216); input.height = Math.min(768, req.height ?? 704); input.num_frames = Math.min(257, Math.round((req.duration ?? 5) * 24) + 1); }
      const pred = await repCreate(cfg, model, input, req.signal);
      const out = await repPoll(cfg, pred, onStage, req.cancelCheck);
      const url = firstUrl(out);
      if (!url) throw new ApiError("UNSUPPORTED_OUTPUT", "Replicate returned no video URL.", 422);
      onStage("Downloading your video…");
      const blob = await urlToBlob(url, req.signal);
      return { blob, mime: blob.type || "video/mp4", meta: { model, free: true } };
    }
    if (req.type === "character") {
      if (!req.characterImageUrl) throw new ApiError("MISSING_INPUT", "Character video needs a character image.", 422);
      onStage("Synthesising narration voice (HF SpeechT5, free)…");
      let audioUrl: string | null = null;
      try {
        const ttsRes = await fetch(`${HF_INFER}/microsoft/speecht5_tts`, {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: req.signal,
          body: JSON.stringify({ inputs: (req.script || req.prompt).slice(0, 400) }),
        });
        if (ttsRes.ok && (ttsRes.headers.get("content-type") ?? "").startsWith("audio")) {
          audioUrl = await blobToDataUri(await ttsRes.blob());
        }
      } catch { /* proceed without audio */ }
      if (!audioUrl) onStage("TTS unavailable — generating silent character video.", true);
      onStage(`Animating character with OmniHuman 1.5 on Replicate…`);
      const pred = await repCreate(cfg, "bytedance/omni-human-1.5", { image: req.characterImageUrl, audio: audioUrl ?? "", seed: req.seed }, req.signal);
      const out = await repPoll(cfg, pred, onStage, req.cancelCheck);
      const url = firstUrl(out);
      if (!url) throw new ApiError("UNSUPPORTED_OUTPUT", "OmniHuman returned no video URL.", 422);
      onStage("Downloading your character video…");
      const blob = await urlToBlob(url, req.signal);
      return { blob, mime: blob.type || "video/mp4", meta: { model: "bytedance/omni-human-1.5", free: true } };
    }
    throw new ApiError("UNSUPPORTED", `Replicate adapter supports image/video/character — not ${req.type}.`, 422);
  },
};

// ── Luma Dream Machine ──
const LUMA_BASE = "https://api.lumalabs.ai/dream-machine/v1";
export const luma: AIProviderAdapter = {
  id: "luma",
  async validate(cfg) {
    try {
      const { value: res, ms } = await timed(() => fetch(`${LUMA_BASE}/generations/image?page_size=1`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } }));
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
      return { ok: true, message: `Luma key verified · ${ms}ms` };
    } catch (e) { return { ok: false, message: mapProviderError(e, "Luma").message }; }
  },
  async health(cfg): Promise<HealthResult> {
    const t0 = performance.now();
    try {
      const res = await fetch(`${LUMA_BASE}/generations/image?page_size=1`, { headers: { Authorization: `Bearer ${cfg.apiKey}` }, signal: AbortSignal.timeout(8000) });
      return { ok: res.ok, latencyMs: Math.round(performance.now() - t0) };
    } catch { return { ok: false, latencyMs: Math.round(performance.now() - t0), message: "unreachable" }; }
  },
  async listModels(): Promise<DiscoveredModel[]> {
    return [{ name: "photon-1", displayName: "Luma Photon", capabilities: ["video"], pricingNote: "Free monthly" }];
  },
  async generate(cfg, req, onStage) {
    if (req.type !== "video" && req.type !== "character") throw new ApiError("UNSUPPORTED", `Luma generates video only — not ${req.type}.`, 422);
    const model = req.modelHint && req.modelHint !== "dream-machine" ? req.modelHint : "photon-1";
    onStage(`Queueing ${model} on Luma Dream Machine…`);
    let res: Response;
    try {
      res = await fetch(`${LUMA_BASE}/generations/video`, {
        method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" }, signal: req.signal,
        body: JSON.stringify({
          prompt: req.prompt, model, loop: false, aspect_ratio: req.aspect ?? "16:9",
          ...(req.characterImageUrl ? { keyframes: { frame0: { type: "image", url: req.characterImageUrl } } } : {}),
        }),
      });
    } catch (e) { throw mapProviderError(e, "Luma"); }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 429 || /quota|limit/i.test(body)) throw new ApiError("RATE_LIMITED", "Luma free monthly quota reached — resets each month.", 429);
      throw mapProviderError(Object.assign(new Error(`HTTP ${res.status}: ${body.slice(0, 140)}`), { status: res.status }), "Luma");
    }
    let gen = await res.json();
    let guard = 0;
    while (!["completed", "failed"].includes(gen.state)) {
      if (req.cancelCheck?.()) throw new ApiError("CANCELLED", "Generation cancelled.", 499);
      if (++guard > 240) throw new ApiError("TIMEOUT", "Luma job timed out.", 504);
      await new Promise((r) => setTimeout(r, 2500));
      const pr = await fetch(`${LUMA_BASE}/generations/video/${gen.id}`, { headers: { Authorization: `Bearer ${cfg.apiKey}` } });
      if (!pr.ok) throw mapProviderError(Object.assign(new Error(`HTTP ${pr.status}`), { status: pr.status }), "Luma");
      gen = await pr.json();
      onStage(`Luma: ${gen.state}…`, false);
    }
    if (gen.state === "failed") throw new ApiError("PROVIDER_ERROR", `Luma failed: ${gen.failure_reason ?? "unknown"}`, 502);
    const url = gen.assets?.video;
    if (!url) throw new ApiError("UNSUPPORTED_OUTPUT", "Luma returned no video URL.", 422);
    onStage("Downloading your Luma video…");
    const blob = await urlToBlob(url, req.signal);
    return { blob, mime: blob.type || "video/mp4", meta: { model, free: true } };
  },
};

// ── Local simulator adapter ──
export const simulator: AIProviderAdapter = {
  id: "simulator",
  async validate() { return { ok: true, message: "Local engine ready (development mock — clearly labelled output)" }; },
  async health(): Promise<HealthResult> { return { ok: true, latencyMs: 0 }; },
  async listModels(): Promise<DiscoveredModel[]> {
    return [{ name: "studio-sim-v1", displayName: "Studio Simulator v1", capabilities: ["text", "image", "video", "tts"], pricingNote: "On-device · 0 credits" }];
  },
  async generate(_cfg, req, onStage) {
    if (req.type === "image") { onStage("Composing procedural artwork…"); return simImage(req); }
    if (req.type === "video") return simVideo(req, onStage, req.cancelCheck ?? (() => false));
    if (req.type === "character") return simCharacterVideo(req, onStage, req.cancelCheck ?? (() => false));
    if (req.type === "text") return simText(req);
    if (req.type === "poster") { onStage("Poster composition happens on the canvas."); return { mime: "image/png", meta: { simulated: true } }; }
    throw new ApiError("UNSUPPORTED", `Simulator does not support ${req.type}.`, 422);
  },
};

export const ADAPTERS: Record<string, AIProviderAdapter> = {
  pollinations, ollama, huggingface, google, openrouter, groq, cerebras, deepseek, mistral, together, nvidia, replicate, luma, custom: openaiCompatible, simulator,
};
export const adapterFor = (providerId: string): AIProviderAdapter => {
  const a = ADAPTERS[providerId];
  if (!a) throw new ApiError("UNKNOWN_PROVIDER", `No adapter registered for "${providerId}".`, 404);
  return a;
};
