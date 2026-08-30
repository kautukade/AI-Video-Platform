import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clapperboard, Coins, Download, ExternalLink, Film, Image as ImageIcon, Infinity as InfinityIcon, Plug, RefreshCw, Trash2, XCircle } from "lucide-react";
import { Asset, Generation, TaskType } from "../lib/types";
import { api } from "../server/api";
import { capabilityForTask } from "../server/ai/router";
import { useApp, useLiveGenerations } from "../state/store";
import { downloadBlob, downloadUrl, fmtNum } from "../lib/utils";
import { blobStore, getAdminSettings } from "../server/db";
import { Button, Field, InfoNote, Select, StageProgress, StatusBadge, Tag } from "./ui";
import { providerDef } from "../server/ai/providers";

export const TASK_LABEL: Record<TaskType, string> = {
  image: "AI Image", video: "AI Video", poster: "AI Poster", character: "Character Video", text: "Text", audio: "Audio",
};
export function taskIcon(t: TaskType, size = 18) {
  if (t === "video") return <Film size={size} />;
  if (t === "image" || t === "poster") return <ImageIcon size={size} />;
  return <Clapperboard size={size} />;
}

export function useGeneration(genId: string | null): Generation | null {
  const { tick } = useApp();
  useLiveGenerations();
  return useMemo(() => {
    if (!genId) return null;
    try { return api.getGeneration(genId); } catch { return null; }
  }, [genId, tick]);
}

export function useAsset(assetId: string | null | undefined): { asset: Asset | null; url: string | null } {
  const { tick } = useApp();
  const asset = useMemo(() => {
    if (!assetId) return null;
    try { return api.getAsset(assetId); } catch { return null; }
  }, [assetId, tick]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let on = true;
    if (!asset) { setUrl(null); return; }
    api.assetUrl(asset).then((u) => on && setUrl(u));
    return () => { on = false; };
  }, [asset]);
  return { asset, url };
}

export function ProviderSelect({ task, value, onChange }: { task: TaskType; value: string; onChange: (v: string) => void }) {
  const { tick } = useApp();
  const options = useMemo(() => {
    let conns: { providerId: string; label: string; status: string }[] = [];
    try { conns = api.myConnections().map((c) => ({ providerId: c.providerId, label: c.label, status: c.status })); } catch { /* noop */ }
    const simEnabled = getAdminSettings().mockEnabled;
    const supportsSim = ["image", "video", "character", "text", "poster"].includes(task);
    return { conns, simEnabled, supportsSim };
  }, [task, tick]);
  return (
    <Field label="AI Provider" hint={value === "auto" ? "best-fit routing" : undefined}>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="auto">Auto (ProviderRouter)</option>
        {options.conns.map((c) => (
          <option key={c.providerId} value={c.providerId}>
            {c.label}{c.status === "error" ? " — unreachable" : ""} · {providerDef(c.providerId)?.billing}
          </option>
        ))}
        {options.simEnabled && options.supportsSim && <option value="simulator">Local Simulator · dev mock · free</option>}
      </Select>
      {value === "auto" && <p className="mt-1.5 text-[11px] leading-snug text-ink-500">Routes by capability → best free engine → health. Paid fallback needs consent in Settings.</p>}
    </Field>
  );
}

export function ModelSelect({ task, providerId, value, onChange }: { task: TaskType; providerId: string; value: string; onChange: (v: string) => void }) {
  const { tick } = useApp();
  const cap = capabilityForTask(task);
  const models = useMemo(() => {
    try {
      const all = api.listModels({ capability: cap });
      if (providerId === "auto") return all;
      return all.filter((m) => m.providerId === providerId);
    } catch { return []; }
  }, [cap, providerId, tick]);
  useEffect(() => {
    if (value && !models.some((m) => m.name === value)) onChange(models[0]?.name ?? "");
    if (!value && models.length) onChange(models[0].name);
  }, [models, value, onChange]);
  return (
    <Field label="AI Model" hint={`${models.length} compatible`}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={!models.length}>
        {models.length === 0 && <option value="">No {cap}-capable models — connect a provider</option>}
        {models.map((m) => (
          <option key={m.id} value={m.name}>{m.displayName} · {m.providerId}{m.pricingNote ? ` · ${m.pricingNote}` : ""}</option>
        ))}
      </Select>
    </Field>
  );
}

