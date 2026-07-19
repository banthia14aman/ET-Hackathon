# TRINETRA — an AI-assisted rules engine with constitutional-AI guardrails

> **TRINETRA uses AI for sense-making and constitutional auditing, deterministic logic for
> scoring, and humans for final approval.**

TRINETRA is a 100% client-side decision engine for India's crude supply chain, demonstrated on
a deterministic replay of the 2026 Strait of Hormuz crisis. It is an **AI-assisted rules
engine**: a large language model does the *sense-making* (reading messy human text into
structured facts) and the *constitutional auditing* (flagging rule gaps) — but a deterministic
core does all the *scoring*, and a human gives *final approval*. Every step is hash-chained and
byte-identical on replay; every number carries provenance (R/E/S → LIVE/CACHED/SYNTH).

## Architecture — where each tool is allowed to act

```
                    ┌─────────────────── the LLM is walled off from scoring ───────────────────┐
unstructured   ①    │  ②  strict schemas          ③  DETERMINISTIC             ④  advisory,     │   ⑤
operator  ─▶ AI ────┼─▶  + domain rules   ─▶  rescore → options → propose  ─▶  read-only    ─▶  │─▶ HUMAN
   text   sense-    │    VALIDATION GATE       → criticize (ZERO LLM)          AI RULE AUDIT     │   APPROVAL
          making    │    (rejects bad fields)   → arbitrate (lattice)         (rule gaps,        │  (logged)
        (advisory)  └───────────────────────── → hash-chained audit ─────────  missing data)  ──┘
```

1. **AI sense-making (advisory).** The LLM extracts *candidate* facts from free text — shocks,
   Brent, cargo offers, charter changes. It is asked for strict JSON and told never to score.
2. **Deterministic validation gate.** Every candidate field is checked against a **strict Zod
   schema** *and* **domain rules** over the real data (known chokepoints/grades/refineries,
   plausible ranges, charter bounds). Anything that fails is **dropped with a reason and never
   reaches scoring** — the LLM cannot smuggle a bad value (or an extra `score` key) past it.
3. **Deterministic scoring (authoritative).** The validated facts feed the same pure engine as
   the replay: `rescore → generateOptions → propose → criticize (zero-LLM) → arbitrate`. **The
   LLM sets no score.**
4. **AI constitutional audit (advisory, read-only).** After scoring, the LLM reviews the
   decision for **rule gaps, missing data, and unsupported assumptions** — advisory notes that
   are structurally incapable of changing any score or status.
5. **Human approval.** A decision **brief** states, in plain language, that the scoring is
   deterministic and requires human sign-off; approval is a logged human action.

Every one of these steps — extraction+validation, each scoring stage, the AI audit, and the
human approval — is appended to a **SHA-256 hash chain** (`verifyChain` re-walks it). Try it
in the app: **`AI ASSIST ✦`** in the header (there's a "⚠ Hallucination test" example that
shows the validation gate rejecting `Brent 9000`, a 200-day floor, and a made-up grade).

## Quickstart

```bash
npm install        # once, on a machine with registry access
npm run dev        # Vite dev server
npm run build      # typecheck + production bundle → dist/
npm run check      # deterministic self-checks + integration checks (82/82)
```

`npm run check` needs **only Node 22+** (22.6–22.17 via the bundled
`--experimental-strip-types` flag; 22.18+ strips types by default). It imports the TypeScript
engines directly — no `npm install`, no network, no build step.

Controls in the app: **SPACE** play/pause, **←/→** seek by event, **AI ASSIST ✦** for the
AI-assisted decision flow. The play loop is presentation-only — the interval advances *sim*
time; wall clock never touches a derivation.

## Repo map

