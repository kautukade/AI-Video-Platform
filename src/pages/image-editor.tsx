import { useMemo, useRef, useState } from "react";
import { Wand2, Upload, Eye, Sparkles } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { friendlyError } from "../lib/utils";
import { Button, Field, InfoNote, Select, Textarea } from "../components/ui";
import { GenerationPreview, useGeneration, hasCapableProvider, CapabilitySetupWizard } from "../components/create-bits";
import { analyzeImageLocal, getOllamaHost, ollamaStatus, profileToPrompt } from "../server/local";

export default function ImageEditorPage() {
  const { toast, tick } = useApp();
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("Change the background to a futuristic city at night");
  const [engine, setEngine] = useState("local");
  const [visionModels, setVisionModels] = useState<{ name: string }[]>([]);
  const [model, setModel] = useState("");
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const hasImgProv = useMemo(() => hasCapableProvider("image"), [tick]);
  const gen = useGeneration(genId);

  const loadFile = (f: File) => {
    if (!f.type.startsWith("image/")) { toast("error", "Unsupported file", "Sirf images (PNG/JPG/WEBP)."); return; }
    setImgUrl(URL.createObjectURL(f));
    const fr = new FileReader();
    fr.onload = () => setDataUri(String(fr.result));
    fr.readAsDataURL(f);
    setProfile(null); setGenId(null);
  };

  const analyze = async () => {
    if (!dataUri) { toast("warning", "Pehle image upload karo"); return; }
    setAnalyzing(true);
    try {
      const s = await ollamaStatus(getOllamaHost());
      const vis = s.models.filter((m) => m.vision);
      setVisionModels(vis);
      if (engine === "local") {
        if (!vis.length) throw new Error("Koi local vision model installed nahi — Ollama me vision model install karo (e.g. qwen2.5vl), ya Cloud engine select karo.");
        const p = await analyzeImageLocal(getOllamaHost(), model || vis[0].name, dataUri);
        setProfile(p);
        toast("success", "Analysis complete", "Local Ollama vision — image device se bahar nahi gayi.");
      } else {
        throw new Error("Cloud vision ke liye OpenRouter connect karo (AI Providers), ya Local Ollama vision use karo.");
      }
    } catch (e: any) {
      toast("error", "Analysis failed", e?.message ?? friendlyError(e).message);
    } finally { setAnalyzing(false); }
  };

  const runEdit = async () => {
    if (!profile) { toast("warning", "Pehle image analyze karo"); return; }
    setBusy(true);
    try {
      const base = profileToPrompt(profile);
      const prompt = `${base}. EDIT: ${instruction}. Keep the main subject identical; change only what the edit asks. High quality, photorealistic.`;
      const g = await api.createGeneration({ type: "image", prompt, params: { providerId: "auto", width: 1024, height: 1024, aspect: "1:1" } });
      setGenId(g.id);
      toast("info", "Edit generation queued", "Compatible image engine engaged.");
    } catch (e) { toast("error", "Edit failed", friendlyError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-jade-400">ai image editor</div>
        <h1 className="font-display mt-1 text-[28px] font-bold tracking-tight text-ink-50">Edit an image with AI</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-400">Vision model image ko samajhta hai → structured edit instruction banta hai → real image engine edit karta hai. Ollama sirf analysis karta hai, pixels image engine banata hai.</p>
      </div>

      {!hasImgProv ? (
        <div className="flex justify-center"><CapabilitySetupWizard task="image" /></div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="panel-flat space-y-4 p-4">
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
              <button onClick={() => fileRef.current?.click()} className="group relative block h-44 w-full overflow-hidden rounded-[12px] border border-dashed border-ink-500 bg-ink-800/60 transition-colors hover:border-solar-500/60">
                {imgUrl ? <img src={imgUrl} alt="" className="h-full w-full object-cover" /> : (
                  <span className="flex h-full flex-col items-center justify-center gap-2 text-[12px] font-semibold text-ink-400 group-hover:text-solar-300"><Upload size={20} /> Upload image to edit</span>
                )}
              </button>
              <Field label="Edit instruction"><Textarea rows={3} className="min-h-[80px]" value={instruction} onChange={(e) => setInstruction(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vision engine"><Select value={engine} onChange={(e) => setEngine(e.target.value)}><option value="local">Local (Ollama)</option><option value="cloud">Cloud (OpenRouter)</option></Select></Field>
                {engine === "local" && (
                  <Field label="Vision model"><Select value={model} onChange={(e) => setModel(e.target.value)} disabled={!visionModels.length}>
                    {visionModels.length === 0 && <option value="">detecting…</option>}
                    {visionModels.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
                  </Select></Field>
                )}
              </div>
              <Button className="w-full" variant="outline" icon={<Eye size={14} />} loading={analyzing} onClick={analyze} disabled={!dataUri}>Analyze image</Button>
              {profile && (
                <div className="anim-fade-in rounded-[10px] border border-jade-500/30 bg-jade-500/6 p-3.5">
                  <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-jade-300"><Sparkles size={12} /> Character profile</div>
                  <dl className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-ink-300">
                    {profile.appearance && <div><dt className="inline font-bold text-ink-200">Appearance: </dt><dd className="inline">{profile.appearance}</dd></div>}
                    {profile.clothing && <div><dt className="inline font-bold text-ink-200">Clothing: </dt><dd className="inline">{profile.clothing}</dd></div>}
                    {profile.hair && <div><dt className="inline font-bold text-ink-200">Hair: </dt><dd className="inline">{profile.hair}</dd></div>}
                    {profile.face && <div><dt className="inline font-bold text-ink-200">Face: </dt><dd className="inline">{profile.face}</dd></div>}
                    {profile.style && <div><dt className="inline font-bold text-ink-200">Style: </dt><dd className="inline">{profile.style}</dd></div>}
                  </dl>
                </div>
              )}
              <Button className="w-full" size="lg" icon={<Wand2 size={15} />} loading={busy} onClick={runEdit} disabled={!profile}>Run AI Edit</Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel-flat flex min-h-[300px] items-center justify-center overflow-hidden p-4">
              {imgUrl ? <img src={imgUrl} alt="source" className="max-h-[46vh] w-auto rounded-[10px] border border-ink-700 object-contain" /> : (
                <p className="max-w-xs text-center text-[12.5px] text-ink-500">Original image yahan dikhegi. Edit ka result neeche generate hoga.</p>
              )}
            </div>
            <GenerationPreview genId={genId} emptyHint={<>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-ink-400"><Wand2 size={20} /></div>
              <h3 className="font-display mt-3 text-[15px] font-bold text-ink-100">Edited result yahan aayega</h3>
              <p className="mt-1 max-w-[260px] text-[12px] text-ink-500">Analyze → profile → Run AI Edit. Real engine pixels generate karega.</p>
            </>} />
          </div>

          <div className="space-y-4">
            <div className="panel-flat p-4">
              <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Pipeline (real)</div>
              <ol className="mt-2.5 space-y-1.5 text-[12px] text-ink-400">
                {["Upload image", "Vision analysis (local/cloud)", "Structured character profile", "Edit instruction merge", "Compatible image engine select", "Real generation queue", "Edited image"].map((s, i) => (
                  <li key={s} className="flex items-center gap-2"><span className="font-mono text-[10px] text-solar-400">{String(i + 1).padStart(2, "0")}</span>{s}</li>
                ))}
              </ol>
            </div>
            <InfoNote tone="iris"><strong>Honest labelling:</strong> analysis Ollama ne ki ho to woh sirf prompt/analysis hai — image edit connected image engine karta hai.</InfoNote>
            {gen?.status === "failed" && <InfoNote tone="coral">{gen.error}</InfoNote>}
          </div>
        </div>
      )}
    </div>
  );
}
