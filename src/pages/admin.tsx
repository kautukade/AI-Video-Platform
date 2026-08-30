import { useMemo, useState } from "react";
import { Activity, Coins, Settings2, Shield, Users as UsersIcon } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { fmtDate, fmtNum, friendlyError } from "../lib/utils";
import { Button, ConfirmModal, Field, Input, StatCard, StatusBadge, Tabs, Tag, Toggle } from "../components/ui";
import { AdminSettings, Job, User } from "../lib/types";

export default function AdminPage() {
  const [tab, setTab] = useState("overview");
  const stats = useMemo(() => { try { return api.admin.stats(); } catch { return null; } }, [tab]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Admin Panel</h1>
        <p className="mt-1 text-[13px] text-ink-400">Users, pricing, jobs aur platform settings — operational metadata only.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" }, { id: "users", label: "Users" }, { id: "pricing", label: "Pricing" },
        { id: "jobs", label: "Jobs" }, { id: "settings", label: "Settings" },
      ]} />
      <div className="mt-6">
        {tab === "overview" && stats && (
          <div className="space-y-6">
            <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Users" value={fmtNum(stats.users)} icon={<UsersIcon size={18} />} tone="solar" />
              <StatCard label="Active" value={fmtNum(stats.activeUsers)} icon={<Shield size={18} />} tone="jade" />
              <StatCard label="Generations" value={fmtNum(stats.generations)} icon={<Activity size={18} />} tone="iris" />
              <StatCard label="Failed Jobs" value={fmtNum(stats.failed)} icon={<Activity size={18} />} tone="coral" />
              <StatCard label="Tracked Usage" value={fmtNum(stats.creditsUsed)} icon={<Coins size={18} />} tone="ink" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="panel-flat p-5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Provider usage</div>
                <div className="mt-3 space-y-2">
                  {Object.entries(stats.byProvider).sort((a, b) => b[1] - a[1]).map(([p, n]) => (
                    <div key={p} className="flex items-center gap-3">
                      <span className="w-28 truncate font-mono text-[11.5px] text-ink-300">{p}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-750">
                        <div className="h-full rounded-full bg-gradient-to-r from-solar-500 to-solar-300" style={{ width: `${Math.min(100, (n / Math.max(1, stats.generations)) * 100)}%` }} />
                      </div>
                      <span className="font-mono text-[11px] text-ink-400">{n}</span>
                    </div>
                  ))}
                  {Object.keys(stats.byProvider).length === 0 && <p className="text-[12px] text-ink-500">No generations yet.</p>}
                </div>
              </div>
              <div className="panel-flat p-5">
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Top models</div>
                <div className="mt-3 space-y-2">
                  {Object.entries(stats.byModel).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([m, n]) => (
                    <div key={m} className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-[11.5px] text-ink-300">{m}</span><Tag tone="ink">{n}</Tag>
                    </div>
                  ))}
                  {Object.keys(stats.byModel).length === 0 && <p className="text-[12px] text-ink-500">No generations yet.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === "users" && <UsersTab />}
        {tab === "pricing" && <PricingTab />}
        {tab === "jobs" && <JobsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}

function UsersTab() {
  const { toast, bump } = useApp();
  const users = useMemo(() => { try { return api.admin.users(); } catch { return []; } }, []);
  const [adjust, setAdjust] = useState<{ u: User; amount: string } | null>(null);
  return (
    <div className="panel-flat overflow-hidden">
      <table className="w-full text-left text-[12.5px]">
        <thead><tr className="border-b border-ink-700 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          <th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
        </tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
              <td className="px-4 py-3"><div className="font-bold text-ink-100">{u.name}</div><div className="font-mono text-[10.5px] text-ink-500">{u.email}</div></td>
              <td className="px-4 py-3"><Tag tone={u.role === "admin" ? "solar" : "ink"}>{u.role}</Tag></td>
              <td className="px-4 py-3">{u.suspended ? <Tag tone="coral">suspended</Tag> : <Tag tone="jade">active</Tag>}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" icon={<Coins size={12} />} onClick={() => setAdjust({ u, amount: "500" })}>Credits</Button>
                  <Button size="sm" variant="ghost" onClick={() => { try { api.admin.suspendUser(u.id, !u.suspended); toast("success", u.suspended ? "Reactivated" : "Suspended"); bump(); } catch (e) { toast("error", "Failed", friendlyError(e).message); } }}>{u.suspended ? "Activate" : "Suspend"}</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmModal open={!!adjust} onClose={() => setAdjust(null)} title={`Adjust credits — ${adjust?.u.name}`} confirmLabel="Apply" danger={false}
        onConfirm={async () => {
          if (!adjust) return;
          const amt = Number(adjust.amount);
          if (!Number.isFinite(amt) || amt === 0) { toast("error", "Invalid amount"); return; }
          try { await api.admin.adjustCredits(adjust.u.id, amt, "Admin adjustment"); toast("success", "Credits adjusted"); bump(); }
          catch (e) { toast("error", "Failed", friendlyError(e).message); }
        }}>
        <Field label="Amount (negative to deduct)"><Input type="number" value={adjust?.amount ?? ""} onChange={(e) => setAdjust((s) => s ? { ...s, amount: e.target.value } : s)} /></Field>
      </ConfirmModal>
    </div>
  );
}

function PricingTab() {
  const { toast, bump } = useApp();
  const rules = useMemo(() => { try { return api.admin.pricing(); } catch { return []; } }, []);
  const [edit, setEdit] = useState<any | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button size="sm" onClick={() => setEdit({ id: "", taskType: "image", providerId: "*", model: "*", base: 5, unit: "per_generation", resolutionMult: {}, qualityMult: {}, note: "" })}>+ New rule</Button></div>
      <div className="panel-flat overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <thead><tr className="border-b border-ink-700 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
            <th className="px-4 py-3">Task</th><th className="px-4 py-3">Provider</th><th className="px-4 py-3 text-right">Base</th><th className="hidden px-4 py-3 md:table-cell">Unit</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-4 py-2.5"><Tag tone="solar">{r.taskType}</Tag></td>
                <td className="px-4 py-2.5 font-mono text-[11.5px] text-ink-300">{r.providerId}</td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-ink-100">{r.base}</td>
                <td className="hidden px-4 py-2.5 font-mono text-[11px] text-ink-400 md:table-cell">{r.unit}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => { api.admin.deletePricing(r.id); toast("success", "Rule deleted"); bump(); }}>Del</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && (
        <ConfirmModal open onClose={() => setEdit(null)} title={edit.id ? "Edit pricing rule" : "New pricing rule"} confirmLabel="Save" danger={false}
          onConfirm={() => { api.admin.upsertPricing(edit); toast("success", "Pricing saved"); bump(); }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Task"><Input value={edit.taskType} onChange={(e) => setEdit({ ...edit, taskType: e.target.value })} /></Field>
            <Field label="Provider (* = any)"><Input value={edit.providerId} onChange={(e) => setEdit({ ...edit, providerId: e.target.value })} /></Field>
            <Field label="Model (* = any)"><Input value={edit.model} onChange={(e) => setEdit({ ...edit, model: e.target.value })} /></Field>
            <Field label="Base credits"><Input type="number" value={edit.base} onChange={(e) => setEdit({ ...edit, base: Number(e.target.value) })} /></Field>
            <Field label="Unit"><Input value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></Field>
            <Field label="Note"><Input value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></Field>
          </div>
        </ConfirmModal>
      )}
    </div>
  );
}

