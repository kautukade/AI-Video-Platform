import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Clapperboard, Save, Upload, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ACTIONS, ASPECTS, EXPRESSIONS, friendlyError, LANGUAGES } from "../lib/utils";
import { Button, Field, Input, InfoNote, Segmented, Select, Textarea, Toggle } from "../components/ui";
import { CapabilitySetupWizard, CreditEstimate, GenerationPreview, hasCapableProvider, ModelSelect, ProviderSelect, useAsset, WorkspaceHeader } from "../components/create-bits";

const VOICES = ["Male", "Female", "Natural", "Professional", "Energetic", "Calm"];

export default function CreateCharacter() {
  const { user, toast, tick } = useApp();
  const [sp] = useSearchParams();
  const hasProv = useMemo(() => hasCapableProvider("character"), [tick]);
  const [imgAssetId, setImgAssetId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(true);
  const [script, setScript] = useState("");
  const [language, setLanguage] = useState(user?.prefs?.defaultLanguage ?? "en");
  const [voice, setVoice] = useState("Professional");
  const [duration, setDuration] = useState(5);
  const [aspect, setAspect] = useState("9:16");
  const [expression, setExpression] = useState("Professional");
  const [action, setAction] = useState("Talking");
  const [providerId, setProviderId] = useState(user?.prefs?.defaultProvider ?? "auto");
  const [model, setModel] = useState(user?.prefs?.defaultModel ?? "");
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const { url: imgPreview } = useAsset(imgAssetId);

  useEffect(() => {
    const charId = sp.get("char");
    const libAsset = sessionStorage.getItem("charImageAsset");
    if (charId) {
      try {
        const c = api.listCharacters().find((x) => x.id === charId);
        if (c) { setName(c.name); setDescription(c.description); setVoice(c.voice ?? "Professional"); setImgAssetId(c.imageAssetId); toast("info", `Character loaded — ${c.name}`); }
      } catch { /* noop */ }
    } else if (libAsset) {
      sessionStorage.removeItem("charImageAsset");
      setImgAssetId(libAsset);
      toast("info", "Image attached as character reference", "Add a name and script to continue.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dims = ASPECTS[aspect] ?? ASPECTS["9:16"];
  const params = useMemo(() => ({
    aspect, duration, language, voice, expression, action,
    width: Math.round(dims.w * (1080 / dims.h)), height: 1080,
    characterAssetId: imgAssetId, characterName: name || undefined,
  }), [aspect, duration, language, voice, expression, action, dims, imgAssetId, name]);

  const upload = async (f: File) => {
    setErr(null);
    try {
      const a = await api.uploadAsset(f, "character_image");
      setImgAssetId(a.id);
      toast("success", "Reference uploaded", "Validated (MIME, extension, size) and stored securely.");
    } catch (e) { setErr(friendlyError(e).message); }
  };

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      if (saveToLibrary && name.trim()) {
        api.createCharacter({ name: name.trim(), description, imageAssetId: imgAssetId, videoAssetId: null, voice, meta: { expression, action } });
      }
      const gen = await api.createGeneration({
        type: "character",
        prompt: script || `${name || "Character"} ${action.toLowerCase()} — ${description}`,
        params: { ...params, providerId, model, script },
      });
      setGenId(gen.id);
      toast("info", "Character video queued", "Real engine engaged — OmniHuman/Luma with free SpeechT5 voice.");
    } catch (e) { setErr(friendlyError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <WorkspaceHeader title="Character Video Studio" sub="Your character reference + script → real lip-synced presenter video." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Character reference</span>
            <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button onClick={() => imgRef.current?.click()} className="group relative block h-32 w-full overflow-hidden rounded-[10px] border border-dashed border-ink-500 bg-ink-800/60 transition-colors hover:border-solar-500/60">
              {imgPreview ? <img src={imgPreview} alt="" className="h-full w-full object-cover" /> : (
                <span className="flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold text-ink-400 group-hover:text-solar-300"><Upload size={16} />Upload PNG / JPG / WEBP</span>
              )}
            </button>
            <Field label="Character Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder='e.g. "Priya — product host"' /></Field>
            <Field label="Description"><Textarea rows={2} className="min-h-[64px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder='"Young Indian female technology presenter wearing a black shirt."' /></Field>
            <Toggle checked={saveToLibrary} onChange={setSaveToLibrary} label="Save character to library" />
          </div>

          <div className="panel-flat space-y-4 p-4">
            <Field label="Script" hint={`${script.length}/4000`}>
              <Textarea rows={5} value={script} onChange={(e) => setScript(e.target.value)} placeholder="What does your character say? SpeechT5 (free) makes the voice, OmniHuman lip-syncs it." />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language"><Select value={language} onChange={(e) => setLanguage(e.target.value)}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
              <Field label="Voice"><Select value={voice} onChange={(e) => setVoice(e.target.value)}>{VOICES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
            </div>
            <Field label="Duration">
              <Segmented size="sm" value={String(duration)} onChange={(v) => setDuration(Number(v))} options={[5, 10, 15].map((d) => ({ value: String(d), label: `${d}s` }))} />
            </Field>
            <Field label="Aspect Ratio">
              <Segmented size="sm" value={aspect} onChange={setAspect} options={Object.entries(ASPECTS).slice(0, 4).map(([a]) => ({ value: a, label: a }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expression"><Select value={expression} onChange={(e) => setExpression(e.target.value)}>{EXPRESSIONS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="Action"><Select value={action} onChange={(e) => setAction(e.target.value)}>{ACTIONS.map((a) => <option key={a}>{a}</option>)}</Select></Field>
            </div>
          </div>
        </div>

        {!genId && !hasProv ? (
          <div className="flex min-h-[420px] items-center justify-center"><CapabilitySetupWizard task="character" /></div>
        ) : (
          <GenerationPreview genId={genId} emptyHint={<>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-ink-400"><Clapperboard size={22} /></div>
            <h3 className="font-display mt-4 text-[17px] font-bold text-ink-100">Your character performs here</h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-ink-500">Script → free HF SpeechT5 voice → Replicate OmniHuman 1.5 aapki image ko lip-synced talking video me animate karta hai.</p>
          </>} />
        )}

        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <ProviderSelect task="character" value={providerId} onChange={setProviderId} />
            <ModelSelect task="character" providerId={providerId} value={model} onChange={setModel} />
            <CreditEstimate task="character" providerId={providerId} model={model} params={params} />
            {err && <InfoNote tone="coral">{err}</InfoNote>}
            <Button className="w-full" size="lg" loading={busy} icon={<Wand2 size={16} />} onClick={generate} disabled={!imgAssetId}>Generate · {duration}s</Button>
            {!imgAssetId && <p className="text-center text-[11px] text-ink-500">Upload a character image to begin.</p>}
          </div>
          <div className="panel-flat p-4">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Save size={13} className="text-jade-400" /> Privacy</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">References per-account stored hain, upload pe validated, aur account delete ke saath hat jaate hain.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
