// Local procedural engine (admin-gated dev/mock mode). Renders REAL output
// on-device: PNG artwork and genuine WebM video via MediaRecorder. Labelled.
import { GenRequest, GenResult } from "../../lib/types";
import { hashStr, mulberry32 } from "../../lib/utils";

export const SIM_CAP = 15;

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
const wordsOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 3).slice(0, 4);

function renderArt(ctx: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, words: string[], opts: { watermark?: boolean } = {}) {
  const hue = Math.floor(rnd() * 360);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hue}, 45%, 12%)`);
  g.addColorStop(0.5, `hsl(${(hue + 40) % 360}, 50%, 18%)`);
  g.addColorStop(1, `hsl(${(hue + 90) % 360}, 40%, 10%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, r = (rnd() * 0.35 + 0.04) * Math.min(w, h);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `hsla(${(hue + rnd() * 120) % 360}, 70%, ${40 + rnd() * 30}%, ${0.16 + rnd() * 0.2})`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = `hsla(${hue}, 60%, 70%, 0.25)`; ctx.lineWidth = Math.max(1, w / 700);
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(rnd() * w, rnd() * h);
    ctx.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h);
    ctx.stroke();
  }
  if (words.length) {
    ctx.fillStyle = "rgba(238,242,250,0.85)";
    ctx.font = `700 ${Math.max(14, w * 0.032)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(words.slice(0, 3).join(" · "), w * 0.06, h * 0.92);
  }
  if (opts.watermark !== false) {
    ctx.font = `600 ${Math.max(10, w * 0.016)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(255,193,77,0.65)";
    ctx.fillText("SIMULATED · LOCAL ENGINE", w - 12, h - 12);
  }
}

