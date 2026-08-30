// Local procedural engine — ONLY used when the admin-gated mock mode is on.
// Output is always labelled "SIMULATED". Not a fake stand-in for real models.
import { GenRequest, GenResult } from "../../lib/types";
import { hashStr, mulberry32 } from "../../lib/utils";

export const SIM_CAP = 15; // max real-time render seconds

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
};
const wordsOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 4).join(" ").toUpperCase();

function renderArt(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, words: string, opts: { watermark?: boolean } = {}) {
  const hue = Math.floor(rnd() * 360);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 50%, 16%)`);
  g.addColorStop(1, `hsl(${(hue + 80) % 360}, 45%, 9%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 22; i++) {
    const x = rnd() * w, y = rnd() * h, r = (rnd() * 0.32 + 0.06) * Math.min(w, h);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${(hue + rnd() * 140) % 360}, 75%, 58%, ${0.14 + rnd() * 0.18})`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `hsla(${hue}, 60%, 80%, ${rnd() * 0.5})`;
    ctx.fillRect(rnd() * w, rnd() * h, rnd() * 2 + 0.5, rnd() * 2 + 0.5);
  }
  ctx.globalAlpha = 1;
  if (words) {
    ctx.fillStyle = "rgba(238,242,250,0.6)";
    ctx.font = `700 ${Math.max(14, w * 0.028)}px "Space Grotesk", sans-serif`;
    ctx.fillText(words, w * 0.05, h * 0.92);
  }
  if (opts.watermark !== false) {
    ctx.fillStyle = "rgba(255,193,77,0.55)";
    ctx.font = `700 ${Math.max(10, w * 0.014)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right";
    ctx.fillText("SIMULATED · AI CREATIVE STUDIO", w - 12, 20);
    ctx.textAlign = "left";
  }
}

export async function simImage(req: GenRequest): Promise<GenResult> {
  const count = Math.min(4, Math.max(1, req.count ?? 1));
  const w = req.width ?? 1024, h = req.height ?? 1024;
  const seed = req.seed ?? hashStr(req.prompt);
  const words = wordsOf(`${req.prompt} ${req.style ?? ""}`);
  if (count === 1) {
    const c = makeCanvas(w, h);
    renderArt(c.getContext("2d")!, w, h, mulberry32(seed), words);
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/png"));
    return { blob, mime: "image/png", width: w, height: h, meta: { simulated: true, seed } };
  }
  const cols = 2, rows = Math.ceil(count / cols);
  const cw = Math.round(w / cols), chh = Math.round(h / rows);
  const c = makeCanvas(cw * cols, chh * rows);
  const ctx = c.getContext("2d")!;
  for (let i = 0; i < count; i++) {
    ctx.save();
    ctx.translate((i % cols) * cw, Math.floor(i / cols) * chh);
    renderArt(ctx, cw, chh, mulberry32(seed + i * 7919 + 13), words, { watermark: false });
    ctx.restore();
  }
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/png"));
  return { blob, mime: "image/png", width: cw * cols, height: chh * rows, meta: { simulated: true, seed, count } };
}

export async function simVideo(req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelled: () => boolean): Promise<GenResult> {
  const dur = Math.min(SIM_CAP, req.duration ?? 5);
  const w = 1280, h = 720;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d")!;
  const seed = req.seed ?? hashStr(req.prompt);
  const rnd = mulberry32(seed);
  const baseHue = Math.floor(rnd() * 360);
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: "video/webm" });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => { rec.onstop = () => res(new Blob(chunks, { type: "video/webm" })); });

  onStage(`Rendering ${dur}s video on-device (real-time)…`);
  rec.start();
  const t0 = performance.now();
  const totalMs = dur * 1000;
  const words = wordsOf(req.prompt);
  await new Promise<void>((resolve) => {
    const tick = () => {
      if (cancelled()) { rec.stop(); resolve(); return; }
      const el = performance.now() - t0;
      const p = Math.min(1, el / totalMs);
      const t = el / 1000;
      const hue = (baseHue + t * 20) % 360;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, `hsl(${hue}, 50%, 15%)`);
      g.addColorStop(1, `hsl(${(hue + 80) % 360}, 45%, 8%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        const x = (Math.sin(t * 0.6 + i) * 0.5 + 0.5) * w;
        const y = (Math.cos(t * 0.4 + i * 1.7) * 0.5 + 0.5) * h;
        const r = 60 + Math.sin(t + i) * 30 + i * 14;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, `hsla(${(hue + i * 22) % 360}, 75%, 60%, 0.2)`);
        rg.addColorStop(1, "transparent");
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "rgba(238,242,250,0.75)";
      ctx.font = `700 34px "Space Grotesk", sans-serif`;
      ctx.fillText(words || "SIMULATED VIDEO", 48, h - 60);
      ctx.fillStyle = "rgba(255,193,77,0.6)";
      ctx.font = `700 14px "JetBrains Mono", monospace`;
      ctx.fillText(`SIMULATED · ${t.toFixed(1)}s / ${dur}s`, 48, 36);
      ctx.fillRect(48, h - 30, (w - 96) * p, 5);
      if (el >= totalMs) { rec.stop(); resolve(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const blob = await done;
  if (cancelled()) throw new Error("CANCELLED");
  onStage("Finalizing WebM…");
  return { blob, mime: "video/webm", width: w, height: h, meta: { simulated: true, seed, duration: dur } };
}

export async function simCharacterVideo(req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelled: () => boolean): Promise<GenResult> {
  onStage("Compositing character presenter (simulated)…");
  return simVideo(req, onStage, cancelled);
}

export async function simText(req: GenRequest): Promise<GenResult> {
  const text = `[SIMULATED OUTPUT — connect a real provider for live results]\n\nPrompt: ${req.prompt}\n\nThis structured template shows how the engine responds. Enable a connected provider (Pollinations, Ollama, Groq…) to get genuine generation.`;
  return { mime: "text/plain", text, meta: { simulated: true } };
}
