// ── Local Simulator: procedural on-device rendering (clearly labelled "SIMULATED").
// Used ONLY when an admin enables mock mode or the user explicitly picks it.
import { GenRequest, GenResult } from "../../lib/types";
import { hashStr, mulberry32 } from "../../lib/utils";

export const SIM_CAP = 15; // seconds — real-time WebM render cap

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
function wordsOf(s: string): string[] {
  return s.toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 4);
}
function renderArt(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, words: string[], opts: { title?: string; watermark?: boolean } = {}) {
  const hue = Math.floor(rnd() * 360);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 50%, 14%)`);
  g.addColorStop(1, `hsl(${(hue + 80) % 360}, 45%, 8%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, r = (rnd() * 0.32 + 0.04) * Math.min(w, h);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${(hue + rnd() * 140) % 360}, 75%, 58%, ${0.1 + rnd() * 0.2})`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // horizon bands
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = `hsla(${(hue + 40 + i * 30) % 360}, 60%, 50%, ${0.05 + rnd() * 0.05})`;
    const y = h * (0.45 + rnd() * 0.5);
    ctx.fillRect(0, y, w, h * 0.02);
  }
  if (opts.title !== undefined) {
    ctx.fillStyle = "rgba(238,242,250,0.85)";
    ctx.font = `700 ${Math.max(20, w * 0.045)}px "Space Grotesk", sans-serif`;
    ctx.fillText(opts.title || words.join(" "), w * 0.06, h * 0.88);
  }
  if (opts.watermark !== false) {
    ctx.fillStyle = "rgba(228,233,242,0.55)";
    ctx.font = `600 ${Math.max(11, w * 0.02)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right";
    ctx.fillText("SIMULATED · AI CREATIVE STUDIO", w - 12, h - 12);
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
    renderArt(c.getContext("2d")!, w, h, mulberry32(seed), words, { title: undefined });
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

export async function simText(req: GenRequest): Promise<GenResult> {
  return { mime: "text/plain", text: `[Local Simulator] Structured draft for: ${req.prompt}`, meta: { simulated: true } };
}

async function canvasToFrame(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("frame encode failed"))), "image/webp", 0.8));
}

export async function simVideo(req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelCheck: () => boolean): Promise<GenResult> {
  const dur = Math.min(SIM_CAP, req.duration ?? 5);
  const w = Math.min(960, req.width ?? 960), h = Math.min(540, Math.round((w * (req.height ?? 540)) / (req.width ?? 960)));
  onStage("Preparing on-device render (Local Simulator)…");
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  const seed = req.seed ?? hashStr(req.prompt);
  const rnd = mulberry32(seed);
  const words = wordsOf(`${req.prompt} ${req.style ?? ""}`);

  const stream = c.captureStream(24);
  let mime = "video/webm;codecs=vp9";
  if (!MediaRecorder.isTypeSupported(mime)) mime = "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
  rec.start(250);
  onStage(`Rendering ${dur}s of frames in real time…`, true);

  const fps = 24; const total = dur * fps;
  const t0 = performance.now();
  for (let f = 0; f < total; f++) {
    if (cancelCheck()) { rec.stop(); await stopped; throw new Error("CANCELLED"); }
    const t = f / fps;
    renderArt(ctx, w, h, mulberry32(seed + Math.floor(t * 2)), words, { watermark: true });
    // moving light sweep to convey motion
    const x = ((t / dur) * (w + 300)) - 150;
    const lg = ctx.createLinearGradient(x - 150, 0, x + 150, 0);
    lg.addColorStop(0, "transparent");
    lg.addColorStop(0.5, "rgba(255,193,77,0.16)");
    lg.addColorStop(1, "transparent");
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(238,242,250,0.8)";
    ctx.font = `600 ${Math.max(12, w * 0.022)}px "JetBrains Mono", monospace`;
    ctx.fillText(`t=${t.toFixed(1)}s · ${(req.camera ?? "Static")}`, 12, h - 12);
    // pace to real time
    const target = t0 + ((f + 1) / fps) * 1000;
    const wait = target - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (f % fps === 0) onStage(`Rendering frame ${f}/${total}…`, true);
  }
  rec.stop();
  await stopped;
  onStage("Encoding WebM…");
  const blob = new Blob(chunks, { type: "video/webm" });
  return { blob, mime: "video/webm", width: w, height: h, meta: { simulated: true, duration: dur } };
}

export async function simCharacterVideo(req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelCheck: () => boolean): Promise<GenResult> {
  return simVideo({ ...req, prompt: `${req.characterName ?? "Character"} — ${req.prompt}` }, onStage, cancelCheck);
}
