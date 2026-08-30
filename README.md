# 🎨 AI Creative Studio

> **Create. Generate. Imagine.** — One unified AI studio for videos, images, posters and character content.
> Built by **[ITCyber Technologies Private Limited](https://www.itcyber.in)** · [connect@itcyber.in](mailto:connect@itcyber.in)

```
        /\
   /\  /  \  /\        AI CREATIVE STUDIO
  /  \/    \/  \       local-first · free engines · real AI
```

A free, local-first AI creation platform. No sign-up, no credit limits, runs on your laptop. Connect free AI engines (Pollinations needs **no key at all**) or your own local Ollama, and generate real images, videos, posters and character content.

---

## 📦 Quick Start

```bash
npm install        # install dependencies
npm run dev        # start dev server  →  http://localhost:5173
npm run build      # production build →  dist/
```

That's it. Open the app — you're auto-logged into the local workspace.

### Optional: Local Bridge (real hardware detection)

Browsers can't read real GPU VRAM / RAM / disk. For **true machine data** and CORS-free Ollama control, run the zero-dependency bridge:

```bash
node local-bridge.mjs    # → http://127.0.0.1:8788
```

Then in **AI Engine Setup** press **Check My System**.

---

## 🏗️ Architecture

```
┌─────────────────────────── WEB FRONTEND (React + Vite + Tailwind) ───────────────────────────┐
│  Studios · Library · Providers · AI Engine Setup · Admin                                     │
│                       │                                                                       │
│                 api facade (Zod-validated) — auth · row-level ownership · server-side pricing│
│        ┌──────────────┼───────────────────────┬───────────────────────┐                      │
│   CreditEngine   ProviderRouter          Job Worker            AIProvider adapters           │
│   reserve→commit   capability→health→     queued→generating     pollinations · ollama ·      │
│   →refund (mutex)  free-first routing     →completed (SSE bus)  huggingface · openrouter ·   │
│                                            + auto fallback       groq · nvidia · replicate · │
│                                                                  luma · deepseek · custom    │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  db (localStorage) · blobStore (IndexedDB) · vault (AES-GCM encrypted keys)                  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
              │                                              │
              ▼ (optional)                                   ▼
   LOCAL AI BRIDGE (node local-bridge.mjs)         CLOUD FREE-TIER APIs
   real OS/GPU/RAM/disk + Ollama relay             (keys AES-GCM encrypted)
              │
              ▼
   OPERATING SYSTEM → OLLAMA → LOCAL MODELS
```

### Generation pipeline (real, no fakes)

```
validate DTO → select route (capability + free-first) → reserve credits
  → job queued → adapter.generate (real API call, stage callbacks)
  → save asset → commit/refund credits → notify
```

If no provider supports the task, the studio shows an **inline setup wizard** — never a fake result. Progress is honest: providers that don't expose progress show `queued → generating → completed`, not invented percentages.

---

## 🤖 AI Providers (all free tiers)

| Provider | What it does | Get a free key |
|---|---|---|
| **Pollinations** | FLUX images + GPT text | **No key needed** |
| **Ollama** | Private local text/vision | [ollama.com/download](https://ollama.com/download) |
| **Hugging Face** | Images, video, text, audio | [HF tokens](https://huggingface.co/settings/tokens) |
| **OpenRouter** | 300+ models, `:free` auto-selected | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Google Gemini** | Text, vision, image | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq / Cerebras / DeepSeek / Mistral / Together** | Fast text | each console (free tier) |
| **NVIDIA NIM** | LTX Video, Llama | [build.nvidia.com](https://build.nvidia.com) (1000 free credits) |
| **Replicate** | LTX/Wan/OmniHuman video | [replicate.com](https://replicate.com/account/api-tokens) (free daily) |
| **Luma** | Cinematic video | [lumalabs.ai](https://lumalabs.ai/dream-machine/api) (free monthly) |
| **Custom** | Any OpenAI-compatible `/v1` | your endpoint |

Connect via **AI Providers** → *Login with provider* → paste key → **system auto-selects the best free model**.

---

## 🖥️ AI Engine Setup (`/engine`)

- **Check My System** — 10-step real detection (OS, CPU, RAM, GPU, VRAM, disk, Ollama, models, providers, recommendations). Anything the browser can't know is shown as *unknown* with an honest warning — never faked.
- **Ollama manager** — detect via `/api/tags`, install models with **byte-level real download progress**, remove, and test each model (real `/api/generate`; vision models get a real image input).
- **Hardware recommendations** — Best / Good / Experimental labels computed from your detected RAM/VRAM/disk, with disk-space protection.
- **Diagnostics** — run real checks over Ollama, bridge, providers, storage, queue and security.

---

## 📁 Project Structure

```
src/
  lib/          types.ts (domain) · utils.ts (crypto + helpers)
  server/
    db.ts          persistence · blobStore · AES-GCM vault · seed
    auth.ts        sessions (PBKDF2) · CreditEngine
    api.ts         API facade (Zod DTOs, ownership, pricing)
    local.ts       machine detection · Ollama manager · recommendations · vision
    ai/
      providers.ts  15 provider adapters (AIProviderAdapter interface)
      router.ts     ProviderRouter · fallback chains · job worker
      simulator.ts  admin-gated on-device mock (labelled SIMULATED)
  state/store.tsx   global app state + toasts
  components/       ui kit · shell · create-bits · gen-art
  pages/            landing · dashboard · 4 studios · image editor · library
                    · providers · engine · credits/settings · admin
local-bridge.mjs    zero-dependency desktop agent (real OS data + Ollama relay)
```

---

## 🔒 Security

- API keys: **AES-GCM encrypted at rest**, masked in UI, never logged or returned.
- Passwords: PBKDF2-SHA256, 60k iterations, per-user salt.
- Row-level ownership on every resource; admin routes guarded.
- Uploads validated by MIME + extension + size.
- Paid providers & paid fallback are **OFF by default** — no silent spend.

## ⚙️ Environment

No env vars required — the app is fully local. Platform keys are optional and user-supplied. See `.env.example` for the production (server) topology.

## ⚠️ Known Limitations

- Full GPU VRAM / exact RAM / disk need the optional `local-bridge.mjs`.
- Ollama is text/vision-only — it can't generate images/video (the UI says so honestly).
- Cloud video generation depends on each provider's free tier and can be slow (honest `MODEL_LOADING` status is shown).

---

## 👨‍💻 About the Creator

**ITCyber Technologies Private Limited** — we design, engineer and maintain AI products, web applications and business automation. This is the same studio we run internally, shared free.

- 🌐 Website: [www.itcyber.in](https://www.itcyber.in)
- ✉️ Email: [connect@itcyber.in](mailto:connect@itcyber.in)
- Services: AI Products · Web & Apps · Business Automation · Consulting

> Kuch alag banana hai? **Ek mail se shuru karte hain.** — connect@itcyber.in

© ITCyber Technologies Private Limited
