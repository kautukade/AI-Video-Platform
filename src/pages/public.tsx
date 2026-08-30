import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Boxes, Check, Clapperboard, Coins, Cpu, ExternalLink, Flower2, Frame, Globe, Image as ImageIcon, Key, Mail, Plug,
  Server, ShieldCheck, Sparkles, Video, Zap,
} from "lucide-react";
import { Button } from "../components/ui";

function PublicNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-solar-500/40 bg-ink-850">
            <svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 23V9l7 8 7-8v14" stroke="#FFC14D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <span className="leading-tight">
            <span className="font-display block text-[15px] font-bold text-ink-50">AI Creative Studio</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-ink-500">by ITCyber Technologies</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1.5">
          <Link to="/features" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-50">Features</Link>
          <Link to="/about" className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-300 transition-colors hover:text-ink-50">About</Link>
          <Link to="/dashboard"><Button size="sm">Open Studio</Button></Link>
        </nav>
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
        <span>Built by <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="font-bold text-ink-300 hover:text-solar-300">ITCyber Technologies Pvt. Ltd</a></span>
        <span className="flex items-center gap-3 font-mono text-[11px] sm:ml-auto">
          <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="hover:text-solar-300">www.itcyber.in</a>
          <span className="text-ink-700">|</span>
          <a href="mailto:connect@itcyber.in" className="hover:text-solar-300">connect@itcyber.in</a>
        </span>
      </div>
      <div className="border-t border-ink-800/60 py-3 text-center font-mono text-[10.5px] text-ink-600">
        © {new Date().getFullYear()} ITCyber Technologies Private Limited · local-first · encrypted credentials
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <PublicNav />

      {/* Hero — opens with the studios, not a generic headline */}
      <section className="relative overflow-hidden border-b border-ink-800 bg-grid">
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[700px] -translate-x-1/2 rounded-full bg-solar-500/7 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14">
          <div className="max-w-2xl">
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-solar-400">create · generate · imagine</div>
            <h1 className="font-display mt-3 text-[40px] font-bold leading-[1.05] tracking-tight text-ink-50 sm:text-[56px]">
              One studio for<br />AI videos, images,<br />posters & characters.
            </h1>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-ink-400">
              Free engines included — <strong className="text-ink-200">Pollinations</strong> (no key), your local <strong className="text-ink-200">Ollama</strong>, and free tiers of Hugging Face, Replicate, NVIDIA NIM, Luma & more. No sign-up, runs on your laptop.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/dashboard"><Button size="lg">Start Creating <ArrowRight size={16} /></Button></Link>
              <Link to="/features"><Button size="lg" variant="outline">Explore Features</Button></Link>
            </div>
            <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-500">no sign-up · runs 100% on your laptop · unlimited</p>
            <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-850/80 px-3 py-1 text-[11.5px] text-ink-400">
              <span className="h-1.5 w-1.5 rounded-full bg-jade-400" />
              Crafted by <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="font-bold text-solar-300 hover:text-solar-200">ITCyber Technologies Pvt. Ltd</a>
            </p>
          </div>

          <div className="stagger mt-12 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: Video, title: "AI Video", desc: "Text, image & character → video", to: "/create/video" },
              { icon: ImageIcon, title: "AI Image", desc: "FLUX & diffusion, free", to: "/create/image" },
              { icon: Frame, title: "AI Poster", desc: "Structured canvas editor", to: "/create/poster" },
              { icon: Clapperboard, title: "Character", desc: "Lip-synced presenter video", to: "/create/character" },
            ].map((c) => (
              <Link key={c.to} to={c.to} className="panel group p-5 transition-all hover:-translate-y-1 hover:border-solar-500/40">
                <c.icon size={22} className="text-solar-400" />
                <div className="mt-3 text-[15px] font-bold text-ink-50">{c.title}</div>
                <div className="mt-0.5 text-[12px] text-ink-400">{c.desc}</div>
                <div className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-solar-300 opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight size={12} /></div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ITCyber ad banner (top, after hero) */}
      <section className="relative mt-16 overflow-hidden border-y-4 border-ink-950 bg-solar-400">
        <div className="itc-marquee select-none border-b-2 border-ink-950/80 bg-ink-950 py-2.5">
          {[0, 1].map((n) => (
            <span key={n} className="flex shrink-0 items-center gap-8 pr-8 font-mono text-[12px] font-bold uppercase tracking-[0.22em] text-solar-300">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} className="flex items-center gap-8">
                  <span>ITCyber Technologies Pvt. Ltd.</span><span className="text-solar-500">✦</span>
                  <span>www.itcyber.in</span><span className="text-solar-500">✦</span>
                  <span>connect@itcyber.in</span><span className="text-solar-500">✦</span>
                  <span>AI · Web · Automation</span><span className="text-solar-500">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 animate-pulse rounded-full bg-ink-950" />
            <span className="font-mono text-[11.5px] font-bold uppercase tracking-[0.3em] text-ink-950/80">Made by the team behind this studio</span>
          </div>
          <h2 className="itc-headline mt-6 text-ink-950">
            ITCYBER<br /><span className="itc-outline">TECHNOLOGIES</span>
          </h2>
          <p className="mt-2 font-mono text-[13px] font-bold uppercase tracking-[0.35em] text-ink-950/70">— Private Limited —</p>
          <p className="mt-7 max-w-2xl text-[16px] font-semibold leading-relaxed text-ink-950/85 sm:text-[18px]">
            Is poore AI Creative Studio ko design, engineer aur maintain kiya hai <strong className="font-extrabold text-ink-950">ITCyber Technologies</strong> ne.
            Aapko bhi custom AI product, website ya business automation chahiye? <strong className="font-extrabold underline decoration-4 decoration-ink-950/40 underline-offset-4">Humse baat karo.</strong>
          </p>
          <div className="mt-10 space-y-4">
            <a href="mailto:connect@itcyber.in" className="group flex flex-col gap-1 rounded-2xl border-4 border-ink-950 bg-ink-950 px-6 py-5 shadow-[8px_8px_0_0_rgba(10,13,19,0.9)] transition-all hover:-translate-y-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-solar-400 text-ink-950"><Mail size={24} strokeWidth={2.4} /></span>
                <span>
                  <span className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.28em] text-solar-400">Email karo — 24 ghante me reply</span>
                  <span className="itc-contact block text-solar-300">connect@itcyber.in</span>
                </span>
              </span>
              <ArrowRight size={30} strokeWidth={2.4} className="hidden shrink-0 text-solar-400 transition-transform group-hover:translate-x-2 sm:block" />
            </a>
            <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="group flex flex-col gap-1 rounded-2xl border-4 border-ink-950 bg-solar-300 px-6 py-5 shadow-[8px_8px_0_0_rgba(10,13,19,0.9)] transition-all hover:-translate-y-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-950 text-solar-300"><Globe size={24} strokeWidth={2.4} /></span>
                <span>
                  <span className="block font-mono text-[10.5px] font-bold uppercase tracking-[0.28em] text-ink-950/60">Website visit karo</span>
                  <span className="itc-contact block text-ink-950">www.itcyber.in</span>
                </span>
              </span>
              <ExternalLink size={30} strokeWidth={2.4} className="hidden shrink-0 text-ink-950 sm:block" />
            </a>
          </div>
          <div className="mt-10 flex flex-col gap-6 border-t-2 border-ink-950/20 pt-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2.5">
              {["AI Products", "Web & Apps", "Business Automation", "Consulting"].map((s) => (
                <span key={s} className="rounded-full border-2 border-ink-950 px-4 py-1.5 font-mono text-[11.5px] font-bold uppercase tracking-wider text-ink-950 transition-colors hover:bg-ink-950 hover:text-solar-300">{s}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              <a href="mailto:connect@itcyber.in" className="inline-flex items-center gap-2 rounded-xl border-4 border-ink-950 bg-ink-950 px-7 py-3 text-[15px] font-extrabold text-solar-300 transition-all hover:-translate-y-0.5"><Mail size={17} /> Start a Project</a>
              <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border-4 border-ink-950 px-7 py-3 text-[15px] font-extrabold text-ink-950 transition-all hover:-translate-y-0.5 hover:bg-solar-300"><Globe size={17} /> www.itcyber.in</a>
            </div>
          </div>
          <p className="mt-8 font-mono text-[11.5px] font-semibold uppercase tracking-[0.18em] text-ink-950/60">© {new Date().getFullYear()} ITCyber Technologies Private Limited · Crafted in-house</p>
        </div>
      </section>

      {/* Provider strip */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="font-display text-[26px] font-bold tracking-tight text-ink-50">Free AI engines, plug & play</h2>
        <p className="mt-2 max-w-xl text-[13.5px] text-ink-400">Connect karte hi system best free model automatic select kar leta hai.</p>
        <div className="stagger mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Flower2, name: "Pollinations", desc: "Free FLUX images & GPT text · no account, no key" },
            { icon: Server, name: "Ollama (Local)", desc: "Free private inference on your own laptop" },
            { icon: Boxes, name: "Hugging Face", desc: "Free-tier images, video, text, audio" },
            { icon: Plug, name: "OpenRouter", desc: "300+ models · :free variants auto-selected" },
            { icon: Cpu, name: "NVIDIA NIM", desc: "Free NIM credits · LTX Video, Llama" },
            { icon: Video, name: "Replicate & Luma", desc: "Free daily / monthly video generation" },
          ].map((p) => (
            <div key={p.name} className="panel-flat flex items-start gap-3.5 p-5 transition-colors hover:border-ink-500">
              <p.icon size={20} className="mt-0.5 shrink-0 text-jade-400" />
              <div>
                <div className="text-[14.5px] font-bold text-ink-50">{p.name}</div>
                <div className="mt-0.5 text-[12.5px] leading-snug text-ink-400">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center"><Link to="/dashboard"><Button size="lg">Open the Studio <ArrowRight size={16} /></Button></Link></div>
      </section>

      <PublicFooter />
    </div>
  );
}

export function Features() {
  const features = [
    { icon: Video, title: "AI Video Studio", desc: "Script builder, scene builder, camera & style controls. Real video from Replicate, Luma, NIM or Hugging Face free tiers." },
    { icon: ImageIcon, title: "AI Image Studio", desc: "Aspect ratios, styles, quality, seeds, batches. FLUX via Pollinations (no key) or connected providers." },
    { icon: Frame, title: "AI Poster Studio", desc: "Structured canvas editor with 12 presets. Text is real design data, not image-rendered gibberish." },
    { icon: Clapperboard, title: "Character Studio", desc: "Upload a face, write a script — OmniHuman lip-syncs it with free SpeechT5 narration." },
    { icon: Cpu, title: "AI Engine Setup", desc: "Real hardware detection, Ollama model manager with true download progress, hardware-based recommendations." },
    { icon: ShieldCheck, title: "Security First", desc: "AES-GCM encrypted keys, PBKDF2 passwords, row-level ownership, upload validation, no plaintext secrets." },
    { icon: Coins, title: "Unlimited Local", desc: "No credit limits in the local build. A full reserve→commit→refund ledger still tracks every run." },
    { icon: Zap, title: "Honest Progress", desc: "Real job statuses (queued→completed). No fake percentages — indeterminate states are labelled as such." },
    { icon: Sparkles, title: "Provider Router", desc: "Capability → health → free-preference routing with automatic fallback chains. Paid fallback needs consent." },
  ];
  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <PublicNav />
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-solar-400">features</div>
        <h1 className="font-display mt-2 text-[38px] font-bold tracking-tight text-ink-50">Everything you need to create</h1>
        <div className="stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="panel p-6 transition-all hover:-translate-y-1 hover:border-solar-500/40">
              <f.icon size={22} className="text-solar-400" />
              <h3 className="font-display mt-4 text-[17px] font-bold text-ink-50">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400">{f.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-center"><Link to="/dashboard"><Button size="lg">Start Creating <ArrowRight size={16} /></Button></Link></div>
      </section>
      <PublicFooter />
    </div>
  );
}

export function About() {
  return (
    <div className="min-h-screen bg-ink-950 text-ink-100">
      <PublicNav />
      <section className="mx-auto max-w-3xl px-5 py-16">
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-solar-400">about the creator</div>
        <h1 className="font-display mt-2 text-[38px] font-bold tracking-tight text-ink-50">ITCyber Technologies</h1>
        <p className="itc-dropcap mt-6 text-[15px] leading-relaxed text-ink-300">
          AI Creative Studio is designed, engineered and maintained by <strong className="text-ink-100">ITCyber Technologies Private Limited</strong>.
          We build AI products, web applications and business automation — and we use our own tools every day. This studio is the same platform we run internally, shared with you free to use on your own laptop.
        </p>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-300">
          Whether you need a custom AI tool, a website, or end-to-end automation for your business — one email is all it takes to start.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <a href="mailto:connect@itcyber.in" className="panel group flex items-center gap-4 p-5 transition-all hover:border-solar-500/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-solar-400/10 text-solar-300"><Mail size={20} /></span>
            <span><span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">email</span><span className="block text-[15px] font-bold text-ink-50">connect@itcyber.in</span></span>
          </a>
          <a href="https://www.itcyber.in" target="_blank" rel="noreferrer" className="panel group flex items-center gap-4 p-5 transition-all hover:border-jade-500/40">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-jade-500/10 text-jade-300"><Globe size={20} /></span>
            <span><span className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">website</span><span className="block text-[15px] font-bold text-ink-50">www.itcyber.in</span></span>
          </a>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

export function Onboarding() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5">
      <div className="panel max-w-md p-8 text-center">
        <Sparkles size={28} className="mx-auto text-solar-400" />
        <h1 className="font-display mt-4 text-[22px] font-bold text-ink-50">You're all set!</h1>
        <p className="mt-2 text-[13.5px] text-ink-400">The local workspace is ready. Connect a provider or start creating right away.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/engine"><Button variant="outline">AI Engine Setup</Button></Link>
          <Link to="/dashboard"><Button>Open Studio</Button></Link>
        </div>
      </div>
    </div>
  );
}