export function CreditEstimate({ task, providerId, model, params, extraNote }: { task: TaskType; providerId: string; model: string; params: Record<string, any>; extraNote?: string }) {
  const { tick } = useApp();
  const est = useMemo(() => {
    try { return api.estimate({ type: task, providerId, model, params }); }
    catch (e: any) { return { error: e?.message ?? "Connect a provider to estimate cost" }; }
  }, [task, providerId, model, params, tick]);
  const unlimited = useMemo(() => { try { return api.platformMode().unlimited; } catch { return true; } }, []);
  if ("error" in est)
    return (
      <div className="rounded-[10px] border border-ink-700 bg-ink-800/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-ink-400"><AlertTriangle size={14} className="text-solar-400" /> {(est as any).error}</div>
      </div>
    );
  if (unlimited || est.credits === 0)
    return (
      <div className="rounded-[10px] border border-jade-500/30 bg-jade-500/8 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Cost</span>
          <span className="flex items-center gap-1.5 font-mono text-[15px] font-bold text-jade-300"><InfinityIcon size={16} /> FREE · unlimited</span>
        </div>
        <div className="mt-1 text-[11px] leading-snug text-ink-500">Local build — no credit limits. Provider usage is free-tier unless you connect paid keys.</div>
        {extraNote && <div className="mt-1.5 text-[11px] text-ink-500">{extraNote}</div>}
      </div>
    );
  return (
    <div className="rounded-[10px] border border-solar-500/25 bg-solar-400/6 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Estimated cost</span>
        <span className="flex items-center gap-1.5 font-mono text-[17px] font-bold text-solar-300"><Coins size={14} /> {fmtNum(est.credits)}</span>
      </div>
      {extraNote && <div className="mt-1.5 text-[11px] text-ink-500">{extraNote}</div>}
    </div>
  );
}

