import { useMemo, useState } from "react";
import { ImageIcon, Wand2 } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ASPECTS, friendlyError, STYLES_IMAGE } from "../lib/utils";
import { Button, Field, Input, InfoNote, Segmented, Select, Textarea } from "../components/ui";
import { CapabilitySetupWizard, CreditEstimate, GenerationPreview, hasCapableProvider, ModelSelect, ProviderSelect, WorkspaceHeader } from "../components/create-bits";

const QUALITIES = ["draft", "standard", "hd"];

export default function CreateImage() {
  const { user, toast, tick } = useApp();
  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [aspect, setAspect] = useState("1:1");
  const [style, setStyle] = useState("Photorealistic");
  const [quality, setQuality] = useState("standard");
  const [count, setCount] = useState(1);
  const [seed, setSeed] = useState<number | "">("");
  const [providerId, setProviderId] = useState(user?.prefs?.defaultProvider ?? "auto");
  const [model, setModel] = useState(user?.prefs?.defaultModel ?? "");
  const [genId, setGenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const hasProv = useMemo(() => hasCapableProvider("image"), [tick]);

  const dims = ASPECTS[aspect] ?? ASPECTS["1:1"];
  const scale = quality === "draft" ? 0.6 : quality === "hd" ? 1 : 0.85;
  const params = useMemo(() => ({
    aspect, width: Math.round(dims.w * scale), height: Math.round(dims.h * scale),
    style, quality, count, negative: negative || undefined, seed: seed === "" ? undefined : Number(seed),
  }), [aspect, dims, scale, style, quality, count, negative, seed]);

  const generate = async () => {
    setBusy(true); setErr(null);
    try {
      const gen = await api.createGeneration({ type: "image", prompt, params: { ...params, providerId, model } });
      setGenId(gen.id);
      toast("info", "Image generation queued", gen.providerId === "ollama" ? "Running locally." : "Real engine engaged.");
    } catch (e) { setErr(friendlyError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <WorkspaceHeader title="AI Image Studio" sub="Diffusion-grade images from free engines — Pollinations needs no key at all." />
      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <Field label="Prompt" hint={`${prompt.length}/4000`}>
              <Textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                placeholder="A young Indian woman in a red saree, cinematic studio light, 85mm lens, shallow depth of field…" />
            </Field>
            <Field label="Negative Prompt"><Input value={negative} onChange={(e) => setNegative(e.target.value)} placeholder="blurry, low quality, watermark…" /></Field>
          </div>
          <div className="panel-flat space-y-4 p-4">
            <Field label="Aspect Ratio">
              <Segmented size="sm" value={aspect} onChange={setAspect} options={Object.entries(ASPECTS).map(([a, v]) => ({ value: a, label: a, title: v.label }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Style"><Select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES_IMAGE.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Quality"><Select value={quality} onChange={(e) => setQuality(e.target.value)}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Number of Images"><Select value={String(count)} onChange={(e) => setCount(Number(e.target.value))}>{[1, 2, 4].map((n) => <option key={n} value={n}>{n}</option>)}</Select></Field>
              <Field label="Seed" hint="blank = random"><Input type="number" value={seed} onChange={(e) => setSeed(e.target.value === "" ? "" : Number(e.target.value))} /></Field>
            </div>
          </div>
        </div>

        {!genId && !hasProv ? (
          <div className="flex min-h-[420px] items-center justify-center"><CapabilitySetupWizard task="image" /></div>
        ) : (
          <GenerationPreview genId={genId} emptyHint={<>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-ink-400"><ImageIcon size={22} /></div>
            <h3 className="font-display mt-4 text-[17px] font-bold text-ink-100">Your images render here</h3>
            <p className="mt-1.5 max-w-xs text-[12.5px] leading-relaxed text-ink-500">
              Pollinations (free, no key) pehle se connected hai. Zyada quality ke liye Hugging Face FLUX ya OpenRouter Gemini image connect karo.
            </p>
          </>} />
        )}

        <div className="space-y-4">
          <div className="panel-flat space-y-4 p-4">
            <ProviderSelect task="image" value={providerId} onChange={setProviderId} />
            <ModelSelect task="image" providerId={providerId} value={model} onChange={setModel} />
            <CreditEstimate task="image" providerId={providerId} model={model} params={params} />
            {err && <InfoNote tone="coral">{err}</InfoNote>}
            <Button className="w-full" size="lg" loading={busy} icon={<Wand2 size={16} />} onClick={generate} disabled={!prompt.trim()}>
              Generate {count > 1 ? `${count} Images` : "Image"}
            </Button>
          </div>
          <div className="panel-flat p-4">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Privacy</div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-400">
              {providerId === "ollama" ? "Running locally — prompt stays on this device." : "Prompt is sent only to the selected provider. Keys are AES-GCM encrypted."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
