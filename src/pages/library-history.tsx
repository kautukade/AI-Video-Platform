import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Download, Eye, FolderOpen, History as HistoryIcon, Pencil, Play, RefreshCw, Search, Trash2, Users as UsersIcon } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { cn, fmtDate, friendlyError, timeAgo } from "../lib/utils";
import { Button, ConfirmModal, EmptyState, Input, StatusBadge, Tabs, Tag } from "../components/ui";
import { GenArt } from "../components/gen-art";
import { taskIcon, useAsset } from "../components/create-bits";
import { Asset, Character, Generation } from "../lib/types";

function AssetThumb({ asset }: { asset: Asset }) {
  const { url } = useAsset(asset.id);
  if (!url) return <div className="h-full w-full bg-ink-800"><GenArt seed={asset.id} words={asset.name} className="h-full w-full opacity-40" /></div>;
  return asset.kind === "video" ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />;
}

export function LibraryPage() {
  const { toast, tick } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Asset | null>(null);
  const assets = useMemo(() => { try { return api.listAssets({ kind: tab, q: q || undefined }); } catch { return []; } }, [tick, tab, q]);
  const counts = useMemo(() => { try { const all = api.listAssets(); return { all: all.length, image: all.filter((a) => a.kind === "image").length, video: all.filter((a) => a.kind === "video").length, poster: all.filter((a) => a.kind === "poster").length, character_image: all.filter((a) => a.kind === "character_image").length }; } catch { return { all: 0, image: 0, video: 0, poster: 0, character_image: 0 }; } }, [tick]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">My Library</h1>
          <p className="mt-1 text-[13px] text-ink-400">Saare generated aur uploaded assets — sirf aapke account ke.</p>
        </div>
        <div className="relative w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "all", label: "All", count: counts.all }, { id: "image", label: "Images", count: counts.image },
        { id: "video", label: "Videos", count: counts.video }, { id: "poster", label: "Posters", count: counts.poster },
        { id: "character_image", label: "Characters", count: counts.character_image },
      ]} />
      {assets.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<FolderOpen size={22} />} title="Library khali hai" body="Generate kuch bhi — video, image ya poster — aur wo yahan save hoga." action={<Link to="/create/image"><Button>Generate an image</Button></Link>} /></div>
      ) : (
        <div className="stagger mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <div key={a.id} className="panel group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-ink-500">
              <div className="relative aspect-[4/3] overflow-hidden">
                <AssetThumb asset={a} />
                <Tag tone="ink" className="absolute left-2 top-2">{a.kind}</Tag>
                {a.kind === "video" && <span className="absolute inset-0 flex items-center justify-center"><Play size={30} className="text-ink-50 opacity-80" /></span>}
              </div>
              <div className="p-3">
                <div className="truncate text-[12.5px] font-semibold text-ink-100">{a.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-500">{timeAgo(a.createdAt)}</div>
                <div className="mt-2.5 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="sm" variant="ghost" icon={<Download size={12} />} onClick={async () => { try { await api.downloadAsset(a); } catch { toast("error", "Download failed"); } }}>Save</Button>
                  {a.kind === "image" && <Button size="sm" variant="ghost" icon={<Clapperboard size={12} />} onClick={() => { sessionStorage.setItem("charImageAsset", a.id); nav("/create/character"); }}>Character</Button>}
                  <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setDel(a)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete asset?" body={`"${del?.name}" permanently delete hoga.`} onConfirm={() => { if (del) { api.deleteAsset(del.id); toast("success", "Deleted"); } }} />
    </div>
  );
}

export function HistoryPage() {
  const { toast, tick } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState("all");
  const [del, setDel] = useState<Generation | null>(null);
  const gens = useMemo(() => { try { return api.listGenerations({ type: tab === "all" ? undefined : tab, pageSize: 100 }).items; } catch { return []; } }, [tick, tab]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Generation History</h1>
        <p className="mt-1 text-[13px] text-ink-400">Har job ka real status — queued, processing, completed, failed.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "all", label: "All" }, { id: "video", label: "Video" }, { id: "image", label: "Image" },
        { id: "poster", label: "Poster" }, { id: "character", label: "Character" }, { id: "processing", label: "Processing" }, { id: "failed", label: "Failed" },
      ]} />
      {gens.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<HistoryIcon size={22} />} title="Koi generation nahi" body="Jab aap generate karenge, yahan history dikhegi." action={<Link to="/create/image"><Button>Generate something</Button></Link>} /></div>
      ) : (
        <div className="mt-6 space-y-2.5">
          {gens.map((g) => <HistoryRow key={g.id} g={g} onDelete={() => setDel(g)} />)}
        </div>
      )}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete generation?" body="Ye generation aur uska asset delete hoga." onConfirm={() => { if (del) { api.deleteGeneration(del.id); toast("success", "Deleted"); } }} />
    </div>
  );
}

