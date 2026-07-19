# TRINETRA — How it works, and why it's built this way

*The complete thinking behind the project: the problem, the innovation, the
architecture, and — deliberately — an honest ledger of what is real vs. modeled.*

Companion file: [`TRINETRA-deck.md`](TRINETRA-deck.md) (the presentation, incl. the Money slide).

---

## 1. In one paragraph

TRINETRA is a **governance layer over AI decisions**, demonstrated on India's crude
supply chain during the 2026 Strait of Hormuz crisis. It is a single-page, 100%
client-side React app that **deterministically replays** the crisis:
live-style signals → an exposure-graph re-score → machine-generated option cards →
a **Decision Charter** (an AI *proposer* → a **zero-LLM critic** → an *arbiter*) →
a **hash-chained audit trace** that re-runs byte-identically, offline. The point is
not to predict the crisis. The point is to show a recommendation that **argues under
rules you wrote**, where a *machine — not a model — enforces the rules*, and every
accept/reject is on the record.

---

## 2. The problem: institutional latency, not information

When the Strait of Hormuz was declared closed on **4 March 2026**, the binding
constraint on India was **not** a lack of route information. It was **institutional
convergence latency** — everyone in different spreadsheets, for weeks. The reframe
that drives the whole design:

> The binding constraint in 2026 wasn't route information; it was institutional
> convergence latency. TRINETRA doesn't buy crude. **It makes the room agree faster.**

Why India specifically is exposed (all figures carry provenance; see §7):
- **~88% crude import dependence** (FY25, PPAC via ORF/EIA) — crossed **90% in FY26 for the first time ever** (EY/PPAC).
- Imports **~4.5–4.9 mb/d**; **Hormuz carries ~20.9 mb/d (~20% of global oil)** (EIA, 1H25).
- Strategic reserves cover **~9.5 days** on a net-import basis (ISPRL/MoPNG) vs the **IEA 90-day norm**.

The honest scope: ~75% of imports are term contracts (treated as a fixed baseline).
TRINETRA optimizes only the **flexible spot sliver plus crisis levers** — and it says
so. Rerouting in 2026 covered **<15%** of exposed flow and landed in week 5+. The
tagline captures the real thesis: *"The buffer isn't barrels; it's decision speed."*

---

## 3. The core innovation: constitutional governance of an AI decision

Most teams show **an AI that answers**. TRINETRA is **an AI that argues — under rules
you wrote** — and then hands you a signed record of the argument.

Three properties make the governance real rather than cosmetic:

### 3.1 The critic is *different code*, not a second prompt
The decision loop has three roles, and only the first and last touch an LLM:

| Role | Does | LLM? | File |
|---|---|---|---|
| **Proposer** | Attaches rationale to machine-generated option cards. Never reorders or filters. | Yes — **cached at build time** | [`propose.ts`](../src/engine/charter/propose.ts) |
| **Critic** | Emits structured objections `{article, rule_id, severity, evidence}` from **pure functions**. | **No — zero LLM** | [`criticize.ts`](../src/engine/charter/criticize.ts) |
| **Arbiter** | Applies a deterministic **severity lattice** → verdict + conditions. | No | [`arbitrate.ts`](../src/engine/charter/arbitrate.ts) |

