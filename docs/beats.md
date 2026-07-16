# TRINETRA — Theatrical Beats: Deterministic Spec

Acceptance criteria for the two judged beats. Both beats MUST re-run byte-identically
(`canonicalJson` equal) — they are asserted by `scripts/check.mjs`, not eyeballed.
Shapes per `src/contracts/types.ts`; lattice per CONTRACTS.md §2 (SWE5 `arbitrate`):
**any `block` ⇒ rejected; else any `flag` ⇒ conditional (conditions = flag messages, sorted);
else validated.**

> ⚠️ This spec resolves several ambiguities in plan.md. Resolutions are marked **[PROPOSED]**
> and listed in DECISIONS-NEEDED at the bottom. Engineers implement the [PROPOSED] values
> unless LEAD overrides; PM1 supplies matching data.

Canonical ids used below (PM1 must use these exact ids in `data/*.json`):
grade `merey16`, refinery nodes `ref:jamnagar`, `ref:paradip`, charter article `A2`
(`param_key: 'min_cover_days'`, default `param_value: 10`).

---

## Beat 1 — "Critic demotes Merey" (demo t≈2:20–3:30)

### Trigger

| Item | Expected value |
|---|---|
| Trigger event | `evt:hormuz2026:closure` **[PROPOSED id — PM1 to confirm]**, the event carrying `triggers: ['shock:hormuz_closure']` |
| Pipeline | applyNext → rescore → generateOptions → propose → criticize → arbitrate (CONTRACTS.md §2 pipeline order) |
| Precondition | `scenario.shocks_active` includes `shock:hormuz_closure`; reroute-lever cards generated, incl. two Merey cards (below) |

### Proposer ranking (pre-critic)

| Assertion | Expected |
|---|---|
| Merey hero card id | `opt:reroute:merey16:jamnagar:0` **[PROPOSED — see D1]** |
| Merey sibling card id | `opt:reroute:merey16:paradip:0` (collapsed row in UI, never zoomed) |
| Cost rank of Merey hero card among `lever === 'reroute'` cards, ascending `cost_delta_usd_bbl` | **#2** |
| `status` of all cards pre-arbitrate | `'proposed'` |
| Card fields (hero) | `voyage_days: 38` (eta_days: 43 — the buffer objection prints the 43-day eta), `payment_rail: 'AMBER'`, `compat_tier: 'BLEND'`, `compat_binding` includes `'api'` (too heavy: API 16 < Jamnagar min 18) |

### The exact 3 objections on the hero card (`opt:reroute:merey16:jamnagar:0`)

Objection.id = `${rule_id}:${option_id}`; output sorted by (option_id, rule_id).

| # | rule_id | article | validator | severity | message must contain | evidence |
|---|---|---|---|---|---|---|
| 1 | `A5.assay_compat` | A5 | `assayValidator` | **flag** (Jamnagar) | `api 16 < min 18` — Merey is too heavy for Jamnagar's envelope (`api [18,45]`); admitted only via blend (`max_blend_ratio 0.87`) | grade `gr:merey-16` assay record + `ref:jamnagar.assay_env` |
| 2 | `A4.payment_rail` | A4 | `sanctionsValidator` | **flag** | `OFAC` + rail `AMBER` + snapshot date `2026-03-01` (snapshot-dated, never undated) | `sanctions_rules.json` entry for `Venezuela` |
| 3 | `A2.voyage_vs_buffer` | A2 | `voyageVsBufferValidator` | **flag** | `43 d` voyage vs `12.2 d` cover at `ref:jamnagar` | edge transit + `scenario.cover_days['ref:jamnagar']` |

On a hypothetical **Paradip card**, the same validators would emit **blocks**:
`A5.assay_compat` = **block** (API 16 too heavy, no blend path) and
`A2.voyage_vs_buffer` = **block** (Paradip cover < `min_cover_days` floor). `A4.payment_rail`
remains flag. → sibling card is **rejected**.

**[PROPOSED] severity rule for `A2.voyage_vs_buffer`** (makes Beat 2 fall out for free):
- `block` if `voyage_days > cover_days(target)` AND `cover_days(target) < min_cover_days`
- `flag` if `voyage_days > cover_days(target)` AND `cover_days(target) >= min_cover_days`
- no objection otherwise.
With floor 10: Jamnagar (12.2 d) → flag; a sub-floor refinery (<10 d) → block.

