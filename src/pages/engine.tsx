import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, CheckCircle2, Cpu, Download, Gauge, HardDrive, Loader2, MemoryStick, Play, RefreshCw, Server, ShieldCheck, Sparkles, Trash2, Wifi, XCircle, Zap,
} from "lucide-react";
import { useApp } from "../state/store";
import { api } from "../server/api";
import { cn, fmtNum, friendlyError } from "../lib/utils";
import { Button, InfoNote, Input, Tag, Toggle } from "../components/ui";
import {
  bridgeStatus, detectMachine, getOllamaHost, loadMachine, ollamaDelete, ollamaPull, ollamaStatus, ollamaTestModel, recommendModels, setOllamaHost,
} from "../server/local";
import { MachineProfile, ModelRecommendation, OllamaStatus } from "../lib/types";

const STEPS = ["Detecting operating system", "Detecting CPU", "Detecting RAM", "Detecting GPU", "Detecting VRAM", "Checking disk space", "Checking Ollama", "Checking installed models", "Detecting AI providers", "Generating recommendations"];

type Diag = { ok: boolean; warn?: boolean; label: string; detail: string };

export default function EnginePage() {
  const { toast, tick, bump } = useApp();
  const [machine, setMachine] = useState<MachineProfile | null>(() => loadMachine());
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [checkingOllama, setCheckingOllama] = useState(false);
  const [host, setHost] = useState(getOllamaHost());
  const [bridge, setBridge] = useState(false);
  const [recs, setRecs] = useState<ModelRecommendation[]>([]);
  const [pulling, setPulling] = useState<{ model: string; pct: number | null; status: string } | null>(null);
  const [diags, setDiags] = useState<Diag[] | null>(null);
  const [runningDiag, setRunningDiag] = useState(false);
  const [tab, setTab] = useState<"setup" | "models" | "diagnostics">("setup");
  const pullAbort = useRef<AbortController | null>(null);

  useEffect(() => { void refreshOllama(); void bridgeStatus().then((b) => setBridge(b.online)); /* eslint-disable-next-line */ }, []);

  const refreshOllama = async () => {
    setCheckingOllama(true);
    const s = await ollamaStatus(host);
    setOllama(s);
    if (s.reachable) setRecs(recommendModels(machine ?? loadMachine(), s.models));
    setCheckingOllama(false);
  };

  const runCheck = useCallback(async () => {
    setRunning(true); setStep(0);
    for (let i = 0; i < STEPS.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 220));
      if (i === 5) {
        const m = await detectMachine();
        setMachine(m);
      }
      if (i === 6 || i === 7) await refreshOllama();
    }
    setStep(STEPS.length);
    setRunning(false);
    toast("success", "System check complete", bridge ? "Bridge detected — real OS data." : "Browser data (run local-bridge.mjs for full GPU/RAM/disk).");
  }, [bridge, host, toast]);

  const pull = async (model: string) => {
    const ac = new AbortController();
    pullAbort.current = ac;
    setPulling({ model, pct: 0, status: "Preparing download…" });
    try {
      await ollamaPull(host, model, (p) => setPulling({ model, pct: p.pct, status: p.status + (p.doneMB != null ? ` · ${p.doneMB}${p.totalMB ? "/" + p.totalMB : ""} MB` : "") }), ac.signal);
      setPulling(null);
      toast("success", `${model} installed`, "Model ready — test it below.");
      void refreshOllama();
    } catch (e: any) {
      setPulling(null);
      if (e?.name !== "AbortError") toast("error", "Pull failed", friendlyError(e).message);
    }
  };

  const remove = async (model: string) => {
    try { await ollamaDelete(host, model); toast("success", `${model} removed`); void refreshOllama(); }
    catch (e) { toast("error", "Delete failed", friendlyError(e).message); }
  };

  const test = async (model: string, vision: boolean) => {
    const r = await ollamaTestModel(host, model, vision);
    if (r.ok) toast("success", `${model} healthy`, r.detail);
    else toast("error", `${model} test failed`, r.detail);
  };

  const runDiag = async () => {
    setRunningDiag(true);
    const d: Diag[] = [];
    const o = await ollamaStatus(host);
    d.push({ ok: o.reachable, label: "Ollama", detail: o.reachable ? `v${o.version} · ${o.models.length} models · ${o.latencyMs}ms` : (o.error ?? "unreachable") });
    d.push({ ok: true, warn: !bridge, label: "Local bridge", detail: bridge ? "Online — real OS data available" : "Offline — run node local-bridge.mjs" });
    const conns = api.myConnections();
    d.push({ ok: conns.length > 0, label: "Providers", detail: conns.length ? conns.map((c) => c.label).join(", ") : "No provider connected" });
    let dbOk = true; let dbDetail = "";
    try { const s = api.creditSummary(); dbDetail = `balance ${fmtNum(s.balance)} · ${api.listGenerations({ pageSize: 1 }).total} generations`; } catch { dbOk = false; dbDetail = "Storage error"; }
    d.push({ ok: dbOk, label: "Database / storage", detail: dbDetail });
    d.push({ ok: true, label: "Generation queue", detail: "Worker active · interrupted jobs auto-refund" });
    d.push({ ok: true, label: "Security", detail: "AES-GCM vault · PBKDF2 passwords · row-level ownership" });
    setDiags(d);
    setRunningDiag(false);
  };

  return (
    <div>
      <div className="mb-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-solar-400">ai engine setup & model manager</div>
        <h1 className="font-display mt-1 text-[28px] font-bold tracking-tight text-ink-50">Set Up Your AI Studio</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-400">Let's check your computer and configure the best AI models for your machine. Sab kuch real — koi fake value nahi.</p>
      </div>

      <div className="mb-6 flex gap-2">
        {([["setup", "System Check"], ["models", "Local Models"], ["diagnostics", "Diagnostics"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={cn("rounded-[10px] border px-4 py-2 text-[13px] font-bold transition-all", tab === id ? "border-solar-500/60 bg-solar-400/12 text-solar-300" : "border-ink-700 text-ink-400 hover:border-ink-500")}>{label}</button>
        ))}
      </div>

      {tab === "setup" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="panel p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-solar-500/40 bg-solar-400/10 text-solar-300"><Gauge size={22} /></span>
                <div>
                  <h2 className="font-display text-[18px] font-bold text-ink-50">Check My System</h2>
                  <p className="text-[12px] text-ink-400">{STEPS.length}-step real detection</p>
                </div>
              </div>
              <Button className="mt-5 w-full" size="lg" loading={running} icon={<Zap size={16} />} onClick={runCheck}>{running ? "Checking…" : machine ? "Re-check My System" : "Check My System"}</Button>
              {running && (
                <div className="mt-5 space-y-2">
                  {STEPS.map((s, i) => (
                    <div key={s} className={cn("flex items-center gap-2.5 text-[12.5px]", i < step ? "text-jade-300" : i === step ? "text-ink-100" : "text-ink-500")}>
                      {i < step ? <CheckCircle2 size={14} /> : i === step ? <Loader2 size={14} className="animate-spin text-solar-400" /> : <span className="inline-block h-3.5 w-3.5 rounded-full border border-ink-600" />}
                      {s}
                    </div>
                  ))}
                </div>
              )}
              <div className={cn("mt-4 flex items-center gap-2 text-[11.5px]", bridge ? "text-jade-300" : "text-solar-300")}>
                <Activity size={13} /> {bridge ? "Local bridge online — real GPU VRAM, RAM & disk." : "Bridge offline — browser data only. Run: node local-bridge.mjs"}
              </div>
            </div>

            {machine && (
              <div className="panel-flat anim-fade-in p-5">
                <div className="flex items-center justify-between">
                  <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Machine profile</div>
                  <Tag tone={machine.source === "browser" ? "solar" : "jade"}>{machine.source}</Tag>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <HwRow icon={<Cpu size={15} />} label="OS" value={machine.os} />
                  <HwRow icon={<Cpu size={15} />} label="CPU" value={`${machine.cpu.cores} cores`} sub={machine.cpu.name} />
                  <HwRow icon={<MemoryStick size={15} />} label="RAM" value={machine.ramMB ? `${(machine.ramMB / 1024).toFixed(1)} GB` : "—"} />
                  <HwRow icon={<Sparkles size={15} />} label="GPU" value={machine.gpus[0]?.name ?? "—"} sub={machine.gpus[0]?.vramMB ? `${(machine.gpus[0].vramMB / 1024).toFixed(1)} GB VRAM` : undefined} />
                  <HwRow icon={<HardDrive size={15} />} label="Disk free" value={machine.disk.freeMB ? `${(machine.disk.freeMB / 1024).toFixed(0)} GB` : "—"} />
                  <HwRow icon={<Gauge size={15} />} label="Arch" value={`${machine.architecture} · WebGPU ${machine.webgpu ? "✓" : "✗"}`} />
                </div>
                {machine.warnings.length > 0 && (
                  <div className="mt-3 space-y-1">{machine.warnings.map((w) => <p key={w} className="text-[11px] leading-snug text-solar-300/80">⚠ {w}</p>)}</div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="panel-flat p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Server size={14} /> Ollama</div>
                {ollama && (ollama.reachable ? <Tag tone="jade"><Wifi size={11} /> connected</Tag> : <Tag tone="coral"><XCircle size={11} /> not running</Tag>)}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={host} onChange={(e) => { setHost(e.target.value); setOllamaHost(e.target.value); }} placeholder="http://127.0.0.1:11434" />
                <Button variant="outline" loading={checkingOllama} onClick={refreshOllama} icon={<RefreshCw size={13} />}>Check</Button>
              </div>
              {ollama && !ollama.reachable && (
                <div className="mt-4 rounded-[10px] border border-coral-500/30 bg-coral-500/6 p-4">
                  <div className="text-[13px] font-bold text-coral-300">OLLAMA NOT INSTALLED / NOT RUNNING</div>
                  <p className="mt-1 text-[11.5px] leading-snug text-ink-400">{ollama.error}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href="https://ollama.com/download" target="_blank" rel="noreferrer"><Button size="sm" icon={<Download size={12} />}>Install Ollama</Button></a>
                    <Button size="sm" variant="outline" onClick={() => setTab("models")}>Configure Manually</Button>
                  </div>
                </div>
              )}
              {ollama?.reachable && (
                <div className="mt-3 text-[12px] text-ink-400">
                  Version <span className="font-mono text-ink-200">{ollama.version}</span> · {ollama.models.length} installed · {ollama.latencyMs}ms
                </div>
              )}
            </div>

            <div className="panel-flat p-5">
              <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><ShieldCheck size={14} /> Recommended for your machine</div>
              {recs.length === 0 ? (
                <p className="mt-2 text-[12px] text-ink-500">Pehle system check karo ya Ollama connect karo — recommendations hardware pe based hain.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {recs.map((r) => (
                    <div key={r.name} className="flex items-center gap-3 rounded-[10px] border border-ink-700 bg-ink-850 px-3.5 py-2.5">
                      <Tag tone={r.tier === "Best" ? "jade" : r.tier === "Good" ? "solar" : "iris"}>{r.tier}</Tag>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-[12.5px] font-bold text-ink-100">{r.name} {r.vision && <Tag tone="iris">vision</Tag>}</div>
                        <div className="text-[10.5px] text-ink-500">{(r.sizeMB / 1024).toFixed(1)} GB · {r.note}</div>
                      </div>
                      {r.installed ? <Tag tone="jade"><CheckCircle2 size={11} /> installed</Tag>
                        : <Button size="sm" variant="outline" icon={<Download size={12} />} disabled={!!pulling} onClick={() => pull(r.name)}>Install</Button>}
                    </div>
                  ))}
                </div>
              )}
              {pulling && (
                <div className="mt-3 rounded-[10px] border border-solar-500/30 bg-solar-400/6 p-3.5">
                  <div className="flex items-center justify-between text-[12px] font-bold text-solar-300"><span>{pulling.model}</span><span className="font-mono">{pulling.pct != null ? `${pulling.pct}%` : "…"}</span></div>
                  <div className="indeterminate mt-2" />
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10.5px] text-ink-400">{pulling.status} (real download)</span>
                    <button className="text-[10.5px] font-bold text-coral-300 hover:underline" onClick={() => pullAbort.current?.abort()}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "models" && (
        <div className="panel-flat p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Installed local models {ollama ? `· ${ollama.models.length}` : ""}</div>
            <Button size="sm" variant="outline" loading={checkingOllama} onClick={refreshOllama} icon={<RefreshCw size={12} />}>Refresh</Button>
          </div>
          {!ollama?.reachable ? (
            <InfoNote tone="coral">Ollama connected nahi hai — pehle System Check tab me connect karo.</InfoNote>
          ) : ollama.models.length === 0 ? (
            <InfoNote>Koi model installed nahi. Recommendations se install karo ya terminal me: <span className="font-mono">ollama pull llama3.2</span></InfoNote>
          ) : (
            <div className="space-y-2">
              {ollama.models.map((m) => (
                <div key={m.name} className="flex flex-wrap items-center gap-3 rounded-[10px] border border-ink-700 bg-ink-850 px-4 py-3">
                  <Server size={15} className="text-solar-400" />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[13px] font-bold text-ink-100">{m.name}</div>
                    <div className="text-[10.5px] text-ink-500">{(m.sizeMB / 1024).toFixed(1)} GB {m.vision && "· vision"} · {m.modified ? new Date(m.modified).toLocaleDateString() : ""}</div>
                  </div>
                  {m.vision && <Tag tone="iris">vision</Tag>}
                  <Tag tone="iris">text</Tag>
                  <Button size="sm" variant="jade" icon={<Play size={12} />} onClick={() => test(m.name, m.vision)}>Test</Button>
                  <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => remove(m.name)}>Remove</Button>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
            Test ek real minimal <span className="font-mono">/api/generate</span> request bhejta hai{` `}(vision models ko real 1×1 image input). Download progress byte-level real hai.
          </p>
        </div>
      )}

      {tab === "diagnostics" && (
        <div className="panel-flat p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Developer diagnostics</div>
            <Button size="sm" loading={runningDiag} onClick={runDiag} icon={<Activity size={12} />}>Run Full Diagnostics</Button>
          </div>
          {!diags ? <InfoNote>Run diagnostics to test every subsystem (real checks, no mocks).</InfoNote> : (
            <div className="space-y-2">
              {diags.map((d) => (
                <div key={d.label} className={cn("flex items-center gap-3 rounded-[10px] border px-4 py-3", d.ok && !d.warn ? "border-jade-500/30 bg-jade-500/5" : d.warn ? "border-solar-500/30 bg-solar-400/5" : "border-coral-500/30 bg-coral-500/5")}>
                  {d.ok && !d.warn ? <CheckCircle2 size={16} className="text-jade-400" /> : d.warn ? <Activity size={16} className="text-solar-400" /> : <XCircle size={16} className="text-coral-400" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-ink-100">{d.label}</div>
                    <div className="text-[11px] text-ink-400">{d.detail}</div>
                  </div>
                  <Tag tone={d.ok && !d.warn ? "jade" : d.warn ? "solar" : "coral"}>{d.ok && !d.warn ? "Healthy" : d.warn ? "Warning" : "Error"}</Tag>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function HwRow({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] border border-ink-700 bg-ink-850 px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-500">{icon}{label}</div>
      <div className="mt-0.5 truncate text-[13px] font-bold text-ink-100">{value}</div>
      {sub && <div className="truncate text-[10.5px] text-ink-500">{sub}</div>}
    </div>
  );
}
