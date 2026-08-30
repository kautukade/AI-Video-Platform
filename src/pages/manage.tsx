import { useMemo, useState } from "react";
import { Coins, Download, Key, ShieldCheck, Trash2, TrendingDown, TrendingUp, User as UserIcon } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { ASPECTS, fmtDate, fmtNum, friendlyError, LANGUAGES } from "../lib/utils";
import { Button, ConfirmModal, Field, InfoNote, Input, Select, Tabs, Tag, Toggle } from "../components/ui";
import { downloadBlob } from "../lib/utils";

export function CreditsPage() {
  const { tick } = useApp();
  const data = useMemo(() => { try { const s = api.creditSummary(); return { ...s, txs: api.creditTransactions() }; } catch { return { balance: 0, lifetime: 0, used: 0, version: 0, updatedAt: "", txs: [] as any[] }; } }, [tick]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Usage</h1>
        <p className="mt-1 text-[13px] text-ink-400">Local build — generate jitna chaho. Ledger har run track karta hai (informational).</p>
      </div>
      <div className="stagger grid gap-3 sm:grid-cols-3">
        <div className="panel relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-jade-500/10 blur-2xl" />
          <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400"><Coins size={13} className="text-jade-400" /> Balance</div>
          <div className="mt-2 font-mono text-[34px] font-bold text-jade-300">∞</div>
          <div className="mt-3 text-[11.5px] text-ink-500">Unlimited — no credit limits in the local build.</div>
        </div>
        <div className="panel-flat p-5">
          <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400"><TrendingUp size={13} className="text-jade-400" /> Lifetime granted</div>
          <div className="mt-2 font-mono text-[34px] font-bold text-ink-50">{fmtNum(data.lifetime)}</div>
        </div>
        <div className="panel-flat p-5">
          <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-ink-400"><TrendingDown size={13} className="text-coral-400" /> Tracked usage</div>
          <div className="mt-2 font-mono text-[34px] font-bold text-ink-50">{fmtNum(data.used)}</div>
        </div>
      </div>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="font-display text-[17px] font-bold text-ink-50">Transactions</h2>
        <Button size="sm" variant="outline" icon={<Download size={12} />} onClick={() => {
          const rows = [["date", "type", "amount", "balance", "note"], ...data.txs.map((t: any) => [t.createdAt, t.type, t.amount, t.balanceAfter, t.note])];
          downloadBlob(new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" }), "credits.csv");
        }}>Export CSV</Button>
      </div>
      <div className="panel-flat mt-3 overflow-hidden">
        <table className="w-full text-left text-[12.5px]">
          <thead><tr className="border-b border-ink-700 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-500">
            <th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-right">Amount</th><th className="hidden px-4 py-3 sm:table-cell">Note</th>
          </tr></thead>
          <tbody>
            {data.txs.map((t: any) => (
              <tr key={t.id} className="border-b border-ink-800 last:border-0 hover:bg-ink-800/50">
                <td className="px-4 py-2.5 font-mono text-[11px] text-ink-400">{fmtDate(t.createdAt)}</td>
                <td className="px-4 py-2.5"><Tag tone={t.type === "refund" || t.type === "bonus" ? "jade" : t.type === "generation" ? "solar" : "ink"}>{t.type}</Tag></td>
                <td className={`px-4 py-2.5 text-right font-mono font-bold ${t.amount >= 0 ? "text-jade-300" : "text-coral-300"}`}>{t.amount >= 0 ? "+" : ""}{fmtNum(t.amount)}</td>
                <td className="hidden max-w-[300px] truncate px-4 py-2.5 text-ink-400 sm:table-cell">{t.note}</td>
              </tr>
            ))}
            {data.txs.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-ink-500">No transactions yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, refreshUser, toast, setUser } = useApp();
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [defProvider, setDefProvider] = useState(user?.prefs?.defaultProvider ?? "");
  const [defLang, setDefLang] = useState(user?.prefs?.defaultLanguage ?? "en");
  const [defAspect, setDefAspect] = useState(user?.prefs?.defaultAspect ?? "16:9");
  const [allowPaid, setAllowPaid] = useState(user?.prefs?.allowPaid ?? false);
  const [allowPaidFallback, setAllowPaidFallback] = useState(user?.prefs?.allowPaidFallback ?? false);
  const [curPw, setCurPw] = useState(""); const [newPw, setNewPw] = useState("");
  const [delOpen, setDelOpen] = useState(false); const [delEmail, setDelEmail] = useState("");
  const conns = useMemo(() => { try { return api.myConnections(); } catch { return []; } }, []);
  if (!user) return null;

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-400">Profile, defaults, cost safety aur data controls.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "profile", label: "Profile" }, { id: "prefs", label: "AI Preferences" },
        { id: "security", label: "Security" }, { id: "privacy", label: "Privacy & Data" },
      ]} />

      {tab === "profile" && (
        <div className="anim-fade-in mt-5 max-w-xl space-y-4">
          <div className="panel-flat space-y-4 p-5">
            <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Button onClick={() => { try { api.updateProfile(name, email); refreshUser(); toast("success", "Profile updated"); } catch (e) { toast("error", "Update failed", friendlyError(e).message); } }}>Save profile</Button>
          </div>
        </div>
      )}

      {tab === "prefs" && (
        <div className="anim-fade-in mt-5 grid max-w-4xl gap-4 md:grid-cols-2">
          <div className="panel-flat space-y-4 p-5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Defaults</div>
            <Field label="Default Provider">
              <Select value={defProvider ?? ""} onChange={(e) => setDefProvider(e.target.value)}>
                <option value="">Auto (ProviderRouter)</option>
                {conns.map((c) => <option key={c.id} value={c.providerId}>{c.label}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Default Language"><Select value={defLang} onChange={(e) => setDefLang(e.target.value)}>{LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Field>
              <Field label="Default Aspect"><Select value={defAspect} onChange={(e) => setDefAspect(e.target.value)}>{Object.keys(ASPECTS).map((a) => <option key={a}>{a}</option>)}</Select></Field>
            </div>
            <Button onClick={() => { api.updatePrefs({ defaultProvider: defProvider || null, defaultLanguage: defLang, defaultAspect: defAspect }); refreshUser(); toast("success", "Preferences saved"); }}>Save defaults</Button>
          </div>
          <div className="panel-flat space-y-4 p-5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-400">Cost Safety</div>
            <Toggle checked={allowPaid} onChange={setAllowPaid} label="Allow paid providers" />
            <Toggle checked={allowPaidFallback} onChange={setAllowPaidFallback} label="Allow automatic paid fallback" />
            <InfoNote tone="solar">Defaults <strong>OFF</strong>. Auto routing free providers use karta hai aur paid ko skip karke batata hai — kabhi chupke paise nahi kharch hote.</InfoNote>
            <Button onClick={() => { api.updatePrefs({ allowPaid, allowPaidFallback }); refreshUser(); toast("success", "Cost safety updated"); }}>Save cost safety</Button>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="anim-fade-in mt-5 max-w-xl space-y-4">
          <div className="panel-flat space-y-4 p-5">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><Key size={13} /> Change password</div>
            <Field label="Current password"><Input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} /></Field>
            <Field label="New password" hint="min 8 characters"><Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></Field>
            <Button onClick={async () => { try { await api.changePassword(curPw, newPw); setCurPw(""); setNewPw(""); toast("success", "Password changed"); } catch (e) { toast("error", "Could not change password", friendlyError(e).message); } }}>Update password</Button>
          </div>
          <div className="panel-flat p-5">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><ShieldCheck size={13} className="text-jade-400" /> How secrets are stored</div>
            <ul className="mt-2.5 space-y-1.5 text-[12px] leading-relaxed text-ink-400">
              <li>· Passwords: PBKDF2-SHA256 (60k iterations), per-user salt</li>
              <li>· Provider API keys: AES-GCM encrypted at rest, masked in UI</li>
              <li>· Sessions: random tokens, 7-day expiry, revocable</li>
            </ul>
          </div>
        </div>
      )}

      {tab === "privacy" && (
        <div className="anim-fade-in mt-5 max-w-xl space-y-4">
          <div className="panel-flat p-5">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-400"><UserIcon size={13} /> Your data</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">Generations, assets, characters, credentials aur credit history aapke account se row-scoped hain. Sab kuch aapke laptop pe hai.</p>
          </div>
          <div className="panel-flat border-coral-500/30 p-5">
            <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-coral-300"><Trash2 size={13} /> Delete account</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-400">Permanently deletes profile, credentials, characters, generations aur assets.</p>
            <Button variant="danger" className="mt-4" onClick={() => setDelOpen(true)}>Delete my account…</Button>
          </div>
        </div>
      )}

      <ConfirmModal open={delOpen} onClose={() => setDelOpen(false)} title="Delete account permanently?" confirmLabel="Delete everything"
        body="Type your email to confirm."
        onConfirm={() => { try { api.deleteAccount(delEmail); setUser(null); } catch (e) { toast("error", "Deletion blocked", friendlyError(e).message); } }}>
        <Field label={`Confirm email (${user.email})`}><Input value={delEmail} onChange={(e) => setDelEmail(e.target.value)} placeholder={user.email} /></Field>
      </ConfirmModal>
    </div>
  );
}
