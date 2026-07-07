# TRINETRA

TRINETRA is a 100% client-side, deterministic replay of the 2026 Strait of Hormuz
crisis for India's crude supply chain: signal feed → exposure-graph re-score → option
cards → Decision Charter (LLM proposer, **zero-LLM** critic, deterministic arbiter) →
hash-chained audit trail. Every number carries provenance (R/E/S → LIVE/CACHED/SYNTH),
every replay is byte-identical, and the whole demo runs in airplane mode.

## Quickstart

```bash
npm install        # once, on a machine with registry access
npm run dev        # Vite dev server
npm run build      # typecheck + production bundle → dist/
npm run check      # deterministic self-checks + integration checks
```

`npm run check` needs **only Node 22+** (22.6–22.17 via the bundled
`--experimental-strip-types` flag; 22.18+ strips types by default). It imports the
TypeScript engines directly — no `npm install`, no network, no build step.

Controls in the app: **SPACE** play/pause, **←/→** seek by event. The play loop is
presentation-only — the interval advances *sim* time; wall clock never touches a
derivation.

## Repo map

```
CONTRACTS.md            frozen module signatures + determinism rules (read first)
data/*.json             all real-world data (events, graph, grades, sanctions,
                        calibration, spot cargoes, charter) — every leaf has
                        prov (R|E|S) + source + as_of
src/contracts/          types.ts + zod schemas (single source of truth)
src/engine/replay.ts    pure event replay (applyNext / applyUntil)
src/engine/scenario.ts  rescore: shocks → node/edge status, cover-days, gap_kbd
src/engine/options.ts   option-card generator across 5 levers
src/engine/charter/     propose (cached LLM text) · criticize (pure validators,
                        zero LLM) · arbitrate (severity lattice) · audit (hash chain)
src/lib/                store, canonical JSON + sha256, fmt, geo projection,
                        pipeline (engine composition — the only place engines meet)
src/components/         MapView (hand-authored SVG map) + panels/*
src/cache/              build-time LLM cache (the ONLY source of LLM text)
scripts/check.mjs       the check suite (75 checks)
docs/                   plan, beats spec (+ observed-behavior appendix), provenance
```

## Data provenance

Structural knowledge (graph, assays, port limits) cites pre-2019 sources; live-feed
style data (events, prices) is scenario data for 2026 — the two are never mixed.
Every value ships with `prov` (`R` real / `E` estimated / `S` synthetic), a `source`,
and an `as_of` date; the UI renders these as LIVE/CACHED/SYNTH chips. Synthetic data
is never upgraded. See `docs/data-provenance.md`.

## No network at runtime

The app makes zero network calls: data enters via static JSON imports, LLM narration
comes from `src/cache/llm-cache.json`, hashes use WebCrypto. It runs from `file://`
or any static host, offline.

## Regenerating the LLM cache

Proposer rationales and arbiter memos are generated **at build time** by
`node scripts/generate-llm-cache.mjs`, which accepts Anthropic (`ANTHROPIC_API_KEY`),
NVIDIA NIM (`NVIDIA_API_KEY`, optional `NVIDIA_MODEL`), or Bedrock (`AWS_*`) credentials
via env. Cache misses degrade to a visible `[rationale pending — cache miss]` template —
never a network call. The runtime app stays 100% offline regardless of which provider
generated the cache.

## Sandbox note (why dist/ is not committed)

This repo was assembled in an environment where the npm registry is blocked, so
`node_modules/` was never installed and `dist/` was never built here. On any normal
machine, `npm install && npm run build` produces `dist/` in one step; `npm run check`
already passes (75/75) with plain Node and is the source of truth for engine
correctness. `npm install && npm run build` has since been verified clean on a
normal machine (Node 22, zero type errors) and `dist/` builds in one step.
