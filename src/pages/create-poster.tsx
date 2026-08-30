import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Frame, Save, Sparkles, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ASPECTS, downloadBlob, friendlyError, LANGUAGES } from "../lib/utils";
import { Button, Field, Input, InfoNote, Select, Textarea } from "../components/ui";
import { useGeneration } from "../components/create-bits";

const PRESETS: Record<string, { aspect: string; label: string }> = {
  "Instagram Post": { aspect: "1:1", label: "1080×1080" },
  "Instagram Story": { aspect: "9:16", label: "1080×1920" },
  "YouTube Thumbnail": { aspect: "16:9", label: "1280×720" },
  "Facebook Post": { aspect: "16:9", label: "1200×630" },
  "LinkedIn Post": { aspect: "4:5", label: "1080×1350" },
  "Event Poster": { aspect: "3:4", label: "1080×1440" },
  "Business Poster": { aspect: "3:4", label: "1080×1440" },
  "Product Poster": { aspect: "4:5", label: "1080×1350" },
  "Festival Poster": { aspect: "3:4", label: "1080×1440" },
  "Advertisement": { aspect: "16:9", label: "1920×1080" },
};
const STYLES = ["Cinematic", "Corporate", "Minimal", "Bold", "Festive", "Tech", "Elegant"];

export default function CreatePoster() {
  const { toast } = useApp();
  const [preset, setPreset] = useState("Instagram Post");
  const [title, setTitle] = useState("Mega Tech Summit 2026");
  const [subtitle, setSubtitle] = useState("AI · Cloud · Automation");
  const [description, setDescription] = useState("");
  const [cta, setCta] = useState("Register Now");
  const [brand, setBrand] = useState("ITCyber Technologies");
  const [color, setColor] = useState("#FFC14D");
  const [style, setStyle] = useState("Bold");
  const [language, setLanguage] = useState("en");
  const [bgPrompt, setBgPrompt] = useState("");
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [bgGenId, setBgGenId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const bgGen = useGeneration(bgGenId);

  const aspect = PRESETS[preset]?.aspect ?? "1:1";
  const dims = ASPECTS[aspect] ?? ASPECTS["1:1"];
  const W = Math.min(1080, dims.w), H = Math.round((W / dims.w) * dims.h);

  // background image → pollinations (free, real)
  useEffect(() => {
    if (bgGen?.status === "completed" && bgGen.assetId) {
      api.getAsset(bgGen.assetId) && api.assetUrl(api.getAsset(bgGen.assetId)).then((u) => { if (u) { setBgUrl(u); toast("success", "AI background ready"); } });
    }
  }, [bgGen, toast]);

  const genBackground = async () => {
    if (!bgPrompt.trim()) { toast("warning", "Describe the background first"); return; }
    try {
      const gen = await api.createGeneration({ type: "image", prompt: `${bgPrompt}, ${style} style, poster background, no text, high quality`, params: { providerId: "auto", width: W, height: H, aspect } });
      setBgGenId(gen.id);
      toast("info", "Background generating", "Free engine engaged.");
    } catch (e) { toast("error", "Background failed", friendlyError(e).message); }
  };

  const bgImg = useMemo(() => {
    if (!bgUrl) return null;
    const img = new Image();
    img.src = bgUrl;
    return img;
  }, [bgUrl]);

  const draw = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    // background
    if (bgUrl && bgImg && bgImg.complete && bgImg.naturalWidth) {
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.fillStyle = "rgba(10,13,19,0.55)";
      ctx.fillRect(0, 0, W, H);
    } else {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#121722");
      g.addColorStop(1, "#0a0d13");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = color + "33"; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(W * 0.85, H * 0.15, 40 + i * 46, 0, Math.PI * 2); ctx.stroke(); }
    }
    // accent bar
    ctx.fillStyle = color;
    ctx.fillRect(W * 0.07, H * 0.16, W * 0.09, 8);
    // brand
    ctx.fillStyle = "rgba(238,242,250,0.75)";
    ctx.font = `700 ${Math.round(W * 0.028)}px "JetBrains Mono", monospace`;
    ctx.textAlign = "left";
    ctx.fillText(brand.toUpperCase(), W * 0.07, H * 0.13);
    // title
    ctx.fillStyle = "#eef2fa";
    ctx.font = `700 ${Math.round(W * 0.085)}px "Space Grotesk", sans-serif`;
    wrapText(ctx, title.toUpperCase(), W * 0.07, H * 0.27, W * 0.86, W * 0.095);
    // subtitle
    ctx.fillStyle = color;
    ctx.font = `600 ${Math.round(W * 0.035)}px "Manrope", sans-serif`;
    ctx.fillText(subtitle, W * 0.07, H * 0.56);
    // description
    if (description.trim()) {
      ctx.fillStyle = "rgba(217,224,239,0.8)";
      ctx.font = `500 ${Math.round(W * 0.026)}px "Manrope", sans-serif`;
      wrapText(ctx, description, W * 0.07, H * 0.62, W * 0.7, W * 0.036);
    }
    // CTA pill
    const ctaW = Math.max(W * 0.3, ctx.measureText(cta).width + W * 0.1);
    roundRect(ctx, W * 0.07, H * 0.82, ctaW, H * 0.075, 14);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = "#0a0d13";
    ctx.font = `800 ${Math.round(W * 0.03)}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(cta.toUpperCase(), W * 0.07 + ctaW / 2, H * 0.82 + H * 0.05);
    ctx.textAlign = "left";
    // language tag
    ctx.fillStyle = "rgba(147,160,188,0.7)";
    ctx.font = `600 ${Math.round(W * 0.02)}px "JetBrains Mono", monospace`;
    ctx.fillText(`${(LANGUAGES.find((l) => l.id === language)?.label ?? "English").toUpperCase()} · ${style.toUpperCase()}`, W * 0.07, H * 0.95);
  };

  useEffect(() => {
    const t = setTimeout(draw, bgUrl ? 250 : 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, subtitle, description, cta, brand, color, style, language, bgUrl, preset, W, H]);

  const exportPng = async (save: boolean) => {
    const c = canvasRef.current;
    if (!c) return;
    draw();
    const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/png"));
    if (save) {
      setSaving(true);
      try {
        await api.savePoster(blob, { title, brand, preset, width: W, height: H });
        toast("success", "Poster saved to Library");
      } catch (e) { toast("error", "Save failed", friendlyError(e).message); }
      finally { setSaving(false); }
    } else {
      downloadBlob(blob, `${(title || "poster").replace(/\s+/g, "-").toLowerCase()}.png`);
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold tracking-tight text-ink-50 sm:text-[27px]">AI Poster Studio</h1>
          <p className="mt-1 text-[13px] text-ink-400">Structured design data — text is real, editable, export-ready. Backgrounds via free AI engines.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Download size={14} />} onClick={() => exportPng(false)}>Download PNG</Button>
          <Button icon={<Save size={14} />} loading={saving} onClick={() => exportPng(true)}>Save to Library</Button>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_290px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-3.5 p-4">
            <Field label="Preset"><Select value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{k} · {v.label}</option>)}</Select></Field>
            <Field label="Poster Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Subtitle"><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></Field>
            <Field label="Description"><Textarea rows={2} className="min-h-[64px]" value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA"><Input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
              <Field label="Brand"><Input value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Brand Color"><input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full cursor-pointer rounded-[10px] border border-ink-600 bg-ink-800" /></Field>
              <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.slice(0, 6).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
            </div>
            <Field label="Logo (optional)">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoUrl(URL.createObjectURL(f)); toast("success", "Logo attached"); } }} />
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>{logoUrl ? "Change logo" : "Upload logo"}</Button>
            </Field>
          </div>
          <div className="panel-flat space-y-3 p-4">
            <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300"><Sparkles size={13} className="text-solar-400" /> AI Background</div>
            <Field label="Describe the background">
              <Input value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} placeholder="futuristic city skyline at night, golden lights…" />
            </Field>
            <Button variant="outline" size="sm" loading={!!bgGenId && !["completed", "failed"].includes(bgGen?.status ?? "completed")} icon={<Wand2 size={13} />} onClick={genBackground}>
              Generate background (free)
            </Button>
            {bgGen?.status === "failed" && <InfoNote tone="coral">{bgGen.error}</InfoNote>}
            {bgUrl && <img src={bgUrl} alt="bg" className="h-20 w-full rounded-lg border border-ink-700 object-cover" />}
          </div>
        </div>

        <div className="panel-flat flex min-h-[420px] items-center justify-center p-5">
          <div className="w-full max-w-[560px]">
            <canvas ref={canvasRef} className="w-full rounded-[12px] border border-ink-700 shadow-2xl shadow-black/50" style={{ aspectRatio: `${W} / ${H}` }} />
            <p className="mt-3 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-500">live preview · {W}×{H} · text is structured & editable</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel-flat p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Frame size={13} className="text-jade-400" /> Why structured?</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
              Image models text-rendering pe galti karte hain. Yahan text <strong className="text-ink-200">design data</strong> hai — hamesha crisp, editable, brand-safe. Sirf background AI se aata hai (Pollinations free).
            </p>
          </div>
          <div className="panel-flat p-4">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Export</div>
            <ul className="mt-2 space-y-1.5 text-[12px] text-ink-400">
              <li>· PNG at full {W}×{H} resolution</li>
              <li>· Save to Library (blob storage)</li>
              <li>· Re-edit anytime from Library</li>
            </ul>
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
