import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Clapperboard, Coins, Download, ExternalLink, Film, Image as ImageIcon,
  Infinity as InfinityIcon, Plug, RefreshCw, Sparkles, Trash2, XCircle, Zap,
} from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { blobUrl } from "../server/db";
import { Asset, Capability, Generation, TaskType } from "../lib/types";
import { cn, downloadBlob, fmtNum, friendlyError, maskKey } from "../lib/utils";
import { Button, InfoNote, Select, StageProgress, StatusBadge, Tag } from "./ui";
import { GenArt } from "./gen-art";

export const TASK_LABEL: Record<string, string> = { image: "Image", video: "Video", poster: "Poster", character: "Character", text: "Text", audio: "Audio" };
export function taskIcon(type: string, size = 14) {
  if (type === "video") return <Film size={size} />;
  if (type === "character") return <Clapperboard size={size} />;
  if (type === "poster") return <ImageIcon size={size} />;
  return <ImageIcon size={size} />;
}

export function WorkspaceHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="anim-fade-up mb-5">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-solar-400">ai creative studio</div>
      <h1 className="font-display mt-1 text-[28px] font-bold tracking-tight text-ink-50">{title}</h1>
      {sub && <p className="mt-1 text-[13.5px] text-ink-400">{sub}</p>}
    </div>
  );
}

export function hasCapableProvider(task: TaskType): boolean {
  try {
    const conns = api.myConnections();
    const registry = api.providerRegistry();
    const cap: Capability = task === "image" || task === "poster" ? "image" : task === "video" || task === "character" ? "video" : task === "audio" ? "audio" : "text";
    return conns.some((c) => {
      const def = registry.find((p) => p.id === c.providerId);
      return def?.capabilities.includes(cap);
    });
  } catch { return false; }
}

export function ProviderSelect({ task, value, onChange }: { task: TaskType; value: string; onChange: (v: string) => void }) {
  const { tick } = useApp();
  const options = useMemo(() => {
    try {
      const conns = api.myConnections();
      const registry = api.providerRegistry();
      const cap: Capability = task === "image" || task === "poster" ? "image" : task === "video" || task === "character" ? "video" : task === "audio" ? "audio" : "text";
      const capable = conns.filter((c) => registry.find((p) => p.id === c.providerId)?.capabilities.includes(cap));
      return capable.map((c) => ({ id: c.providerId, label: `${c.label}${c.providerId === "simulator" ? " (SIM)" : ""}` }));
    } catch { return []; }
  }, [tick, task]);
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">AI Provider</div>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="auto">Auto (best free engine)</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </Select>
    </div>
  );
}

export function ModelSelect({ task, providerId, value, onChange }: { task: TaskType; providerId: string; value: string; onChange: (v: string) => void }) {
  const { tick } = useApp();
  const models = useMemo(() => {
    try {
      if (providerId === "auto") return [];
      const cap: Capability = task === "image" || task === "poster" ? "image" : task === "video" || task === "character" ? "video" : task === "audio" ? "audio" : "text";
      return api.listModels({ providerId, capability: cap });
    } catch { return []; }
  }, [tick, providerId, task]);
  const defModel = useMemo(() => {
    try { return providerId !== "auto" ? api.defaultModelFor(providerId, task) : ""; } catch { return ""; }
  }, [providerId, task]);
  return (
    <div>
      <div className="mb-1.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">Model</div>
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{defModel ? `auto — ${defModel}` : "auto (recommended)"}</option>
        {models.map((m) => <option key={m.id} value={m.name}>{m.displayName}</option>)}
      </Select>
    </div>
  );
}