export async function simImage(req: GenRequest): Promise<GenResult> {
  const count = Math.min(4, Math.max(1, req.count ?? 1));
  const w = req.width ?? 1024, h = req.height ?? 1024;
  const seed = req.seed ?? hashStr(req.prompt);
  const words = wordsOf(`${req.prompt} ${req.style ?? ""}`);
  const c = makeCanvas(count === 1 ? w : w, count === 1 ? h : h);
  const ctx = c.getContext("2d")!;
  if (count === 1) {
    renderArt(ctx, w, h, mulberry32(seed), words);
  } else {
    const cw = Math.floor(w / 2), chh = Math.floor(h / 2);
    for (let i = 0; i < count; i++) {
      ctx.save(); ctx.translate((i % 2) * cw, Math.floor(i / 2) * chh);
      renderArt(ctx, cw, chh, mulberry32(seed + i * 7919 + 13), words, { watermark: false });
      ctx.restore();
    }
    ctx.font = `600 ${Math.max(11, w * 0.018)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "right"; ctx.fillStyle = "rgba(228,233,242,0.55)";
    ctx.fillText(`SIMULATED · BATCH ${count}`, w - 12, h - 12);
  }
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/png"));
  return { blob, mime: "image/png", width: w, height: h, meta: { simulated: true, seed } };
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seed: number, words: string[], charImg: HTMLImageElement | null, style: string, camera: string) {
  const rnd = mulberry32(seed);
  const hue = Math.floor(rnd() * 360);
  const drift = camera === "Pan" ? Math.sin(t * 0.8) * w * 0.06 : camera === "Zoom" ? 1 + t * 0.02 : 1;
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(drift, drift); ctx.translate(-w / 2, -h / 2);
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${(hue + t * 14) % 360}, 48%, 12%)`);
  g.addColorStop(1, `hsl(${(hue + 80 + t * 14) % 360}, 42%, 8%)`);
  ctx.fillStyle = g; ctx.fillRect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2);
  for (let i = 0; i < 14; i++) {
    const bx = (rnd() * w + t * (30 + i * 12) * (camera === "Tracking" ? 2 : 1)) % (w * 1.2) - w * 0.1;
    const by = rnd() * h, r = (rnd() * 0.3 + 0.05) * Math.min(w, h);
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    rg.addColorStop(0, `hsla(${(hue + i * 24 + t * 20) % 360}, 75%, 55%, 0.2)`);
    rg.addColorStop(1, "transparent");
    ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // lower-third caption
  ctx.fillStyle = "rgba(10,13,19,0.55)";
  ctx.fillRect(0, h * 0.82, w, h * 0.18);
  ctx.fillStyle = "rgba(238,242,250,0.92)";
  ctx.font = `600 ${Math.max(13, w * 0.026)}px "Space Grotesk", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(words.join(" · ") || "untitled scene", w * 0.05, h * 0.9);
  ctx.font = `600 ${Math.max(10, w * 0.015)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = "rgba(255,193,77,0.85)";
  ctx.fillText(`${style.toUpperCase()} · ${camera.toUpperCase()} · SIMULATED`, w * 0.05, h * 0.955);
  // character overlay
  if (charImg && charImg.complete && charImg.naturalWidth) {
    const ch = h * 0.5, cw2 = ch * (charImg.naturalWidth / charImg.naturalHeight);
    const bob = Math.sin(t * 3) * h * 0.008;
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    const cx = w * 0.72, cy = h * 0.52 + bob;
    ctx.roundRect(cx - cw2 / 2, cy - ch / 2, cw2, ch, 18);
    ctx.clip();
    ctx.drawImage(charImg, cx - cw2 / 2, cy - ch / 2, cw2, ch);
    ctx.restore();
    ctx.strokeStyle = "rgba(255,193,77,0.5)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(cx - cw2 / 2, cy - ch / 2, cw2, ch, 18); ctx.stroke();
  }
}

async function recordVideo(req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelCheck: () => boolean, withChar: boolean): Promise<GenResult> {
  const dims = { w: req.width ?? 1280, h: req.height ?? 720 };
  const w = Math.min(1280, dims.w), h = Math.round((w / dims.w) * dims.h);
  const duration = Math.min(SIM_CAP, Math.max(3, req.duration ?? 5));
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d")!;
  let charImg: HTMLImageElement | null = null;
  if (withChar && req.characterImageUrl) {
    charImg = new Image();
    charImg.src = req.characterImageUrl;
    await new Promise((r) => { charImg!.onload = r; charImg!.onerror = r; setTimeout(r, 2500); });
  }
  const words = wordsOf(req.prompt);
  const seed = req.seed ?? hashStr(req.prompt);
  const fps = req.fps ?? 30;
  const stream = c.captureStream(fps);
  const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res, rej) => {
    rec.onstop = () => res(new Blob(chunks, { type: mime }));
    rec.onerror = () => rej(new Error("recorder failed"));
  });
  onStage(`Rendering ${duration}s on-device at ${fps}fps (real MediaRecorder)…`, true);
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((res, rej) => {
    const tick = () => {
      if (cancelCheck()) { rec.stop(); rej(Object.assign(new Error("cancelled"), { code: "CANCELLED" })); return; }
      const t = (performance.now() - t0) / 1000;
      if (t >= duration) { rec.stop(); res(); return; }
      drawFrame(ctx, w, h, t, seed, words, charImg, req.style ?? "Cinematic", req.camera ?? "Static");
      requestAnimationFrame(tick);
    };
    tick();
  });
  const blob = await done;
  onStage("Encoding WebM…", true);
  return { blob, mime, width: w, height: h, meta: { simulated: true, duration, fps } };
}

export const simVideo = (req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelCheck: () => boolean) => recordVideo(req, onStage, cancelCheck, false);
export const simCharacterVideo = (req: GenRequest, onStage: (s: string, honest?: boolean) => void, cancelCheck: () => boolean) => recordVideo(req, onStage, cancelCheck, true);

export async function simText(req: GenRequest): Promise<GenResult> {
  const topic = req.prompt.split(/[\n.]/)[0].slice(0, 80);
  await new Promise((r) => setTimeout(r, 700));
  const text = [
    `SCENE — ${topic}`,
    `CAMERA: ${req.camera ?? "Cinematic"} · slow push-in, ${req.style ?? "cinematic"} grade.`,
    `LIGHTING: key light 45°, soft rim, practical accents.`,
    `ENVIRONMENT: layered depth, atmospheric haze, brand colours.`,
    `MOTION: subject enters frame left, beats on emphasis words.`,
    `STYLE: ${req.style ?? "Cinematic"}, high contrast, ${req.quality ?? "standard"} detail.`,
    `(Local template engine — connect a text provider for full AI scripting.)`,
  ].join("\n");
  return { mime: "text/plain", text, meta: { simulated: true } };
}