**Severity rule for `A5.assay_compat`**: `block` if `compat_tier === 'CANNOT_RUN'`
at the target; `flag` if `'BLEND'` with a binding dimension exceeded neat; none if `'RUN_NOW'`.

### Expected arbiter outcome

| Assertion | Expected |
|---|---|
| Hero card final `status` | `'conditional'` |
| Hero card `conditions` | exactly the 3 flag messages, **sorted** (per frozen lattice) — i.e. named conditions covering: OFAC waiver branch in force; max blend ratio respected at Jamnagar; cover bridged by levers 1–2 until ETA |
| Sibling Paradip card final `status` | `'rejected'` |
| UI verdict text | 4-word verdict at 18px, e.g. `DEMOTED — CONDITIONS APPLY` (SWE6) |
| Determinism | second run of criticize+arbitrate on same inputs ⇒ identical `canonicalJson` |

Note: the frozen lattice makes "conditional with 3 named conditions" **mathematically require
3 flags and 0 blocks** on the hero card. Any spec putting a `block` on the hero card
contradicts the demanded outcome — see D1/D2.

### Expected audit entries (appended this tick, hash-chained)

| seq (relative) | actor | action | refs include | checks |
|---|---|---|---|---|
| n | `proposer` | `propose` | all option ids | `prev_hash` = prior entry's `output_hash` (or `GENESIS`); `llm_cache_key` set |
| n+1 | `critic` | `criticize` | all objection ids (incl. the 3 above + 3 sibling objections) | `input_hash = sha256Hex(canonicalJson(input))` |
| n+2 | `arbiter` | `arbitrate` | option ids with final statuses | chain intact; `ts_sim` = trigger event `t` (never wall clock) |

---

## Beat 2 — "Charter edit" (demo t≈3:30–3:45)

### Trigger

| Item | Expected value |
|---|---|
| Action | `setCharterParam('A2', 15)` (store action; Charter panel edit 10 → 15) |
| Pipeline | re-run `criticize` + `arbitrate` on current options with updated charter; append audit entries. No re-propose, no re-generate. |

### Expected re-sort (which cards demote, and why)

With `min_cover_days: 15`, every refinery with `cover_days < 15` is now below floor, so
`A2.voyage_vs_buffer` escalates flag→block wherever `voyage_days > cover_days` at such a
refinery ([PROPOSED] rule above).

**OBSERVED (authoritative):** raising A2 to 15 demotes exactly **6** cards
conditional→rejected — every long-haul reroute targeting Jamnagar, whose 12.2 d cover is now
below the 15 d floor, so its `A2.voyage_vs_buffer` flag escalates to a block:

| Card | Before | After | Why |
|---|---|---|---|
| `opt:reroute:gr:cabinda:ref:jamnagar:1` | conditional | **rejected** | Jamnagar 12.2 d < 15 d floor → voyage flag escalates to block |
| `opt:reroute:gr:girassol:ref:jamnagar:2` | conditional | **rejected** | same |
| `opt:reroute:gr:urals:ref:jamnagar:3` | conditional | **rejected** | same |
| `opt:reroute:gr:tupi:ref:jamnagar:6` | conditional | **rejected** | ~35 d Brazil voyage; same |
| `opt:reroute:gr:wti-midland:ref:jamnagar:7` | conditional | **rejected** | ~30 d US Gulf voyage; same |
| `opt:reroute:gr:merey-16:ref:jamnagar:8` | conditional | **rejected** | its 43 d voyage flag escalates to block (12.2 < 15) |

The Angolan/West-African cards (Cabinda, Girassol) are demoted **too** — they do not survive
the stricter floor. (The market-as-validator claim is about the pre-edit **top-5 option set**
matching what desks bought, not about surviving a 15-day floor.)

Exactly the demoted cards get the 2 s amber ring; FLIP re-sort 800 ms; sorted by
(lever, id) in engine output, by display rank in UI (plan.md §8 moment 3).

### Expected rule traces printed per changed card (150 ms apart)

Trace line = the objection `message`, prefixed by `rule_id`, formatted via `fmt.ts`:

```
A2.voyage_vs_buffer  voyage 43 d > cover 12.2 d · floor 15 d — BLOCK   (Merey → Jamnagar)
A2.voyage_vs_buffer  voyage 35 d > cover 12.2 d · floor 15 d — BLOCK   (Urals → Jamnagar)
A2.voyage_vs_buffer  voyage 30 d > cover 12.2 d · floor 15 d — BLOCK   (WTI Midland → Jamnagar)
```

