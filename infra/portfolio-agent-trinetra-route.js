// ─────────────────────────────────────────────────────────────────────────────
// TRINETRA live-LLM route — an ADDITIVE, backward-compatible change to your
// existing `aman-portfolio-agent` Cloudflare Worker. Your portfolio /chat route is
// untouched; this adds a separate POST /trinetra route that proxies to NVIDIA NIM.
//
// WHY a separate route: /chat hardcodes the portfolio system prompt, forces free
// OpenRouter models, and uses chatbot-tight rate limits — none of which fit TRINETRA.
// /trinetra takes TRINETRA's own messages and calls NVIDIA directly with your key.
//
// ── HOW TO INTEGRATE (in the portfolio-agent worker source) ──────────────────
// 1. Add TRINETRA's dev origin to ALLOWED_ORIGINS (prod already shares your origin
//    https://banthia14aman.github.io):
//        var ALLOWED_ORIGINS = [
//          "https://banthia14aman.github.io",
//          "http://localhost:4321",
//          "http://localhost:5173",   // <-- add: TRINETRA local dev (Vite)
//        ];
// 2. In `fetch(request, env)`, right AFTER the OPTIONS handling and BEFORE the
//    existing chat logic, add the route dispatch:
//        const url = new URL(request.url);
//        if (url.pathname === "/trinetra" || url.pathname.endsWith("/trinetra")) {
//          return handleTrinetra(request, env, origin);
//        }
// 3. Paste the two functions below (handleTrinetra + triRateLimited) into the module.
//    They reuse your existing cors() and json() helpers and your KV binding `env.RL`.
// 4. Add the secret(s) and deploy:
//        wrangler secret put NVIDIA_API_KEY        # paste your NVIDIA NIM key
//        # optional: wrangler secret put NVIDIA_MODEL   (defaults to the qwen model below)
//        wrangler deploy
//    (Or set them in Cloudflare dashboard → Workers → aman-portfolio-agent →
//     Settings → Variables and Secrets, then Deploy.)
//
// SECURITY NOTE: CORS only stops browsers from other origins — a raw `curl` can still
// hit /trinetra. The key never leaves the Worker, and triRateLimited caps per-IP usage
// (40/min, 300/day) to protect your NVIDIA credits. That's the pragmatic protection for
// a demo endpoint; raise/lower the caps as you like.
// ─────────────────────────────────────────────────────────────────────────────

var TRINETRA_MODEL_DEFAULT = "qwen/qwen3.5-397b-a17b"; // your build-cache bakeoff default

async function handleTrinetra(request, env, origin) {
  if (request.method !== "POST") return json({ error: "POST /trinetra only" }, 405, origin);
  if (!env.NVIDIA_API_KEY) {
    return json({ error: "TRINETRA live model not configured (set NVIDIA_API_KEY)." }, 503, origin);
  }
  if (env.RL) {
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    const over = await triRateLimited(env.RL, ip);
    if (over) return json({ error: over }, 429, origin);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "Bad JSON" }, 400, origin); }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) return json({ error: "No messages" }, 400, origin);
  for (const m of messages) {
    if (!["system", "user", "assistant"].includes(m.role)
      || typeof m.content !== "string" || m.content.length > 8000) {
      return json({ error: "Invalid message" }, 400, origin);
    }
  }

  const model = (typeof body.model === "string" && body.model) || env.NVIDIA_MODEL || TRINETRA_MODEL_DEFAULT;
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
  } catch (e) {
    return json({ error: "Upstream fetch failed" }, 502, origin);
  }
  if (!res.ok) {
    const detail = await res.text();
    console.log("nvidia error", res.status, detail.slice(0, 300));
    return json({ error: "Model momentarily unavailable.", status: res.status }, 502, origin);
  }
  const data = await res.json();
  // Reasoning models may prefix <think>…</think>; strip it so only the final answer is returned.
  const reply = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  return json({ reply, model }, 200, origin);
}

// Separate limiter (own KV namespace) so it never touches the portfolio /chat limits.
async function triRateLimited(kv, ip) {
  const now = Date.now();
  const mKey = `tri:${ip}:m:${Math.floor(now / 6e4)}`;
  const dKey = `tri:${ip}:d:${Math.floor(now / 864e5)}`;
  const [mRaw, dRaw] = await Promise.all([kv.get(mKey), kv.get(dKey)]);
  const mCount = (parseInt(mRaw, 10) || 0) + 1;
  const dCount = (parseInt(dRaw, 10) || 0) + 1;
  if (mCount > 40) return "Too many requests this minute — wait a moment.";
  if (dCount > 300) return "Daily limit for the TRINETRA demo endpoint reached.";
  await Promise.all([
    kv.put(mKey, String(mCount), { expirationTtl: 120 }),
    kv.put(dKey, String(dCount), { expirationTtl: 9e4 }),
  ]);
  return null;
}
