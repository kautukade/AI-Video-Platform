import { useMemo, useState } from "react";
import {
  Activity, AudioLines, Boxes, CheckCircle2, Cpu, ExternalLink, Flower2, Image as ImageIcon, Key, Plug, Search, Server, ShieldCheck, Trash2, Video, Wifi, WifiOff, XCircle, Zap,
} from "lucide-react";
import { api, SafeConnection } from "../server/api";
import { useApp } from "../state/store";
import { cn, friendlyError } from "../lib/utils";
import { Button, ConfirmModal, Field, InfoNote, Input, Modal, Tag } from "../components/ui";
import { ProviderDef } from "../lib/types";

type Cat = "all" | "video" | "image" | "text" | "audio";
const CATEGORIES: { id: Cat; label: string; icon: any }[] = [
  { id: "all", label: "All", icon: Boxes }, { id: "video", label: "Video", icon: Video },
  { id: "image", label: "Image", icon: ImageIcon }, { id: "text", label: "Text", icon: Search }, { id: "audio", label: "Audio", icon: AudioLines },
];
const catCap: Record<Exclude<Cat, "all">, string[]> = {
  video: ["video"], image: ["image"], text: ["text", "vision"], audio: ["audio", "tts", "stt"],
};
const FREE_DIRECTORY: { provider: string; model: string; name: string; cat: Exclude<Cat, "all">; bestFor: string; freeNote: string }[] = [
  { provider: "replicate", model: "lucataco/ltx-video-13b-distilled", name: "LTX Video 13B", cat: "video", bestFor: "Open-source, quick renders", freeNote: "Free daily" },
  { provider: "replicate", model: "chenxwh/wan2.1-1.3b", name: "Wan 2.1", cat: "video", bestFor: "High-quality open video", freeNote: "Free daily" },
  { provider: "replicate", model: "bytedance/omni-human-1.5", name: "OmniHuman 1.5", cat: "video", bestFor: "Character lip-sync", freeNote: "Free daily" },
  { provider: "luma", model: "photon-1", name: "Luma Photon", cat: "video", bestFor: "Cinematic shots", freeNote: "~30 free/mo" },
  { provider: "nvidia", model: "lightricks/ltx-video", name: "LTX Video (NIM)", cat: "video", bestFor: "Fast photoreal video", freeNote: "Free NIM tier" },
  { provider: "huggingface", model: "Lightricks/LTX-Video", name: "LTX Video (HF)", cat: "video", bestFor: "Free text-to-video", freeNote: "Free tier · slow" },
  { provider: "pollinations", model: "flux", name: "FLUX", cat: "image", bestFor: "Best free image quality", freeNote: "Free · no key" },
  { provider: "pollinations", model: "turbo", name: "Turbo", cat: "image", bestFor: "Fastest free images", freeNote: "Free · no key" },
  { provider: "huggingface", model: "black-forest-labs/FLUX.1-schnell", name: "FLUX.1 Schnell", cat: "image", bestFor: "Diffusion quality", freeNote: "Free tier" },
  { provider: "google", model: "gemini-2.5-flash-image-preview", name: "Gemini Image", cat: "image", bestFor: "Text-aware images", freeNote: "Free tier" },
  { provider: "ollama", model: "llama3.2", name: "Llama 3.2 (local)", cat: "text", bestFor: "Private, on your laptop", freeNote: "Free · local" },
  { provider: "ollama", model: "qwen2.5vl", name: "Qwen 2.5 VL (local)", cat: "text", bestFor: "Local vision/analysis", freeNote: "Free · local" },
  { provider: "pollinations", model: "openai", name: "GPT (Pollinations)", cat: "text", bestFor: "No-key text", freeNote: "Free · no key" },
  { provider: "google", model: "gemini-2.5-flash", name: "Gemini 2.5 Flash", cat: "text", bestFor: "Fast + smart", freeNote: "Free tier" },
  { provider: "groq", model: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", cat: "text", bestFor: "Ultra-fast inference", freeNote: "Free tier" },
  { provider: "cerebras", model: "llama-3.3-70b", name: "Llama 3.3 70B", cat: "text", bestFor: "Blazing open models", freeNote: "Free tier" },
  { provider: "deepseek", model: "deepseek-chat", name: "DeepSeek V3", cat: "text", bestFor: "Top reasoning", freeNote: "Near-zero cost" },
  { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B", cat: "text", bestFor: "300+ model router", freeNote: ":free variant" },
  { provider: "huggingface", model: "microsoft/speecht5_tts", name: "SpeechT5 TTS", cat: "audio", bestFor: "Narration voice", freeNote: "Free tier" },
];
const CAP_TONES: Record<string, "ink" | "solar" | "jade" | "coral" | "iris"> = {
  text: "iris", image: "jade", video: "solar", audio: "coral", tts: "coral", stt: "coral", vision: "iris", embedding: "ink",
};
function ProviderGlyph({ id }: { id: string }) {
  const map: Record<string, any> = { openrouter: Plug, huggingface: Boxes, pollinations: Flower2, ollama: Server, custom: Cpu, google: Key, replicate: Boxes, nvidia: Cpu, together: Plug, groq: Zap, cerebras: Zap, deepseek: Search, mistral: Plug, luma: Video };
  const I = map[id] ?? Plug;
  return <I size={19} />;
}

export function ProvidersPage() {
  const { toast, tick, bump } = useApp();
  const registry = useMemo(() => {
    const all = api.providerRegistry();
    try { if (!api.platformMode().simulatorEnabled) return all.filter((p) => p.id !== "simulator"); } catch { /* boot */ }
    return all;
  }, []);
  const conns = useMemo(() => { try { return api.myConnections(); } catch { return []; } }, [tick]);
  const [cat, setCat] = useState<Cat>("all");
  const [modal, setModal] = useState<ProviderDef | null>(null);
  const [confirmDisc, setConfirmDisc] = useState<SafeConnection | null>(null);
  const connFor = (pid: string) => conns.find((c) => c.providerId === pid);
  const providersForCat = useMemo(() => registry.filter((p) => cat === "all" || p.capabilities.some((c) => catCap[cat as Exclude<Cat, "all">]?.includes(c))), [registry, cat]);
  const modelsForCat = useMemo(() => FREE_DIRECTORY.filter((m) => cat === "all" || m.cat === cat), [cat]);

  return (
    <div className="relative">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-jade-400">free model directory</div>
          <h1 className="font-display mt-1 text-[28px] font-bold tracking-tight text-ink-50">AI Providers</h1>
          <p className="mt-1 max-w-2xl text-[13.5px] text-ink-400">Har free AI engine, category-wise. <strong className="text-ink-200">Login with provider</strong> karo — key dalte hi system <strong className="text-ink-200">best free model auto-select</strong> kar leta hai.</p>
        </div>
        <Tag tone="jade"><ShieldCheck size={12} /> keys AES-GCM encrypted</Tag>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = cat === c.id;
          const count = c.id === "all" ? FREE_DIRECTORY.length : FREE_DIRECTORY.filter((m) => m.cat === c.id).length;
          return (
            <button key={c.id} onClick={() => setCat(c.id)}
              className={cn("group flex items-center gap-2.5 rounded-[12px] border px-4 py-2.5 transition-all", active ? "border-solar-500/60 bg-solar-400/12 text-solar-300" : "border-ink-700 bg-ink-850/60 text-ink-300 hover:border-ink-500")}>
              <c.icon size={16} className={active ? "text-solar-400" : "text-ink-400"} />
              <span className="text-[13.5px] font-bold">{c.label}</span>
              <span className={cn("rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold", active ? "bg-solar-400/20 text-solar-300" : "bg-ink-750 text-ink-400")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="stagger grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {providersForCat.map((p) => {
          const conn = connFor(p.id);
          const connected = !!conn && conn.status !== "disconnected";
          const noKey = p.auth === "none";
          const featured = FREE_DIRECTORY.filter((m) => m.provider === p.id && (cat === "all" || m.cat === cat)).slice(0, 3);
          return (
            <div key={p.id} className={cn("panel relative flex flex-col overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:border-ink-500", connected && "border-jade-500/30")}>
              {connected && <span className="absolute inset-x-0 top-0 h-[2.5px] bg-gradient-to-r from-jade-500/70 to-jade-500/10" />}
              <div className="flex items-start justify-between gap-2">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border", connected ? "border-jade-500/40 bg-jade-500/10 text-jade-300" : "border-ink-600 bg-ink-800 text-ink-300")}><ProviderGlyph id={p.id} /></div>
                <div className="flex flex-col items-end gap-1.5">
                  <Tag tone={p.billing === "free" ? "jade" : p.billing === "freemium" ? "solar" : "coral"}>{p.billing === "free" ? "100% free" : p.billing === "freemium" ? "free tier" : "paid"}</Tag>
                  {connected ? <Tag tone={conn!.status === "connected" ? "jade" : "coral"}>{conn!.status === "connected" ? <><Wifi size={11} /> connected</> : <><WifiOff size={11} /> error</>}</Tag>
                    : noKey ? <Tag tone="jade"><Zap size={11} /> no login needed</Tag> : <Tag>not connected</Tag>}
                </div>
              </div>
              <h3 className="font-display mt-3.5 text-[16px] font-bold text-ink-50">{p.name}</h3>
              <p className="mt-1 text-[12.5px] leading-snug text-ink-400">{p.tagline}</p>
              {featured.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{featured.map((m) => <Tag key={m.model} tone="ink" className="font-mono">{m.name}</Tag>)}</div>}
              <div className="mt-3 flex flex-wrap gap-1.5">{p.capabilities.map((c) => <Tag key={c} tone={CAP_TONES[c] ?? "ink"}>{c}</Tag>)}</div>
              <div className="mt-4 flex items-center gap-2 border-t border-ink-700 pt-4">
                {connected ? (
                  <>
                    <Button size="sm" variant="jade" onClick={async () => { try { const r = await api.testConnection(conn!.id); toast("success", `${p.name} healthy`, r.message); bump(); } catch (e) { toast("error", `${p.name} test failed`, friendlyError(e).message); bump(); } }} icon={<Activity size={13} />}>Test</Button>
                    <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={() => setConfirmDisc(conn!)} />
                    {conn!.latencyMs != null && <span className="ml-auto font-mono text-[10.5px] text-ink-500">{conn!.latencyMs}ms</span>}
                  </>
                ) : (
                  <>
                    <Button size="sm" onClick={() => setModal(p)} icon={noKey ? <Zap size={13} /> : <Key size={13} />}>{noKey ? "Connect" : `Login ${p.name.split(" ")[0]}`}</Button>
                    <a href={p.docs} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold text-ink-400 hover:text-solar-300">{noKey ? "docs" : "free key"} <ExternalLink size={11} /></a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-[19px] font-bold text-ink-50">Free {cat === "all" ? "" : cat + " "}models right now</h2>
          <span className="font-mono text-[11px] text-ink-500">verified catalog</span>
        </div>
        <div className="panel-flat overflow-hidden">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-ink-700 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
                <th className="px-4 py-3">Model</th><th className="px-4 py-3">Provider</th><th className="hidden px-4 py-3 sm:table-cell">Best for</th>
                <th className="px-4 py-3">Free plan</th><th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {modelsForCat.map((m) => {
                const conn = connFor(m.provider);
                const def = registry.find((p) => p.id === m.provider);
                return (
                  <tr key={m.provider + m.model} className="border-b border-ink-800 transition-colors last:border-0 hover:bg-ink-800/50">
                    <td className="px-4 py-3"><div className="font-bold text-ink-100">{m.name}</div><div className="font-mono text-[10.5px] text-ink-500">{m.model}</div></td>
                    <td className="px-4 py-3 text-ink-300">{def?.name ?? m.provider}</td>
                    <td className="hidden px-4 py-3 text-ink-400 sm:table-cell">{m.bestFor}</td>
                    <td className="px-4 py-3"><Tag tone="jade">{m.freeNote}</Tag></td>
                    <td className="px-4 py-3 text-right">{conn ? <Tag tone="jade"><CheckCircle2 size={11} /> ready</Tag> : <Button size="sm" variant="outline" onClick={() => def && setModal(def)}>Login & Use</Button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ConnectModal def={modal} existing={connFor(modal.id) ?? null} onClose={() => { setModal(null); bump(); }} />}
      <ConfirmModal open={!!confirmDisc} onClose={() => setConfirmDisc(null)} title={`Disconnect ${confirmDisc?.label}?`}
        body="Saved key encrypted vault se delete ho jayegi." confirmLabel="Disconnect"
        onConfirm={() => { if (confirmDisc) { api.disconnectProvider(confirmDisc.id); toast("info", "Disconnected", confirmDisc.label); bump(); } }} />
    </div>
  );
}

function ConnectModal({ def, existing, onClose }: { def: ProviderDef; existing: SafeConnection | null; onClose: () => void }) {
  const { toast, bump } = useApp();
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(existing?.endpoint ?? (def.id === "ollama" ? "http://127.0.0.1:11434" : ""));
  const [defaultModel, setDefaultModel] = useState(existing?.defaultModel ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size?: string; capabilities: string[] }[] | null>(null);
  const needsKey = def.auth !== "none";
  let host = "";
  try { host = def.docs.startsWith("http") ? new URL(def.docs).host : ""; } catch { host = ""; }

  const validate = async () => {
    setBusy(true); setResult(null);
    try {
      if (def.id === "ollama") {
        const models = await api.detectOllama(endpoint);
        setOllamaModels(models.map((m) => ({ name: m.name, size: m.size, capabilities: m.capabilities })));
        setResult({ ok: true, message: `Ollama reachable · ${models.length} installed models found.` });
      } else {
        const r = await api.connectProvider({ providerId: def.id, apiKey: apiKey || undefined, endpoint: def.id === "custom" ? endpoint : undefined, defaultModel: defaultModel || undefined });
        setResult({ ok: true, message: `${r.validation}${r.discovered ? ` · ${r.discovered} models discovered` : ""}` });
        toast("success", `${def.name} connected`, "Free models auto-selected.");
        bump(); onClose();
      }
    } catch (e) { setResult({ ok: false, message: friendlyError(e).message }); }
    finally { setBusy(false); }
  };
  const connectOllama = async () => {
    setBusy(true);
    try {
      const r = await api.connectProvider({ providerId: "ollama", endpoint, defaultModel: defaultModel || ollamaModels?.[0]?.name });
      toast("success", "Ollama connected", `${r.validation}${r.discovered ? ` · ${r.discovered} models` : ""} — auto model set.`);
      bump(); onClose();
    } catch (e) { toast("error", "Ollama connect failed", friendlyError(e).message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-2"><ProviderGlyph id={def.id} /> Login {def.name}</span>}
      footer={def.id === "ollama" ? (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" loading={busy} icon={<Activity size={13} />} onClick={validate}>Detect Ollama</Button>
          <Button loading={busy} onClick={connectOllama} disabled={result ? !result.ok : false}>Connect Ollama</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button loading={busy} onClick={validate} icon={<Key size={13} />}>{existing ? "Save" : "Login & Connect"}</Button>
        </>
      )}>
      <div className="space-y-4">
        {needsKey && (
          <a href={def.docs} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-[10px] border border-solar-500/35 bg-solar-400/8 px-4 py-3 text-[12.5px] font-bold text-solar-300 hover:bg-solar-400/15">
            <span>Create a free {def.name} account & key {host && <span className="font-mono text-[10.5px] font-normal text-ink-400">({host})</span>}</span>
            <ExternalLink size={14} />
          </a>
        )}
        {needsKey && (
          <Field label={def.auth === "token" ? "API Token" : "API Key"} hint={existing ? "leave blank to keep current" : undefined}>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" placeholder={def.id === "openrouter" ? "sk-or-v1-…" : def.id === "huggingface" ? "hf_…" : "API key…"} />
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-500"><Key size={11} /> AES-GCM encrypted · sirf masked hint dikhega</div>
          </Field>
        )}
        {(def.id === "ollama" || def.id === "custom") && (
          <Field label={def.id === "ollama" ? "Ollama endpoint" : "Base URL"} hint={def.id === "ollama" ? "localhost, LAN IP ya hostname" : "must expose /models"}>
            <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder={def.id === "ollama" ? "http://192.168.1.20:11434" : "https://api.groq.com/openai/v1"} />
          </Field>
        )}
        <Field label="Default model (optional)" hint="blank → auto best free model">
          <Input value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="auto (recommended)" />
        </Field>
        {result && (
          <div className={cn("flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed", result.ok ? "border-jade-500/35 bg-jade-500/8 text-jade-300" : "border-coral-500/35 bg-coral-500/8 text-coral-300")}>
            {result.ok ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <XCircle size={15} className="mt-0.5 shrink-0" />}
            <div>{result.message}</div>
          </div>
        )}
        {def.id === "ollama" && (
          <div className="rounded-[10px] border border-ink-700 bg-ink-850 p-4">
            <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Installed models {ollamaModels ? `· ${ollamaModels.length}` : ""}</div>
            {ollamaModels === null ? <p className="mt-2 text-[12px] text-ink-500"><span className="font-mono text-solar-300">Detect Ollama</span> dabao — /api/tags se models list honge.</p>
              : ollamaModels.length === 0 ? <p className="mt-2 text-[12px] text-ink-500">Ollama reachable hai par koi model nahi. Pehle: <span className="font-mono text-solar-300">ollama pull llama3.2</span></p>
              : (
                <div className="mt-2.5 space-y-1.5">
                  {ollamaModels.map((m) => (
                    <div key={m.name} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2">
                      <Server size={13} className="text-solar-400" />
                      <span className="font-mono text-[12px] text-ink-100">{m.name}</span>
                      {m.size && <span className="font-mono text-[10.5px] text-ink-500">{m.size}</span>}
                      <span className="ml-auto flex gap-1">{m.capabilities.map((c) => <Tag key={c} tone={CAP_TONES[c] ?? "ink"}>{c}</Tag>)}</span>
                      <Button size="sm" variant="ghost" onClick={() => setDefaultModel(m.name)}>Use</Button>
                    </div>
                  ))}
                </div>
              )}
            {result && !result.ok && (
              <div className="mt-3 border-t border-ink-700 pt-3">
                <div className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Troubleshooting</div>
                <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] text-ink-400">
                  <li>Ollama chal raha hai? — <span className="font-mono text-ink-200">ollama serve</span></li>
                  <li>Browser CORS: <span className="font-mono text-ink-200">OLLAMA_ORIGINS=* ollama serve</span></li>
                  <li>Ya local bridge: <span className="font-mono text-ink-200">node local-bridge.mjs</span></li>
                </ol>
              </div>
            )}
            <div className="mt-3 border-t border-ink-700 pt-3 text-[11.5px] leading-relaxed text-ink-400">
              <span className="font-bold text-ink-200">Claude</span> Ollama pe available nahi — Claude/GPT ke liye <span className="text-solar-300">OpenRouter</span> connect karo.
            </div>
          </div>
        )}
        {def.id === "pollinations" && <InfoNote tone="jade"><strong>No login, no key.</strong> Pollinations free FLUX images aur GPT text publicly serve karta hai — Connect dabao aur routing shuru.</InfoNote>}
        {def.id === "huggingface" && <InfoNote>Free tier me <strong>image, video, text & audio</strong> sab hai. Video cold-start pe slow hota hai — honest MODEL_LOADING status dikhta hai.</InfoNote>}
        {def.id === "openrouter" && <InfoNote>Studio <strong>":free" variants automatic prefer</strong> karta hai. Paid models sirf aapki permission pe.</InfoNote>}
        {def.id === "replicate" && <InfoNote>Free account pe <strong>daily free predictions</strong> — LTX, Wan, OmniHuman character video ke liye best.</InfoNote>}
        {def.id === "nvidia" && <InfoNote>NIM free tier me <strong>1000 credits</strong> — LTX Video aur Llama models ke liye.</InfoNote>}
        {def.id === "luma" && <InfoNote>Dream Machine ka <strong>free monthly quota</strong> — cinematic text/image-to-video.</InfoNote>}
      </div>
    </Modal>
  );
}

export function ModelsPage() {
  const { tick } = useApp();
  const [filter, setFilter] = useState("");
  const [cap, setCap] = useState("all");
  const models = useMemo(() => { try { return api.listModels({ capability: cap === "all" ? undefined : cap }); } catch { return []; } }, [tick, cap]);
  const filtered = models.filter((m) => !filter || m.name.toLowerCase().includes(filter.toLowerCase()) || m.displayName.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">AI Models</h1>
        <p className="mt-1 text-[13px] text-ink-400">Connected providers ke saare models — capability badges aur pricing ke saath.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search models…" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", "text", "image", "video", "vision", "audio"].map((c) => (
            <button key={c} onClick={() => setCap(c)} className={cn("rounded-lg border px-3 py-2 text-[12px] font-bold transition-all", cap === c ? "border-solar-500/60 bg-solar-400/12 text-solar-300" : "border-ink-700 text-ink-400 hover:border-ink-500")}>{c}</button>
          ))}
        </div>
      </div>
      <div className="stagger mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((m) => (
          <div key={m.id} className="panel-flat p-4 transition-colors hover:border-ink-500">
            <div className="flex items-start justify-between gap-2">
              <div><div className="text-[13.5px] font-bold text-ink-50">{m.displayName}</div><div className="mt-0.5 font-mono text-[10.5px] text-ink-500">{m.name}</div></div>
              <Tag tone={m.pricingNote && /FREE/i.test(m.pricingNote) ? "jade" : "ink"}>{m.pricingNote || m.providerId}</Tag>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {m.capabilities.map((c) => <Tag key={c} tone={CAP_TONES[c] ?? "ink"}>{c}</Tag>)}
              <Tag tone="ink">{m.providerId}</Tag>
              {m.context && <Tag tone="ink">{Math.round(m.context / 1024)}k ctx</Tag>}
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <div className="mt-8"><InfoNote>Is capability ke liye koi model nahi mila — provider connect karo ya category badlo.</InfoNote></div>}
    </div>
  );
}