export function CreditEstimate({ task, providerId, model, params }: { task: TaskType; providerId: string; model: string; params: Record<string, any> }) {
  const est = useMemo(() => {
    try { return api.estimate({ type: task, providerId, model: model || null, params }); }
    catch { return { credits: 0, rule: { base: 0, unit: "per_generation" as const, note: "" } }; }
  }, [task, providerId, model, params]);
  const unlimited = useMemo(() => { try { return api.platformMode().unlimited; } catch { return true; } }, []);
  if (unlimited || est.credits === 0)
    return (
      <div className="rounded-[10px] border border-jade-500/30 bg-jade-500/8 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Cost</span>
          <span className="flex items-center gap-1.5 font-mono text-[15px] font-bold text-jade-300"><InfinityIcon size={16} /> FREE · unlimited</span>
        </div>
        <div className="mt-1 text-[11px] leading-snug text-ink-500">Local build — no credit limits. Free-tier engines (Pollinations, Ollama, HF) unless you connect a paid key.</div>
      </div>
    );
  return (
    <div className="rounded-[10px] border border-solar-500/25 bg-solar-400/6 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-ink-400">Estimated cost</span>
        <span className="flex items-center gap-1.5 font-mono text-[17px] font-bold text-solar-300"><Coins size={14} /> {fmtNum(est.credits)}</span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-ink-500">Reserved up-front; unused credits refund automatically.</div>
    </div>
  );
}

export function useAsset(assetId: string | null): { asset: Asset | null; url: string | null } {
  const { tick } = useApp();
  const asset = useMemo(() => {
    if (!assetId) return null;
    try { return api.getAsset(assetId); } catch { return null; }
  }, [assetId, tick]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (asset) api.assetUrl(asset).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [asset]);
  return { asset, url };
}

export function useGeneration(genId: string | null): Generation | null {
  const { tick } = useApp();
  return useMemo(() => {
    if (!genId) return null;
    try { return api.getGeneration(genId); } catch { return null; }
  }, [genId, tick]);
}

export function GenerationPreview({ genId, emptyHint }: { genId: string | null; emptyHint: React.ReactNode }) {
  const gen = useGeneration(genId);
  const { asset, url } = useAsset(gen?.assetId ?? null);
  const { toast } = useApp();

  if (!gen)
    return (
      <div className="panel-flat anim-fade-in flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
        {emptyHint}
      </div>
    );

  const active = ["queued", "preparing", "generating", "processing"].includes(gen.status);
  return (
    <div className="panel-flat anim-fade-in flex min-h-[420px] flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <StatusBadge status={gen.status} />
        <div className="flex items-center gap-2">
          {gen.providerId && <Tag tone="ink">{gen.providerId}{gen.simulated ? " · SIM" : ""}</Tag>}
          {gen.model && <Tag tone="ink" className="font-mono">{gen.model}</Tag>}
        </div>
      </div>

      {active && (
        <div className="flex flex-1 items-center justify-center"><div className="w-full max-w-md"><StageProgress stages={gen.stages} status={gen.status} /></div></div>
      )}

      {gen.status === "completed" && url && asset && (
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-1 items-center justify-center overflow-hidden rounded-[12px] border border-ink-700 bg-ink-900">
            {asset.kind === "video"
              ? <video src={url} controls className="max-h-[52vh] w-auto rounded-[8px]" />
              : <img src={url} alt={gen.prompt} className="max-h-[52vh] w-auto rounded-[8px] object-contain" />}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" icon={<Download size={13} />} onClick={async () => { try { await api.downloadAsset(asset); } catch { toast("error", "Download failed"); } }}>Download</Button>
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={async () => { try { await api.regenerate(gen.id); toast("info", "Regeneration queued"); } catch (e) { toast("error", "Regenerate failed", friendlyError(e).message); } }}>Regenerate</Button>
            {asset.kind === "image" && (
              <Button size="sm" variant="ghost" icon={<Clapperboard size={13} />} onClick={() => { sessionStorage.setItem("charImageAsset", asset.id); window.location.hash = "#/create/character"; }}>Use as character</Button>
            )}
            <Link to="/library" className="ml-auto text-[12px] font-semibold text-solar-300 hover:underline">Saved to library →</Link>
          </div>
        </div>
      )}

      {gen.status === "failed" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <XCircle size={34} className="text-coral-400" />
          <div>
            <div className="text-[15px] font-bold text-ink-100">Generation failed</div>
            <p className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-ink-400">{gen.error}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" icon={<RefreshCw size={13} />} onClick={async () => { try { await api.regenerate(gen.id); toast("info", "Retrying…"); } catch (e) { toast("error", "Retry failed", friendlyError(e).message); } }}>Retry</Button>
            <Link to="/providers"><Button size="sm" variant="ghost" icon={<Plug size={13} />}>Connect a provider</Button></Link>
          </div>
        </div>
      )}

      {gen.status === "cancelled" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle size={30} className="text-ink-400" />
          <p className="text-[13px] text-ink-400">Cancelled — reserved credits refunded.</p>
        </div>
      )}
    </div>
  );
}

