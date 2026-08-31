import { useEffect, useRef } from "react";
import { hashStr, mulberry32 } from "../lib/utils";

/** Deterministic procedural artwork for empty states & thumbnails. */
export function GenArt({ seed, words, className }: { seed: string; words: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const w = (c.width = c.offsetWidth * 2 || 600);
    const h = (c.height = c.offsetHeight * 2 || 400);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const rnd = mulberry32(hashStr(seed));
    const hue = Math.floor(rnd() * 360);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${hue}, 45%, 13%)`);
    g.addColorStop(1, `hsl(${(hue + 70) % 360}, 40%, 8%)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = rnd() * h, r = (rnd() * 0.3 + 0.05) * Math.min(w, h);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `hsla(${(hue + rnd() * 120) % 360}, 70%, 55%, ${0.12 + rnd() * 0.16})`);
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    const ws = words.toLowerCase().split(/\s+/).filter((x) => x.length > 3).slice(0, 3).join(" · ");
    if (ws) {
      ctx.fillStyle = "rgba(238,242,250,0.5)";
      ctx.font = `700 ${Math.max(16, w * 0.03)}px "Space Grotesk", sans-serif`;
      ctx.fillText(ws, w * 0.06, h * 0.9);
    }
  }, [seed, words]);
  return <canvas ref={ref} className={className} />;
}
