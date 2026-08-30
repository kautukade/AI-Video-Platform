import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Boxes, Check, Clapperboard, Coins, Cpu, ExternalLink, Flower2, Frame, Globe, Image as ImageIcon, Key, Lock, Mail, Plug,
  Quote, Server, ShieldCheck, Sparkles, Video, Zap, PenLine,
} from "lucide-react";
import { cn } from "../lib/utils";
import { Button } from "../components/ui";

function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-solar-500/40 bg-ink-850">
            <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 23V9l7 8 7-8v14" stroke="#FFC14D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[14.5px] font-bold tracking-tight text-ink-50">AI Creative Studio</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-ink-400">ITCyber Technologies</span>
          </span>
        </Link>
        <nav className="ml-auto hidden items-center gap-5 text-[13px] font-semibold text-ink-300 sm:flex">
          <Link className="transition-colors hover:text-ink-50" to="/features">Features</Link>
          <Link className="transition-colors hover:text-ink-50" to="/about">About</Link>
          <Link className="transition-colors hover:text-ink-50" to="/dashboard">Dashboard</Link>
        </nav>
        <Link to="/dashboard"><Button size="sm">Open Studio <ArrowRight size={13} /></Button></Link>
      </div>
    </header>
  );
}

function PublicFooter() {
  return (
    <footer className="border-t border-ink-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[12px] text-ink-500 sm:flex-row sm:items-center">
        <span className="font-mono">AI CREATIVE STUDIO</span>
        <span className="hidden sm:inline">·</span>
        <span>Built by <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="font-bold text-ink-300 transition-colors hover:text-solar-300">ITCyber Technologies Pvt. Ltd</a></span>
        <span className="flex items-center gap-3 font-mono text-[11px] sm:ml-auto">
          <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="transition-colors hover:text-solar-300">www.itcyber.in</a>
          <span className="text-ink-700">|</span>
          <a href="mailto:connect@itcyber.in" className="transition-colors hover:text-solar-300">connect@itcyber.in</a>
        </span>
      </div>
      <div className="border-t border-ink-800/60 py-3 text-center font-mono text-[10.5px] text-ink-600">
        © {new Date().getFullYear()} ITCyber Technologies Private Limited · local-first architecture · encrypted credentials
      </div>
    </footer>
  );
}

const TICKER_ITEMS = ["ITCyber Technologies Pvt. Ltd.", "www.itcyber.in", "connect@itcyber.in", "AI · Web · Automation"];