function JobsTab() {
  const jobs = useMemo(() => { try { return api.admin.jobs(); } catch { return []; } }, []);
  return (
    <div className="panel-flat overflow-hidden">
      <table className="w-full text-left text-[12.5px]">
        <thead><tr className="border-b border-ink-700 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
          <th className="px-4 py-3">Created</th><th className="px-4 py-3">Status</th><th className="hidden px-4 py-3 sm:table-cell">Stage</th><th className="hidden px-4 py-3 md:table-cell">Error</th>
        </tr></thead>
        <tbody>
          {jobs.map((j: Job) => (
            <tr key={j.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
              <td className="px-4 py-2.5 font-mono text-[11px] text-ink-400">{fmtDate(j.createdAt)}<div className="text-ink-600">{j.id.slice(0, 8)}</div></td>
              <td className="px-4 py-2.5"><StatusBadge status={j.status} /></td>
              <td className="hidden px-4 py-2.5 text-ink-300 sm:table-cell">{j.stage}</td>
              <td className="hidden max-w-[300px] truncate px-4 py-2.5 text-coral-300 md:table-cell">{j.error ?? "—"}</td>
            </tr>
          ))}
          {jobs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-500">No jobs yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const { toast, bump } = useApp();
  const [s, setS] = useState<AdminSettings | null>(() => { try { return api.admin.getSettings(); } catch { return null; } });
  if (!s) return null;
  const set = (patch: Partial<AdminSettings>) => setS({ ...s, ...patch });
  return (
    <div className="max-w-2xl space-y-4">
      <div className="panel-flat space-y-4 p-5">
        <div className="flex items-start justify-between gap-4 rounded-[10px] border border-ink-700 bg-ink-850 px-4 py-3">
          <div><div className="text-[13px] font-bold text-ink-100">Unlimited mode (no credit limits)</div><p className="mt-0.5 text-[11.5px] text-ink-400">Local build default — saari generations free.</p></div>
          <Toggle checked={s.unlimitedMode} onChange={(v) => set({ unlimitedMode: v })} />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-[10px] border border-ink-700 bg-ink-850 px-4 py-3">
          <div><div className="text-[13px] font-bold text-ink-100">Local Simulator (mock mode)</div><p className="mt-0.5 text-[11.5px] text-ink-400">Output hamesha "SIMULATED" label ke saath. Default off.</p></div>
          <Toggle checked={s.mockEnabled} onChange={(v) => set({ mockEnabled: v })} />
        </div>
        <div className="flex items-start justify-between gap-4 rounded-[10px] border border-ink-700 bg-ink-850 px-4 py-3">
          <div><div className="text-[13px] font-bold text-ink-100">Maintenance mode</div><p className="mt-0.5 text-[11.5px] text-ink-400">Non-admin generations temporarily block.</p></div>
          <Toggle checked={s.maintenanceMode} onChange={(v) => set({ maintenanceMode: v })} />
        </div>
        <Field label="Max upload (MB)"><Input type="number" value={s.maxUploadMB} onChange={(e) => set({ maxUploadMB: Number(e.target.value) })} /></Field>
        <Button icon={<Settings2 size={14} />} onClick={() => { api.admin.updateSettings(s); toast("success", "Settings saved"); bump(); }}>Save settings</Button>
      </div>
    </div>
  );
}
