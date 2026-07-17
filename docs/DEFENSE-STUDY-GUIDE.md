# TRINETRA — End-to-End Tech Defense & Study Guide

*What to study to defend every piece of technology in TRINETRA, layer by layer.
Each layer: what it is · how TRINETRA implements it (grounded in the code) · study
topics + real references · the sharp questions a technical judge asks + crisp answers ·
traps (things NOT to overclaim on stage).*

Built from a 9-expert code-grounded audit. Every reference below is real and canonical —
verify the ones you'll lean on.

---

## The one mental model (the defense thesis)

> **TRINETRA is one idea repeated at every layer: put each sub-problem in the hands of the
> *weakest tool that can solve it correctly*, and keep every strong-but-untrustworthy tool
> (the LLM, the sampling, the wall clock) strictly *off the derivation path*.**

State is a pure fold over an append-only event log, hashed with SHA-256 over canonical JSON,
so the same sim-time cursor always yields byte-identical output — which is exactly why an LLM
can only write prose, a softmax model can only advise, and a zero-LLM rule critic holds the
compliance veto. **Defending it well means always naming which layer owns a given claim
(physics vs. rules vs. model vs. prose vs. crypto) and conceding the honest boundary of each,
rather than overclaiming across the seam.**

## Cold-start learning path (study in this order)

1. **Pure functions & referential transparency** (SICP) — the single mechanism under every determinism claim; without it you can't defend replay.
2. **Canonical serialization + ECMA-262 Number→String** — why `canonicalJson(x)` hashes identically across engines even with IEEE-754 floats (RFC 8785 spirit).
3. **SHA-256 & tamper-evident hash chains** (FIPS 180-4; Haber–Stornetta 1991) — the audit chain's integrity, and why it's *evident*, not *proof*.
4. **Event sourcing** — state as a fold over an append-only log; full replay vs. snapshots (Martin Fowler).
5. **React 18 `useSyncExternalStore` + Zod trust boundary + Vite static build** — how the offline SPA reads that pure state safely.
6. **Domain core** — crude assay dimensions, days-of-cover, the 5-lever action space, OFAC/EU rails — the vocabulary the whole demo speaks.
7. **Multinomial softmax logistic regression + feature standardization** (Bishop PRML 4.3.4) — the advisory model.
8. **Constitutional-AI loop + policy-as-code + severity lattice** (Bai et al. 2022; OPA/Rego) — governed decisioning.
9. **LLM decoding, hallucination, LLM-as-judge eval, build-time caching** (Holtzman 2020; Ji 2023; Zheng 2023).
10. **Geospatial** — plate carrée, point-in-polygon, CCW segment intersection, Dijkstra, Catmull-Rom — the presentation-only map, *last* because it can never change a hash.

---

# Layer 1 — App shell, state, build & contracts

**One line.** The offline SPA's spine: a ~30-line pub/sub store on React 18's
`useSyncExternalStore`, a Zod parse-at-load trust boundary, a frozen types↔schema contract,
and a Vite static build that opens from `file://` in airplane mode.

**How TRINETRA uses it.** State lives in `src/lib/store.ts` (`createStore` = a hand-rolled
pub/sub: a `Set` of listeners; `setState(patch)` shallow-merges and synchronously notifies).
Components read via `useStore(selector) = useSyncExternalStore(store.subscribe, () => selector(store.getState()))`;
`App.tsx` uses one `useStore` call *per raw field* so each snapshot is referentially stable
between publishes. The contract is `src/contracts/types.ts` (compile-time interfaces) mirrored
by `schemas.ts` where every schema is pinned `z.ZodType<X>` so drift is a **compile error** —
plus real invariants (lat/lon ranges, `z.string().datetime()`, `CharterFileSchema.length(7)`),
run once at module load on JSON imported `with { type: 'json' }`. Orchestration is a
module-scoped serialized async driver in `App.tsx`: `runAt` guards with a `running` flag + a
single `queued` slot (latest wins) so out-of-order crypto-async completions can't clobber
state. Build: `tsc -b && vite build`; `base:'./'` for relative assets.

**Study topics.**
- **`useSyncExternalStore` + the getSnapshot caching contract** — snapshots compared with `Object.is`; returning a fresh object/array from a selector loops forever; why concurrent rendering needs this over a `useEffect` subscription. → *React docs, `useSyncExternalStore` reference (react.dev).*
- **"You Might Not Need Redux"** — answers "why not Redux/Zustand?": a flat state object + a few actions needs no middleware; trade is no time-travel, selector-stability is the caller's job. → *Dan Abramov, "You Might Not Need Redux" (2016).*
- **Parse, don't validate — Zod as a trust boundary** — data files are authored by a different owner; parsed once so a bad `prov` tag or out-of-range lat throws at import, not mid-hash. → *Alexis King, "Parse, don't validate" (2019).*
- **Pinning a runtime schema to a compile-time type (`z.ZodType<T>`)** — why this beats `z.infer` (which inverts the relationship and lets the interface rot). → *Zod docs (zod.dev).*
- **Vite production build, base path, JSON import attributes** — `base:'./'` → relative URLs (opens from `file://`); JSON inlined at build time → no runtime fetch; esbuild dev, Rollup prod. → *Vite docs, "Building for Production".*
- **`tsc -b`, `isolatedModules`, `noEmit`** — TS is a typecheck gate only; esbuild transpiles; why `npm run build` fails on a type error before Vite runs. → *TypeScript Handbook, tsconfig reference.*

**Judge Q&A.**
- *"Your `useStore` passes a fresh closure every render — doesn't React 18 loop forever?"* → React compares the *returned value* with `Object.is`, not the closure. Selectors return existing fields; `setState` only swaps a field's reference when it's in the patch, so between publishes the snapshot is stable. The trap (selecting `s.options.filter(...)`) is avoided by selecting one raw field per call and deriving in render.
- *"Why hand-roll a 30-line store instead of Redux?"* → One flat object, four actions, no middleware — a reducer framework is ceremony + a dependency. `useSyncExternalStore` solves the hard part (tearing-free reads under concurrent rendering). Honest cost: no devtools/time-travel; selector stability is the caller's job.
- *"Isn't Zod dead weight on data you froze?"* → Its highest value is at *compile* time (`z.ZodType<T>` makes a mismatch a build error). At load it's a genuine trust boundary because the data is owned by a different person than the engine. Concession: for the shipped frozen bundle the parse always passes, so at pure runtime it's belt-and-suspenders.
- *"How does a static build run in airplane mode with no server?"* → `base:'./'` makes asset refs relative; data/cache JSON is import-inlined at build time (LLM text ships as a module in `src/cache`). Dependency surface is just react/react-dom/zod — nothing phones home.

