import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clapperboard, Copy, Download, Film, FolderOpen, History as HistoryIcon, Image as ImageIcon, Pencil, Play, RefreshCw, Search, Sparkles, Trash2, User as UserIcon, Users } from "lucide-react";
import { api } from "../server/api";
import { useApp } from "../state/store";
import { fmtDate, timeAgo } from "../lib/utils";
import { Button, ConfirmModal, EmptyState, Input, Select, StatusBadge, Tabs, Tag } from "../components/ui";
import { GenArt } from "../components/gen-art";
import { useAsset } from "../components/create-bits";
import { Asset, Character, Generation } from "../lib/types";
import { blobStore } from "../server/db";
import { downloadBlob, downloadUrl } from "../lib/utils";

function LibThumb({ asset }: { asset: Asset }) {
  const { url } = useAsset(asset.id);
  if (!url) return <div className="flex h-full w-full items-center justify-center bg-ink-800 text-ink-500"><ImageIcon size={20} /></div>;
  return asset.mime.startsWith("video") ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt={asset.name} className="h-full w-full object-cover" loading="lazy" />;
}

export function LibraryPage() {
  const { tick, toast, bump } = useApp();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");
  const [del, setDel] = useState<Asset | null>(null);
  const nav = useNavigate();

  const items = useMemo(() => {
    try {
      const kind = tab === "all" ? undefined : tab === "characters" ? undefined : tab === "videos" ? "video" : tab === "images" ? "image" : "poster";
      return api.listAssets({ kind, q: q || undefined, sort });
    } catch { return []; }
  }, [tick, tab, q, sort]);
  const chars = useMemo(() => { try { return api.listCharacters(); } catch { return []; } }, [tick]);

  const counts = useMemo(() => {
    try {
      const all = api.listAssets({});
      return {
        all: all.length + chars.length,
        videos: all.filter((a) => a.mime.startsWith("video") || a.kind === "video").length,
        images: all.filter((a) => a.kind === "image" || a.kind === "character_image").length,
        posters: all.filter((a) => a.kind === "poster").length,
        characters: chars.length,
      };
    } catch { return { all: 0, videos: 0, images: 0, posters: 0, characters: 0 }; }
  }, [tick, chars]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">My Library</h1>
        <p className="mt-1 text-[13px] text-ink-400">Everything you've generated or uploaded — stored locally, private to your account.</p>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: "all", label: "All", count: counts.all }, { id: "videos", label: "Videos", count: counts.videos },
        { id: "images", label: "Images", count: counts.images }, { id: "posters", label: "Posters", count: counts.posters },
        { id: "characters", label: "Characters", count: counts.characters },
      ]} />
      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-44">
          <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
        </Select>
      </div>

      {tab === "characters" ? (
        <CharacterGrid chars={chars} />
      ) : items.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<FolderOpen size={22} />} title="Library khali hai" body="Kuch generate karo — sab results yahan save honge." action={<Link to="/create/image"><Button>Create something</Button></Link>} /></div>
      ) : (
        <div className="stagger mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
          {items.map((a) => (
            <div key={a.id} className="panel group overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden"><LibThumb asset={a} />
                <Tag className="absolute left-2 top-2">{a.kind.replace("_", " ")}</Tag>
                {a.mime.startsWith("video") && <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-950/70 text-solar-300"><Play size={13} /></span>}
              </div>
              <div className="p-3">
                <div className="truncate text-[12.5px] font-semibold text-ink-100">{a.name}</div>
                <div className="mt-0.5 font-mono text-[10px] text-ink-500">{(a.size / 1024 / 1024).toFixed(2)} MB · {timeAgo(a.createdAt)}</div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <Button size="sm" variant="ghost" icon={<Download size={12} />} onClick={async () => {
                    const u = await api.assetUrl(a);
                    if (a.blobId) { const b = await blobStore.get(a.blobId); if (b) downloadBlob(b, `${a.name}.${a.mime.split("/")[1] ?? "bin"}`); }
                    else if (u) downloadUrl(u, a.name);
                  }}>Save</Button>
                  {(a.kind === "image" || a.kind === "character_image") && (
                    <>
                      <Button size="sm" variant="ghost" icon={<UserIcon size={12} />} onClick={() => { sessionStorage.setItem("charImageAsset", a.id); nav("/create/character"); }}>Character</Button>
                      <Button size="sm" variant="ghost" icon={<ImageIcon size={12} />} onClick={() => { sessionStorage.setItem("posterBgAsset", a.id); nav("/create/poster"); }}>Poster bg</Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={() => setDel(a)} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete asset?" body={`"${del?.name}" permanently delete ho jayega.`}
        onConfirm={() => { if (del) { try { api.deleteAsset(del.id); toast("success", "Asset deleted"); bump(); } catch (e: any) { toast("error", "Delete failed", e.message); } } }}>
        <span />
      </ConfirmModal>
    </div>
  );
}

function CharacterGrid({ chars }: { chars: Character[] }) {
  const { toast, bump } = useApp();
  const [del, setDel] = useState<Character | null>(null);
  const nav = useNavigate();
  if (!chars.length)
    return <div className="mt-6"><EmptyState icon={<Users size={22} />} title="No characters yet" body="Character studio me reference upload karke save karo." action={<Link to="/create/character"><Button>Create character</Button></Link>} /></div>;
  return (
    <div className="stagger mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-4">
      {chars.map((c) => (
        <CharCard key={c.id} c={c} onDelete={() => setDel(c)} onUse={() => nav(`/create/character?char=${c.id}`)}
          onEdit={() => nav(`/characters`)}
          onDuplicate={() => { api.createCharacter({ name: `${c.name} (copy)`, description: c.description, imageAssetId: c.imageAssetId, videoAssetId: c.videoAssetId, voice: c.voice, metadata: c.metadata }); toast("success", "Character duplicated"); bump(); }} />
      ))}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete character?" body={`"${del?.name}" delete ho jayega (references library me rahenge).`}
        onConfirm={() => { if (del) { api.deleteCharacter(del.id); toast("success", "Character deleted"); bump(); } }}>
        <span />
      </ConfirmModal>
    </div>
  );
}

function CharCard({ c, onDelete, onUse, onEdit, onDuplicate }: { c: Character; onDelete: () => void; onUse: () => void; onEdit: () => void; onDuplicate: () => void }) {
  const { url } = useAsset(c.imageAssetId);
  return (
    <div className="panel group overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-800">
        {url ? <img src={url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-ink-500"><UserIcon size={26} /></div>}
        <Tag tone="iris" className="absolute left-2 top-2">character</Tag>
      </div>
      <div className="p-3">
        <div className="truncate text-[13px] font-bold text-ink-50">{c.name}</div>
        <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-400">{c.description || "—"}</div>
        <div className="mt-0.5 font-mono text-[10px] text-ink-500">{fmtDate(c.createdAt)}</div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button size="sm" icon={<Play size={12} />} onClick={onUse}>Use</Button>
          <Button size="sm" variant="ghost" icon={<Pencil size={12} />} onClick={onEdit} />
          <Button size="sm" variant="ghost" icon={<Copy size={12} />} onClick={onDuplicate} />
          <Button size="sm" variant="ghost" icon={<Trash2 size={12} />} onClick={onDelete} />
        </div>
      </div>
    </div>
  );
}

export function HistoryPage() {
  const { tick, toast, bump } = useApp();
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Generation | null>(null);
  const nav = useNavigate();

  const gens = useMemo(() => {
    try { return api.listGenerations({ type: type === "all" ? undefined : type, status: status === "all" ? undefined : status, q: q || undefined, pageSize: 60 }).items; }
    catch { return []; }
  }, [tick, type, status, q]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Generation History</h1>
        <p className="mt-1 text-[13px] text-ink-400">Har job ka real status — queued → generating → completed/failed.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Select value={type} onChange={(e) => setType(e.target.value)} className="w-36">
          {["all", "video", "image", "poster", "character", "text"].map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40">
          {["all", "processing", "completed", "failed", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search prompts…" className="pl-9" />
        </div>
      </div>
      {gens.length === 0 ? (
        <div className="mt-6"><EmptyState icon={<HistoryIcon size={22} />} title="No generations yet" body="Studio me kuch create karo — history yahan dikhegi." /></div>
      ) : (
        <div className="mt-5 space-y-2.5">
          {gens.map((g) => <GenRow key={g.id} g={g} onDelete={() => setDel(g)} onRegen={async () => { try { await api.regenerate(g.id); toast("success", "Regenerating", "New job queued."); } catch (e: any) { toast("error", "Failed", e.message); } }} />)}
        </div>
      )}
      <ConfirmModal open={!!del} onClose={() => setDel(null)} title="Delete generation?" body="Generation aur uska asset delete ho jayega."
        onConfirm={() => { if (del) { api.deleteGeneration(del.id); toast("success", "Deleted"); bump(); } }}>
        <span />
      </ConfirmModal>
    </div>
  );
}

function GenRow({ g, onDelete, onRegen }: { g: Generation; onDelete: () => void; onRegen: () => void }) {
  const { url } = useAsset(g.assetId);
  const nav = useNavigate();
  return (
    <div className="panel flex items-center gap-4 p-3.5 transition-colors hover:border-ink-500">
      <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-[10px] bg-ink-800">
        {g.status === "completed" && url
          ? (g.type === "video" || g.type === "character" ? <video src={url} className="h-full w-full object-cover" muted /> : <img src={url} alt="" className="h-full w-full object-cover" />)
          : <div className="flex h-full items-center justify-center"><GenArt seed={g.id} words={g.prompt} className="h-full w-full opacity-50" /></div>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase text-ink-500">
            {g.type === "video" || g.type === "character" ? <Film size={11} /> : g.type === "image" || g.type === "poster" ? <ImageIcon size={11} /> : <Sparkles size={11} />}
            {g.type}
          </span>
          <StatusBadge status={g.status} />
          {g.simulated && <Tag tone="solar">SIM</Tag>}
        </div>
        <div className="mt-1 truncate text-[13px] font-semibold text-ink-100">{g.prompt}</div>
        <div className="mt-0.5 font-mono text-[10.5px] text-ink-500">{g.providerId ?? "—"}/{g.model ?? "—"} · {fmtDate(g.createdAt)}{g.error ? ` · ${g.error.slice(0, 80)}` : ""}</div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="ghost" icon={<Clapperboard size={13} />} onClick={() => nav("/library")} title="Open in library" />
        <Button size="sm" variant="ghost" icon={<RefreshCw size={13} />} onClick={onRegen} title="Regenerate" />
        <Button size="sm" variant="ghost" icon={<Trash2 size={13} />} onClick={onDelete} title="Delete" />
      </div>
    </div>
  );
}

export function CharactersPage() {
  const { tick } = useApp();
  const chars = useMemo(() => { try { return api.listCharacters(); } catch { return []; } }, [tick]);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Characters</h1>
          <p className="mt-1 text-[13px] text-ink-400">Saved character references — use kisi bhi video me.</p>
        </div>
        <Link to="/create/character"><Button icon={<UserIcon size={14} />}>New Character</Button></Link>
      </div>
      <CharacterGrid chars={chars} />
    </div>
  );
}
