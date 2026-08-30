#!/usr/bin/env node
/**
 * AI Creative Studio — Local AI Bridge (desktop agent)
 * ----------------------------------------------------
 * Browsers cannot read real CPU/GPU/RAM/disk or control processes. This
 * zero-dependency Node agent provides REAL OS data and CORS-free Ollama
 * control to the web app.
 *
 *   node local-bridge.mjs        → http://127.0.0.1:8788
 *
 * Security: binds to 127.0.0.1 ONLY. Sends no secrets anywhere. Relays only
 * to Ollama and reads OS info — never downloads or executes unknown code.
 */
import http from "node:http";
import os from "node:os";
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";

const PORT = process.env.BRIDGE_PORT ?? 8788;
const OLLAMA = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

function cpus() {
  const list = os.cpus();
  return { name: list[0]?.model?.trim() ?? "unknown", cores: list.length, threads: list.length };
}

function gpus() {
  return new Promise((resolve) => {
    const platform = process.platform;
    const done = (g) => resolve(g);
    if (platform === "win32") {
      execFile("wmic", ["path", "win32_videocontroller", "get", "name,adapterram,driverversion", "/format:csv"], { timeout: 6000 }, (e, out) => {
        if (e) return done([]);
        const rows = out.trim().split("\n").slice(1).map((l) => l.trim()).filter(Boolean);
        done(rows.map((r) => {
          const parts = r.split(",");
          const name = parts[2] ?? "unknown";
          const ram = Number(parts[1]);
          return { vendor: /nvidia/i.test(name) ? "NVIDIA" : /amd|radeon/i.test(name) ? "AMD" : /intel/i.test(name) ? "Intel" : "unknown", name: name.trim(), vramMB: ram > 0 ? Math.round(ram / 1e6) : null, driver: parts[3] ?? null };
        }));
      });
    } else if (platform === "darwin") {
      execFile("system_profiler", ["SPDisplaysDataType"], { timeout: 8000 }, (e, out) => {
        if (e) return done([]);
        const name = out.match(/Chipset Model: (.+)/)?.[1]?.trim() ?? "Apple GPU";
        const vram = out.match(/VRAM.*?: (\d+) (\w+)/);
        done([{ vendor: /apple/i.test(name) ? "Apple" : "unknown", name, vramMB: vram ? Number(vram[1]) * (/gb/i.test(vram[2]) ? 1024 : 1) : null, driver: null }]);
      });
    } else {
      execFile("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader,nounits"], { timeout: 6000 }, (e, out) => {
        if (e) return done([]);
        done(out.trim().split("\n").filter(Boolean).map((l) => {
          const [name, mem, drv] = l.split(",").map((s) => s.trim());
          return { vendor: "NVIDIA", name, vramMB: Number(mem) || null, driver: drv ?? null };
        }));
      });
    }
  });
}

async function disk() {
  try {
    const s = await statfs(os.homedir());
    return { totalMB: Math.round((s.blocks * s.bsize) / 1e6), freeMB: Math.round((s.bavail * s.bsize) / 1e6) };
  } catch { return { totalMB: null, freeMB: null }; }
}

const cors = (res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
};
const json = (res, code, obj) => { cors(res); res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/health") return json(res, 200, { ok: true, name: "acs-local-bridge", time: new Date().toISOString() });

  if (url.pathname === "/system") {
    const g = await gpus();
    const d = await disk();
    return json(res, 200, {
      os: `${os.type()} ${os.release()}`,
      platform: os.platform(),
      architecture: os.arch(),
      hostname: os.hostname(),
      cpu: cpus(),
      ram: { totalMB: Math.round(os.totalmem() / 1e6), availableMB: Math.round(os.freemem() / 1e6) },
      gpus: g,
      disk: d,
    });
  }

  if (url.pathname.startsWith("/ollama/")) {
    const path = url.pathname.replace("/ollama", "");
    try {
      const init = { method: req.method, headers: { "Content-Type": "application/json" } };
      if (req.method === "POST" || req.method === "DELETE") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        init.body = Buffer.concat(chunks).toString("utf8") || "{}";
      }
      const r = await fetch(`${OLLAMA}${path}`, init);
      cors(res);
      res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") ?? "application/json" });
      const body = r.body;
      if (!body) return res.end();
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) return res.end();
        res.write(Buffer.from(value));
      }
    } catch (e) {
      return json(res, 502, { error: `Ollama unreachable at ${OLLAMA}: ${e.message}` });
    }
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[acs-bridge] Local AI bridge running on http://127.0.0.1:${PORT}`);
  console.log(`[acs-bridge] Ollama relay → ${OLLAMA}`);
  console.log(`[acs-bridge] Bound to loopback only. Refresh the studio and press "Check My System".`);
});
