# CLAUDE.md — TRINETRA

AI-powered energy supply-chain resilience demo for the ET Hackathon 2026.
Single-page, 100% client-side React app that deterministically replays the 2026
Strait of Hormuz crisis: signals → exposure-graph re-score → option cards →
Decision Charter (proposer → zero-LLM critic → arbiter) → hash-chained audit trace.

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — typecheck + production bundle (`dist/`)
- `npm run check` — deterministic self-checks (replay twice → identical hashes)
- `node scripts/generate-llm-cache.mjs` — regenerate proposer/memo cache (needs
  BEDROCK/ANTHROPIC creds via env; committed cache is a labeled placeholder until then)

## Architecture (read CONTRACTS.md first — signatures are FROZEN)
- `src/contracts/` — types.ts + zod schemas. Single source of truth. Change here = team decision.
- `src/lib/` — store (pub/sub + useSyncExternalStore), canonical JSON + sha256, fmt.ts (the ONLY number/timestamp formatter — never format inline).
- `src/engine/replay.ts` — pure: (cursor, bundle) → events. No store deps.
- `src/engine/scenario.ts` — rescore(graph, shocks, calibration) → ScenarioState (days-of-cover per refinery, gap_kbd).
- `src/engine/options.ts` — generateOptions(...) → OptionCard[] across 5 levers (stock_draw, divert_on_water, floating_storage, reroute, demand_side).
- `src/engine/charter/` — propose (cached LLM text), criticize (PURE FUNCTIONS ONLY — no LLM, ever), arbitrate (severity lattice: block→rejected, flag→conditional, else validated; async for crypto.subtle), audit (hash-chained entries).
- `src/engine/refinery_model.ts` — our OWN trained model (softmax regression, frozen weights in `data/refinery_model.json`, fit by `scripts/train-refinery-model.mjs`). Advisory crude-compatibility prediction (tier + confidence) on reroute cards; pure/deterministic inference. The zero-LLM critic stays the authority. See `docs/ml-architecture.md` for the "right tool per layer" story (rules for veto, our model for numbers, LLM only for prose).
- `src/lib/labels.ts` — presentation-only jargon map: internal ids/rule-codes/status enums → plain English. Engine strings are NEVER renamed; mapped at render time only, so checks + audit JSON stay byte-identical.
- `src/components/` — MapView (SVG, no tiles/tokens), panels/* (ticker, options, critic chips, charter, waterfall, stopwatch, provenance chips).
- `data/*.json` — all real-world data. Every leaf carries `prov: R|E|S` (Real-sourced / Estimated / Synthetic) + `source` + `as_of`. UI renders these as LIVE/CACHED/SYNTH chips.

## Hard rules (breaking these breaks the product's core claims)
1. **No network calls at runtime.** The demo must run in airplane mode. LLM text comes from `src/cache/`.
2. **No `Date.now()` / `Math.random()` in any derivation path.** Sim time (`ts_sim`) only. Byte-identical replay is a judged claim.
3. **The critic contains zero LLM.** Objections are computed facts `{article, evidence, severity}`; LLM only narrates elsewhere.
4. **Provenance is load-bearing.** Never ship a number without `prov/source/as_of`. Never upgrade S→R.
5. **One formatter.** All numbers/timestamps through `src/lib/fmt.ts` (`412 kb/d`, `$71.40/bbl`, `+$2.10/bbl`, `38 d`, `14:22Z · 19:52 IST`).
6. **KB freeze discipline:** structural knowledge must cite pre-2019 sources (see docs/data-provenance.md). Live-feed data is separate. Don't mix.

## Project context
- `docs/plan.md` — the full 7-day plan, judging-criteria strategy, verbatim pitch scripts, Q&A bank. Read before changing scope.
- `docs/brainstorm-brief.md` — why every decision was made (30 problems, 7 solution workstreams).
- `docs/credibility-slide.md` — sourced public quotes (Puri "60-60-60") + market-as-validator framing.
- Judging: Innovation 25%, Business Impact 25%, Technical Excellence 20%, Scalability 15%, UX 15%.
- Demo beats: (1) critic demotes Venezuelan Merey (TAN + OFAC + voyage-vs-buffer), (2) charter edit days-of-cover 10→15 with visible rule traces. Both must be deterministic.

## Current status / next steps
- UI REVAMPED (2026-07-06, from a 21-agent diagnosis+design workflow): plain-language everywhere
  (no raw ids on screen — see `src/lib/labels.ts`), sans type scale, a header with the national
  cover KPI + pitch, a plain-English guide band that narrates what's happening and why, provenance
  chips, and a "no AI in that decision" framing. Simulated judge panel: 55%→78% weighted.
- Added our OWN trained model (`refinery_model.ts` + `train-refinery-model.mjs`) — answers "why
  only one LLM": rules for the veto, our model for the numbers, LLM only for prose. `docs/ml-architecture.md`.
- Bloomberg-terminal restyle (true black, amber, dense mono, square, header bars) + interactive
  map camera (auto-frames affected straits; click a cargo to fly to + highlight its route; 50m geometry).
- What-if sandbox (`WHAT-IF` button → ScenarioBuilder → pipeline.computeScenario); clearly labeled SANDBOX.
- Beat choreography: staggered critic objections + Beat-2 amber ring on status change.
- Guided demo/tour (`▶ DEMO` button, `?tour=1` auto-play, `?judge=1` manual) — drives the real app,
  spotlights panels, captions double as the video script (docs/demo-tour.md).
- Engines + data + UI integrated; `npm run check` 73/73; `npm run build` verified clean (Node 22).
- Still to do (lower priority, non-code): the deck, the 3-min video, the signed audit-trace PDF prop
  (plan.md §7). Optional code: calibration-regression model (docs/ml-architecture.md upgrade path).
- Known-issue backlog cleared: LLM cache covers all top-3 cards (kochi:0/1, demand_side,
  floating_storage added; stale keys rekeyed), duplicate option/proposer rows collapse to ×N,
  and the Nayara buyer override now fires via `evt:ukmto-2026-04-08-bab-el-mandeb`
  (docs/beats.md Beat 3 — post-T, so Beats 1–2 stay byte-identical).
- Next: beat choreography timing (FLIP re-sort, amber rings — plan.md §8), terminal styling
  polish, sensitivity-sweep precompute, deck + 3-min video (specs in docs/plan.md §7).
- Cut-lines and daily rituals: docs/plan.md §4. Feature freeze rules apply.
