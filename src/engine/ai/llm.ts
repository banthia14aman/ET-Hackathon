// LIVE-LLM CLIENT with a RECORD-REPLAY transcript. Part of src/engine/ai/ — the ONLY
// network-capable engine layer (excepted from the determinism scan; see CLAUDE.md rule 1).
//
// The key insight that keeps "live LLM" and "auditable replay" compatible:
//   • at DECISION time a live model is called ONCE per unique (endpoint, model, messages)
//     and the response is RECORDED in this transcript, keyed by its content hash;
//   • any identical later call (seek back/forth, re-render, re-run in session) REPLAYS the
//     recorded text byte-identically instead of re-calling the model.
// The model is non-deterministic; the RECORD is not. Scoring never depends on this text.
//
// The endpoint is a Cloudflare Worker that holds the NVIDIA API key server-side
// (infra/trinetra-llm). The browser never sees a key; the URL below is public by design.
// In Node (npm run check) import.meta.env is undefined → live mode is off → the offline
// deterministic stand-ins run, so the check suite stays offline and byte-identical.

import { canonicalJson } from '../../lib/canonical';

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface LlmRecord { text: string; model: string; live: boolean; replayed: boolean }
export interface ChatOpts { model?: string; endpoint?: string; apiKey?: string; temperature?: number; maxTokens?: number }

export const DEFAULT_LLM_ENDPOINT = 'https://trinetra-llm.sampoornacrm.workers.dev';
/** Fast + reliable on NVIDIA NIM (the 397b bake-off default times out live). */
export const DEFAULT_LLM_MODEL = 'meta/llama-3.3-70b-instruct';

/** Resolve the live endpoint. undefined ⇒ live mode off (Node, or VITE_AI_LIVE=0). */
export function llmEndpoint(): string | undefined {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (!env) return undefined; // Node / check suite — never live
  if (env.VITE_AI_LIVE === '0') return undefined; // explicit kill switch
  return env.VITE_AI_ENDPOINT || DEFAULT_LLM_ENDPOINT;
}

// module-level session transcript: content-hash key → recorded completion
const transcript = new Map<string, LlmRecord>();

/** The recorded transcript (for export/inspection alongside the audit trail). */
export function llmTranscript(): Record<string, LlmRecord> {
  return Object.fromEntries(transcript);
}

/** djb2 over the canonical request — sync, cheap, and stable. (Not crypto: the key only
    dedupes/replays within the transcript; audit hashing stays SHA-256 elsewhere.) */
function transcriptKey(endpoint: string, model: string, messages: ChatMessage[]): string {
  const s = canonicalJson({ endpoint, messages, model });
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, '0') + ':' + s.length.toString(16);
}

/** Live chat completion with record-replay. Throws when live mode is off or the call fails —
    callers fall back to their deterministic offline stand-ins. */
export async function chatLive(messages: ChatMessage[], opts: ChatOpts = {}): Promise<LlmRecord> {
  const endpoint = opts.endpoint ?? llmEndpoint();
  if (!endpoint) throw new Error('live LLM disabled');
  const model = opts.model ?? DEFAULT_LLM_MODEL;

  const key = transcriptKey(endpoint, model, messages);
  const hit = transcript.get(key);
  if (hit) return { ...hit, replayed: true };

  // one retry on transient upstream failures (NIM free-tier 429s / hiccups); 25s cap per
  // attempt so a hung upstream can never stall the UI — callers fall back on final throw.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: AbortSignal.timeout(25_000),
        headers: {
          'content-type': 'application/json',
          ...(opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {}), // worker needs no client key
        },
        body: JSON.stringify({
          model, messages,
          temperature: opts.temperature ?? 0.2,
          max_tokens: opts.maxTokens ?? 1024,
        }),
      });
      if (!res.ok) throw new Error(`llm HTTP ${res.status}`);
      const j = await res.json() as { model?: string; reply?: string; choices?: { message?: { content?: string } }[] };
      // normalize: OpenAI shape (worker + NIM) or the worker's earlier {reply} shape
      const text = String(j.choices?.[0]?.message?.content ?? j.reply ?? '').trim();
      if (!text) throw new Error('empty completion');

      const rec: LlmRecord = { text, model: j.model ?? model, live: true, replayed: false };
      transcript.set(key, rec);
      return rec;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}
