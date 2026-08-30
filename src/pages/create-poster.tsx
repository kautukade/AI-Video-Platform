import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Frame, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { friendlyError, LANGUAGES } from "../lib/utils";
import { Button, Field, Input, InfoNote, Select, Textarea } from "../components/ui";
import { CreditEstimate, WorkspaceHeader } from "../components/create-bits";

const PRESETS: { id: string; w: number; h: number }[] = [
  { id: "Instagram Post", w: 1080, h: 1080 }, { id: "Instagram Story", w: 1080, h: 1920 },
  { id: "YouTube Thumbnail", w: 1280, h: 720 }, { id: "YouTube Banner", w: 2560, h: 1440 },
  { id: "Facebook Post", w: 1200, h: 630 }, { id: "LinkedIn Post", w: 1200, h: 627 },
  { id: "Advertisement", w: 1080, h: 1350 }, { id: "Event Poster", w: 1080, h: 1620 },
  { id: "Business Poster", w: 1080, h: 1440 }, { id: "Product Poster", w: 1080, h: 1350 },
  { id: "Festival Poster", w: 1080, h: 1620 }, { id: "Educational Poster", w: 1080, h: 1440 },
];
const STYLES = ["Bold & Modern", "Minimal", "Corporate", "Festive", "Cinematic", "Gradient Pop", "Retro", "Elegant"];

export default function CreatePoster() {
  const { toast, tick } = useApp();
  const [title, setTitle] = useState("AI CREATIVE STUDIO");
  const [subtitle, setSubtitle] = useState("Create. Generate. Imagine.");
  const [desc, setDesc] = useState("");
  const [cta, setCta] = useState("Start Free");
  const [brand, setBrand] = useState("ITCyber");
  const [preset, setPreset] = useState("Instagram Post");
  const [style, setStyle] = useState("Bold & Modern");
  const [bgColor, setBgColor] = useState("#121722");
  const [accent, setAccent] = useState("#ffc14d");
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dims = useMemo(() => PRESETS.find((p) => p.id === preset) ?? PRESETS[0], [preset]);

  // Render structured poster as real design data on canvas
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = dims.w; c.height = dims.h;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, dims.w, dims.h);
    // accent shape
    ctx.fillStyle = accent + "22";
    ctx.beginPath();
    ctx.arc(dims.w * 0.85, dims.h * 0.12, dims.w * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent + "14";
    ctx.beginPath();
    ctx.arc(dims.w * 0.1, dims.h * 0.9, dims.w * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.fillRect(dims.w * 0.08, dims.h * 0.3, dims.w * 0.12, 8);
    const scaleF = dims.w / 1080;
    ctx.fillStyle = "#eef2fa";
    ctx.font = `800 ${Math.round(72 * scaleF)}px "Space Grotesk", sans-serif`;
    wrapText(ctx, title.toUpperCase(), dims.w * 0.08, dims.h * 0.4, dims.w * 0.84, Math.round(78 * scaleF));
    ctx.fillStyle = accent;
    ctx.font = `700 ${Math.round(34 * scaleF)}px "Manrope", sans-serif`;
    ctx.fillText(subtitle, dims.w * 0.08, dims.h * 0.62);
    if (desc) {
      ctx.fillStyle = "#b9c4da";
      ctx.font = `500 ${Math.round(26 * scaleF)}px "Manrope", sans-serif`;
      wrapText(ctx, desc, dims.w * 0.08, dims.h * 0.68, dims.w * 0.8, Math.round(34 * scaleF));
    }
    if (cta) {
      const bw = dims.w * 0.3, bh = Math.round(70 * scaleF);
      ctx.fillStyle = accent;
      roundRect(ctx, dims.w * 0.08, dims.h * 0.85, bw, bh, 14 * scaleF);
      ctx.fill();
      ctx.fillStyle = "#0a0d13";
      ctx.font = `800 ${Math.round(28 * scaleF)}px "Manrope", sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(cta, dims.w * 0.08 + bw / 2, dims.h * 0.85 + bh / 2 + Math.round(10 * scaleF));
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#93a0bc";
    ctx.font = `600 ${Math.round(22 * scaleF)}px "JetBrains Mono", monospace`;
    ctx.fillText(brand, dims.w * 0.08, dims.h * 0.09);
  }, [title, subtitle, desc, cta, brand, bgColor, accent, dims, tick]);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const c = canvasRef.current!;
      const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"));
      const asset = await api.savePoster(blob, { title, subtitle, cta, brand, preset, width: dims.w, height: dims.h });
      toast("success", "Poster saved to library", asset.name);
      setGenId(asset.generationId);
    } catch (e) { setErr(friendlyError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <WorkspaceHeader title="AI Poster Studio" sub="Structured canvas editor — text real design data hai, image-rendered gibberish nahi." />
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_280px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <Field label="Poster Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            <Field label="Description"><Textarea rows={2} className="min-h-[64px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA"><Input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
              <Field label="Brand"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            </div>
          </div>
          <div className="panel-flat space-y-4 p-4">
            <Field label="Preset"><Select value={preset} onChange={(e) => setPreset(e.target.value)}>{PRESETS.map((p) => <option key={p.id}>{p.id}</option>)}</Select></Field>
            <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Background"><input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-[10px] border border-ink-600 bg-ink-800" /></Field>
              <Field label="Accent"><input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-full cursor-pointer rounded-[10px] border border-ink-600 bg-ink-800" /></Field>
            </div>
            <p className="font-mono text-[11px] text-ink-500">{dims.w} × {dims.h}px · editable text</p>
          </div>
        </div>

        <div className="panel-flat flex min-h-[420px] items-center justify-center overflow-auto p-5">
          <canvas ref={canvasRef} className="max-h-[64vh] w-auto max-w-full rounded-[10px] border border-ink-700 shadow-2xl shadow-black/50" />
        </div>

        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <CreditEstimate task="poster" providerId="auto" model="" params={{ width: dims.w, height: dims.h }} />
            {err && <InfoNote tone="coral">{err}</InfoNote>}
            <Button className="w-full" size="lg" loading={busy} icon={<Wand2 size={16} />} onClick={generate}>Save Poster</Button>
            <Button className="w-full" variant="outline" icon={<Download size={14} />} onClick={() => {
              const c = canvasRef.current!;
              c.toBlob((b) => { if (b) { const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `${(title || "poster").toLowerCase().replace(/\s+/g, "-")}.png`; a.click(); } });
            }}>Download PNG</Button>
          </div>
          <div className="panel-flat p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Frame size={13} className="text-solar-400" /> Why structured?</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">Text canvas pe draw hota hai — crisp, editable, koi AI-rendered spelling mistake nahi. AI background chahiye to Image Studio se bana ke yahan use karo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const test = line + w + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, yy);
      line = w + " ";
      yy += lineH;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, yy);
}
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