function HistoryRow({ g, onDelete }: { g: Generation; onDelete: () => void }) {
  const { toast } = useApp();
  const { asset, url } = useAsset(g.assetId);
  const active = ["queued", "preparing", "generating", "processing"].includes(g.status);
  return (
    <div className="panel-flat flex flex-wrap items-center gap-4 p-4 transition-colors hover:border-ink-500">
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-[8px] border border-ink-700 bg-ink-800">
        {url ? (g.type === "video" || g.type === "character" ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt="" className="h-full w-full object-cover" />)
          : <div className="flex h-full items-center justify-center text-ink-500">{taskIcon(g.type, 16)}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink-100">{g.prompt}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-ink-500">
          <span>{g.type}</span>·<span>{g.providerId ?? "—"}</span>·<span>{timeAgo(g.createdAt)}</span>
          {g.simulated && <Tag tone="solar">SIM</Tag>}
        </div>
      </div>
      <StatusBadge status={g.status} />
      <div className="flex items-center gap-1.5">
        {active && <Button size="sm" variant="outline" onClick={async () => { try { api.cancelGeneration(g.id); toast("info", "Cancel requested"); } catch (e) { toast("error", "Cancel failed", friendlyError(e).message); } }}>Cancel</Button>}
        {g.status === "completed" && asset && <Button size="sm" variant="ghost" icon={<Download size={12} />} onClick={async () => { try { await api.downloadAsset(asset); } catch { toast("error", "Download failed"); } }}>Save</Button>}
        {(g.status === "failed" || g.status === "cancelled") && <Button size="sm" variant="ghost" icon={<RefreshCw size={12} />} onClick={async () => { try { await api.regenerate(g.id); toast("info", "Retrying…"); } catch (e) { toast("error", "Retry failed", friendlyError(e).message); } }}>Retry</Button>}
        <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={onDelete} />
      </div>
    </div>
  );
}

export function CharactersPage() {
  const { toast, tick } = useApp();
  const nav = useNavigate();
  const [del, setDel] = useState<Character | null>(null);
  const chars = useMemo(() => { try { return api.listCharacters(); } catch { return []; } }, [tick]);

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Characters</h1>
          <p className="mt-1 text-[13px] text-ink-400">Saved character references — video studio me reuse karo.</p>
        </div>
        <Link to="/create/character"><Button icon={<Clapperboard size={14} />}>New Character</Button></Link>
      </div>
      {chars.length === 0 ? (
        <EmptyState icon={<UsersIcon size={22} />} title="Koi character nahi" body="Character Video studio me image upload karke apna pehla character banao." action={<Link to="/create/character"><Button>Create character</Button></Link>} />
      ) : (
        <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {chars.map((c) => <CharacterCard key={c.id} c={c} onUse={() => nav(`/create/character?char=${c.id}`)} onDelete={() => setDel(c)} />)}
        </div>
      )}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete character?" body={`"${del?.name}" delete hoga (references assets library me rahenge).`} onConfirm={() => { if (del) { api.deleteCharacter(del.id); toast("success", "Deleted"); } }} />
    </div>
  );
}

function CharacterCard({ c, onUse, onDelete }: { c: Character; onUse: () => void; onDelete: () => void }) {
  const { url } = useAsset(c.imageAssetId);
  return (
    <div className="panel group overflow-hidden transition-all hover:-translate-y-0.5 hover:border-ink-500">
      <div className="relative aspect-square overflow-hidden">
        {url ? <img src={url} alt={c.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="flex h-full items-center justify-center bg-ink-800 text-ink-500"><UsersIcon size={26} /></div>}
      </div>
      <div className="p-3.5">
        <div className="truncate text-[14px] font-bold text-ink-50">{c.name}</div>
        <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-400">{c.description || "No description"}</div>
        <div className="mt-1 font-mono text-[10px] text-ink-500">{fmtDate(c.createdAt)}</div>
        <div className="mt-3 flex items-center gap-1.5">
          <Button size="sm" icon={<Play size={12} />} onClick={onUse}>Use</Button>
          <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}
