import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, Boxes, Clapperboard, Coins, Cpu, FolderOpen, Frame, History, Image as ImageIcon, LayoutDashboard,
  Menu, Plug, Search, Settings, Shield, Sliders, Sparkles, User as UserIcon, Users, Video, Wand2, X, Zap,
} from "lucide-react";
import { cn, timeAgo } from "../lib/utils";
import { useApp } from "../state/store";
import { api } from "../server/api";

const NAV = [
  {
    section: "Studio",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/create/video", label: "AI Video", icon: Video },
      { to: "/create/image", label: "AI Image", icon: ImageIcon },
      { to: "/create/poster", label: "AI Poster", icon: Frame },
      { to: "/create/character", label: "Character Video", icon: Clapperboard },
      { to: "/editor", label: "Image Editor", icon: Wand2 },
    ],
  },
  {
    section: "Library",
    items: [
      { to: "/library", label: "My Library", icon: FolderOpen },
      { to: "/characters", label: "Characters", icon: Users },
      { to: "/history", label: "History", icon: History },
    ],
  },
  {
    section: "Platform",
    items: [
      { to: "/engine", label: "AI Engine Setup", icon: Cpu },
      { to: "/providers", label: "AI Providers", icon: Plug },
      { to: "/models", label: "AI Models", icon: Boxes },
      { to: "/credits", label: "Usage (Free)", icon: Coins },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-solar-500/40 bg-gradient-to-b from-ink-750 to-ink-850">
        <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 23V9l7 8 7-8v14" stroke="#FFC14D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="font-display block text-[14.5px] font-bold tracking-tight text-ink-50">AI Creative Studio</span>
          <span className="block font-mono text-[9.5px] uppercase tracking-[0.22em] text-ink-400">by ITCyber</span>
        </span>
      )}
    </Link>
  );
}

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useApp();
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-4 py-5">
      <div className="px-1.5"><Logo /></div>
      {NAV.map((group) => (
        <div key={group.section}>
          <div className="mb-1.5 px-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-500">{group.section}</div>
          <div className="space-y-0.5">
            {group.items.map((it) => (
              <NavLink key={it.to} to={it.to} onClick={onNavigate}
                className={({ isActive }) => cn(
                  "group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-all",
                  isActive ? "bg-solar-400/12 text-solar-300 shadow-[inset_2px_0_0_var(--color-solar-400)]" : "text-ink-300 hover:bg-ink-750 hover:text-ink-100"
                )}>
                <it.icon size={16} className="shrink-0" />
                {it.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
      {user?.role === "admin" && (
        <div>
          <div className="mb-1.5 px-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-500">Admin</div>
          <NavLink to="/admin" onClick={onNavigate}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13px] font-semibold transition-all",
              isActive ? "bg-coral-500/12 text-coral-300 shadow-[inset_2px_0_0_var(--color-coral-500)]" : "text-ink-300 hover:bg-ink-750 hover:text-ink-100"
            )}>
            <Shield size={16} /> Admin Panel
          </NavLink>
        </div>
      )}
      <div className="mt-auto rounded-xl border border-ink-700 bg-ink-800/60 p-3.5">
        <div className="flex items-center gap-2 text-[12px] font-bold text-ink-200"><Zap size={13} className="text-solar-400" /> Provider status</div>
        <ProviderMini />
      </div>
    </nav>
  );
}

function ProviderMini() {
  const { tick } = useApp();
  const conns = useMemo(() => { try { return api.myConnections(); } catch { return []; } }, [tick]);
  if (!conns.length)
    return <Link to="/providers" className="mt-2 block text-[11.5px] font-semibold text-solar-300 hover:underline">No AI provider connected →</Link>;
  return (
    <div className="mt-2 space-y-1">
      {conns.slice(0, 3).map((c) => (
        <div key={c.id} className="flex items-center gap-2 text-[11.5px] text-ink-300">
          <span className={cn("h-1.5 w-1.5 rounded-full", c.status === "connected" ? "bg-jade-400" : c.status === "error" ? "bg-coral-400" : "bg-ink-400")} />
          {c.label}
          {c.latencyMs != null && <span className="ml-auto font-mono text-[10px] text-ink-500">{c.latencyMs}ms</span>}
        </div>
      ))}
    </div>
  );
}

function NotificationsBell() {
  const { unread, tick, bump } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const items = useMemo(() => { try { return api.notifications().slice(0, 8); } catch { return []; } }, [tick, open]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="focus-ring relative rounded-[10px] border border-ink-700 bg-ink-800/70 p-2 text-ink-300 transition-colors hover:border-ink-500 hover:text-ink-100" aria-label="Notifications">
        <Bell size={16} />
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-solar-400 px-1 font-mono text-[9.5px] font-bold text-ink-950">{unread}</span>}
      </button>
      {open && (
        <div className="anim-scale-in panel absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden py-1.5 shadow-2xl shadow-black/50">
          <div className="flex items-center justify-between border-b border-ink-700 px-4 pb-2 pt-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-ink-300">Notifications</span>
            <button className="text-[11.5px] font-semibold text-solar-300 hover:underline" onClick={() => { api.markNotificationsRead(); bump(); }}>Mark all read</button>
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {items.length === 0 && <div className="px-4 py-5 text-[12.5px] text-ink-400">No notifications yet.</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => { if (n.link) nav(n.link); setOpen(false); }}
                className={`flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-ink-750 ${!n.read ? "bg-ink-800/50" : ""}`}>
                <span className="flex items-center gap-2 text-[12.5px] font-bold text-ink-100">
                  {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-solar-400" />}{n.title}
                  <span className="ml-auto shrink-0 font-mono text-[10px] font-normal text-ink-500">{timeAgo(n.createdAt)}</span>
                </span>
                <span className="text-[11.5px] leading-snug text-ink-400">{n.body}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const results = useMemo(() => (q.trim().length >= 2 ? api.search(q.trim()) : null), [q]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return (
    <div ref={ref} className="relative hidden w-full max-w-md md:block">
      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
        placeholder="Search generations, characters…"
        className="h-9 w-full rounded-[10px] border border-ink-700 bg-ink-800/70 py-2 pl-10 pr-4 text-[13px] text-ink-100 placeholder:text-ink-500 transition-colors focus:border-solar-500/60 hover:border-ink-600" />
      {open && results && (
        <div className="anim-scale-in panel absolute left-0 right-0 top-11 z-50 overflow-hidden py-1.5 shadow-2xl shadow-black/50">
          {results.gens.length === 0 && results.chars.length === 0 && <div className="px-4 py-3 text-[12.5px] text-ink-400">Nothing matches "{q}".</div>}
          {results.gens.map((g) => (
            <button key={g.id} onClick={() => { setOpen(false); setQ(""); nav("/history"); }} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-ink-750">
              <Sparkles size={13} className="shrink-0 text-solar-400" />
              <span className="truncate text-[12.5px] text-ink-200">{g.prompt}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-ink-500">{g.type}</span>
            </button>
          ))}
          {results.chars.map((c) => (
            <button key={c.id} onClick={() => { setOpen(false); setQ(""); nav("/characters"); }} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-ink-750">
              <UserIcon size={13} className="shrink-0 text-iris-400" />
              <span className="truncate text-[12.5px] text-ink-200">{c.name}</span>
              <span className="ml-auto shrink-0 font-mono text-[10px] uppercase text-ink-500">character</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AppShell() {
  const [drawer, setDrawer] = useState(false);
  const { user, tick } = useApp();
  const loc = useLocation();
  useEffect(() => setDrawer(false), [loc.pathname]);
  const activeJobs = useMemo(() => {
    try { return api.listGenerations({ status: "processing", pageSize: 3 }).items; } catch { return []; }
  }, [tick]);

  return (
    <div className="flex min-h-screen bg-ink-950">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r border-ink-800 bg-ink-900/70 lg:block">
        <SideNav />
      </aside>
      {drawer && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog">
          <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="anim-slide-right absolute inset-y-0 left-0 w-[270px] border-r border-ink-700 bg-ink-900">
            <button onClick={() => setDrawer(false)} className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-400 hover:bg-ink-750"><X size={17} /></button>
            <SideNav onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[60] flex items-center gap-3 border-b border-ink-800 bg-ink-950/85 px-4 py-3 backdrop-blur-md sm:px-6">
          <button onClick={() => setDrawer(true)} className="focus-ring rounded-[10px] border border-ink-700 bg-ink-800/70 p-2 text-ink-300 lg:hidden" aria-label="Open menu"><Menu size={17} /></button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2.5">
            {activeJobs.length > 0 && (
              <Link to="/history" className="hidden items-center gap-2 rounded-[10px] border border-iris-500/35 bg-iris-400/10 px-3 py-1.5 text-[11.5px] font-bold text-iris-300 sm:flex">
                <Sliders size={12} className="animate-pulse" /> {activeJobs.length} generating
              </Link>
            )}
            <Link to="/credits" className="focus-ring flex items-center gap-1.5 rounded-[10px] border border-jade-500/35 bg-jade-500/10 px-3 py-1.5 font-mono text-[12.5px] font-bold text-jade-300 transition-colors hover:bg-jade-500/20" title="Unlimited local build — no credit limits">
              <Coins size={13} /> ∞ unlimited
            </Link>
            <NotificationsBell />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
        <footer className="border-t border-ink-800 px-6 py-4 text-[11px] text-ink-500">
          <span className="font-mono">AI Creative Studio</span> · built by <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="font-bold text-ink-300 hover:text-solar-300">ITCyber Technologies Pvt. Ltd</a> · <a href="mailto:connect@itcyber.in" className="hover:text-solar-300">connect@itcyber.in</a>
        </footer>
      </div>
    </div>
  );
}
