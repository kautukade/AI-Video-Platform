import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Film, Plus, Trash2, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ASPECTS, CAMERAS, friendlyError, LANGUAGES, STYLES_VIDEO } from "../lib/utils";
import { Button, Field, Input, InfoNote, Segmented, Select, Textarea } from "../components/ui";
import { CapabilitySetupWizard, CreditEstimate, GenerationPreview, hasCapableProvider, ModelSelect, ProviderSelect, WorkspaceHeader } from "../components/create-bits";

interface Scene { id: number; prompt: string; duration: number; camera: string }

export default function CreateVideo() {
  const { user, toast, tick } = useApp();
  const [prompt, setPrompt] = useState("");
  const [useScenes, setUseScenes] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([{ id: 1, prompt: "", duration: 5, camera: "Static" }]);
  const [aspect, setAspect] = useState(user?.prefs?.defaultAspect ?? "16:9");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState(5);
  const [style, setStyle] = useState("Cinematic");
  const [camera, setCamera] = useState("Cinematic");
  const [language, setLanguage] = useState(user?.prefs?.defaultLanguage ?? "en");
  const [providerId, setProviderId] = useState(user?.prefs?.defaultProvider ?? "auto");
  const [model, setModel] = useState(user?.prefs?.defaultModel ?? "");
  const [seed, setSeed] = useState<number | "">("");
  const [negative, setNegative] = useState("");
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasProv = useMemo(() => hasCapableProvider("video"), [tick]);

  const dims = ASPECTS[aspect] ?? ASPECTS["16:9"];
  const totalSceneDur = scenes.reduce((a, s) => a + s.duration, 0);
  const effDuration = useScenes ? totalSceneDur : duration;
  const scale = resolution === "720p" ? 720 / dims.h : resolution === "4k" ? 2160 / dims.h : 1080 / dims.h;

  const params = useMemo(() => ({
    aspect, resolution, duration: effDuration, style, camera, language,
    width: Math.round(dims.w * scale), height: Math.round(dims.h * scale),
    scenes: useScenes ? scenes.map(({ prompt: p, duration: d, camera: c }) => ({ prompt: p || "Continuation", duration: d, camera: c })) : undefined,
    seed: seed === "" ? undefined : Number(seed), negative: negative || undefined,
  }), [aspect, resolution, effDuration, style, camera, language, dims, scale, useScenes, scenes, seed, negative]);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const gen = await api.createGeneration({ type: "video", prompt: prompt || "Cinematic scene", params: { ...params, providerId, model } });
      setGenId(gen.id);
      toast("info", "Video generation queued", "Real engine engaged — honest progress dikhega.");
    } catch (e) { setErr(friendlyError(e).message); }
    finally { setBusy(false); }
  };

  const sceneCtl = (i: number, fn: (s: Scene) => Scene) => setScenes((ss) => ss.map((s, j) => (j === i ? fn(s) : s)));

  return (
    <div>
      <WorkspaceHeader title="AI Video Studio" sub="Script → scenes → real render. Video sirf connected engines se banta hai — kabhi fake nahi." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <Field label="Prompt / Script" hint={`${prompt.length}/4000`}>
              <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder='"Create a professional promotional video for an AI automation company."' />
            </Field>
          </div>

          <div className="panel-flat space-y-4 p-4">
            <Field label="Video Size">
              <Segmented size="sm" value={aspect} onChange={setAspect} options={Object.entries(ASPECTS).slice(0, 4).map(([a, v]) => ({ value: a, label: a, title: v.label }))} />
            </Field>
            <Field label="Resolution">
              <Segmented size="sm" value={resolution} onChange={setResolution} options={[{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }, { value: "4k", label: "4K" }]} />
            </Field>
            <Field label="Duration">
              <Segmented size="sm" value={String(duration)} onChange={(v) => setDuration(Number(v))} options={[5, 10, 15].map((d) => ({ value: String(d), label: `${d}s` }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES_VIDEO.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Camera"><Select value={camera} onChange={(e) => setCamera(e.target.value)}>{CAMERAS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seed" hint="blank = random"><Input type="number" value={seed} onChange={(e) => setSeed(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
              <Field label="Negative"><Input value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="avoid…" /></Field>
            </div>
          </div>

          <div className="panel-flat space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Scene Builder</span>
              <button onClick={() => setUseScenes((s) => !s)} className={`text-[11.5px] font-semibold ${useScenes ? "text-jade-300" : "text-ink-400"}`}>{useScenes ? "ON" : "OFF"}</button>
            </div>
            {useScenes && (
              <div className="space-y-2.5">
                {scenes.map((s, i) => (
                  <div key={s.id} className="rounded-[10px] border border-ink-700 bg-ink-800/60 p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="font-mono text-[10.5px] font-bold text-solar-300">SCENE {i + 1}</span>
                      <span className="ml-auto flex gap-0.5">
                        <button className="rounded p-1 text-ink-400 hover:text-ink-100 disabled:opacity-30" disabled={i === 0} onClick={() => setScenes((ss) => { const n = [...ss]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ArrowUp size={12} /></button>
                        <button className="rounded p-1 text-ink-400 hover:text-ink-100 disabled:opacity-30" disabled={i === scenes.length - 1} onClick={() => setScenes((ss) => { const n = [...ss]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ArrowDown size={12} /></button>
                        <button className="rounded p-1 text-ink-400 hover:text-coral-300 disabled:opacity-30" disabled={scenes.length === 1} onClick={() => setScenes((ss) => ss.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
                      </span>
                    </div>
                    <Textarea rows={2} className="min-h-[54px]" value={s.prompt} placeholder="What happens in this scene?" onChange={(e) => sceneCtl(i, (x) => ({ ...x, prompt: e.target.value }))} />
                    <div className="mt-2 flex gap-2">
                      <Select value={String(s.duration)} onChange={(e) => sceneCtl(i, (x) => ({ ...x, duration: Number(e.target.value) }))} className="w-24">
                        {[3, 5, 8, 10].map((d) => <option key={d} value={d}>{d}s</option>)}
                      </Select>
                      <Select value={s.camera} onChange={(e) => sceneCtl(i, (x) => ({ ...x, camera: e.target.value }))} className="flex-1">
                        {CAMERAS.map((c) => <option key={c}>{c}</option>)}
                      </Select>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" icon={<Plus size={13} />} onClick={() => setScenes((ss) => [...ss, { id: Date.now(), prompt: "", duration: 5, camera: "Pan" }])}>Add scene</Button>
                <p className="font-mono text-[11px] text-ink-400">total duration: <span className="text-solar-300">{totalSceneDur}s</span></p>
              </div>
            )}
          </div>
        </div>

        {!genId && !hasProv ? (
          <div className="flex min-h-[420px] items-center justify-center"><CapabilitySetupWizard task="video" /></div>
        ) : (
          <GenerationPreview genId={genId} emptyHint={<>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-ink-400"><Film size={22} /></div>
            <h3 className="font-display mt-4 text-[17px] font-bold text-ink-100">Your video renders here</h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-ink-500">
              <strong className="text-ink-300">Real AI video only.</strong> Connect Replicate, Luma, NVIDIA NIM ya Hugging Face (sab free tier) — system best model khud chunega aur honest progress dikhayega.
            </p>
          </>} />
        )}

        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <ProviderSelect task="video" value={providerId} onChange={setProviderId} />
            <ModelSelect task="video" providerId={providerId} value={model} onChange={setModel} />
            <CreditEstimate task="video" providerId={providerId} model={model} params={params} />
            {err && <InfoNote tone="coral">{err}</InfoNote>}
            <Button className="w-full" size="lg" loading={busy} icon={<Wand2 size={16} />} onClick={generate} disabled={!prompt.trim() && !useScenes}>
              Generate Video · {effDuration}s
            </Button>
          </div>
          <div className="panel-flat p-4">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Honest progress</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">Video APIs progress expose nahi karte — isliye fake percentage nahi, real <strong>queued → generating → completed</strong> status dikhta hai.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
