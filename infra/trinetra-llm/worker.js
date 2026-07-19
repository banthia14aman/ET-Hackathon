// Standalone TRINETRA live-LLM proxy — a tiny Cloudflare Worker that holds the NVIDIA key
// server-side and forwards chat completions to NVIDIA NIM. TRINETRA's browser calls this; the
// key never reaches the client. Your portfolio worker stays untouched.
//
// Deploy (from this folder):
//   npx wrangler deploy
//   npx wrangler secret put NVIDIA_API_KEY      # paste your NVIDIA NIM key
//   # optional: npx wrangler secret put NVIDIA_MODEL
// URL becomes: https://trinetra-llm.<your-subdomain>.workers.dev  (subdomain = amanbanthia)

const ALLOWED_ORIGINS = [
  "https://banthia14aman.github.io", // TRINETRA prod (GitHub Pages project page)
  "http://localhost:5173",           // TRINETRA local dev (Vite)
];
// Fast + high-quality on NVIDIA NIM. (qwen3.5-397b, the build-cache default, 524-timeouts live.)
const MODEL_DEFAULT = "meta/llama-3.3-70b-instruct";

function cors(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
function json(obj, status, origin) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...cors(origin) } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { headers: cors(origin) });
    if (request.method !== "POST") return json({ error: "POST only" }, 405, origin);
    if (!env.NVIDIA_API_KEY) return json({ error: "NVIDIA_API_KEY not set on this Worker." }, 503, origin);

    // Light per-IP rate limit — only if you bind a KV namespace named RL; skipped otherwise.
    if (env.RL) {
      const ip = request.headers.get("CF-Connecting-IP") || "anon";
      const key = `tri:${ip}:${Math.floor(Date.now() / 6e4)}`;
      const n = (parseInt(await env.RL.get(key), 10) || 0) + 1;
      if (n > 60) return json({ error: "Rate limit — wait a moment." }, 429, origin);
      await env.RL.put(key, String(n), { expirationTtl: 120 });
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400, origin); }
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json({ error: "No messages" }, 400, origin);
    for (const m of messages) {
      if (!["system", "user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 8000) {
        return json({ error: "Invalid message" }, 400, origin);
      }
    }
    const model = (typeof body.model === "string" && body.model) || env.NVIDIA_MODEL || MODEL_DEFAULT;

    let res;
    try {
      res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { authorization: `Bearer ${env.NVIDIA_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          temperature: typeof body.temperature === "number" ? body.temperature : 0.2,
          max_tokens: typeof body.max_tokens === "number" ? Math.min(body.max_tokens, 2048) : 1024,
        }),
      });
    } catch {
      return json({ error: "Upstream fetch failed" }, 502, origin);
    }
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: "Model unavailable", status: res.status, detail: detail.slice(0, 200) }, 502, origin);
    }
    const data = await res.json();
    // Reasoning models may prefix <think>…</think>; strip it so only the final answer returns.
    const reply = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    // OpenAI-compatible shape so TRINETRA's existing adapters (choices[0].message.content) consume it.
    return json({ model, choices: [{ message: { role: "assistant", content: reply } }] }, 200, origin);
  },
};
