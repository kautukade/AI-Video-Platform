import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Film, Plus, Trash2, Upload, User as UserIcon, Volume2, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ASPECTS, CAMERAS, friendlyError, LANGUAGES, STYLES_VIDEO, TONES } from "../lib/utils";
import { Button, Field, Input, InfoNote, Segmented, Select, Textarea, Toggle } from "../components/ui";
import { CapabilitySetupWizard, CreditEstimate, GenerationPreview, hasCapableProvider, ModelSelect, ProviderSelect, useAsset, WorkspaceHeader } from "../components/create-bits";

interface Scene { id: number; prompt: string; duration: number; camera: string }
const VOICES = ["Male", "Female", "Natural", "Professional", "Energetic", "Calm"];

export default function CreateVideo() {
  const { user, toast, tick } = useApp();
  const [prompt, setPrompt] = useState("");
  const [showScript, setShowScript] = useState(false);
  const [hook, setHook] = useState(""); const [intro, setIntro] = useState(""); const [main, setMain] = useState(""); const [cta, setCta] = useState("");
  const [tone, setTone] = useState("Professional");
  const [scriptBusy, setScriptBusy] = useState(false);
  const [useScenes, setUseScenes] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([{ id: 1, prompt: "", duration: 5, camera: "Static" }]);
  const [charMode, setCharMode] = useState<"none" | "library" | "upload">("none");
  const [charId, setCharId] = useState("");
  const [charAssetId, setCharAssetId] = useState<string | null>(null);
  const [charName, setCharName] = useState("");
  const [consistency, setConsistency] = useState(true);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [aspect, setAspect] = useState(user?.prefs?.defaultAspect ?? "16:9");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState(10);
  const [style, setStyle] = useState("Cinematic");
  const [camera, setCamera] = useState("Cinematic");
  const [language, setLanguage] = useState(user?.prefs?.defaultLanguage ?? "en");
  const [voice, setVoice] = useState("Natural");
  const [providerId, setProviderId] = useState(user?.prefs?.defaultProvider ?? "auto");
  const [model, setModel] = useState(user?.prefs?.defaultModel ?? "");
  const [showAdv, setShowAdv] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [seed, setSeed] = useState<number | "">("");
  const [negative, setNegative] = useState("");
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasProv = useMemo(() => hasCapableProvider("video"), [tick]);

  const chars = useMemo(() => { try { return api.listCharacters(); } catch { return []; } }, [tick]);
  const char = chars.find((c) => c.id === charId);
  const { url: charPreview } = useAsset(charMode === "library" ? char?.imageAssetId ?? null : charAssetId);

  const scriptText = showScript ? [hook && `HOOK: ${hook}`, intro && `INTRO: ${intro}`, main && `CONTENT: ${main}`, cta && `CTA: ${cta}`].filter(Boolean).join("\n") : "";
  const totalSceneDur = scenes.reduce((a, s) => a + s.duration, 0);
  const effDuration = useScenes ? totalSceneDur : duration;
  const dims = ASPECTS[aspect] ?? ASPECTS["16:9"];
  const scale = resolution === "720p" ? 720 / dims.h : resolution === "4k" ? 2160 / dims.h : 1080 / dims.h;

  const params = useMemo(() => ({
    aspect, resolution, duration: effDuration, style, camera, language, voice,
    width: Math.round(dims.w * scale), height: Math.round(dims.h * scale),
    scenes: useScenes ? scenes.map(({ prompt: p, duration: d, camera: c }) => ({ prompt: p || "Continuation", duration: d, camera: c })) : undefined,
    script: scriptText || undefined,
    characterAssetId: charMode === "library" ? char?.imageAssetId ?? null : charAssetId,
    characterName: charMode === "library" ? char?.name : charName || undefined,
    characterConsistency: consistency,
    temperature, seed: seed === "" ? undefined : Number(seed), negative: negative || undefined,
  }), [aspect, resolution, effDuration, style, camera, language, voice, dims, scale, useScenes, scenes, scriptText, charMode, char, charAssetId, charName, consistency, temperature, seed, negative]);

  const generateScript = async () => {
    setScriptBusy(true);
    try {
      const r = await api.enhancePrompt(`Write a short ${tone.toLowerCase()} video script about: ${prompt || "my product"}`, { providerId, duration: effDuration, style });
      const lines = r.text.split("\n").filter(Boolean);
      setHook(lines.find((l) => /hook|scene/i.test(l)) ?? lines[0] ?? "");
      setIntro(lines.find((l) => /intro|camera/i.test(l)) ?? lines[1] ?? "");
      setMain(lines.find((l) => /content|environment|motion/i.test(l)) ?? lines[2] ?? "");
      setCta(lines.find((l) => /cta|style/i.test(l)) ?? lines[3] ?? "");
      toast("success", "Script drafted", r.source);
    } catch (e) { toast("error", "Script generation failed", friendlyError(e).message); }
    finally { setScriptBusy(false); }
  };

  const uploadChar = async (f: File) => {
    setUploadErr(null);
    try {
      const a = await api.uploadAsset(f, "character_image");
      setCharAssetId(a.id);
      toast("success", "Character asset uploaded", `${(f.size / 1024 / 1024).toFixed(2)} MB validated & stored.`);
    } catch (e) { setUploadErr(friendlyError(e).message); }
  };

  const previewVoice = () => {
    try {
      const u = new SpeechSynthesisUtterance(`Hello! I'm ${charName || "your presenter"}. This is how your narration will sound.`);
      u.pitch = voice === "Female" ? 1.25 : voice === "Male" ? 0.85 : 1;
      u.rate = voice === "Energetic" ? 1.15 : voice === "Calm" ? 0.85 : 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      toast("info", "Voice preview", "Playing via your browser's local TTS.");
    } catch { toast("error", "Preview unavailable", "This browser has no speech synthesis."); }
  };

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const gen = await api.createGeneration({ type: "video", prompt: prompt || scriptText, params: { ...params, providerId, model } });
      setGenId(gen.id);
      toast("info", "Video generation queued", "Real engine engaged — status streams live.");
    } catch (e) { setErr(friendlyError(e).message); }
    finally { setBusy(false); }
  };

  const sceneCtl = (i: number, fn: (s: Scene) => Scene) => setScenes((ss) => ss.map((s, j) => (j === i ? fn(s) : s)));

  return (
    <div>
      <WorkspaceHeader title="AI Video Studio" sub="Script → scenes → real render · Luma, Replicate, NVIDIA NIM, Hugging Face (free tiers)." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Prompt / Script</span>
              <button className="text-[11.5px] font-semibold text-solar-300 hover:underline" onClick={() => setShowScript((s) => !s)}>{showScript ? "Simple prompt" : "Script builder"}</button>
            </div>
            {!showScript ? (
              <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={`"Create a professional promotional video for an AI automation company."`} />
            ) : (
              <div className="space-y-3">
                <Field label="Hook"><Input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="What stops the scroll?" /></Field>
                <Field label="Introduction"><Input value={intro} onChange={(e) => setIntro(e.target.value)} /></Field>
                <Field label="Main Content"><Textarea rows={3} value={main} onChange={(e) => setMain(e.target.value)} /></Field>
                <Field label="CTA"><Input value={cta} onChange={(e) => setCta(e.target.value)} /></Field>
                <div className="flex items-center gap-2">
                  <Select value={tone} onChange={(e) => setTone(e.target.value)} className="flex-1">{TONES.map((t) => <option key={t}>{t}</option>)}</Select>
                  <Button variant="outline" size="sm" loading={scriptBusy} icon={<Wand2 size={13} />} onClick={generateScript}>AI Script</Button>
                </div>
              </div>
            )}
          </div>

          <div className="panel-flat space-y-3.5 p-4">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Character</span>
            <Segmented size="sm" value={charMode} onChange={setCharMode}
              options={[{ value: "none", label: "None" }, { value: "library", label: "Library" }, { value: "upload", label: "Upload" }]} />
            {charMode === "library" && (
              <Select value={charId} onChange={(e) => setCharId(e.target.value)}>
                <option value="">Select a saved character…</option>
                {chars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            )}
            {charMode === "upload" && (
              <>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadChar(e.target.files[0])} />
                <Button variant="outline" size="sm" icon={<Upload size={13} />} onClick={() => fileRef.current?.click()}>Upload PNG / JPG / WEBP</Button>
                <Field label="Character Name"><Input value={charName} onChange={(e) => setCharName(e.target.value)} placeholder="e.g. Arjun — tech presenter" /></Field>
              </>
            )}
            {charPreview && <img src={charPreview} alt="character" className="h-24 w-24 rounded-[10px] border border-ink-600 object-cover" />}
            {uploadErr && <InfoNote tone="coral">{uploadErr}</InfoNote>}
            {charMode !== "none" && <Toggle checked={consistency} onChange={setConsistency} label="Character consistency across scenes" />}
          </div>

          <div className="panel-flat space-y-4 p-4">
            <Field label="Video Size">
              <Segmented size="sm" value={aspect} onChange={setAspect} options={Object.entries(ASPECTS).slice(0, 4).map(([a, v]) => ({ value: a, label: a, title: v.label }))} />
            </Field>
            <Field label="Resolution">
              <Segmented size="sm" value={resolution} onChange={setResolution} options={[{ value: "720p", label: "720p" }, { value: "1080p", label: "1080p" }, { value: "4k", label: "4K" }]} />
            </Field>
            <Field label="Duration">
              <Segmented size="sm" value={String(duration)} onChange={(v) => setDuration(Number(v))} options={[5, 10, 15, 30, 60].map((d) => ({ value: String(d), label: `${d}s` }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES_VIDEO.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Camera"><Select value={camera} onChange={(e) => setCamera(e.target.value)}>{CAMERAS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
              <Field label="Voice" hint="if TTS supported">
                <div className="flex gap-2">
                  <Select value={voice} onChange={(e) => setVoice(e.target.value)} className="flex-1">{VOICES.map((v) => <option key={v}>{v}</option>)}</Select>
                  <Button variant="ghost" size="sm" icon={<Volume2 size={14} />} onClick={previewVoice} title="Preview voice (local browser TTS)" />
                </div>
              </Field>
            </div>
          </div>

          <div className="panel-flat space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Scene Builder</span>
              <Toggle checked={useScenes} onChange={setUseScenes} />
            </div>
            {useScenes && (
              <div className="space-y-2.5">
                {scenes.map((s, i) => (
                  <div key={s.id} className="rounded-[10px] border border-ink-700 bg-ink-800/60 p-3">
                    <div className="mb-2 flex items-center gap-1.5">
                      <span className="font-mono text-[10.5px] font-bold text-solar-300">SCENE {i + 1}</span>
                      <span className="ml-auto flex gap-0.5">
                        <button className="rounded p-1 text-ink-400 hover:bg-ink-750 hover:text-ink-100 disabled:opacity-30" disabled={i === 0} onClick={() => setScenes((ss) => { const n = [...ss]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ArrowUp size={12} /></button>
                        <button className="rounded p-1 text-ink-400 hover:bg-ink-750 hover:text-ink-100 disabled:opacity-30" disabled={i === scenes.length - 1} onClick={() => setScenes((ss) => { const n = [...ss]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ArrowDown size={12} /></button>
                        <button className="rounded p-1 text-ink-400 hover:bg-coral-500/15 hover:text-coral-300 disabled:opacity-30" disabled={scenes.length === 1} onClick={() => setScenes((ss) => ss.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
                      </span>
                    </div>
                    <Textarea rows={2} className="min-h-[54px]" value={s.prompt} placeholder="What happens in this scene?" onChange={(e) => sceneCtl(i, (x) => ({ ...x, prompt: e.target.value }))} />
                    <div className="mt-2 flex gap-2">
                      <Select value={String(s.duration)} onChange={(e) => sceneCtl(i, (x) => ({ ...x, duration: Number(e.target.value) }))} className="w-24">
                        {[3, 5, 8, 10, 15].map((d) => <option key={d} value={d}>{d}s</option>)}
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
              Real AI video only — connect Replicate (LTX/Wan/MiniMax), Luma, NVIDIA NIM ya Hugging Face. Ollama text-only hai; system best engine khud chunta hai.
            </p>
          </>} />
        )}

        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <ProviderSelect task="video" value={providerId} onChange={setProviderId} />
            <ModelSelect task="video" providerId={providerId} value={model} onChange={setModel} />
            <button className="text-[11.5px] font-semibold text-solar-300 hover:underline" onClick={() => setShowAdv((s) => !s)}>{showAdv ? "− Hide advanced" : "+ Advanced settings"}</button>
            {showAdv && (
              <div className="anim-fade-in space-y-3">
                <Field label="Temperature"><Input type="number" step={0.1} min={0} max={2} value={temperature} onChange={(e) => setTemperature(Math.min(2, Math.max(0, Number(e.target.value))))} /></Field>
                <Field label="Seed" hint="blank = random"><Input type="number" value={seed} onChange={(e) => setSeed(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
                <Field label="Negative Prompt"><Input value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="what to avoid…" /></Field>
                <p className="text-[11px] leading-snug text-ink-500">Steps/CFG sirf tab bhejte hain jab model unhe support karta hai.</p>
              </div>
            )}
            <CreditEstimate task="video" providerId={providerId} model={model} params={params} />
            {err && <InfoNote tone="coral">{err}</InfoNote>}
            <Button className="w-full" size="lg" loading={busy} icon={<Wand2 size={16} />}
              disabled={!prompt.trim() && !scriptText.trim() && !useScenes}
              onClick={generate}>
              Generate Video · {effDuration}s
            </Button>
          </div>
          <div className="panel-flat p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><UserIcon size={13} className="text-iris-400" /> Capability note</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
              Model picker sirf <strong className="text-ink-200">video-capable</strong> models dikhata hai. Provider fail ho to router agle free engine pe automatic fallback karta hai.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