(observed: raising the floor to 15 demotes exactly 6 Jamnagar-targeting cards — see APPENDIX;
each prints one trace naming `A2.voyage_vs_buffer`, the voyage days, the cover days, and the new floor.)

### Expected audit entries

| seq (relative) | actor | action | checks |
|---|---|---|---|
| m | `user` | `set_charter_param` | refs `['A2']`; note records `10 -> 15`; `ts_sim` = current sim time |
| m+1 | `critic` | `criticize` | objection set differs from Beat 1 only in `A2.voyage_vs_buffer` severities/instances |
| m+2 | `arbiter` | `arbitrate` | statuses as table above; chain intact from entry m |

Reverting to 10 and re-running MUST reproduce the Beat-1 end state hashes exactly.

---

## DECISIONS-NEEDED (RESOLVED — the APPENDIX below records observed behavior and supersedes any [PROPOSED] answer here that differs)

- **D1 — Which refinery does the hero Merey card target?** plan.md §6 seeds Merey's killer
  dim (V ~400+ ppm) and the beat cites "Paradip max 1.5", but brainstorm §1.3 says Merey
  runs only at "Jamnagar/Vadinar/Paradip-class" refineries. [PROPOSED]: two cards — hero
  targets **Jamnagar** (flags → conditional), sibling targets **Paradip** (blocks → rejected),
  so the demo shows both the block and the conditional without breaking the lattice.
