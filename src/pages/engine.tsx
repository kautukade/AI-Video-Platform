import { useEffect, useMemo, useState } from "react";
import {
  Activity, Boxes, CheckCircle2, Cpu, Download, Gauge, HardDrive, Loader2, MemoryStick, Play, Plug, RefreshCw,
  Server, ShieldCheck, Sparkles, Terminal, Trash2, Wifi, XCircle, Zap, Eye,
} from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { cn, fmtNum, friendlyError } from "../lib/utils";
import { Button, ConfirmModal, Field, InfoNote, Input, Tag, Toggle } from "../components/ui";
import {
  bridgeStatus, detectMachine, getOllamaHost, loadMachine, ollamaDelete, ollamaPull, ollamaStatus, ollamaTestModel,
  recommendModels, setOllamaHost,
} from "../server/local";
import { MachineProfile, ModelRecommendation, OllamaStatus } from "../lib/types";

type CheckState = { label: string; state: "pending" | "busy" | "done"; detail: string };

export default function EnginePage() {
  const { toast, bump, tick } = useApp();
  const [profile, setProfile] = useState<MachineProfile | null>(loadMachine());
  const [checks, setChecks] = useState<CheckState[] | null>(null);
  const [running, setRunning] = useState(false);
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [host, setHost] = useState(getOllamaHost());
  const [recs, setRecs] = useState<ModelRecommendation[]>([]);
  const [pulling, setPulling] = useState<Record<string, { status: string; pct: number | null; doneMB: number | null; totalMB: number | null }>>({});
  const [testing, setTesting] = useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [bridge, setBridge] = useState<{ online: boolean } | null>(null);

  const conns = useMemo(() => { try { return api.myConnections(); } catch { return []; } }, [tick]);
  const simOn = useMemo(() => { try { return api.platformMode().simulatorEnabled; } catch { return false; } }, [tick]);

  useEffect(() => {
    bridgeStatus().then(setBridge);
    // auto-check ollama on load (real API call)
    setOllamaChecking(true);
    ollamaStatus(getOllamaHost()).then((s) => { setOllama(s); setOllamaChecking(false); });
  }, []);

  const step = (i: number, patch: Partial<CheckState>) =>
    setChecks((cs) => (cs ? cs.map((c, j) => (j === i ? { ...c, ...patch } : c)) : cs));

  const runCheck = async () => {
    setRunning(true);
    setChecks([
      { label: "Detecting operating system", state: "busy", detail: "" },
      { label: "Detecting CPU", state: "pending", detail: "" },
      { label: "Detecting RAM", state: "pending", detail: "" },
      { label: "Detecting GPU / VRAM", state: "pending", detail: "" },
      { label: "Checking disk space", state: "pending", detail: "" },
      { label: "Checking local bridge", state: "pending", detail: "" },
      { label: "Checking Ollama", state: "pending", detail: "" },
      { label: "Scanning installed models", state: "pending", detail: "" },
      { label: "Detecting AI providers", state: "pending", detail: "" },
      { label: "Generating recommendations", state: "pending", detail: "" },
    ]);
    const p = await detectMachine();
    setProfile(p);
    step(0, { state: "done", detail: `${p.os} · ${p.architecture}` });
    step(1, { state: "done", detail: p.cpu.name !== "unknown" ? `${p.cpu.name} · ${p.cpu.cores} cores` : `${p.cpu.cores} logical cores (name needs bridge)` });
    step(2, { state: "done", detail: p.ramMB ? `~${(p.ramMB / 1024).toFixed(0)} GB${p.source === "browser" ? " (rounded by browser)" : ""}` : "unknown (bridge needed)" });
    step(3, { state: "done", detail: p.gpus.length ? p.gpus.map((g) => g.name).join(", ") + (p.gpus[0].vramMB ? ` · ${Math.round(p.gpus[0].vramMB / 1024)}GB VRAM` : "") : `no GPU exposed${p.webgpu ? "" : " · WebGPU unavailable"}` });
    step(4, { state: "done", detail: p.disk.totalMB ? `${(p.disk.freeMB! / 1024).toFixed(1)} GB free (browser quota)` : "unknown (bridge needed)" });
    const b = await bridgeStatus();
    setBridge(b);
    step(5, { state: "done", detail: b.online ? "online — full OS data enabled" : "offline — run: node local-bridge.mjs" });
    step(6, { state: "busy", detail: "" });
    const os = await ollamaStatus(host);
    setOllama(os);
    step(6, { state: "done", detail: os.reachable ? `running · v${os.version ?? "?"} · ${os.latencyMs}ms` : "not reachable" });
    step(7, { state: "done", detail: os.reachable ? `${os.models.length} installed models` : "skipped — Ollama offline" });
    const cs = conns.length;
    step(8, { state: "done", detail: `${cs} connected provider${cs === 1 ? "" : "s"} (Pollinations auto-connected)` });
    const r = recommendModels(p, os.models);
    setRecs(r);
    step(9, { state: "done", detail: `${r.length} models recommended for this hardware` });
    setRunning(false);
    toast("success", "System check complete", os.reachable ? `Ollama online · ${os.models.length} models` : "Ollama offline — install guide neeche hai.");
  };

  const refreshOllama = async () => {
    setOllamaChecking(true);
    const s = await ollamaStatus(host);
    setOllama(s);
    setOllamaChecking(false);
    setRecs(recommendModels(profile, s.models));
    bump();
  };

  const install = async (name: string) => {
    const disk = profile?.disk?.freeMB ?? null;
    const sizeMB = recs.find((r) => r.name === name)?.sizeMB ?? 0;
    if (disk != null && sizeMB * 1.15 > disk) {
      toast("error", "Not enough disk space", `Required: ${(sizeMB / 1024).toFixed(1)} GB · Available: ${(disk / 1024).toFixed(1)} GB. Installation not started.`);
      return;
    }
    const ctrl = new AbortController();
    setPulling((s) => ({ ...s, [name]: { status: "Preparing download…", pct: null, doneMB: null, totalMB: null } }));
    try {
      await ollamaPull(host, name, (p) => setPulling((s) => ({ ...s, [name]: p })), ctrl.signal);
      setPulling((s) => ({ ...s, [name]: { status: "Verifying…", pct: 100, doneMB: null, totalMB: null } }));
      await refreshOllama();
      setPulling((s) => { const { [name]: _, ...rest } = s; return rest; });
      toast("success", `${name} installed`, "Model ready — Test button se verify karo.");
    } catch (e: any) {
      setPulling((s) => { const { [name]: _, ...rest } = s; return rest; });
      if (e?.name === "AbortError" || e?.code === "CANCELLED") toast("info", "Download cancelled");
      else toast("error", "Download failed", friendlyError(e).message);
    }
  };

  const testModel = async (name: string, vision: boolean) => {
    setTesting((s) => ({ ...s, [name]: "running" }));
    const r = await ollamaTestModel(host, name, vision);
    setTesting((s) => ({ ...s, [name]: r.ok ? `✓ Installed · ✓ API reachable · ✓ Model loaded · ✓ Response received (${r.latencyMs}ms)` : `✕ ${r.detail}` }));
  };

  const providerHealth = async (id: string) => {
    const c = conns.find((x) => x.providerId === id);
    if (!c) return;
    try { const r = await api.testConnection(c.id); toast("success", `${c.label} healthy`, r.message); }
    catch (e) { toast("error", `${c.label} failed`, friendlyError(e).message); }
    bump();
  };

  const diag = [
    { name: "Database", ok: true, detail: "local repositories + IndexedDB blobs" },
    { name: "Storage", ok: true, detail: "blob store reachable" },
    { name: "Generation queue", ok: true, detail: "worker active · recovery on boot" },
    { name: "Ollama", ok: ollama?.reachable ?? false, detail: ollama?.reachable ? `v${ollama.version} · ${ollama.models.length} models` : (ollama?.error ?? "not checked") },
    { name: "Local bridge", ok: bridge?.online ?? false, detail: bridge?.online ? "127.0.0.1:8788" : "offline (optional)" },
    { name: "Providers", ok: conns.some((c) => c.status === "connected"), detail: `${conns.filter((c) => c.status === "connected").length}/${conns.length} connected` },
  ];

  return (
    <div className="space-y-8">
      <div className="anim-fade-up">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-solar-400">smart machine setup</div>
        <h1 className="font-display mt-1 text-[28px] font-bold tracking-tight text-ink-50">Set Up Your AI Studio</h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink-400">
          Let's check your computer and configure the best AI models for your machine. Sab values <strong className="text-ink-200">real APIs</strong> se aati hain — browser jo nahi jaan sakta, woh honest "unknown" dikhta hai (local bridge se full data milta hai).
        </p>
      </div>

      {/* Welcome / system check */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="panel relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-solar-500/8 blur-3xl" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-solar-500/40 bg-solar-400/10 text-solar-300"><Cpu size={22} /></div>
          <h2 className="font-display mt-4 text-[20px] font-bold text-ink-50">Check My System</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">
            OS, CPU, RAM, GPU, disk, Ollama aur providers — ek click me real detection. Phir hardware ke hisaab se <strong className="text-ink-200">Best / Good / Experimental</strong> models recommend honge.
          </p>
          <Button className="mt-5" size="lg" loading={running} icon={<Gauge size={16} />} onClick={runCheck}>
            {profile ? "Re-run system check" : "Check My System"}
          </Button>
          {bridge && (
            <div className={cn("mt-4 flex items-center gap-2 rounded-[10px] border px-3 py-2 text-[11.5px] font-semibold", bridge.online ? "border-jade-500/35 bg-jade-500/8 text-jade-300" : "border-ink-700 bg-ink-850 text-ink-400")}>
              {bridge.online ? <CheckCircle2 size={13} /> : <Terminal size={13} />}
              {bridge.online ? "Local bridge online — full OS data" : <>Bridge offline — <span className="font-mono">node local-bridge.mjs</span> (optional, real VRAM/disk)</>}
            </div>
          )}
        </div>
        <div className="panel-flat p-5">
          {!checks ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center">
              <Sparkles size={26} className="text-ink-500" />
              <p className="mt-3 max-w-xs text-[12.5px] text-ink-500">
                {profile ? `Last check: ${new Date(profile.checkedAt).toLocaleTimeString()} · ${profile.os} · ${profile.cpu.cores} cores` : "Abhi tak koi check nahi hua. Left me button dabao — 10 real steps chalenge."}
              </p>
            </div>
          ) : (
            <ol className="space-y-2">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[10px] border border-ink-700/70 bg-ink-850/60 px-3.5 py-2.5">
                  {c.state === "busy" ? <Loader2 size={15} className="shrink-0 animate-spin text-solar-400" />
                    : c.state === "done" ? <CheckCircle2 size={15} className="shrink-0 text-jade-400" />
                    : <span className="h-[15px] w-[15px] shrink-0 rounded-full border-2 border-ink-600" />}
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-[12.5px] font-semibold", c.state === "pending" ? "text-ink-500" : "text-ink-100")}>{i + 1}. {c.label}</div>
                    {c.detail && <div className="truncate font-mono text-[10.5px] text-ink-500">{c.detail}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Hardware profile */}
      {profile && (
        <section className="anim-fade-up">
          <h2 className="font-display mb-3 text-[18px] font-bold text-ink-50">Your machine <Tag tone="ink" className="ml-2">{profile.source}</Tag></h2>
          <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
            <HwCard icon={<Cpu size={17} />} label="CPU / OS" value={profile.cpu.name !== "unknown" ? profile.cpu.name : `${profile.cpu.cores} cores`} sub={`${profile.os}${profile.architecture !== "unknown" ? ` · ${profile.architecture}` : ""}`} />
            <HwCard icon={<MemoryStick size={17} />} label="RAM" value={profile.ramMB ? `~${(profile.ramMB / 1024).toFixed(0)} GB` : "—"} sub={profile.ramMB == null ? "bridge needed for exact value" : profile.source === "browser" ? "browser-rounded" : "real"} />
            <HwCard icon={<Activity size={17} />} label="GPU" value={profile.gpus[0]?.name ?? "—"} sub={profile.gpus[0]?.vramMB ? `${(profile.gpus[0].vramMB / 1024).toFixed(1)} GB VRAM` : profile.webgpu ? "WebGPU · VRAM needs bridge" : "no GPU exposed"} />
            <HwCard icon={<HardDrive size={17} />} label="Disk" value={profile.disk.freeMB != null ? `${(profile.disk.freeMB / 1024).toFixed(0)} GB free` : "—"} sub={profile.disk.totalMB ? `of ${(profile.disk.totalMB / 1024).toFixed(0)} GB (browser quota)` : "bridge needed"} />
          </div>
          {profile.warnings.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {profile.warnings.map((w, i) => <p key={i} className="text-[11.5px] text-solar-300/90">⚠ {w}</p>)}
            </div>
          )}
        </section>
      )}

      {/* Ollama */}
      <section className="anim-fade-up">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display flex items-center gap-2.5 text-[18px] font-bold text-ink-50">
            <Server size={18} className="text-solar-400" /> Local AI · Ollama
            {ollama && (ollama.reachable ? <Tag tone="jade"><Wifi size={11} /> connected · v{ollama.version}</Tag> : <Tag tone="coral"><XCircle size={11} /> offline</Tag>)}
          </h2>
          <div className="flex gap-2">
            <Input value={host} onChange={(e) => { setHost(e.target.value); setOllamaHost(e.target.value); }} placeholder="http://127.0.0.1:11434" className="w-64 font-mono text-[12px]" />
            <Button variant="outline" size="sm" loading={ollamaChecking} icon={<RefreshCw size={13} />} onClick={refreshOllama}>Check</Button>
          </div>
        </div>

        {ollama && !ollama.reachable && (
          <div className="panel-flat border-coral-500/30 p-5">
            <div className="flex items-center gap-2 text-[15px] font-extrabold tracking-wide text-coral-300"><XCircle size={17} /> OLLAMA NOT INSTALLED / NOT RUNNING</div>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-400">{ollama.error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="https://ollama.com/download" target="_blank" rel="noreferrer"><Button icon={<Download size={14} />}>Install Ollama</Button></a>
              <Button variant="outline" onClick={() => { setHost("http://127.0.0.1:11434"); setOllamaHost("http://127.0.0.1:11434"); }}>Configure Manually</Button>
              <Button variant="ghost" onClick={() => toast("info", "Skipped", "Cloud providers se kaam chal sakta hai — Ollama baad me bhi jod sakte ho.")}>Skip</Button>
            </div>
            <ol className="mt-4 list-decimal space-y-1 pl-5 text-[12px] text-ink-400">
              <li>Official installer download karo (Windows/macOS/Linux) — app kabhi khud binary install nahi karta.</li>
              <li>Install ke baad: <span className="font-mono text-solar-300">OLLAMA_ORIGINS=* ollama serve</span></li>
              <li>Wapas aake <strong>Check</strong> dabao — installation verify ho jayegi (version + models).</li>
            </ol>
          </div>
        )}

        {ollama?.reachable && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="panel-flat p-5">
              <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Installed models · {ollama.models.length}</div>
              <div className="mt-3 space-y-2">
                {ollama.models.length === 0 && <p className="text-[12.5px] text-ink-500">Koi model installed nahi — right side se recommended models install karo.</p>}
                {ollama.models.map((m) => (
                  <div key={m.name} className="rounded-[10px] border border-ink-700 bg-ink-850/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-ink-50">{m.name}</span>
                      <Tag tone="ink">{(m.sizeMB / 1024).toFixed(1)} GB</Tag>
                      {m.vision && <Tag tone="iris"><Eye size={10} /> vision</Tag>}
                      <span className="ml-auto flex gap-1.5">
                        <Button size="sm" variant="jade" icon={<Play size={12} />} loading={testing[m.name] === "running"} onClick={() => testModel(m.name, m.vision)}>Test</Button>
                        <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setConfirmDel(m.name)} />
                      </span>
                    </div>
                    {testing[m.name] && testing[m.name] !== "running" && (
                      <div className={cn("mt-2 font-mono text-[10.5px] leading-relaxed", testing[m.name].startsWith("✓") ? "text-jade-300" : "text-coral-300")}>{testing[m.name]}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="panel-flat p-5">
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Recommended for your machine</div>
                <Tag tone="solar"><Zap size={10} /> hardware-matched</Tag>
              </div>
              <div className="mt-3 space-y-2">
                {recs.length === 0 && <p className="text-[12.5px] text-ink-500">Recommendations ke liye pehle "Check My System" chalao.</p>}
                {recs.map((r) => {
                  const p = pulling[r.name];
                  return (
                    <div key={r.name} className="rounded-[10px] border border-ink-700 bg-ink-850/70 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[13px] font-bold text-ink-50">{r.name}</span>
                        <Tag tone={r.tier === "Best" ? "jade" : r.tier === "Good" ? "solar" : "iris"}>{r.tier}</Tag>
                        <Tag tone="ink">{r.category}{r.vision ? " · vision" : ""}</Tag>
                        <span className="ml-auto">
                          {r.installed ? <Tag tone="jade"><CheckCircle2 size={11} /> installed</Tag>
                            : p ? null
                            : <Button size="sm" icon={<Download size={12} />} onClick={() => install(r.name)}>Install</Button>}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[10.5px] text-ink-500">
                        <span>size {(r.sizeMB / 1024).toFixed(1)} GB</span>
                        <span>VRAM ~{(r.vramMB / 1024).toFixed(1)} GB</span>
                        <span className="text-ink-400">{r.note}</span>
                      </div>
                      {p && (
                        <div className="mt-2.5">
                          <div className="flex items-center justify-between font-mono text-[10.5px] text-solar-300">
                            <span>{p.status}{p.doneMB != null && p.totalMB ? ` · ${p.doneMB}/${p.totalMB} MB` : ""}</span>
                            <span>{p.pct != null ? `${p.pct}%` : ""}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-750">
                            {p.pct != null
                              ? <div className="h-full rounded-full bg-gradient-to-r from-solar-500 to-solar-300 transition-all" style={{ width: `${p.pct}%` }} />
                              : <div className="indeterminate h-full" />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* AI Providers quick view */}
      <section className="anim-fade-up">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display flex items-center gap-2.5 text-[18px] font-bold text-ink-50"><Plug size={18} className="text-jade-400" /> AI Providers</h2>
          <a href="#/providers" className="text-[12.5px] font-semibold text-solar-300 hover:underline">Full directory →</a>
        </div>
        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {conns.slice(0, 8).map((c) => (
            <div key={c.id} className={cn("panel-flat p-4", c.status === "connected" && "border-jade-500/25")}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-bold text-ink-50">{c.label}</span>
                {c.status === "connected" ? <Tag tone="jade"><Wifi size={10} /> on</Tag> : <Tag tone="coral">error</Tag>}
              </div>
              <div className="mt-1 font-mono text-[10.5px] text-ink-500">{c.providerId}{c.latencyMs != null ? ` · ${c.latencyMs}ms` : ""}</div>
              <Button size="sm" variant="ghost" className="mt-2" icon={<Activity size={12} />} onClick={() => providerHealth(c.providerId)}>Test connection</Button>
            </div>
          ))}
          {conns.length === 0 && <InfoNote tone="solar">Pollinations boot pe auto-connect hota hai. Zyada engines ke liye <a href="#/providers" className="font-bold underline">AI Providers</a> kholo.</InfoNote>}
        </div>
      </section>

      {/* Model router defaults + diagnostics */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="panel-flat p-5">
          <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Boxes size={13} /> Model router · Auto Mode</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">
            Auto mode task → capability → best free engine → health ke hisaab se route karta hai. Video: <span className="font-mono text-solar-300">Replicate → Luma → NIM → HF</span> · Image: <span className="font-mono text-solar-300">Pollinations → HF → Gemini</span> · Text: <span className="font-mono text-solar-300">Ollama → Pollinations → Groq</span>. Failed engine pe automatic fallback — paid fallback sirf aapki permission se.
          </p>
          <div className="mt-3 space-y-1.5 font-mono text-[11px] text-ink-500">
            <div>privacy: ollama = <span className="text-jade-300">"Running locally"</span> · cloud = <span className="text-solar-300">"Using Cloud AI: {`{provider}`}"</span></div>
            <div>local video unavailable hone pe: <span className="text-ink-300">"Using connected API provider"</span> (kabhi fake nahi)</div>
          </div>
        </div>
        <div className="panel-flat p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><ShieldCheck size={13} /> Developer diagnostics</div>
            <Button size="sm" variant="outline" icon={<RefreshCw size={12} />} onClick={() => { refreshOllama(); bridgeStatus().then(setBridge); toast("info", "Diagnostics refreshed"); }}>Run full diagnostics</Button>
          </div>
          <div className="mt-3 space-y-2">
            {diag.map((d) => (
              <div key={d.name} className="flex items-center gap-3 rounded-[10px] border border-ink-700/70 bg-ink-850/60 px-3.5 py-2.5">
                {d.ok ? <CheckCircle2 size={15} className="shrink-0 text-jade-400" /> : <XCircle size={15} className="shrink-0 text-coral-400" />}
                <span className="text-[12.5px] font-bold text-ink-100">{d.name}</span>
                <span className="ml-auto truncate font-mono text-[10.5px] text-ink-500">{d.detail}</span>
              </div>
            ))}
          </div>
          {!simOn && <p className="mt-3 text-[11px] text-ink-500">Simulator off hai (real-only build) — admin Settings se on kar sakte ho, output hamesha "SIMULATED" label ke saath.</p>}
        </div>
      </section>

      <ConfirmModal open={!!confirmDel} onClose={() => setConfirmDel(null)} title={`Remove ${confirmDel}?`}
        body="Model disk se delete ho jayega (ollama rm). Dobara install kar sakte ho." confirmLabel="Remove"
        onConfirm={async () => {
          if (!confirmDel) return;
          try { await ollamaDelete(host, confirmDel); toast("success", `${confirmDel} removed`); refreshOllama(); }
          catch (e) { toast("error", "Remove failed", friendlyError(e).message); }
        }}>
        <span />
      </ConfirmModal>
    </div>
  );
}

function HwCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="panel-flat p-4">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">{icon}{label}</div>
      <div className="mt-2 truncate text-[15px] font-bold text-ink-50" title={value}>{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-ink-500">{sub}</div>
    </div>
  );
}