export function GenerationPreview({ genId, onDone, emptyHint }: { genId: string | null; onDone?: (g: Generation) => void; emptyHint: React.ReactNode }) {
  const gen = useGeneration(genId);
  const { asset, url } = useAsset(gen?.assetId);
  const { toast } = useApp();
  const nav = useNavigate();
  const doneRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (gen && gen.status === "completed" && doneRef.current !== gen.id) { doneRef.current = gen.id; onDone?.(gen); }
  }, [gen, onDone]);

  if (!gen)
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-[14px] border border-dashed border-ink-600 bg-ink-900/40 p-8 text-center">
        {emptyHint}
      </div>
    );
  const active = ["queued", "preparing", "generating", "processing"].includes(gen.status);
  return (
    <div className="panel-flat flex h-full min-h-[420px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ink-700 px-4 py-3">
        <StatusBadge status={gen.status} />
        <span className="truncate font-mono text-[11px] text-ink-500">{gen.id.slice(0, 13)} · {gen.providerId ?? "routing"}/{gen.model ?? "…"}</span>
        <span className="ml-auto flex items-center gap-1 font-mono text-[11.5px] text-jade-300"><Coins size={12} /> {api.platformMode().unlimited ? "free" : (gen.creditFinal ?? gen.creditEstimate)}</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {active && (
          <div className="anim-fade-in flex flex-1 flex-col justify-center gap-5 px-2">
            <div className="text-center">
              <div className="font-display text-[18px] font-bold text-ink-50">
                {gen.status === "queued" ? "In the queue…" : gen.status === "preparing" ? "Preparing your generation…" : gen.status === "generating" ? "Generating…" : "Processing output…"}
              </div>
              <p className="mt-1 text-[12.5px] text-ink-400">
                {gen.providerId === "ollama" ? "Running locally — your data stays on this device." : `Using Cloud AI — sent to ${providerDef(gen.providerId ?? "")?.name ?? gen.providerId}.`} Status streams live, no invented percentages.
              </p>
            </div>
            <StageProgress stages={gen.stages} status={gen.status} />
            {gen.status === "queued" && (
              <Button variant="outline" size="sm" className="self-center" onClick={async () => { try { await api.cancelGeneration(gen.id); toast("info", "Generation cancelled"); } catch (e: any) { toast("error", "Cannot cancel", e.message); } }}>Cancel</Button>
            )}
          </div>
        )}
        {gen.status === "completed" && url && (
          <div className="anim-fade-in flex flex-1 flex-col">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-[10px] bg-ink-950/70">
              {asset?.kind === "video" || asset?.mime.startsWith("video")
                ? <video src={url} controls className="max-h-[46vh] w-full object-contain" />
                : <img src={url} alt={gen.prompt} className="max-h-[46vh] w-full object-contain" />}
              {gen.simulated && <Tag tone="solar" className="absolute left-2.5 top-2.5">SIMULATED · DEV</Tag>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="subtle" icon={<Download size={13} />} onClick={async () => {
                if (asset?.blobId) { const b = await blobStore.get(asset.blobId); if (b) downloadBlob(b, `${asset.name}.${asset.mime.includes("png") ? "png" : asset.mime.includes("webm") ? "webm" : asset.mime.split("/")[1] ?? "bin"}`); }
                else if (url) downloadUrl(url, asset?.name ?? "result");
              }}>Download</Button>
              <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={async () => { try { await api.regenerate(gen.id); toast("success", "Regenerating", "New job queued."); nav("/history"); } catch (e: any) { toast("error", "Regenerate failed", e.message); } }}>Regenerate</Button>
              <Link to="/library"><Button size="sm" variant="outline" icon={<ExternalLink size={13} />}>Open Library</Button></Link>
            </div>
          </div>
        )}
        {gen.status === "completed" && !url && <div className="flex flex-1 items-center justify-center text-[13px] text-ink-400">Done — open the result from your Library.</div>}
        {(gen.status === "failed" || gen.status === "cancelled") && (
          <div className="anim-fade-in flex flex-1 flex-col items-center justify-center gap-3 text-center">
            {gen.status === "failed" ? <XCircle size={34} className="text-coral-400" /> : <AlertTriangle size={34} className="text-ink-400" />}
            <div className="font-display text-[17px] font-bold text-ink-100">{gen.status === "failed" ? "Generation failed" : "Generation cancelled"}</div>
            <p className="max-w-md text-[12.5px] leading-relaxed text-ink-400">{gen.error}</p>
            <div className="w-full max-w-md text-left"><StageProgress stages={gen.stages} status={gen.status} /></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function WorkspaceHeader({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[24px] font-bold tracking-tight text-ink-50 sm:text-[27px]">{title}</h1>
        <p className="mt-1 text-[13px] text-ink-400">{sub}</p>
      </div>
      {children}
    </div>
  );
}

export function DangerDelete({ onDelete, label = "Delete" }: { onDelete: () => void; label?: string }) {
  return <Button size="sm" variant="danger" icon={<Trash2 size={13} />} onClick={onDelete}>{label}</Button>;
}

/** True when at least one connected provider can run this task. */
export function hasCapableProvider(task: TaskType): boolean {
  try {
    const cap = capabilityForTask(task);
    const connected = new Set(api.myConnections().map((c) => c.providerId));
    return api.providerRegistry().some((p) => connected.has(p.id) && p.capabilities.includes(cap));
  } catch { return false; }
}

/** Inline first-connect wizard shown when no provider can run the task. */
const WIZARD_PROVIDERS: { id: string; why: string; keyHint: string }[] = [
  { id: "huggingface", why: "Free-tier images, video, text & audio · works from the browser", keyHint: "hf_…" },
  { id: "replicate", why: "Best free video quality — LTX, Wan 2.1, MiniMax, OmniHuman", keyHint: "r8_…" },
  { id: "luma", why: "Cinematic text/image-to-video · free monthly quota", keyHint: "luma key" },
  { id: "nvidia", why: "NIM free credits — LTX Video + Llama text", keyHint: "nvapi-…" },
];

export function CapabilitySetupWizard({ task }: { task: TaskType }) {
  const { bump, toast } = useApp();
  const [key, setKey] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [ep, setEp] = useState("http://127.0.0.1:11434");
  const label = TASK_LABEL[task] ?? task;

  const connect = async (pid: string) => {
    setBusy(pid);
    try {
      const def = api.providerRegistry().find((p) => p.id === pid)!;
      const r = await api.connectProvider({
        providerId: pid,
        apiKey: key[pid]?.trim() || undefined,
        endpoint: pid === "ollama" ? ep : undefined,
      });
      setResult((s) => ({ ...s, [pid]: { ok: true, msg: `${r.validation}${r.discovered ? ` · ${r.discovered} models discovered` : ""} — best free model auto-selected.` } }));
      toast("success", `${def.name} connected`, "Free models will be used automatically.");
      bump();
    } catch (e: any) {
      setResult((s) => ({ ...s, [pid]: { ok: false, msg: e?.message ?? "Connection failed." } }));
    } finally { setBusy(null); }
  };

  return (
    <div className="anim-fade-up panel w-full max-w-xl p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-solar-500/40 bg-solar-400/10 text-solar-300"><Plug size={18} /></span>
        <div>
          <h3 className="font-display text-[18px] font-bold text-ink-50">Set up {label}</h3>
          <p className="text-[12.5px] text-ink-400">Koi bhi ek free provider connect karo — system khud best free model chun lega.</p>
        </div>
      </div>
      <div className="mt-5 space-y-3">
        {WIZARD_PROVIDERS.map((p) => {
          const def = api.providerRegistry().find((x) => x.id === p.id);
          const r = result[p.id];
          return (
            <div key={p.id} className="rounded-xl border border-ink-700 bg-ink-850/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[14px] font-bold text-ink-50">{def?.name}</span>
                <Tag tone="jade">free tier</Tag>
                <span className="ml-auto">
                  {r?.ok ? <Tag tone="jade"><CheckCircle2 size={11} /> connected</Tag>
                    : <Button size="sm" loading={busy === p.id} onClick={() => connect(p.id)}>
                        {def?.auth === "none" ? "Connect" : "Login & Connect"}
                      </Button>}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-ink-400">{p.why}</p>
              {def && def.auth !== "none" && !r?.ok && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <input type="password" value={key[p.id] ?? ""} onChange={(e) => setKey((s) => ({ ...s, [p.id]: e.target.value }))}
                    placeholder={`API key (${p.keyHint}) — encrypted, never stored plain`}
                    className="min-w-0 flex-1 rounded-[10px] border border-ink-600 bg-ink-800 px-3 py-2 text-[12.5px] text-ink-100 placeholder:text-ink-500 focus:border-solar-500/70" />
                  <a href={def.docs} target="_blank" rel="noreferrer" className="flex items-center gap-1 self-center text-[11.5px] font-bold text-solar-300 hover:underline">
                    Get free key <ExternalLink size={11} />
                  </a>
                </div>
              )}
              {r && (
                <div className={`mt-2 text-[11.5px] font-semibold ${r.ok ? "text-jade-300" : "text-coral-300"}`}>{r.msg}</div>
              )}
            </div>
          );
        })}
        <div className="rounded-xl border border-ink-700 bg-ink-850/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-bold text-ink-50">Ollama (local · private)</span>
            <Tag tone="jade">100% free</Tag>
            <span className="ml-auto"><Button size="sm" variant="outline" loading={busy === "ollama"} onClick={() => connect("ollama")}>Detect & Connect</Button></span>
          </div>
          <p className="mt-1 text-[12px] text-ink-400">Text & vision only (video ke liye upar wale providers). Start: <span className="font-mono text-solar-300">ollama serve</span> with <span className="font-mono text-solar-300">OLLAMA_ORIGINS=*</span>, ya <span className="font-mono text-solar-300">node local-bridge.mjs</span>.</p>
          <input value={ep} onChange={(e) => setEp(e.target.value)} placeholder="http://127.0.0.1:11434"
            className="mt-2.5 w-full rounded-[10px] border border-ink-600 bg-ink-800 px-3 py-2 font-mono text-[12px] text-ink-100 focus:border-solar-500/70" />
          {result.ollama && <div className={`mt-2 text-[11.5px] font-semibold ${result.ollama.ok ? "text-jade-300" : "text-coral-300"}`}>{result.ollama.msg}</div>}
        </div>
        <InfoNote tone="solar">
          Real engines only — koi fake output nahi. Connect ke baad <strong>Generate</strong> dabao; system Auto mode me best available engine use karega aur fail hone pe agle provider pe fallback karega.
        </InfoNote>
      </div>
    </div>
  );
}