- **D2 — Block vs conditional contradiction.** The beat brief assigns `severity: block` to
  the assay (Paradip) and voyage objections, yet demands final status `conditional` with 3
  conditions. Under the frozen lattice any block ⇒ rejected. [PROPOSED]: hero-card
  objections are all flags (D1). If LEAD instead wants a single Merey card, either the
  lattice or the outcome claim in plan.md §2/§9 (Q&A #5 "demoting it to Conditional") must change.
- **D3 — Article for the assay validator. RESOLVED → A5.** The shipped `assayValidator`
  emits under **Article A5** (stated uncertainty / physical executability), rule id
  `A5.assay_compat`. (The earlier [PROPOSED] "A2.assay_env under A2" is superseded.)
- **D4 — 10 vs 12 day buffer.** Beat 1 cites a "12-day cover buffer", Beat 2 edits "10 → 15".
  [PROPOSED reconciliation]: **12 d = Jamnagar's scenario `cover_days` at beat time** (data),
  **10 = charter `min_cover_days` default** (rule). PM1 must set Jamnagar cover to 12 at the
  Beat-1 timestamp or the on-screen line "43-day voyage vs 12.2-day cover" is wrong.
  **RESOLVED (observed):** Jamnagar scenario cover = 12.19 d; the objection prints "43 d voyage vs 12.2 d cover."
- **D5 — March vs June closure. RESOLVED → March 2026.** The engine runs the beat at
  `2026-03-15` (closure declared 4 Mar 2026; the strait reopened mid-June 2026). All slides,
  the ticker, and the 148-word summary use **March 2026** for the closure; "June" only ever
  refers to the *reopening*.
- **D6 — Beat-2 demoting cards. RESOLVED (observed):** raising A2 to 15 demotes **6** cards
  conditional→rejected — `cabinda`, `girassol`, `merey-16`, `tupi`, `urals`, `wti-midland`,
  all → `ref:jamnagar`. **WAF/Angolan cards do NOT survive** — the earlier "WAF survives /
  matches what desks bought" line was inconsistent with the engine and is dropped. The
  market-as-validator claim is about the pre-edit **top-5 option set**, not survival of the stricter floor.
- **D7 — Venezuela kb/d figure. RESOLVED (in data):** `hormuz2026_events.json` now carries
  `venezuela_kbd: 284` for 2026-04 with the note "292 kb/d figure debunked" (283–285 Apr
  range, agency-dependent). No slide shows a bare 292; use 284 (or the 283–285 range) with its month.

---

## APPENDIX — OBSERVED BEHAVIOR (integration run)

Recorded by INTEGRATION from `npm run check` (76/76 passing) over the real
`hormuz2026` bundle at sim time `2026-03-15T00:00:00Z` (post-Mar-11 attack wave;
`shock:hormuz-partial` + `shock:hormuz-severe` active). These empirical values
supersede the [PROPOSED] figures above where they differ (LEAD rulings D1–D6).

- **Scenario:** `gap_kbd = 1657.5`, Brent = 112.4 (last PRICE ≤ t_sim),
  **Jamnagar scenario cover = 12.19 d** (D4: the "12-day buffer" verified; baseline
  15 d × severe-shock supply ratio 0.6875).
- **Hero card:** `opt:reroute:gr:merey-16:ref:jamnagar:8` (rank 8, not 0 — long-haul
  eta tier ranks it last within reroute despite the $1.0/bbl discount-adjusted delta).
  No Merey→Paradip sibling exists: Paradip stays supply-`ok` under the shock, and no
  Venezuela→Paradip edge is in the graph (D1: acceptable).
- **Beat 1 objections on the hero card (exactly 3 flags, 0 blocks → `conditional`):**
  1. `A2.voyage_vs_buffer` flag — `43 d voyage vs 12.2 d cover buffer — Article A2`
  2. `A4.payment_rail` flag — `payment rail AMBER — OFAC comfort letter required per cargo. Snapshot 2026-03-01. — Article A4`
  3. `A5.assay_compat` flag — `grade gr:merey-16 needs BLEND at ref:jamnagar: api 16 < min 18/max_blend_ratio 0.87 binding — Article A5`
     (updated 2026-07-07: Merey's assay is now real — API 16 / S 2.45 (corroborated), TAN 0.69, V 262 ppm. The binding
     constraint is that it is **too heavy** (API 16 < envelope min 18), not a high TAN. The earlier `tan 3.3` was a
     fabricated value and has been removed; the beat still demotes Merey, now for the honest reason.)
  Conditions = the 3 flag messages, sorted (frozen lattice). Shipped rule ids:
  `A2.voyage_vs_buffer`, `A4.payment_rail`, `A5.assay_compat`.
- **Floor coupling (resolves D2/Beat-2):** `A2.voyage_vs_buffer` severity is now
  floor-aware — eta > cover at a refinery **below** `min_cover_days` ⇒ block
  (unbridgeable); at/above the floor ⇒ flag. With floor 10 and Jamnagar at 12.19 d
  the hero card is a flag → conditional; low-cover targets block → rejected.
- **Beat 1 full deck at floor 10:** conditional = cabinda→jamnagar, girassol→jamnagar,
  merey→jamnagar, tupi→jamnagar, urals→jamnagar, wti-midland→jamnagar;
  rejected = bonny→mangalore, urals→mumbai, urals→visakh (target cover < 10 d);
  validated = stock_draw, floating_storage, demand_side, 14× divert→kochi.
- **Beat 2 (D6 answer) — `setCharterParam('A2', 15)` demotes exactly these 6 cards
  (conditional → rejected):**
  `opt:reroute:gr:cabinda:ref:jamnagar:1`, `opt:reroute:gr:girassol:ref:jamnagar:2`,
  `opt:reroute:gr:merey-16:ref:jamnagar:8`, `opt:reroute:gr:tupi:ref:jamnagar:6`,
  `opt:reroute:gr:urals:ref:jamnagar:3`, `opt:reroute:gr:wti-midland:ref:jamnagar:7`.
  (Jamnagar's 12.19 d cover falls below the new 15 d floor, so every long-haul card
  targeting it escalates flag→block. WAF cards do NOT survive at 15 — the [PROPOSED]
  "WAF validated" row was inconsistent with its own rule and is superseded.)
  Audit gains `user/set_charter_param (note "10 -> 15")` → proposer → critic → arbiter
  entries; chain verifies end-to-end.
- **Determinism:** two full pipeline runs at the same t_sim are `canonicalJson`-equal
  including all audit hashes (checked in `scripts/check.mjs`).

### Beat 3 (bonus, post-T) — "Nayara buyer override"

`evt:ukmto-2026-04-08-bab-el-mandeb` (prov S, scenario choreography) carries
`shock:bab-el-mandeb-partial`. From 2026-04-08 onward the Suez-routed
`edge:urals-vadinar` degrades (0.6 flow mult), Vadinar falls to `stressed`
(ratio 0.60), and the reroute generator emits a Urals→Vadinar card over the
Cape edge. The `buyer:Nayara` sanctions rule (EU 18th package, Jul 2025) then
overrides the origin-country rail → **RED → critic block → rejected**, with the
designation note printed on the collapsed row. Before 2026-04-08 the override is
provably dormant, so Beats 1–2 at `2026-03-15T00:00:00Z` are byte-identical to
the values above (asserted by the three `nayara:` checks in `scripts/check.mjs`).