**Traps.** Don't call it "Redux-like" (no middleware/time-travel) · don't say `useSyncExternalStore` "memoizes selectors" (it doesn't) · don't claim "immutable state" (it's a shallow merge) · don't overstate Zod as a *security* control · don't say "no server needed" without "static build from `file://` or any static host; the vite dev server is dev-only."

---

# Layer 2 — Determinism & event sourcing

**One line.** The whole app state is a pure fold over an append-only event log replayed from
event 0 on sim-time only, so the same cursor produces byte-identical output and the same
SHA-256 audit hashes.

**How TRINETRA uses it.** Event log = `data/hormuz2026_events.json`; `src/engine/replay.ts`
is the pure projector. `ordered()` re-sorts by `(t, id)` with an explicit id tiebreak — and
because sim time is fixed-width ISO-8601 UTC `Z` strings, **lexicographic string comparison IS
chronological** (no Date parsing on the compare path). `applyUntil(-1, bundle, t_sim)` folds
every event with `t <= t_sim`. `computeAt` always replays from cursor `-1` (CONTRACTS.md §3.7:
"seek = full deterministic rebuild from event 0, no incremental undo state"). Reproducibility
is enforced by content hashing in `src/lib/canonical.ts`. `scripts/check.mjs` proves it three
ways: module `selfCheck()`s, a **FORBIDDEN-regex denylist** over `src/engine`+`src/lib`
(`Date.now`/`Math.random`/`performance.now`/`crypto.randomUUID`/`fetch`/`XMLHttpRequest`/`WebSocket`),
and the load-bearing `canonicalJson(r1) === canonicalJson(r2)` plus identical `output_hash`
sequences after `computeAt` twice. The only runtime clock/`Date.now()` is in the **cosmetic
Stopwatch**; the only randomness is a **seeded mulberry32 in the build-time trainer**.

**Study topics.**
- **Pure functions & referential transparency (substitution model)** — same inputs → byte-identical output; this is the *mechanism*, not the marketing. → *SICP, Ch. 1 & 3; "Referential transparency" (Wikipedia).*
- **Event sourcing: state as a fold; snapshots vs full replay** — why replay-from-0 trades O(n) seek for zero state-corruption bugs; snapshotting is the scale upgrade. → *Martin Fowler, "Event Sourcing" (2005).*
- **ISO-8601 UTC ordering** — fixed-width zero-padded single-timezone `Z` strings sort lexicographically == chronologically; know what breaks it (offsets, missing pad, mixed precision). → *ISO 8601 (Wikipedia / ISO 8601-1:2019).*
- **IEEE-754 doubles & ECMA-262 Number→String determinism** — the sharpest attack on "byte-identical": `canonicalJson` stringifies via `String()`, pinned to the *shortest round-tripping* representation, so the same double serializes identically on any conformant engine. → *IEEE 754-2019 + ECMA-262 "Number::toString".*
- **Deterministic record-replay & stable total ordering** — every emitted array carries a documented sort with an explicit id tiebreak because iteration order isn't otherwise guaranteed. → *O'Callahan et al., "Engineering Record And Replay For Deployability", USENIX ATC 2017 (rr).*

**Judge Q&A.**
- *"IEEE-754 math isn't portable — how are audit hashes identical?"* → We never hash raw float bytes; we hash `canonicalJson(x)`, which serializes numbers with `String()`, pinned by ECMA-262 to the shortest string that round-trips. Honest bound: portability across conformant ECMAScript engines (browser + Node 22 for the check), not cross-language bit-portability — and the whole derivation runs in one engine.
- *"Seek re-derives from event 0 — isn't that O(n)?"* → Yes, deliberate (CONTRACTS §3.7): no incremental undo state means a class of desync bugs can't exist, and the bundle is dozens of events (sub-millisecond). Because it's a pure fold, snapshot-plus-tail-replay is a drop-in. Concession: `ordered()` also re-sorts each call.
- *"Running `computeAt` twice and diffing is weak — what does it catch?"* → Accidental nondeterminism (unsorted iteration, wall-clock/PRNG leakage, unstable ids), backed by the denylist regex. It does *not* catch a defect identically wrong on both runs — that guarantee is architectural (pure functions, no globals, no mutation). The test defends the property; the design provides it.
- *"You say zero randomness, but there's mulberry32 and `Date.now()`."* → Both off the derivation path: mulberry32 in the build-time trainer (seeded, never imported at runtime); `Date.now()` only in the cosmetic Stopwatch + build scripts. The FORBIDDEN scan enforces zero over exactly `src/engine`+`src/lib`.
- *"`crypto.subtle` forces async — how does that not add nondeterminism?"* → We never race hashes: `appendEntry` awaits sequentially (each `prev_hash` depends on the prior `output_hash`), and `canonicalJson` fixes serialization order before any digest. No `Promise.all` over hashes. Async defers the same pure computation; it never reorders it.

**Traps.** Don't say "floating-point is deterministic" flatly (the claim is narrow: *serialized* numbers via `String()`) · never call the log a "blockchain" · don't claim the regex "proves" determinism (it's a denylist tripwire; the guarantee is architectural) · don't say seek is O(1)/incremental · don't say entries are language-enforced "immutable."

---

# Layer 3 — Domain science & operations research

*(exposure graph · days-of-cover · 5 levers · assay chemistry · sanctions rails)*

**One line.** The physics-and-economics core: a directed supply graph whose edges attenuate
under chokepoint shocks, a legible days-of-cover index, an enumerate-and-screen action space
of five crisis levers, and an axis-aligned crude-assay compatibility screen backed by OFAC/EU
rails — all pure, deterministic, provenance-tagged.

**How TRINETRA uses it.** `rescore()` in `src/engine/scenario.ts` is **NOT a max-flow solver**
— it is single-pass attenuation: `effective = volume_kbd × flow_mult` (0.5 partial / 0.1
severe, calibration-overridable) keyed on the worst shocked chokepoint on the edge's route,
then sums inbound baseline vs. effective per refinery. Days-of-cover is the deliberately simple
linear index `cover = cover_days × (0.4 + 0.6 × min(1, supplyRatio))` with an explicit 40%
floor; `gap_kbd = Σ(baseline − effective)` over refinery-bound edges. `sweepStability()` is a
one-at-a-time (OAT) sensitivity sweep = % of a parameter range over which the ranking is
unchanged. `generateOptions()` enumerates five levers (stock_draw cap 30,000 kb; divert = 3
days of an open edge's flow; floating = fixed 2,000 kb; reroute = spot cargo over an existing
edge; demand_side = 300 kb/d run-cut). `assayScreen` is an axis-aligned box test over
`[api, sulfur, tan, ni_v, resid, pour]`: 0 fails→RUN_NOW, 1–2→BLEND, >2→CANNOT_RUN. Rails from
`sanctions_rules.json` (GREEN/AMBER/RED per country) with a `buyer:Nayara` RED override.

**Study topics.**
- **Crude assay dimensions & what each physically constrains** — why API 16 is a problem (density/light-ends yield, envelope floor), TAN → naphthenic-acid corrosion (316/317 SS above ~220°C), Ni+V → FCC catalyst poison, resid → coker capacity, sulfur → hydrotreaters, pour point → cold flow. A refining judge probes exactly one. → *Gary, Handwerk & Kaiser, "Petroleum Refining: Technology and Economics"; Wikipedia "API gravity" / "Total acid number"; API RP 571.*
- **Refinery crude selection as an LP; how a box envelope approximates it** → *Gary/Handwerk/Kaiser (LP chapter); keyword "refinery crude slate optimization linear programming".*
- **Days-of-cover, SPR, the IEA 90-day obligation** — true relation `days ≈ inventory / net daily draw` (convex) vs. TRINETRA's stylized linear index with a 0.4 floor. → *IEA "Agreement on an International Energy Program" (1974); keyword "India ISPRL strategic petroleum reserve".*
- **Network-flow vs. attenuation (max-flow / min-cost-flow)** — the sharpest OR question; know what a real solver adds so you can position attenuation as the transparent physics layer. → *Ahuja, Magnanti & Orlin, "Network Flows" (1993); Wikipedia "Maximum flow problem".*
- **Supply-chain disruption: mitigation vs. contingency** — the five levers as a resilience action space. → *Tomlin (2006), Management Science 52(5); Sheffi, "The Resilient Enterprise" (2005).*
- **Crude blending: which properties blend linearly** — the linear blend ratio is OK for sulfur/TAN (mass), wrong for API (linear in specific gravity), badly wrong for viscosity/pour (blend indices). → *Refutas equation; ASTM D341; Gary/Handwerk/Kaiser (blending).*
- **OFAC / EU-G7 sanctions mechanics** — why Venezuela is AMBER not RED (general license = per-cargo licensed dealings), Russia AMBER (price-cap attestation), `buyer:Nayara` RED overriding origin (entity-level EU designation, ~49% Rosneft). → *OFAC "Sanctions Programs and Country Information"; EU "Russian oil price cap"; keyword "OFAC general license Venezuela PdVSA".*
- **Hindsight bias, backtest overfitting, sensitivity analysis (OAT vs. global)** → *Saltelli et al., "Global Sensitivity Analysis: The Primer" (2008); Bailey, Borwein, López de Prado & Zhu (2014), "Pseudo-Mathematics and Financial Charlatanism", Notices of the AMS 61(5).*
- **Provenance discipline (R/E/S) + KB-freeze/holdout** → *docs/data-provenance.md; EIA "World Oil Transit Chokepoints".*

**Judge Q&A.**
- *"Real days-of-cover is convex — why a straight line, and where's 0.4 from?"* → A deliberately legible stylized index, monotone in severity with a 40% floor = headroom you can always tap (SPR draw + run-cuts). The day-count isn't a forecast; we defend the *ranking* of most-exposed refinery, and `sweepStability()` shows the ranking survives wide coefficient variation. A true inventory model is the upgrade path.
- *"Is the graph solving network flow or just scaling edges?"* → Honestly, it attenuates — multiply each edge by a flow multiplier, sum inbound; no capacity-constrained reallocation. Reallocation is a *decision*, which is what the divert/reroute levers are for. Min-cost-flow is the scale-up, not a claim we're making today.
- *"Your box screen is six independent min/max ranges — real compatibility has interactions."* → It's a first-order separable *veto signal*, not a refinery LP. I concede the interactions and non-linear blends; the box is conservative and only flags run-now/blend/cannot-run with the binding property named; the deterministic critic owns the decision.
- *"Is Merey's demotion in the data or hard-coded?"* → Data-driven: Merey-16 is API 16 in `grades.json`; Jamnagar's envelope has an API floor of 18 → `16 < 18` is the single binding failure → BLEND, plus AMBER OFAC. The generator still ranks it #2 (cheap, −$4/bbl discount), so the demotion is a *visible* act (Article A1). Change the floor and the beat changes.
- *"How do I know calibration wasn't curve-fit — hindsight bias?"* → No out-of-sample holdout, so I won't say "backtested." Guard is `sweepStability()`: an OAT sweep showing the ranking is robust to moving the numbers. Honest limit: local OAT, not global (Sobol) — can miss interaction effects.
- *"Why Venezuela AMBER and what's the Nayara override doing?"* → AMBER = a general license authorizes licensed per-cargo dealings (conditional, not a blanket ban like Iran/RED). The `buyer:Nayara` RED override supersedes the origin rail for cargoes to Vadinar — entity-level sanctions attach to the buyer (~49% Rosneft) regardless of crude origin; a country-only rail misses it.

**Traps.** Don't call it "network optimization" (say "decision-support enumerator") · don't present `cover_days` as a physical forecast (defend the ranking) · don't claim the box "knows which crudes a refinery can run" · don't say the linear blend ratio is valid for all six props · **never say "backtested"/"validated out-of-sample"** (say "sensitivity-tested"; concede local OAT) · don't call the softmax model the decision-maker · don't say "API 16 is too heavy to refine" as a law (it's below *Jamnagar's configured floor of 18*) · never upgrade S/E to R · don't imply the graph reroutes flow automatically when a lane closes.

---

# Layer 4 — The LLM layer (proposer narration + arbiter memo), cached at build time

**One line.** A build-time-only LLM writes the prose; runtime imports frozen JSON and never
calls a model, so the demo is offline and byte-identical while a real, provider-agnostic,
adversarially-selected model still produced the text.

**How TRINETRA uses it.** Generation is **build-time only** (`scripts/generate-llm-cache.mjs`):
`contextFor(hero)` injects only fixed `data/*.json` fields (assay, refinery capacity + cover,
cargo, rail note, charter titles) plus a style directive ("trader-grade, numbers-first, <120
words"). Provider-agnostic: `pickProvider()` → Anthropic / NVIDIA NIM (OpenAI-compatible,
temp 0.2) / Bedrock; `withRetry` 3 attempts; `--dry-run` prints prompts with zero network.
Runtime **never touches a model**: `src/cache/index.ts` does a static JSON import; `propose()`
is pure (`{...o, rationale: cache[o.id]?.rationale ?? CACHE_MISS_RATIONALE}` — a miss degrades
to a template, Article A1). Model selection is `docs/nvidia-bakeoff.md`: 10 NIM models blind-
ranked on tone / grounding-in-supplied-numbers / format compliance.
*Note: `prompt_hash` is hard-coded `'PLACEHOLDER'`; check.mjs only checks presence, not content freshness.*

**Study topics.**
- **Decoding & sampling: temperature, top-p/nucleus, why generation is non-deterministic** — confines non-determinism to build time; runtime reads a frozen import. → *Holtzman et al. (2020), "The Curious Case of Neural Text Degeneration", ICLR.*
- **Hallucination & grounded generation (context-stuffing vs. retrieval)** — prompt-conditioning *reduces* but doesn't eliminate hallucination; the shipped cache actually invents figures. Distinguish deterministic context-injection from RAG. → *Ji et al. (2023), ACM Computing Surveys; Lewis et al. (2020), "Retrieval-Augmented Generation", NeurIPS.*
- **OpenAI-compatible Chat Completions + NVIDIA NIM** — one code path serves many models. → *OpenAI API reference (Chat Completions); NVIDIA NIM docs.*
- **LLM eval: blind/pairwise ranking, LLM-as-judge, position bias, reproducibility** — name the pitfalls the doc concedes (no raw logs; a byte-identical duplicate must not double-count). → *Zheng et al. (2023), "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena", NeurIPS D&B.*
- **Structured/format-compliant output & constrained decoding** — prompt-only format compliance is *soft* vs. grammar/JSON-constrained decoding. → *Willard & Louf (2023), "Efficient Guided Generation" (Outlines); OpenAI structured-outputs docs.*
- **LLM as narrator not authority; prompt injection; defense-in-depth** → *OWASP Top 10 for LLM Applications (LLM01, LLM09).*
- **Build-time memoization / precomputation for deterministic runtime** → *keyword "memoization" + "build-time precomputation / ahead-of-time caching".*

**Judge Q&A.**
- *"What enforces 'grounded in the supplied numbers only'?"* → Nothing at generation; the prompt requests it and the bake-off scored for it, but the *authority* is the zero-LLM critic, which reads only structured `OptionCard` fields, not the prose. Honest concession: specific figures in the cached text aren't cross-checked; the shipped Merey memo even has a 10× unit slip. A numeric-consistency lint over the cache would close it — not wired yet.
- *"Did you really test ten distinct models?"* → No — one output was byte-identical to another (API aliasing) → ~8 genuinely distinct + 2 hard failures. Larger caveat: scores shipped without raw request/response logs, so it's an internal selection record, not a reproducible benchmark.
- *"If everything's cached, why an LLM at all?"* → The value is the *reproducible pipeline* (real context injected, provider-agnostic, adversarial selection) plus the pitch point that the models' failure modes (unit-mangling the cargo, invented prices) are exactly what the deterministic critic catches. The JSON is the frozen artifact; keeping the generator means it's regenerable/swappable, not a hand-edited string.
- *"How do you know the cache still matches the data/prompts?"* → Weakly today: check.mjs verifies *presence*, but `prompt_hash` is `'PLACEHOLDER'` so there's no content binding. Fix is honest and small — set `prompt_hash = sha256(prompt)` via the same canonical-JSON+SHA-256 path and fail on mismatch. Not wired yet.
- *"Temperature 0.2 — so the cache isn't reproducible; how is replay byte-identical?"* → Different sides of the build boundary. Generation is intentionally non-reproducible and doesn't need to be; runtime reads the committed JSON via static import and never calls a model. All LLM non-determinism lives at build time, off the runtime derivation path.

**Traps.** Don't say "grounded so it can't hallucinate numbers" (it can — the Merey memo proves it) · don't call it RAG (no retrieval/embeddings; it's context injection) · don't claim "no LLM in the product" (there's one at *build* time; the claim is "no LLM at runtime, none in the critic") · don't claim the bake-off is reproducible or tested 10 independent models · don't say `prompt_hash` binds the cache · don't claim temp-0/deterministic generation · don't oversell format compliance · don't imply the prose was fact-checked against data.

---

# Layer 5 — The zero-LLM critic (rule / expert system)

**One line.** A pure-function business-rule engine that screens every option card against the
seven charter articles and emits deterministic, citable objections
`{article, rule_id, severity, evidence}` — the compliance veto, with no LLM anywhere on its path.

**How TRINETRA uses it.** `criticize(options, ctx)` in `src/engine/charter/criticize.ts` is
pure: double-loops every card over a `VALIDATORS` registry of six `ValidatorFn`s, concatenates
`Objection[]`, stable-sorts by `(option_id, rule_id)`. Each objection has a deterministic id
`${rule_id}:${option_id}`, severity `block`|`flag`|`note`, message, evidence. The six:
(1) `assayValidator` (A5) reads precomputed `compat_tier`; (2) `voyageVsBufferValidator` (A2)
blocks only when cover is below the A2 floor, else flags — the Beat-2 coupling; (3)
`sanctionsValidator` (A4) RED→block, AMBER→flag; (4) `concentrationValidator` (A3) via the
route-less `corridorsFor` heuristic; (5) `freshnessValidator` (A5) notes prov='S' evidence;
(6) `securityFloorValidator` (A2). The chemistry envelope screen lives *upstream* in
`options.ts assayScreen`; the softmax `classifyCrude` is advisory only and never gates.

**Study topics.**
- **Pure functions, referential transparency, deterministic replay** — same inputs → same objections (hash-chainable). → *Wikipedia "Pure function"/"Referential transparency"; SICP.*
- **Expert systems & production (rule) systems** — the critic *is* a small production system (condition→objection over a working memory `CriticContext`). → *Wikipedia "Expert system"/"Production system (computer science)".*
- **Business-rules engines, decision tables, Rete** — frames the six validators; contrast the linear per-option scan with production matchers (for "does it scale"). → *Wikipedia "Business rules engine"/"Decision table"; Forgy, "Rete", Artificial Intelligence, 1982.*
- **Interpretable models for high-stakes decisions (rules over black boxes)** — *the* core defense. → *Cynthia Rudin, "Stop explaining black box ML models for high stakes decisions and use interpretable models instead", Nature Machine Intelligence, 2019.*
- **Crude assay compatibility & refinery slate constraints** → *Gary/Handwerk/Kaiser; keyword "crude assay TAN sulfur API refinery compatibility".*
- **Days-of-cover / strategic stock adequacy** → *IEA emergency response; keyword "IEA 90-day net import cover obligation".*
- **Sanctions compliance & payment rails (OFAC, general licenses)** → *U.S. Treasury OFAC; Wikipedia "Office of Foreign Assets Control".*

**Judge Q&A.**
- *"`assayValidator` just reads a tier — where's the chemistry?"* → The envelope screen (each dim inside `[min,max]` + a linear max-blend-ratio) is `assayScreen` in `options.ts`, a pure function → CANNOT_RUN/BLEND/RUN_NOW. The softmax runs in parallel but is advisory. Honest: the *screen* decides compatibility, the *critic* decides the veto given that verdict — two files by design so authority is auditable.
- *"Why six hand-written rules instead of an LLM that catches the unanticipated?"* → Compliance demands reproducibility + citability: every objection is a pure-function `{article, rule_id, severity, evidence}`; `selfCheck` asserts exact message strings; the result is hash-chainable. An LLM critic would be non-deterministic and could hallucinate/miss a violation untraceably. Honest trade: rules catch only what we encode — a narrower but always-accountable veto.
- *"Concentration flags a corridor but the card has no route — how?"* → A heuristic (`corridorsFor`): attribute an option to every corridor on an edge into its target or out of its origin, then compute incremental share vs. the A3 cap. It over-approximates (safe direction for a cap). Upgrade: a real `route` field from the sea-lane router → exact share.
- *"Same overshoot is sometimes block, sometimes flag — a bug?"* → No, coupled to the charter: an eta longer than cover is a *block* only when the refinery is already below the A2 floor (unbridgeable); at/above the floor the identical overshoot is a *flag*. This floor-dependence is Beat 2 — editing 10→15 re-scores with visible traces.
- *"If a block fires, is it final?"* → The validator only sets severity; the arbiter applies a fixed lattice. One designed escape: if every block names an explicitly satisfiable condition (a voyage gap a same-batch stock_draw/divert can bridge, or a BLEND), the option becomes *conditional*. Article A7 guarantees a human can override, logged.

**Traps.** Don't say "the critic runs the chemistry/ML model" · don't call the audit a "blockchain"/"Merkle tree" · don't claim the rules are "complete" · don't present concentration as precise routing · don't say "zero AI in the decision" loosely (the precise claim: *zero LLM in the critic/veto*) · don't claim objection messages go through `fmt.ts` (the critic builds its own strings) · don't call it "forward-chaining with a Rete network" (it's a single linear pass).

---

# Layer 6 — The trained crude-compatibility model (multinomial logistic regression)

**One line.** A 24-parameter softmax classifier predicting RUN_NOW / BLEND / CANNOT_RUN from
engineered assay-exceedance features, trained offline on rule-labelled synthetic crudes and
shipped as frozen weights for pure, deterministic, **advisory** inference.

**How TRINETRA uses it.** Trainer `scripts/train-refinery-model.mjs` fits a multinomial logistic
regression over 3 classes: 9 refineries × `PER_REF=400` synthetic crudes (3,600), stratified by
violated-dim count. Each crude is labelled by `label()` — a **byte-for-byte mirror of
`assayScreen`**. `featurize()` builds 7 features (signed exceedance per dim normalized by
envelope width + `frac_dims_outside`), z-score standardized (mean/std frozen), fit by full-batch
gradient descent with the cross-entropy gradient `(p[k]-y_k)*x` (LR=0.3, ITERS=400, L2=1e-4),
seeded mulberry32. Output = 24 frozen floats + mean/std + meta (`train_accuracy 1`, `prov 'E'`).
Runtime `classifyCrude` is pure (featurize → standardize → `W*x+b` → stable softmax → argmax;
confidence = max class prob, 3dp). check.mjs asserts every reroute card has a tier + confidence,
≥85% agreement with the physical screen, and identical predictions across two re-runs.

**Study topics.**
- **Multinomial logistic regression / softmax classifier** — a *linear* model with a softmax link over K=3, 3×7 W + 3 b; not a neural net. → *Bishop, PRML (2006), §4.3.4; Wikipedia "Multinomial logistic regression".*
- **Softmax + log-sum-exp / max-subtraction stability** — both trainer and runtime subtract `max(z)` to prevent `exp()` overflow. → *Goodfellow, Bengio & Courville, Deep Learning (2016), §4.1/6.2.2; CS231n "Linear Classification".*
- **Cross-entropy loss & its gradient `(p−y)x`** — recognize the inner loop as the exact CE gradient. → *Bishop PRML §4.3.4.*
- **Batch gradient descent + L2 (weight decay)** — explains LR/ITERS/L2. → *Goodfellow et al., Ch. 5 & 7; Wikipedia "Tikhonov regularization".*
- **Feature standardization (z-scoring)** — why compute/freeze mean/std; makes runtime reproduce training. → *Hastie, Tibshirani & Friedman, ESL (2009).*
- **Feature engineering for linear separability** — hand-built features make the rule frontier nearly linearly separable → ~100%. → *ESL (basis expansions).*
- **Train accuracy vs. generalization; overfitting; held-out validation** — the honest weak point (100% *train*, no split = rule-recovery on synthetic data). → *ESL, Ch. 7.*
- **Calibration of classifier confidence** — `model_confidence` is the max class prob, not an empirically calibrated risk. → *Guo, Pleiss, Sun & Weinberger, "On Calibration of Modern Neural Networks", ICML 2017.*
- **Reproducible/deterministic ML: seeded PRNG + frozen weights** → *keyword "mulberry32 PRNG"; concept "deterministic/reproducible builds".*

**Judge Q&A.**
- *"100% train accuracy — isn't that overfitting?"* → It's ~100% because the labels *are* the physical rule (`label()` mirrors `assayScreen`), so it recovers a deterministic frontier — and after feature engineering that frontier is nearly linearly separable, so 24 params fit it cleanly. Reported honestly as *train* accuracy, no split; the model is advisory. Concession: rule-recovery, not generalization.
- *"If labels come from your own rule, isn't it circular?"* → Fair — today it's a smooth learned surrogate; what it adds is a *continuous confidence* the hard rule lacks, plus "our own model." Its real purpose is the upgrade seam: retrain the identical pipeline on real PPAC/tanker-tracking run histories → it learns the true empirical frontier. Kept advisory because the data is still synthetic.
- *"Why softmax and not a neural net / GBM?"* → After feature engineering the boundary is essentially linear and 24 params already reach ~100% — a deeper model has zero headroom and adds parameters to justify/freeze/audit. Fewer params = inspectable weights, trivially deterministic inference. Simplest model that fits.
- *"Is 'confidence' a calibrated failure probability?"* → No — max softmax class prob, a valid model probability but not calibrated against real outcomes; rounded to 3dp for byte-identical output, advisory next to the rule's hard verdict.
- *"Weights load onto `frac_dims_outside` — isn't it just counting violations?"* → Yes, correctly reporting the truth about the label (0→RUN_NOW, ≤2→BLEND, >2→CANNOT_RUN + the resid case), so the count carries most signal and per-dim exceedances refine it. A feature of honest labelling, not a bug.

**Traps.** Don't say "learned from real refinery run history" (synthetic, rule-labelled, prov E) · don't claim 100% proves it generalizes · don't say the model "decides/vetoes/screens out" · don't call `model_confidence` a calibrated failure probability · don't call it a neural network / "deep learning" · don't claim it adds independent predictive info today · don't inflate the data (3,600 synthetic across 9 refineries) · don't imply training runs at demo time.

---

# Layer 7 — Constitutional AI & governed decisioning (the arbiter)

**One line.** The propose→critique→arbitrate governance loop Anthropic uses to align a model
in *training*, re-purposed to run at *decision* time with a written 7-article charter as
machine-enforced policy and a deterministic (zero-LLM) critic in place of the AI critic.

**How TRINETRA uses it.** Borrows the **architecture** of Constitutional AI, two deliberate
moves: run the loop at *decision* time; replace the AI critic with a deterministic one.
**Proposer** (`propose.ts`) attaches cached prose, never reorders/filters (A1). **Critic**
(`criticize.ts`) = the zero-LLM critic (Layer 5). **Arbiter** (`arbitrate.ts`) = the severity
lattice: any block→rejected, else any flag→conditional, else validated. Designed nuance
`blockCondition()`: a block naming an explicitly satisfiable condition becomes *conditional* —
but below the A2 floor the overshoot is marked unbridgeable (hard block), driving Beat 2. The
constitution is `data/charter.json`: 7 human-authored articles, two with tunable params (A2
`min_cover_days=10`, A3 `max_corridor_share=0.35`), editable live → Beat-2 edit re-runs only
critique+arbitration via `rerunWithCharter`. A7 (traceability + human sovereignty) is realized
by `audit.ts` (hash chain).

**Study topics.**
- **Constitutional AI: the propose→critique→revise loop & RLAIF** — state precisely what Anthropic did, so you can say what TRINETRA *keeps* (loop + written constitution) vs. *drops* (training objective, AI critic). → *Bai et al. 2022, "Constitutional AI: Harmlessness from AI Feedback", arXiv:2212.08073.*
- **RLHF / RLAIF & reward modeling** — the paradigm CAI sits inside. → *Ouyang et al. 2022 (InstructGPT), arXiv:2203.02155; Christiano et al. 2017, "Deep RL from human preferences", NeurIPS.*
- **Policy-as-code & rule/decision engines** — the honest framing: the critic+arbiter is a policy engine, not AI. → *Open Policy Agent / Rego docs (openpolicyagent.org); keyword "policy as code".*
- **Order theory: total orders, precedence, monotone combination** — the "severity lattice" is a precedence over `{block > flag > pass}` + the satisfiable-block exception; defend the naming and order-independence. → *Wikipedia "Lattice (order theory)"/"Total order"; Davey & Priestley, "Introduction to Lattices and Order".*
- **AI governance: EU AI Act (human oversight + logging) & NIST AI RMF** — Art. 14 (oversight) ↔ A7; Art. 12 (record-keeping) ↔ the hash chain. Built the *affordances*, not a conformity assessment. → *Regulation (EU) 2024/1689, Art. 12 & 14, Annex III; NIST AI RMF 1.0 (NIST AI 100-1, 2023).*

**Judge Q&A.**
- *"CAI is a training method — isn't this just a rules engine with a borrowed name?"* → Correct, and we say so: we borrow the *architecture* (propose→critique→arbitrate under a written constitution), not RLAIF. Two divergences: decision-time operational governance; a deterministic critic because a crude-supply decision *has* a formalizable rulebook (cover floor, OFAC rail, assay envelope, concentration cap) that open-ended text alignment lacks. On stage: say "constitutional AI" once; the screen reads "Decision Charter."
- *"Anthropic uses an AI critic for a reason — why is deterministic *better* here?"* → Anthropic uses an AI critic because harmlessness has no ground-truth rulebook. Our constraints are numeric/lookup facts, so a pure function can't hallucinate a veto, every objection cites Article + evidence, and the critique replays byte-identically. An LLM critic would emit a different set each run and break the hash-chained audit. Strictly safer for *this* domain, not in general.
- *"Walk me through the arbiter / satisfiable block."* → Precedence: any block→rejected, else any flag→conditional, else validated. `blockCondition()`: if every block names a satisfiable condition (a voyage gap a same-batch stock_draw/divert bridges, or a BLEND), it's *conditional*. Caveat: below the A2 floor the overshoot is deliberately unbridgeable → the Beat-2 escalation.
- *"How do I know the audit wasn't tampered with, and what's the crypto?"* → Each entry stores `sha256(canonicalJson(input/output))`, `prev_hash` → prior `output_hash`, GENESIS at seq 0 (SHA-256 via `crypto.subtle`); `verifyChain` re-walks every link. Honest limit: tamper-*evident*, not tamper-proof — no external signature in the repo, so a full re-chain from a new root passes verify; the signed one-page PDF prop is the external anchor.
- *"Does this meet EU AI Act human-oversight/logging?"* → The design maps onto it (Art. 14 ↔ A7 human authority + logged override; Art. 12 ↔ the hash chain), but these are *affordances*, not a completed conformity assessment. Governance-ready by construction, not certified.

**Traps.** Don't present it as an *implementation* of Anthropic's CAI (you adapted the loop, not RLAIF) · don't call the chain "tamper-proof"/"blockchain" · don't say the critic "decides/ranks/is AI" · don't state the lattice as "any block→rejected, full stop" (the satisfiable-block exception + the sub-floor hard-block) · don't overclaim "EU AI Act compliant" · don't imply the arbiter consults the softmax or LLM · don't frame the charter as "the AI's values" or a geopolitical stance (it's human-authored operational policy).

---

# Layer 8 — Hashing & the tamper-evident audit trail

**One line.** A single-writer, append-only hash chain: each decision entry stores SHA-256
digests of its canonicalized input/output and links to the prior entry's `output_hash`, so any
edit, reorder, or deletion breaks the chain and fails `verifyChain`.

**How TRINETRA uses it.** `src/lib/canonical.ts`: `canonicalJson(x)` is a hand-rolled
deterministic serializer (recursively sorts keys, drops `undefined`, normalizes `-0`→`'0'`,
throws on NaN/Infinity); `sha256Hex(str)` digests via
`crypto.subtle.digest('SHA-256', TextEncoder().encode(input))`. `crypto.subtle` is Promise-
based → that's why `appendEntry`/`arbitrate`/`decide()` are async. `src/engine/charter/audit.ts`:
`appendEntry` builds an `AuditEntry` with `seq` (monotonic from 0), `input_hash`/`output_hash`
= `sha256Hex(canonicalJson(...))`, `prev_hash` = last `output_hash` or `'GENESIS'`. **The raw
input/output are hashed, not stored.** `verifyChain` re-walks: hex64 well-formedness, seq
monotonicity, `prev_hash === prior output_hash`, seq-0 = GENESIS. Never touches
`Date.now`/`Math.random` — so replay yields byte-identical hashes.

**Study topics.**
- **Hash-function properties: preimage, second-preimage, collision resistance** — tamper-evidence rests on second-preimage/collision resistance; state which you rely on; hashing ≠ encryption. → *Menezes, van Oorschot & Vanstone, Handbook of Applied Cryptography, Ch. 9 (free: cacr.uwaterloo.ca/hac).*
- **SHA-256 / SHA-2** — 256-bit / 64 hex (matches the HEX64 regex); Merkle–Damgård; no practical collision (unlike SHA-1). → *NIST FIPS 180-4 (2015).*
- **Web Crypto API — `SubtleCrypto.digest`** — why async + hand hex-encode; secure-context gotcha (HTTPS/localhost). → *W3C Web Cryptography API; MDN "SubtleCrypto.digest".*
- **JSON canonicalization / deterministic serialization** — `JSON.stringify` key order/number handling isn't guaranteed stable → logically-equal entries could hash differently. → *RFC 8785, JSON Canonicalization Scheme (JCS), 2020.*
- **Hash chains & linked timestamping** — a linear hash-linked log; predates blockchain by ~17 years. → *Haber & Stornetta, "How to Time-Stamp a Digital Document", Journal of Cryptology, 1991.*
- **Merkle trees (as the contrast)** — why *not* one: a single-writer sequential log needs O(n) verify, not O(log n) membership proofs. → *Ralph Merkle, CRYPTO '87.*
- **Tamper-evident logging vs. blockchains** — evidence needs the verifier to hold one unforgeable value (a signed/published head); without it a full re-chain is undetectable. → *Crosby & Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009.*

**Judge Q&A.**
- *"`verifyChain` never recomputes a hash from data — what does it prove?"* → Internal linkage integrity: every hash is well-formed hex64, seq strictly monotonic, each `prev_hash` = prior `output_hash`, seq-0 anchored at GENESIS. Any reorder/deletion/insertion/edit breaks a link. It deliberately doesn't re-derive from content (inputs are hashed-not-stored) — the content check is *re-running the deterministic pipeline* and comparing head hashes. Cheap structural check + semantic reproducibility.
- *"Why `canonicalJson` instead of `JSON.stringify`?"* → The hash is over *bytes*; `JSON.stringify` gives no cross-engine guarantee on key order / dropped-vs-kept `undefined` / `-0`, so logically-identical entries could hash differently (false alarms + broken replay). `canonicalJson` makes equal values map to equal bytes — a hand-rolled instance of RFC 8785.
- *"An attacker who controls the array can re-chain from GENESIS — how is that tamper-evident?"* → Correct, and inherent to any *unsigned* hash chain: evidence requires the verifier to trust one unforgeable value (a signed/published head). We don't sign the head, so I won't claim we detect a full rewrite. Our substitute is *determinism*: the chain is a pure function of committed inputs, so anyone re-runs and must get the identical head hash — the reproducible build IS the trusted head. Signing the head is the production upgrade.
- *"Why SHA-256 via `crypto.subtle` + a linear chain, not a Merkle tree?"* → Browser-native audited SHA-256, no dependency, no hand-rolled crypto (cost: async). A single-writer append-only sequentially-verified log gains nothing from a Merkle tree's O(log n) inclusion proofs — those pay off for large random-access sets; our verify is a linear O(n) walk.
- *"What stops `-0`/NaN/float formatting hashing two ways?"* → `canonicalJson` normalizes `-0`→`'0'` and throws on non-finite; JS Number→string is deterministic per ECMAScript. Residual gap to name honestly: no Unicode NFC normalization — irrelevant for ASCII ids, a real edge if free text entered a hashed field.

**Traps.** Don't call it a blockchain (no consensus/PoW/network) · don't say "Merkle tree" (it's a linear chain) · don't say "tamper-proof" (evident, and only against edits that don't re-chain) · don't claim `verifyChain` recomputes hashes from data · don't call SHA-256 "encryption"/"unbreakable" · don't claim GENESIS is a cryptographic anchor (it's a sentinel) · don't imply `canonicalJson` handles every edge (no NFC; rejects bigint/non-finite).

---

# Layer 9 — Maritime routing & geospatial rendering

**One line.** A fully offline, tile-free SVG map that draws crude-tanker routes as shortest
water-only paths over a hand-built sea-lane graph, projected with plate carrée and smoothed
with clamped Catmull-Rom — all **presentation-only, never on the derivation path**.

**How TRINETRA uses it.** **Build-time** (`scripts/build-sea-network.mjs`): ~70 hand-placed
ocean waypoints; an edge exists only if the straight `[lat,lon]` segment stays in water. Land =
Natural Earth 50m (`src/assets/world-land.geo.json`), flattened to rings with bboxes.
`crossesLand()` = bbox prefilter + Sedgewick CCW segment-intersection; `onLand()` = ray-cast
point-in-polygon. Because 50m misrepresents narrow straits, two hand-curated lists correct it:
**PORTALS** force real transits (Suez centerline, Bab-el-Mandeb, Bosphorus/Dardanelles,
Malacca, the Gulf lane); **BLACKLIST** deletes edges the coarse coastline wrongly reads as open
water (Kish/Qeshm corner-cutters, cuts across the Peloponnese). **Runtime** (`searoutes.ts`):
`seaRoute()` stitches source → each `via_chokepoint` → dest; snaps to nearest node + Dijkstra
(plain O(V²), fine at ~70 nodes); inland refineries route to a coastal landing with a dashed
`pipelineTail()`. **Render** (`geo.ts` + `MapView.tsx`): `project()` is equirectangular over a
fixed window → 1000×490 viewBox; `routePath()` uses uniform Catmull-Rom with `clampHandle()`
capping each control handle to `seg/3` to tame overshoot; the camera animates the SVG viewBox.
**Nothing here imports the store** — routes are SVG strings in a `useMemo`, so a routing bug is
cosmetic and cannot change an audit hash.

**Study topics.**
- **Equirectangular (plate carrée) projection & distortion** — neither equal-area nor conformal; a degree of longitude shrinks by `cos(lat)` → the Dijkstra weights are screen-space, not nautical miles. → *Snyder, "Map Projections — A Working Manual", USGS PP 1395 (1987); Wikipedia "Equirectangular projection".*
- **Ray-casting point-in-polygon (even-odd rule)** — `onLand()` is the classic PNPOLY loop incl. the half-open `(yi>lat)!==(yj>lat)` test that avoids double-counting vertices. → *W. R. Franklin, "PNPOLY"; O'Rourke, "Computational Geometry in C", 2nd ed.*
- **Segment–segment intersection via the CCW predicate** — the canonical `ccw(A,C,D)!=ccw(B,C,D) && ccw(A,B,C)!=ccw(A,B,D)`; the `>` form silently drops collinear/degenerate cases. → *Sedgewick & Wayne, "Algorithms" 4th ed.; CLRS computational-geometry chapter.*
- **Bounding-box (broad-phase) spatial pruning** — skip any ring whose bbox can't overlap the query segment. → *O'Rourke; keyword "broad-phase collision AABB overlap".*
- **Dijkstra's shortest path & complexity** — array-scan O(V²) justified (~70 nodes, no heap); needs non-negative weights (degree-distances are). → *Dijkstra (1959), Numerische Mathematik 1:269–271; CLRS single-source shortest paths.*
- **Catmull-Rom splines, overshoot, knot parameterization** — uniform Catmull-Rom can overshoot/cusp on uneven spacing; centripetal is the principled alternative we did *not* use — we clamped handles instead. → *Catmull & Rom (1974); Wikipedia "Centripetal Catmull–Rom spline".*
- **GeoJSON & Natural Earth vector coastlines** — `[lon,lat]` order, Polygon vs MultiPolygon; the `[lon,lat]`↔`[lat,lon]` flip is a common bug. → *RFC 7946 (GeoJSON); Natural Earth 1:50m physical vectors.*
- **SVG viewBox as a camera** — `viewBox` defines a user-space→viewport mapping; `s(px)=px/z` counter-scales strokes so glyphs stay constant size. → *W3C SVG spec, "viewBox"; MDN "viewBox".*

**Judge Q&A.**
- *"Dijkstra minimizes hypot in degree-space — a longitude degree at 55°N is half the equator's. Isn't the routing wrong?"* → The weights are Euclidean-in-degrees (screen-space), not great-circle nautical miles, so we minimize *screen length*, not a real voyage. Accepted because the map is presentation-only — it never feeds scenario/charter/audit — and the goal is a plausible in-water polyline through the correct straits. Swapping to haversine is a one-line change; we didn't because it changes no decision or checkable number.
- *"How do you guarantee routes stay in water after Catmull-Rom bulges near coasts?"* → Build-time, every edge is rejected if its straight segment intersects a coastline ring (CCW test + bbox prefilter); `check-sea-routes.mjs` re-verifies. Honest risk: uniform Catmull-Rom can overshoot, so `clampHandle` caps each control handle to `seg/3`. Concession: we verify the polyline, not the analytic bezier, so a very sharp coastal turn could clip a few pixels — clamp + dense waypoints is a strong mitigation, not a proof.
- *"50m can't resolve Hormuz or Suez — how do you route through them?"* → Two hand-curated lists over the auto water-test: PORTALS force the real transits a coarse coastline walls off; BLACKLIST removes edges it wrongly reads as open water. So: "auto water-test, then human-corrected at exactly the straits that matter" — honest about the data's resolution.
- *"Why 70 hand-placed waypoints not a rasterized ocean + A*?"* → For a fixed known set of lanes, 70 waypoints hit every strait, the graph is tiny (O(V²) Dijkstra is instant), and every edge is human-inspectable. A raster+A* is more general but needs a fine grid and still needs manual fixes at the same straits. A deliberately scoped *route illustrator*, not a general marine router.
- *"`greatCircleArc` — is there geodesic math?"* → No: it's a cosmetic quadratic bezier with a perpendicular bend, used only as the two-point fallback; no spherical/geodesic computation anywhere. The name is legacy and slightly misleading.

**Traps.** Don't call `greatCircleArc` a great-circle route · don't claim routes are "optimal"/"shortest by distance" · don't say "guaranteed off-land to the pixel" (verified on the polyline; the bezier is only clamped) · don't imply the coastline is high-res (it's 50m; that's why PORTALS/BLACKLIST exist) · don't say it "uses AIS"/"real shipping lanes" · don't call plate carrée equal-area/distance-preserving · don't claim the geometry is "robust" against degenerate cases · **never imply routing/projection touches the derivation path.**

---

# The 6 hardest cross-layer questions

1. **"You keep saying deterministic, but there's an LLM in here — which is it?"**
   Draw the build/runtime boundary explicitly. The LLM runs *once, at build time* (temp 0.2),
   frozen into `src/cache/llm-cache.json`. At runtime the app does a static JSON import and
   never calls a model — the FORBIDDEN scan enforces no fetch over `src/engine`+`src/lib`. All
   model non-determinism lives *off* the derivation path; the scenario replay is a pure fold
   hashed with SHA-256 over canonical JSON. Same cursor → same bytes and head hash. **The LLM
   writes sentences; it never touches a number that gets hashed.**

2. **"Where is the decision actually made — LLM, model, or rules? Prove the authority chain."**
   Three tools, one authority. The generator (`options.ts`) enumerates/ranks the five levers
   and runs the deterministic `assayScreen` (the real chemistry box). The LLM only attaches
   advisory prose. The softmax (`refinery_model.ts`) only attaches an advisory tier+confidence
   (check.mjs asserts ≥85% agreement with the physical screen). **The zero-LLM critic
   (`criticize.ts`) is the veto** — six pure functions emitting `{article, rule_id, severity,
   evidence}`. The arbiter applies a fixed lattice. **The only actor that can reject an option
   is deterministic, citable code**; the two-file split (screen in `options.ts`, veto in
   `criticize.ts`) exists precisely so the authority is auditable.

3. **"You're replaying a known crisis and your chain is unsigned — isn't this curve-fit + tamper-theatre?"**
   Two concessions, two defenses. *Hindsight:* no out-of-sample holdout, so we never say
   "backtested" — the guard is `sweepStability()`, an OAT sweep showing the exposure ranking
   survives moving the numbers (limit: local OAT, not global Sobol). *Audit:* tamper-*evident*,
   not tamper-proof — a full re-chain from GENESIS passes `verifyChain`, because any unsigned
   chain needs the verifier to hold one unforgeable value (a signed head). Our substitute is
   determinism: anyone re-runs the pure pipeline and must reproduce the identical head hash —
   the reproducible build *is* the trusted head. Signing the head (+ the PDF prop) is the named upgrade.

4. **"Why nine layers and five tools instead of one big LLM agent?"**
   The thesis: *the weakest tool that is correct for each sub-problem* — because in a regulated,
   high-consequence decision the failure mode of an over-powerful tool is an *unauditable wrong
   answer*. Compliance is formalizable facts → a pure rule engine (can't hallucinate a veto,
   replays byte-identically) is strictly safer there (Rudin's interpretable-models argument).
   Chemistry is physics → an envelope screen. Prose has no ground truth → the only place the LLM
   is allowed. A single LLM agent collapses all of these onto a non-deterministic, non-citable
   path and breaks the hash-chained audit that is the moat. **Each layer is the minimum tool
   that makes its claim defensible.**

5. **"What breaks first at scale?"** (the honest engineering-limits question)
   Four named O(n)/approximation ceilings, each with a drop-in upgrade: (1) replay re-folds from
   event 0 + `ordered()` re-sorts each call → snapshot-plus-tail-replay; (2) the exposure graph
   is single-pass attenuation, not min-cost-flow → a real flow solver (Ahuja-Magnanti-Orlin);
   (3) the assay box + route-less concentration heuristic → a real `route` field + an LP; (4)
   maritime Dijkstra O(V²) with degree-space weights → haversine + a heap. **None are on the
   audit path**, so scaling them changes performance/fidelity, never the determinism guarantee.

6. **"Your canonical JSON and hashing are home-grown — why trust they're reproducible?"**
   The primitive isn't home-grown — SHA-256 is browser-native `crypto.subtle.digest` (FIPS
   180-4). Only the pre-hash serializer is ours, a deliberately small subset in the spirit of
   RFC 8785: sort keys, drop `undefined`, normalize `-0`→`'0'`, throw on non-finite, stringify
   with `String()` (pinned by ECMA-262 to the unique shortest round-trip). We don't claim full
   JCS compliance (no Unicode NFC; arrays rely on documented upstream sorts with id tiebreaks),
   and check.mjs proves the property empirically by hashing two full re-runs. **It's internally
   consistent for our own re-runs — that's the exact claim, no more.**

---

*Cross-references: `docs/TRINETRA-explained.md` (how it works), `docs/ml-architecture.md`
(right-tool-per-layer), `docs/nvidia-bakeoff.md` (LLM selection), `docs/data-provenance.md`
(R/E/S + KB freeze), `CONTRACTS.md` (frozen signatures), `scripts/check.mjs` (the 76 checks).*