```
CONTRACTS.md            frozen module signatures + determinism rules (read first)
data/*.json             all real-world data — every leaf has prov (R|E|S) + source + as_of
src/contracts/          types.ts + zod schemas (single source of truth; strict AI-intake schemas)
src/engine/replay.ts    pure event replay (applyNext / applyUntil)
src/engine/scenario.ts  rescore: shocks → node/edge status, cover-days, gap_kbd
src/engine/options.ts   option-card generator across 5 levers
src/engine/charter/     propose (cached LLM text) · criticize (pure validators, zero LLM) ·
                        arbitrate (severity lattice) · audit (hash chain)
src/engine/ai/          AI-ASSIST layer (the only non-deterministic, network-capable code):
                        extract (LLM sense-making) · validate (deterministic gate) ·
                        ruleAudit (LLM constitutional audit) · brief (deterministic)
src/lib/                store, canonical JSON + sha256, fmt, geo, pipeline (engine composition;
                        computeFromText = the AI-assisted flow; approveDecision = human sign-off)
src/components/         MapView + panels/* + AiAssistPanel (the AI-assisted decision UI)
src/cache/              build-time LLM cache (the source of LLM proposer/memo text)
scripts/check.mjs       the check suite (82 checks)
docs/                   plan, beats, provenance, ml-architecture, DEFENSE-STUDY-GUIDE, deck
```

## Determinism vs. the AI-assist layer

The **derivation path stays byte-identical and offline**: `src/engine/*` (except `ai/`) and
`src/lib/*` contain no wall clock, no randomness, no network — `npm run check` scans for and
forbids exactly that, and proves replay reproduces identical audit hashes.

`src/engine/ai/*` is the **explicitly non-deterministic AI-assist layer** and is excepted from
that scan (a network call to a live model is the point). It is walled off from scoring: its
*only* influence is (a) *candidate* facts that must survive the deterministic validation gate,
and (b) *advisory* audit notes that can change nothing. So the guarantees hold precisely:
**given the validated facts, scoring and its audit hashes are byte-identical.**

**Live vs. offline.** In the browser the AI layer is **live by default**: extraction, the
constitutional audit, and the option-card narration call NVIDIA NIM
(`meta/llama-3.3-70b-instruct`) through a key-holding Cloudflare Worker
(`infra/trinetra-llm`) — the browser never sees an API key. A **record-replay transcript**
(`src/engine/ai/llm.ts`) records each live completion keyed by its request content, so
identical state replays the recorded text instead of re-calling the model: *a live model makes
the call; the record replays byte-identically.* Every live path degrades to a deterministic
offline stand-in (and the build-time cache) on failure or in airplane mode — set
`VITE_AI_LIVE=0` to force offline. Node (`npm run check`) is always offline. Either way the
guardrails — strict schema + rules on intake, read-only on audit, human approval — are identical.

## Data provenance

Structural knowledge (graph, assays, port limits) cites pre-2019 sources; live-feed-style data
(events, prices) is 2026 scenario data — the two are never mixed. Every value ships with `prov`
(`R` real / `E` estimated / `S` synthetic), a `source`, and an `as_of` date; the UI renders
these as LIVE/CACHED/SYNTH chips, and `npm run check` enforces that every leaf carries all
three. Synthetic data is never upgraded. See `docs/data-provenance.md`.

## Regenerating the build-time LLM cache

Proposer rationales and arbiter memos are generated **at build time** by
`node scripts/generate-llm-cache.mjs` (Anthropic `ANTHROPIC_API_KEY`, NVIDIA NIM
`NVIDIA_API_KEY`/`NVIDIA_MODEL`, or Bedrock `AWS_*`). Cache misses degrade to a visible
template — never a runtime network call. This is separate from the AI-assist layer above, which
is an optional *runtime* capability.

## Docs

`docs/TRINETRA-explained.md` (how it works), `docs/ml-architecture.md` (right tool per layer),
`docs/DEFENSE-STUDY-GUIDE.md` (what to study to defend every layer), `docs/data-provenance.md`
(R/E/S + KB freeze), `CONTRACTS.md` (frozen signatures), plus the pitch/deck materials.