/** Inline setup wizard shown in studios when no capable provider is connected. */
export function CapabilitySetupWizard({ task }: { task: TaskType }) {
  const { toast, bump } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [key, setKey] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const isVideo = task === "video" || task === "character";

  const options = useMemo(() => {
    const registry = api.providerRegistry();
    const cap: Capability = isVideo ? "video" : task === "audio" ? "audio" : task === "text" ? "text" : "image";
    return registry.filter((p) => p.capabilities.includes(cap) && p.id !== "simulator");
  }, [task, isVideo]);

  const connectNoKey = async (pid: string, name: string) => {
    setBusy(pid);
    try {
      await api.connectProvider({ providerId: pid });
      toast("success", `${name} connected`, "Free models auto-selected — generate now!");
      bump();
    } catch (e) { toast("error", "Connect failed", friendlyError(e).message); }
    finally { setBusy(null); }
  };

  const connectKey = async (pid: string, name: string) => {
    if (!key.trim()) { toast("warning", "API key required", `${name} ke liye free key paste karo.`); return; }
    setBusy(pid);
    try {
      await api.connectProvider({ providerId: pid, apiKey: key.trim() });
      toast("success", `${name} connected`, "Free models auto-selected — generate now!");
      setKey(""); setTarget(null); bump();
    } catch (e) { toast("error", "Connect failed", friendlyError(e).message); }
    finally { setBusy(null); }
  };

  return (
    <div className="anim-fade-up w-full max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-solar-500/40 bg-solar-400/10 text-solar-300"><Sparkles size={22} /></span>
        <div>
          <h3 className="font-display text-[20px] font-bold text-ink-50">Set Up Your AI Studio</h3>
          <p className="text-[12.5px] text-ink-400">Ek free {isVideo ? "video" : "image/text"} engine connect karo — sabke free tier hain, system best model khud chunega.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((p) => {
          const noKey = p.auth === "none";
          const expanded = target === p.id;
          return (
            <div key={p.id} className="panel-flat flex flex-col p-4">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-bold text-ink-50">{p.name}</span>
                <Tag tone={p.billing === "free" ? "jade" : "solar"}>{p.billing === "free" ? "no key" : "free tier"}</Tag>
              </div>
              <p className="mt-1 flex-1 text-[11.5px] leading-snug text-ink-400">{p.tagline}</p>
              <div className="mt-3 flex items-center gap-2">
                {noKey ? (
                  <Button size="sm" loading={busy === p.id} icon={<Zap size={12} />} onClick={() => connectNoKey(p.id, p.name)}>Connect</Button>
                ) : expanded ? (
                  <div className="flex w-full gap-1.5">
                    <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="API key…"
                      className="h-8 min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-800 px-2.5 text-[12px] text-ink-100 focus:border-solar-500/70" />
                    <Button size="sm" loading={busy === p.id} onClick={() => connectKey(p.id, p.name)}>Go</Button>
                  </div>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { setTarget(p.id); setKey(""); }}>Login</Button>
                    <a href={p.docs} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] font-semibold text-solar-300 hover:underline">free key <ExternalLink size={10} /></a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
        Keys AES-GCM encrypted hoti hain, kabhi log nahi hoti. Ya <Link to="/engine" className="font-semibold text-solar-300 hover:underline">AI Engine Setup</Link> me apna local Ollama jodo.
      </p>
    </div>
  );
}