function ItcTicker() {
  return (
    <div className="itc-marquee select-none border-b-2 border-ink-950/80 bg-ink-950 py-2.5">
      {[0, 1].map((n) => (
        <span key={n} className="flex shrink-0 items-center gap-8 pr-8 font-mono text-[12px] font-bold uppercase tracking-[0.22em] text-solar-300">
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="flex items-center gap-8">
              {TICKER_ITEMS.map((t) => <React.Fragment key={t}><span>{t}</span><span className="text-solar-500">✦</span></React.Fragment>)}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}

function ItcBanner() {
  return (
    <section className="relative mt-14 overflow-hidden rounded-[20px] border-4 border-ink-950 bg-solar-400 shadow-[0_24px_80px_-30px_rgba(255,193,77,0.35)]">
      <ItcTicker />
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:py-16">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 animate-pulse rounded-full bg-ink-950" />
          <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.3em] text-ink-950/80">Made by the team behind this studio</span>
        </div>
        <h2 className="itc-headline mt-6 text-ink-950">
          ITCYBER<br /><span className="itc-outline">TECHNOLOGIES</span>
        </h2>
        <p className="mt-4 inline-block border-4 border-ink-950 bg-ink-950 px-5 py-2 font-mono text-[13px] font-bold uppercase tracking-[0.42em] text-solar-300 sm:text-[15px]">
          Private Limited
        </p>
        <p className="mt-7 max-w-2xl text-[16px] font-semibold leading-relaxed text-ink-950/85 sm:text-[18px]">
          Is poore AI Creative Studio ko design, engineer aur maintain kiya hai{" "}
          <strong className="font-extrabold text-ink-950">ITCyber Technologies</strong> ne. Aapko bhi aisa hi
          custom AI product, website ya business automation chahiye?{" "}
          <strong className="font-extrabold underline decoration-4 decoration-ink-950/40 underline-offset-4">Humse baat karo.</strong>
        </p>
        <div className="mt-9 space-y-4">
          <a href="mailto:connect@itcyber.in"
            className="group flex flex-col gap-1 rounded-2xl border-4 border-ink-950 bg-ink-950 px-6 py-5 shadow-[8px_8px_0_0_rgba(10,13,19,0.9)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0_0_rgba(10,13,19,1)] sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-solar-400 text-ink-950"><Mail size={24} strokeWidth={2.4} /></span>
              <span>
                <span className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.28em] text-solar-400">Email karo — 24 ghante me reply</span>
                <span className="itc-contact block text-solar-300 transition-colors group-hover:text-ink-50">connect@itcyber.in</span>
              </span>
            </span>
            <ArrowRight size={30} strokeWidth={2.4} className="hidden shrink-0 text-solar-400 transition-transform group-hover:translate-x-2 sm:block" />
          </a>
          <a href="https://www.itcyber.in" target="_blank" rel="noreferrer"
            className="group flex flex-col gap-1 rounded-2xl border-4 border-ink-950 bg-solar-300 px-6 py-5 shadow-[8px_8px_0_0_rgba(10,13,19,0.9)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0_0_rgba(10,13,19,1)] sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-solar-300"><Globe size={24} strokeWidth={2.4} /></span>
              <span>
                <span className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.28em] text-ink-950/60">Website visit karo</span>
                <span className="itc-contact block text-ink-950">www.itcyber.in</span>
              </span>
            </span>
            <ExternalLink size={30} strokeWidth={2.4} className="hidden shrink-0 text-ink-950 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1 sm:block" />
          </a>
        </div>
        <div className="mt-9 flex flex-col gap-6 border-t-2 border-ink-950/20 pt-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2.5">
            {["AI Products", "Web & Apps", "Business Automation", "Consulting"].map((s) => (
              <span key={s} className="rounded-full border-2 border-ink-950 px-4 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-wider text-ink-950 transition-colors hover:bg-ink-950 hover:text-solar-300">{s}</span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="mailto:connect@itcyber.in" className="focus-ring inline-flex items-center gap-2 rounded-xl border-4 border-ink-950 bg-ink-950 px-7 text-[15px] font-extrabold text-solar-300 shadow-[5px_5px_0_0_rgba(10,13,19,0.6)] transition-all hover:-translate-y-0.5" style={{ height: 52 }}>
              <Mail size={17} /> Start a Project
            </a>
            <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 rounded-xl border-4 border-ink-950 px-7 text-[15px] font-extrabold text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-solar-300" style={{ height: 52 }}>
              <Globe size={17} /> www.itcyber.in
            </a>
          </div>
        </div>
        <p className="mt-7 font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-950/60">
          © {new Date().getFullYear()} ITCyber Technologies Private Limited · Crafted in-house
        </p>
      </div>
    </section>
  );
}

function ItcJournal() {
  const services = [
    ["01", "Custom AI Products", "Is studio jaisa apna AI tool — aapke business ke workflow ke hisaab se design kiya hua."],
    ["02", "Websites & Web Apps", "Fast, secure, modern web platforms — landing se lekar full SaaS tak."],
    ["03", "Business Automation", "Repetitive kaam ko AI agents aur pipelines se automate karna."],
    ["04", "AI Consulting", "Kaunsa model, kaunsa provider, kitna kharcha — seedhi, honest salah."],
  ];
  return (
    <section className="relative mt-20 overflow-hidden rounded-[20px] border border-ink-700 bg-ink-900/60">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-50" />
      <div className="relative px-6 py-12 sm:px-12 sm:py-14">
        <div className="flex flex-wrap items-center gap-3">
          <PenLine size={16} className="text-solar-400" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-solar-400">The ITCyber Journal</span>
          <span className="rounded-full border border-ink-600 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-ink-400">Company Message · No. 01</span>
        </div>
        <h2 className="itc-blog-title mt-5 max-w-3xl text-ink-50">
          Hum sirf software nahi banate — hum aapke business ko <span className="text-solar-300">AI ke saath aage</span> le jaate hain.
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-ink-500">
          <span>Team ITCyber</span><span className="text-ink-700">·</span>
          <span>{new Date().toLocaleDateString(undefined, { day: "2-digit", month: "long", year: "numeric" })}</span><span className="text-ink-700">·</span>
          <span>5 min read</span>
        </div>
        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-5 text-[14.5px] leading-[1.85] text-ink-300">
            <p className="itc-dropcap">
              Aaj har company AI ki baat karti hai, lekin bahut kam actually apne kaam me AI utaarti hain. ITCyber Technologies isi gap ko bharne ke liye bani hai — hum aise tools banate hain jo demo me nahi, <strong className="font-bold text-ink-100">production me chalte hain</strong>. Ye AI Creative Studio usi soch ka nateeja hai: ek hi jagah video, image, poster aur character content — aapke apne providers, aapke apne laptop par.
            </p>
            <p>
              Hamara usool simple hai: <strong className="font-bold text-ink-100">jo dikh raha hai, wohi real hai.</strong> Koi fake progress bar nahi, koi nakli output nahi. Agar koi provider video nahi bana sakta, to hum seedha keh dete hain. Yehi imaandari hum har client project me laate hain — chahe woh ek chhoti dukaan ki automation ho ya enterprise-grade AI platform.
            </p>
            <p>
              Agar aapke paas koi idea hai — koi process jo automate karna hai, koi product jo AI se behtar ho sakta hai — to bas ek mail bhejiye. Hum sunenge, samjhenge, aur phir banayenge.
            </p>
          </div>
          <div className="space-y-6">
            <blockquote className="rounded-[14px] border-l-4 border-solar-400 bg-ink-850/80 p-6">
              <Quote size={22} className="text-solar-400" />
              <p className="font-display mt-3 text-[19px] font-bold leading-snug text-ink-50">
                “AI koi jaadu nahi hai — yeh ek lever hai. Aur hum woh lever aapke haath me dete hain.”
              </p>
              <footer className="mt-3 font-mono text-[11px] uppercase tracking-wider text-ink-500">— Founding Team, ITCyber Technologies</footer>
            </blockquote>
            <div className="rounded-[14px] border border-ink-700 bg-ink-850/60 p-6">
              <div className="font-mono text-[10.5px] font-bold uppercase tracking-[0.24em] text-ink-500">What we build for you</div>
              <ul className="mt-4 space-y-3">
                {services.map(([n, t, d]) => (
                  <li key={n} className="group flex gap-3.5">
                    <span className="font-mono text-[13px] font-bold text-solar-400">{n}</span>
                    <span>
                      <span className="block text-[13.5px] font-bold text-ink-100 transition-colors group-hover:text-solar-300">{t}</span>
                      <span className="block text-[12px] leading-relaxed text-ink-400">{d}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[14px] border border-jade-500/30 bg-jade-500/8 p-5">
              <div className="text-[13.5px] font-bold text-jade-300">Chaliye baat karte hain.</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-400">Project ka idea ho ya sirf ek sawaal — hum 24 ghante ke andar jawab dete hain.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href="mailto:connect@itcyber.in" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg bg-jade-500/20 px-4 text-[12.5px] font-bold text-jade-300 transition-colors hover:bg-jade-500/30"><Mail size={13} /> connect@itcyber.in</a>
                <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-ink-600 px-4 text-[12.5px] font-bold text-ink-200 transition-colors hover:border-ink-400"><Globe size={13} /> www.itcyber.in</a>
              </div>
              <p className="mt-3 font-mono text-[10.5px] uppercase tracking-wider text-ink-500">— Team ITCyber Technologies Pvt. Ltd.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Landing() {
  const studios = [
    { to: "/create/video", title: "AI Video", sub: "script → scenes → real video render", icon: Video, note: "Replicate · Luma · NVIDIA NIM · HF" },
    { to: "/create/image", title: "AI Image", sub: "FLUX & diffusion · batches · seeds", icon: ImageIcon, note: "Pollinations free · no key" },
    { to: "/create/poster", title: "AI Poster", sub: "structured canvas + AI backgrounds", icon: Frame, note: "12 presets · editable text" },
    { to: "/create/character", title: "Character Video", sub: "your face + script → talking video", icon: Clapperboard, note: "OmniHuman · lip-sync" },
  ];
  return (
    <div className="relative min-h-screen overflow-x-clip bg-ink-950">
      <PublicNav />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-70" />
      <div className="pointer-events-none absolute left-[-180px] top-[80px] h-[480px] w-[480px] rounded-full bg-solar-500/6 blur-3xl" />
      <div className="pointer-events-none absolute right-[-140px] top-[420px] h-[380px] w-[380px] rounded-full bg-iris-500/6 blur-3xl" />

      <section className="relative mx-auto max-w-6xl px-5 pb-10 pt-14 sm:pt-20">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.24em] text-ink-400">
            <span className="flex items-center gap-2 rounded-full border border-jade-500/35 bg-jade-500/10 px-3 py-1 text-jade-300"><Zap size={11} /> free providers · no sign-up</span>
            <span className="rounded-full border border-ink-700 bg-ink-850 px-3 py-1">local-first</span>
          </div>
          <h1 className="font-display mt-6 text-[44px] font-bold leading-[1.02] tracking-tight text-ink-50 sm:text-[72px]">
            Create. Generate.<br /><span className="text-solar-300">Imagine.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-ink-300 sm:text-[17px]">
            One powerful AI creative studio for <strong className="text-ink-100">videos, images, posters and character-based content</strong> —
            free internet providers (Pollinations, HF, Groq…), apna Ollama, ya koi bhi API key. Sab real engines, koi demo nahi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/dashboard"><Button size="lg">Start Creating <ArrowRight size={16} /></Button></Link>
            <Link to="/features"><Button size="lg" variant="outline">Explore Features</Button></Link>
          </div>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">no sign-up · runs 100% on your laptop</p>
          <div className="mt-9 grid max-w-md grid-cols-3 gap-4">
            {[["4", "creation studios"], ["14", "provider adapters"], ["∞", "local usage"]].map(([v, l]) => (
              <div key={l} className="border-l-2 border-ink-700 pl-3">
                <div className="font-mono text-[20px] font-bold text-ink-50">{v}</div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ITCyber — company first */}
        <ItcBanner />
        <ItcJournal />
      </section>

      {/* Studios */}
      <section className="relative mx-auto max-w-6xl px-5 py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-solar-400">the studios</div>
            <h2 className="font-display mt-2 text-[28px] font-bold tracking-tight text-ink-50 sm:text-[34px]">Four studios, one brain</h2>
          </div>
          <Link to="/dashboard" className="text-[13px] font-semibold text-solar-300 hover:underline">Open dashboard →</Link>
        </div>
        <div className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {studios.map((s) => (
            <Link key={s.to} to={s.to} className="panel group relative flex flex-col overflow-hidden p-5 transition-all hover:-translate-y-1 hover:border-solar-500/45">
              <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-solar-400 to-solar-600 transition-transform duration-300 group-hover:scale-x-100" />
              <s.icon size={24} className="text-solar-400" />
              <h3 className="font-display mt-4 text-[17px] font-bold text-ink-50">{s.title}</h3>
              <p className="mt-1 text-[12.5px] text-ink-400">{s.sub}</p>
              <p className="mt-auto pt-4 font-mono text-[10px] uppercase tracking-wider text-ink-500">{s.note}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Providers strip */}
      <section className="relative mx-auto max-w-6xl px-5 pb-16">
        <div className="panel relative overflow-hidden p-8 sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-solar-500/8 blur-3xl" />
          <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-solar-400">provider engine</div>
              <h2 className="font-display mt-2 text-[26px] font-bold tracking-tight text-ink-50 sm:text-[32px]">Har free AI engine, ek jagah</h2>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-400">
                Connect karte hi system <strong className="text-ink-100">best free model khud chunta hai</strong>. Ollama connect karo to text/vision bilkul private — image/video ke liye free cloud tiers.
              </p>
              <Link to="/providers" className="mt-5 inline-block"><Button icon={<Plug size={14} />}>Browse free providers</Button></Link>
            </div>
            <ul className="space-y-2.5">
              {[
                [Flower2, "Pollinations — free FLUX images & GPT text · no account, no key"],
                [Server, "Ollama — free local inference on your own laptop"],
                [Boxes, "Hugging Face — free-tier images, video, text, audio"],
                [Plug, "OpenRouter — 300+ models, free variants auto-selected"],
                [Key, "Groq · Cerebras · DeepSeek · Mistral · Together · NVIDIA NIM · Replicate · Luma"],
              ].map(([I, t]: any, i) => (
                <li key={i} className="flex items-center gap-3 rounded-[10px] border border-ink-700 bg-ink-850/70 px-4 py-3 text-[12.5px] text-ink-300 transition-colors hover:border-ink-500">
                  <I size={15} className="shrink-0 text-solar-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Feature bullets */}
      <section className="relative mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [Cpu, "AI Engine Setup", "Real hardware detection, Ollama model manager, best-model recommendations"],
            [Sparkles, "Real generation only", "No fake outputs — honest statuses, refunds, fallback chains"],
            [Coins, "Unlimited local usage", "No credit limits in the local build — generate as much as you want"],
            [ShieldCheck, "Encrypted keys", "AES-GCM vault, masked keys, row-level privacy, delete anytime"],
          ].map(([I, t, d]: any) => (
            <div key={t} className="panel-flat p-5 transition-colors hover:border-ink-500">
              <I size={19} className="text-solar-400" />
              <h3 className="font-display mt-3 text-[14.5px] font-bold text-ink-50">{t}</h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-ink-400">{d}</p>
            </div>
          ))}
        </div>
        <div className="panel mt-12 flex flex-col items-start justify-between gap-5 p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-display text-[22px] font-bold text-ink-50">No sign-up. No plans. Just open it.</h3>
            <p className="mt-1 text-[13.5px] text-ink-400">Runs locally on your laptop — free simulator included, plug in real providers whenever you want.</p>
          </div>
          <Link to="/dashboard"><Button size="lg">Open the Studio <ArrowRight size={16} /></Button></Link>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

export function Features() {
  const groups = [
    { title: "Generation pipeline", items: ["Job queue with live status streaming", "Honest, non-faked progress states", "Automatic provider fallback chains", "Cancel & regenerate with one click", "Real WebM/video/image outputs"] },
    { title: "Providers & models", items: ["14 provider adapters incl. Pollinations & Ollama", "Free-model auto-selection on connect", "Live model discovery", "Ollama local endpoint + model manager", "Capability-filtered model picker", "Per-provider health & latency"] },
    { title: "Local AI engine", items: ["Real hardware detection (bridge-enhanced)", "Ollama pull/delete/test with real progress", "Hardware-based model recommendations", "Disk-space protection before downloads", "Private vision analysis on-device"] },
    { title: "Control & safety", items: ["Unlimited local usage mode", "Admin pricing rules & adjustments", "Role-based admin panel & analytics", "Encrypted credentials, masked keys", "Full account deletion"] },
  ];
  return (
    <div className="min-h-screen bg-ink-950">
      <PublicNav />
      <div className="mx-auto max-w-6xl px-5 py-14">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-solar-400">Features</div>
        <h1 className="font-display mt-2 max-w-2xl text-[36px] font-bold leading-tight tracking-tight text-ink-50 sm:text-[44px]">Everything a production AI studio needs</h1>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {groups.map((g, i) => (
            <div key={g.title} className={cn("panel p-6", i % 2 === 1 && "sm:translate-y-3")}>
              <h2 className="font-display text-[17px] font-bold text-ink-50">{g.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {g.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[13.5px] text-ink-300"><Check size={15} className="mt-0.5 shrink-0 text-jade-400" />{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-center"><Link to="/dashboard"><Button size="lg">Open the Studio <ArrowRight size={16} /></Button></Link></div>
      </div>
      <PublicFooter />
    </div>
  );
}

export function About() {
  return (
    <div className="min-h-screen bg-ink-950">
      <PublicNav />
      <div className="mx-auto max-w-3xl px-5 py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-solar-400">About</div>
        <h1 className="font-display mt-2 text-[36px] font-bold tracking-tight text-ink-50 sm:text-[42px]">A studio, not a walled garden</h1>
        <div className="mt-6 space-y-5 text-[14.5px] leading-relaxed text-ink-300">
          <p>Most AI tools lock you into one model, one vendor, one pricing scheme. AI Creative Studio is built the opposite way: a provider-agnostic core that treats Pollinations, Hugging Face, Ollama, Replicate, NVIDIA NIM and any OpenAI-compatible endpoint as interchangeable engines behind one interface.</p>
          <p>The <strong className="text-ink-100">AIProvider abstraction</strong> means new engines slot in as adapters without touching the studios, the credit engine or the job queue.</p>
          <p>And honesty is a feature: if a provider can't generate video, we tell you. If progress isn't available, we show a real processing state instead of a fake percentage. Browsers can't read your real GPU or install Ollama — so we ship an optional <strong className="text-ink-100">local bridge</strong> instead of pretending.</p>
        </div>
        <div className="panel mt-8 grid gap-6 p-7 sm:grid-cols-3">
          {[["Extensible", "Add providers, models, task types and storage backends without rewrites."], ["Portable", "Deploy the frontend anywhere static; the service layer maps 1:1 to a Node/Postgres backend."], ["Yours", "Your keys, your uploads, your characters — encrypted and deletable."]].map(([t, b]) => (
            <div key={t}><div className="font-display text-[15px] font-bold text-solar-300">{t}</div><p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">{b}</p></div>
          ))}
        </div>
        <div className="mt-8 rounded-[14px] border border-ink-700 bg-ink-900/60 p-6">
          <div className="text-[13px] font-bold text-ink-100">Built by ITCyber Technologies Private Limited</div>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-400">Custom AI products, web platforms and business automation. <a className="font-semibold text-solar-300 hover:underline" href="https://www.itcyber.in" target="_blank" rel="noreferrer">www.itcyber.in</a> · <a className="font-semibold text-solar-300 hover:underline" href="mailto:connect@itcyber.in">connect@itcyber.in</a></p>
        </div>
      </div>
      <PublicFooter />
    </div>
  );
}

const PURPOSES = ["Content Creation", "Marketing", "Education", "Business", "Social Media", "Personal"];
export function Onboarding() {
  const { user, refreshUser, toast, ready } = useAppSafe();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [purpose, setPurpose] = useState<string | null>(null);
  if (!ready) return null;
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 bg-grid px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[440px] w-[640px] -translate-x-1/2 rounded-full bg-solar-500/7 blur-3xl" />
      <div className="anim-fade-up relative w-full max-w-[520px]">
        <div className="panel p-7">
          <div className="mb-4 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-solar-400" : "bg-ink-700")} />)}</div>
          {step === 0 && (
            <>
              <h1 className="font-display text-[22px] font-bold text-ink-50">Set Up Your AI Studio</h1>
              <p className="mt-1.5 text-[13.5px] text-ink-400">Let's check your computer and configure the best AI models for your machine.</p>
              <Button className="mt-5 w-full" size="lg" onClick={() => setStep(1)}>Check My System</Button>
            </>
          )}
          {step === 1 && (
            <>
              <h1 className="font-display text-[22px] font-bold text-ink-50">What will you create?</h1>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {PURPOSES.map((p) => (
                  <button key={p} onClick={() => setPurpose(p)} className={cn("rounded-[10px] border px-3 py-2.5 text-[13px] font-semibold transition-all", purpose === p ? "border-solar-500/60 bg-solar-400/12 text-solar-300" : "border-ink-700 text-ink-300 hover:border-ink-500")}>{p}</button>
                ))}
              </div>
              <Button className="mt-5 w-full" size="lg" disabled={!purpose} onClick={() => setStep(2)}>Continue</Button>
            </>
          )}
          {step === 2 && (
            <>
              <h1 className="font-display text-[22px] font-bold text-ink-50">You're ready.</h1>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-400">
                Pollinations (free images/text) is already connected. Open <strong className="text-ink-100">AI Engine Setup</strong> to detect your hardware & Ollama, or jump straight into a studio.
              </p>
              <div className="mt-5 grid gap-2">
                <Button size="lg" onClick={() => { try { if (user) { apiUpdatePurpose(purpose); refreshUser(); } } catch { /* noop */ } toast("success", "Studio ready", "Pollinations connected · unlimited local usage."); nav("/engine"); }}>Open AI Engine Setup</Button>
                <Button size="lg" variant="outline" onClick={() => { try { if (user) { apiUpdatePurpose(purpose); refreshUser(); } } catch { /* noop */ } nav("/dashboard"); }}>Go to Dashboard</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// tiny shims to keep this file self-contained
import { useApp as useAppSafe } from "../state/store";
import { api as apiObj } from "../server/api";
function apiUpdatePurpose(purpose: string | null) { try { apiObj.completeOnboarding(purpose); } catch { /* noop */ } }
