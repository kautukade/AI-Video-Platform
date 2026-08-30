import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Clapperboard, Coins, Cpu, Film, FolderOpen, Frame, Image as ImageIcon, Plug, Sparkles, Video } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { Button, EmptyState, StatCard, StatusBadge, Tag } from "../components/ui";
import { GenArt } from "../components/gen-art";
import { taskIcon, useAsset } from "../components/create-bits";
import { fmtNum, timeAgo } from "../lib/utils";
import { Generation } from "../lib/types";

function Thumb({ gen }: { gen: Generation }) {
  const { url } = useAsset(gen.assetId);
  if (gen.status !== "completed" || !url)
    return <div className="flex h-full w-full items-center justify-center bg-ink-800"><GenArt seed={gen.id} words={gen.prompt} className="h-full w-full opacity-40" /></div>;
  return gen.type === "video" || gen.type === "character"
    ? <video src={url} className="h-full w-full object-cover" muted />
    : <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

const STUDIO_TILES = [
  { to: "/create/video", title: "Create Video", sub: "script → scenes → real render", icon: Video, seed: "cinematic city night" },
  { to: "/create/image", title: "Create Image", sub: "FLUX · diffusion · batches", icon: ImageIcon, seed: "portrait studio light" },
  { to: "/create/poster", title: "Create Poster", sub: "structured canvas editor", icon: Frame, seed: "poster gradient bold" },
  { to: "/create/character", title: "Character Video", sub: "your face, your script", icon: Clapperboard, seed: "presenter stage lights" },
];

export default function Dashboard() {
  const { user, tick } = useApp();
  const nav = useNavigate();
  const data = useMemo(() => {
    try {
      const all = api.listGenerations({ pageSize: 1000 }).items;
      const recent = all.slice(0, 8);
      const by = (t: string) => all.filter((g) => g.type === t && g.status === "completed").length;
      return { total: all.length, recent, videos: by("video") + by("character"), images: by("image"), posters: by("poster"), used: api.creditSummary().used, conns: api.myConnections() };
    } catch {
      return { total: 0, recent: [] as Generation[], videos: 0, images: 0, posters: 0, used: 0, conns: [] as any[] };
    }
  }, [tick]);

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div className="anim-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-ink-500">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="font-display mt-1 text-[26px] font-bold tracking-tight text-ink-50 sm:text-[30px]">{greet}, {user?.name?.split(" ")[0]}</h1>
          <p className="mt-1 text-[13.5px] text-ink-400">Your studio is live — free engines connected, unlimited local usage.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/engine"><Button variant="outline" icon={<Cpu size={14} />}>AI Engine Setup</Button></Link>
          {data.conns.length <= 1 && <Link to="/providers"><Button variant="outline" icon={<Plug size={14} />}>Connect providers</Button></Link>}
        </div>
      </div>

      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total Generations" value={fmtNum(data.total)} icon={<Sparkles size={18} />} tone="solar" />
        <StatCard label="Videos Created" value={fmtNum(data.videos)} icon={<Film size={18} />} tone="iris" />
        <StatCard label="Images Created" value={fmtNum(data.images)} icon={<ImageIcon size={18} />} tone="jade" />
        <StatCard label="Posters Created" value={fmtNum(data.posters)} icon={<Frame size={18} />} tone="ink" />
        <StatCard label="Credits Used" value="∞ free" icon={<Coins size={18} />} tone="coral" sub={`${fmtNum(data.used)} tracked`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[16.5px] font-bold text-ink-50">Recent generations</h2>
            <Link to="/history" className="text-[12.5px] font-semibold text-solar-300 hover:underline">View all →</Link>
          </div>
          {data.recent.length === 0 ? (
            <EmptyState icon={<Sparkles size={22} />} title="Nothing generated yet"
              body="Pollinations (free, no key) is pre-connected — images aur text turant chalenge. Video ke liye AI Engine Setup ya Providers me ek free engine connect karo (HF, Replicate, Luma, NIM), ya apna Ollama jodo."
              action={<Link to="/create/image"><Button>Create your first image <ArrowRight size={14} /></Button></Link>} />
          ) : (
            <div className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {data.recent.map((g) => (
                <button key={g.id} onClick={() => nav("/history")} className="panel group overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:border-ink-500">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Thumb gen={g} />
                    {g.simulated && <Tag tone="solar" className="absolute left-2 top-2">SIM</Tag>}
                    <StatusBadge status={g.status} className="absolute bottom-2 right-2" />
                  </div>
                  <div className="p-3">
                    <div className="truncate text-[12px] font-semibold text-ink-200">{g.prompt}</div>
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ink-500">{taskIcon(g.type, 11)} {g.type} · {timeAgo(g.createdAt)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display mb-3 text-[16.5px] font-bold text-ink-50">Quick create</h2>
          <div className="space-y-3">
            {STUDIO_TILES.map((t) => (
              <Link key={t.to} to={t.to} className="panel group relative flex items-center gap-4 overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-solar-500/40">
                <div className="absolute inset-y-0 right-0 w-32 opacity-25 transition-opacity group-hover:opacity-45"><GenArt seed={t.seed} words={t.seed} className="h-full w-full" /></div>
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-solar-500/30 bg-solar-400/10 text-solar-300"><t.icon size={19} /></div>
                <div className="relative">
                  <div className="text-[14px] font-bold text-ink-50">{t.title}</div>
                  <div className="font-mono text-[10.5px] text-ink-500">{t.sub}</div>
                </div>
                <ArrowRight size={16} className="relative ml-auto text-ink-500 transition-transform group-hover:translate-x-1 group-hover:text-solar-300" />
              </Link>
            ))}
            <Link to="/library" className="flex items-center gap-3 rounded-[10px] border border-dashed border-ink-600 px-4 py-3 text-[13px] font-semibold text-ink-400 transition-colors hover:border-ink-400 hover:text-ink-200">
              <FolderOpen size={16} /> Browse your library
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