> **Hard rule (CLAUDE.md #3):** the critic contains **zero LLM**. Objections are
> computed facts `{article, evidence, severity}`; the LLM only narrates elsewhere.

Because the critic is deterministic code, it **cannot hallucinate a veto**, every
objection **cites its Article and its evidence**, and the demotion "already happened in
code" before any sentence is written. The narration line built into the demo:

> "The critic didn't have an opinion. It ran the sanctions list, the assay table, and
> the calendar. The language model just wrote the memo."

### 3.2 The Decision Charter — a written constitution the AI is bound by
[`data/charter.json`](../data/charter.json) — seven articles, human-authored, and
**editable live** (two carry tunable parameters):

| # | Article | Parameter | Enforced by |
|---|---|---|---|
| **A1** | Completeness — no option silently dropped | — | structural (proposer never filters) |
| **A2** | Security floor — no plan leaves a refinery below the cover floor | `min_cover_days = 10` | `securityFloorValidator`, `voyageVsBufferValidator` |
| **A3** | Concentration cap — no corridor carries more than a capped share | `max_corridor_share = 0.35` | `concentrationValidator` |
| **A4** | Sanctions transparency — declare the payment rail; RED never laundered in | — | `sanctionsValidator` |
| **A5** | Stated uncertainty — every quantitative claim carries provenance; assay fit stated | — | `assayValidator`, `freshnessValidator` |
| **A6** | Reversibility — prefer options that can be unwound mid-voyage | — | structural (surfaced in ranking/memo) |
| **A7** | Traceability & human sovereignty — every verdict hash-chained; a human can override, logged | — | `audit.ts` + human override |

The framing that keeps this apolitical: *"This charter doesn't govern India's choices.
It governs what India's choices deserve: **honest paper**."*

### 3.3 How this relates to "Constitutional AI"
TRINETRA borrows the **architecture** of Constitutional AI — a written constitution
governing an AI's proposals through a propose → critique → arbitrate loop — but makes
two deliberate moves:
1. It runs the loop **at decision time** (operational governance), not as a training objective.
2. It replaces the **AI critic** with a **zero-LLM** one. Anthropic uses an AI critic
   because open-ended text alignment has no ground-truth rulebook. A crude-supply
   decision is the opposite: the constraints *are* formalizable (a days-of-cover floor,
   an OFAC rail, an assay envelope, a concentration cap), so a deterministic critic is
   both possible and strictly safer — reproducible, citable, un-hallucinating.

Call it **constitutional governance of AI decisions**: Constitutional AI turned into an
auditable control system rather than a training signal. (On stage: say "constitutional
AI" out loud exactly once; the screen always reads **"Decision Charter."**)

---

## 4. How it works, end to end

The canonical pipeline ([`pipeline.ts`](../src/lib/pipeline.ts)):

```
signals ─▶ rescore ─▶ generateOptions ─▶ propose ─▶ criticize ─▶ arbitrate ─▶ audit
(events)  (scenario)   (5 levers)        (LLM text)  (ZERO LLM)   (lattice)   (hash chain)
```

**Three entry points**, all through the same pure `decide(...)`:
- `computeAt(data, t_sim, charter)` — the **live replay**; always replays from event 0 (seek = full rebuild).
- `computeScenario(data, shocks, charter)` — the **what-if sandbox**; a user-built `ShockContext` fed straight to `rescore`. Same engine ⇒ same determinism; only the inputs are hypothetical.
- `rerunWithCharter(...)` — the **Beat-2 charter edit**; re-runs `criticize` + `arbitrate` on the current options with the edited charter. *No re-propose, no re-generate.*

### 4.1 `rescore` — signals → ScenarioState ([`scenario.ts`](../src/engine/scenario.ts))
Pure and deterministic. It parses active shocks to shocked chokepoints, applies **flow
multipliers** (partial ≈ 0.5, severe ≈ 0.1 — calibration-overridable), marks edge status
(`open/risk/closed`) and effective volume, then computes per-refinery **days-of-cover** and
the national **gap_kbd**. The cover model is an *explicit, testable assumption*:

> `cover = baseline × (0.4 + 0.6 × supplyRatio)` — full supply keeps baseline cover;
> zero supply still leaves a 40% floor (strategic reserves / demand cuts).

`ScenarioState = { t_sim, shocks_active[], node_status{}, edge_status{}, cover_days{}, gap_kbd, brent_usd }`.

### 4.2 `generateOptions` — the five crisis levers ([`options.ts`](../src/engine/options.ts))
The action space, deliberately small and honest (rerouting is the *slowest, smallest* lever):

| Lever | What it does |
|---|---|
| `stock_draw` | SPR release covering the gap (capped) |
| `divert_on_water` | Redirect an on-water cargo from a healthy refinery to a critical one |
| `floating_storage` | Draw down a floating parcel |
| `reroute` | Buy a spot cargo and route it to a stressed refinery — runs an assay screen + the trained compatibility model |
| `demand_side` | Run-cut / product-import equivalent |

The generator **ranks but never rejects** — "nothing is rejected here; proposer /
critic / arbiter own judgment" (Article A1). Deep-discount origins (Iran/Russia/Venezuela)
stay *cheap on purpose* so the critic, not the generator, is what demotes them.

### 4.3 `criticize` — the zero-LLM validators, each bound to an Article
Six pure functions ([`criticize.ts`](../src/engine/charter/criticize.ts)), each emitting
`Objection { article, rule_id, severity ∈ {block, flag, note}, message, evidence, validator }`:

| Validator | Article | Fires |
|---|---|---|
| `assayValidator` | A5 | `CANNOT_RUN` → **block**; `BLEND` → flag (names the binding dims) |
| `voyageVsBufferValidator` | A2 | voyage > cover below the floor → **block**; else > 0.75× cover → flag |
| `sanctionsValidator` | A4 | rail `RED` → **block**; `AMBER` → flag (with snapshot note) |
| `concentrationValidator` | A3 | corridor share > cap → flag (names the corridor + %) |
| `freshnessValidator` | A5 | evidence derived from SYNTH-labeled data → note |
| `securityFloorValidator` | A2 | gain still leaves refinery below the floor → note |

Output is sorted by `(option_id, rule_id)` and every objection id is deterministic
(`${rule_id}:${option_id}`) — so the same inputs always produce the same objections in
the same order.

### 4.4 `arbitrate` — the severity lattice ([`arbitrate.ts`](../src/engine/charter/arbitrate.ts))
Deterministic verdict:

> **any `block` ⇒ rejected; else any `flag` ⇒ conditional; else validated.**

With one designed nuance: a **satisfiable block** (e.g. a voyage-gap that a same-batch
stock-draw bridge can cover) becomes `conditional` with the bridge stated, rather than
rejected. Conditions are the sorted, de-duplicated objection messages.

### 4.5 `audit` — the hash chain ([`audit.ts`](../src/engine/charter/audit.ts))
Every proposer/critic/arbiter/user action appends an immutable entry:
`{ seq, ts_sim, actor, action, input_hash, output_hash, prev_hash, refs }` where hashes
are `sha256(canonicalJson(x))` and `prev_hash` links to the previous `output_hash`
(`GENESIS` at seq 0). `verifyChain` re-walks every link; a tampered entry fails. This is
the artifact a fine-tuned forecaster *cannot* produce — and the physical prop handed to
judges is this trace exported as a signed one-page PDF.

---

## 5. Determinism and airplane mode

The whole derivation path is pure:

> **Hard rule (CLAUDE.md #2):** no `Date.now()` / `Math.random()` in any derivation.
> Sim time (`ts_sim`) only. Byte-identical replay is a judged claim.

No network calls at runtime — LLM text comes from a build-time cache, so the demo runs
in airplane mode. `scripts/check.mjs` runs the whole pipeline twice and asserts the audit
hashes are identical. The closing line of Beat 2 is the payoff: *"Run it again —
byte-identical. Try that with a prompt."*

---

## 6. The ML architecture: the right tool per layer

The answer to *"why only one LLM — where's your own ML?"* is the architecture itself,
**chosen by what each layer is allowed to get wrong** ([`ml-architecture.md`](ml-architecture.md)):

| Layer | Job | Tool | Why |
|---|---|---|---|
| **Enforcement** | sanctions / assay / voyage veto | **pure-function rules, zero AI** | must be reproducible + citable, and cannot hallucinate |
| **Prediction** | crude ↔ refinery compatibility | **our trained model** (softmax regression, frozen weights) | a number must be defensible and byte-identical every run |
| **Language** | proposer rationale + arbiter memo | **LLM, cached at build time** | only the *sentence* may vary — and even that is frozen for offline replay |

> "One big LLM" fails all three: it would hallucinate the compliance check, give a
> different number every run, and can't be replayed — destroying the hash-chained audit
> trail that is the moat.

### 6.1 Our trained model ([`refinery_model.ts`](../src/engine/refinery_model.ts))
A **multinomial logistic (softmax) regression** over `RUN_NOW / BLEND / CANNOT_RUN`,
from **7 features** (6 signed assay-envelope exceedances + `frac_dims_outside`). Weights
are **frozen** in [`refinery_model.json`](../data/refinery_model.json) (3×7 matrix),
fit at build time by [`train-refinery-model.mjs`](../scripts/train-refinery-model.mjs)
(seeded gradient descent, 400 iters). Inference is pure/deterministic — safe on the
byte-identical replay path. It surfaces a `tier + confidence` on reroute cards
(e.g. *"Merey 16 → Jamnagar · Blend only 86%"*). **It is advisory; the zero-LLM critic
stays the authority**, and model↔physical-screen agreement is checked (≥85%).

Honest caveats (say these): the model is trained on **synthetic crudes labeled by the
physical screen** (prov **E** — expert-labeled, never re-badged R); its ~100% train
accuracy measures *rule-recovery*, not real-world hit rate. The upgrade path — swap in
real PPAC/tanker-tracking run histories — changes only the model file.

### 6.2 The language layer ([`nvidia-bakeoff.md`](nvidia-bakeoff.md))
The proposer/memo cache is generated by a bake-off across NVIDIA NIM models on the real
build-time prompts; the winner was chosen for being *simultaneously format-compliant,
arithmetically correct, and free of invented dollar figures.* The systemic finding is
itself the pitch: the dominant failure mode was **unit-mangling the cargo size and
inventing prices — exactly the failure class the zero-LLM critic exists to catch.**
*(Provenance note: the bake-off scores ship without raw logs — present them as
illustrative unless the run logs are attached.)*

---

## 7. Provenance and the KB-freeze — the honesty apparatus

Every data leaf is `{ value, prov, source, as_of }`:

| prov | Meaning | On-screen chip |
|---|---|---|
| **R** | Real-sourced — verbatim from a named public record | **LIVE** (green) |
| **E** | Estimated — derived from real sources with a stated method | **CACHED** (amber) |
| **S** | Synthetic — invented for scenario plumbing, **never upgraded** | **SYNTH** (purple) |

> The honest claim is not "everything is real" — it's **"nothing is fabricated, and
> every number shows exactly how certain it is."**

**KB-freeze discipline** (the hindsight-bias firewall): structural knowledge cites only
**pre-2019** sources (Basrah *Light*, not Medium — which didn't exist until 2021 and has
been removed from the dataset; Urals unsanctioned; "Angola" is not known, it *emerges* from
a query). Calibration constants are **stated, sensitivity-swept assumptions** anchored to
earlier crises (Abqaiq 2019, Suez 2021, Red Sea 2023-24) — **never fit to the Hormuz-2026
outcomes the demo replays**. **May claim** on stage: replayed real feeds, frozen KB, top-5
recall with misses shown. **May never claim:** live feeds, prediction of outcomes, or R
status for any synthetic number.

Real sources actually used include: EIA (RBRTE daily Brent; World Oil Transit
Chokepoints; TIE disruption reports), PPAC / EY / ORF (import dependence, reserves,
capacity), producer assays (TotalEnergies, ADNOC, ExxonMobil, SOMO, BP/OGJ), OFAC SDN +
EUR-Lex sanctions with snapshot dates, and named press for the 2026 timeline (Al Jazeera,
UK HoC Library CBP-10636, Britannica). What stays **synthetic**: dark-vessel AIS
positions, per-refinery days-of-cover, and spot-cargo availability (all commercially
confidential).

---

## 8. The two deterministic demo beats

**Beat 1 — the critic demotes Merey.** At the Hormuz-closure event, the proposer ranks
Venezuelan **Merey 16 → Jamnagar** highly on cost. The zero-LLM critic fires **three
flags** — (1) **43 d** voyage vs **12.2 d** cover buffer (A2), (2) payment rail AMBER /
OFAC comfort letter required, snapshot 2026-03-01 (A4), (3) needs BLEND: **API 16 < envelope
min 18, too heavy** (A5) — and the arbiter demotes it to **conditional** with those three
sorted conditions. *(Correction baked into the engine: the earlier "TAN 3.3" reason was a
**fabricated value and has been removed**; Merey's real assay is API 16 / S 2.45 / TAN 0.69,
and it now demotes for the honest reason — it is too heavy to run neat.)*

**Beat 2 — change one rule, get a different plan.** Editing Article A2's security floor
**10 → 15** re-runs only critique + arbitration. Jamnagar's **12.2-day** cover now falls
below the new floor, so **six** Jamnagar-targeting cards (Cabinda, Girassol, Merey, Tupi,
Urals, WTI Midland) escalate **flag → block → rejected**, each printing its rule trace.
Revert to 10 and the Beat-1 end-state **hashes reproduce exactly**.

---

## 9. Scale is config, not code

The engine is graph-agnostic: a different supply chain is a different **data bundle**,
not different code. `scripts/check.mjs` proves the same engine runs an arbitrary graph
deterministically, and `npm run scale-demo` loads a second (illustrative) theatre in the
CLI. The claim on the slide — *"one strait this week; every chokepoint, every commodity,
next"* — with an honest footer about what productionizing live feeds would take.

---

## 10. Honesty ledger — what is real vs. modeled

Carry this into every slide and Q&A. It is a scored *feature*, not a liability.

| Claim / number | Status |
|---|---|
| 2026 Hormuz closure event (4 Mar; reopening mid-June) | **R** — documented, multiply sourced |
| Brent price path $71→$77→$100+→$126 | **R** (SOLID) — EIA RBRTE |
| Chokepoint flows, import dependence, SPR days, assays | **R** — EIA / PPAC / producer assays |
| Historical analog disruption + Brent moves | **R** — EIA/Britannica cited |
| Refinery compatibility model | **E** — synthetic, rule-labeled; ~100% = rule-recovery |
| Per-refinery days-of-cover, spot availability, dark-vessel AIS | **S** — modeled/synthetic, labeled on screen |
| Cost-of-delay $ figures | **E / directional** — order-of-magnitude, spot share ~30% is an estimate |
| "6-day decision lag" | **E / asserted** — load-bearing but not sourced in-repo; label it |
| NVIDIA bake-off scores | **S / illustrative** — no raw logs shipped |
| Pricing ($150k/desk), 200× ROI, Kpler/Vortexa benchmark | **S** — product decisions / uncited benchmark |

**Previously-known inconsistencies — now reconciled repo-wide (2026-07-07):** (a) the
fabricated "TAN 3.3" reason is gone everywhere — Merey demotes on **API 16 < min 18**;
(b) the closure date is standardized to **March 2026** (June refers only to the reopening);
(c) the Venezuela figure is resolved in the event data (**284 kb/d**, "292 debunked");
(d) the "West-African cards survive the floor-15 edit" claim is dropped — the engine demotes
all six Jamnagar-targeting cards, and the market-as-validator claim now refers to the pre-edit
top-5 option set. The Merey voyage/cover/snapshot values (**43 d / 12.2 d / 2026-03-01**) match
the live engine, and `npm run check` is **87/87**.

---

## 11. How each judging criterion is addressed

| Criterion | Weight | Carried by |
|---|---|---|
| Innovation | 25% | zero-LLM critic; live charter edit with rule traces; frozen-KB firewall; signed audit-trace PDF; right-tool-per-layer |
| Business Impact | 25% | the Money slide (§ Money in the deck); public testimony + market-as-validator; pricing + ask |
| Technical Excellence | 20% | deterministic core / LLM-at-the-edges architecture; byte-identical replay; hash-chained audit |
| Scalability | 15% | "scale is config, not code" + a second theatre in the same engine |
| User Experience | 15% | one-screen terminal, five choreographed beats, provenance chips, projector-proofed contrast |

---

## 12. Repo map

- `src/contracts/` — frozen types + zod schemas (single source of truth).
- `src/lib/pipeline.ts` — the orchestration (`computeAt` / `computeScenario` / `rerunWithCharter`).
- `src/engine/scenario.ts` — `rescore` (days-of-cover, gap).
- `src/engine/options.ts` — the 5 levers.
- `src/engine/charter/` — `propose` / `criticize` (zero-LLM) / `arbitrate` / `audit`.
- `src/engine/refinery_model.ts` — the trained compatibility model.
- `data/*.json` — all real-world data, every leaf carrying `prov / source / as_of`.
- `docs/` — plan, beats, provenance, ml-architecture, this file, and the deck.

**Run it:** `npm run dev` (app) · `npm run build` (typecheck + bundle) · `npm run check`
(deterministic self-checks — replay twice, identical hashes).
