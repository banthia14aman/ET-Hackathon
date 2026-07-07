# TRINETRA — Group Brainstorm Brief
*10-agent session: 3 problem-finders (technical skeptic, oil-domain realist, judge/VC) + 7 solution agents. July 5, 2026.*

---

## THE ONE SENTENCE (pitch)

> **"When Hormuz closed, India took six days to reroute crude; TRINETRA does it in four minutes — and shows you the argument, under rules you wrote."**

Backup lines:
- Thesis line: *"India can't buy China's 120 days of storage — but it can stop spending its first 10 days of a crisis in meetings."*
- Venture line (Q&A): *"Storage buys you days. TRINETRA makes them count."* (kills the "software substitutes for storage" overclaim — we complement reserves, never replace them)

---

## PART 1 — THE 30 PROBLEMS (ranked digest)

### FATAL (would lose the hackathon if unaddressed)
1. **Circular backtest / hindsight bias** (all 3 agents). Built in July 2026 knowing India chose Angola/Venezuela; 2026 crisis was in both calibration set AND validation target. "Was Angola in your database before you knew the answer?" kills the demo.
2. **AIS dead zone mid-Hormuz.** AISstream (free, terrestrial) can't see mid-strait; satellite AIS is paywalled; shadow fleet spoofs anyway.
3. **Toy compatibility model.** API+sulfur isn't executability: real substitution needs TAN, Ni/V, residue yield vs coker capacity, blend stability. Merey 16 runs only at Jamnagar/Vadinar/Paradip-class refineries. Refiners answer this with LP models (Aspen PIMS).
4. **Timescale mismatch.** Term liftings nominate at M-2; voyages take 20–40 days. A 60-second procurement loop optimizes a timescale that doesn't exist.
5. **No real user.** No standing "MoPNG coordination cell" buys crude. OMC trading desks buy under fiduciary duty; Reliance/Nayara won't take ministry recommendations (UPSI issues).
6. **Scope overrun.** Six products planned, not one demo; 2–3 arrive half-broken and judges score the broken one.

### MAJOR (top of the list)
7. War-risk insurance premiums (best leading indicator) aren't an API — they live in JWC circulars and broker PDFs.
8. ACLED license blocks hackathon use. GDELT is high-recall/low-precision (one Reuters story = 40 events).
9. Chartering/insurance layer missing: VLCC availability evaporates in crises; Nayara (EU-sanctioned) can't fix mainstream tonnage at all.
10. Payment rails were the REAL 2026 binding constraint (OFAC comfort letters, dirham/yuan workarounds, LC headroom) — not routes.
11. Action space too small: Angola+Venezuela covered <15% of Hormuz-exposed flow; the real bridge was inventories, floating storage, on-water diversions.
12. Port/tankage physics absent (SPMs, drafts, segregated tankage, SPR withdrawal rate caps).
13. n≈12 calibration events have no statistical meaning; judge asks for error bars, our own "stated uncertainty" rule indicts us.
14. Stopwatch aimed at slowest component (3+ sequential LLM calls); live websockets die on conference wifi; deck.gl arcs choke projector laptops.
15. Narrative identity crisis (monitor? simulator? procurement engine? governance system?) — judges retain one sentence per team.
16. Fake-live sniff test: Bloomberg-terminal aesthetic RAISES data-authenticity expectations.
17. Constitution risks reading as "slider wired to a sort function"; 2026 agent-debate fatigue is real.
18. Ministry-as-customer = VC red flag (3–5yr sales cycle, n=1 TAM). "Who signs the first cheque?"
19. Pricing politics (pump freezes, subsidies, waiver diplomacy) are decided by the PMO — no ministry writes down its sanctions-ambiguity strategy.
20. Crude-only framing misses LPG/LNG exposure — the acute citizen-facing pain in 2026.

---

## PART 2 — THE SOLUTIONS (7 workstreams, key decisions)

### 2.1 Data strategy (honest + demoable)
**Core move: replay-first architecture with provenance chips.** Every panel carries a chip: green **LIVE** (ticking timestamp), amber **CACHED-REAL** (capture date), purple **SYNTH** (scenario inputs). Clicking shows source URL + fetch time. Demo defaults to a deterministic 24–72h cached replay; live feeds are a bonus that flips chips green. Wifi dies → a chip changes color, nothing breaks.

**The 13-source stack:** AISstream live + own cached replay; UKMTO advisories (free, structured, authoritative — REPLACES ACLED for maritime); MARAD MSCI alerts; JWC circulars from lmalloyds.com (free PDFs — the war-risk repricing signal: JWC listed the Gulf BEFORE the 2026 strikes → lead-time evidence); GDELT gated by a verifier; Reuters/gCaptain/Splash247/Lloyd's List RSS; Polymarket/Kalshi probabilities; EIA API; OFAC SDN XML; PPAC monthly XLS (fine for slow-changing topology, stamped "official, monthly"); hand-curated exposure graph; labeled synthetic scenarios.

**Specific fixes:**
- *AIS dead zone → feature:* compute transit-flow proxy at coverage edges (entered west, never appeared east within expected time = "dark transit" flag). Optional static Sentinel-1 SAR scene as ground-truth evidence layer.
- *GDELT noise → demo moment:* cluster 40 raw hits → 1 candidate → LLM verifies against independent source (UKMTO/RSS) → only corroborated events fire; uncorroborated sit in a visible "unconfirmed signals" tray. Measurable precision claim.
- *Paid sources → adapter stubs:* `SpireAdapter`, `KplerAdapter` visible in repo, ~30 lines, marked "production license." "Upgrading is a license key, not a rewrite."

### 2.2 Validation (kills the hindsight-bias bomb)
1. **Freeze the knowledge base at 2018** (`kb_frozen_2018`, checksummed, every record source+dated). Angola isn't "in the database" — it *emerges* from a query over structural facts (who produces what grade, which refineries can run it, port capacities).
2. **Hard time split:** calibrate ONLY on pre-2024 events (Katrina, Abqaiq, COVID, Ever Given, Russia 2022...). Red Sea 2023-24 AND Hormuz 2026 are pure holdouts.
3. **Score the option set, not the outcome:** top-5 recall — did India's actual basket (Angola, Venezuela, stranded Urals) appear in our top 5, at what rank?
4. **Policy as branches, never predictions:** waiver_renewed / waiver_lapsed shown side-by-side. "Nobody predicts a 30-day US waiver; we model it as a branch."
5. **Lead time scored on signals:** publicly timestamped precursors (JWC repricing, AIS deviations) vs. when India's response became visible. Every date checkable.
6. **Pre-registration:** git-timestamped one-pager of metrics/thresholds before running the replay.
7. **Report the misses.** A scorecard with a visible miss is 10x more credible.

**Uncertainty display:** constants as ranges with provenance ("reroute friction: 2–5 weeks, observed across 8 pre-2024 events"), sensitivity sliders (drag across full range → top-5 barely reshuffles → "robust to everything we're uncertain about"), rank-stability badge ("top-5 in 94% of parameter sweeps"), 3-tier color coding (sourced fact / calibrated range / assumption-you-choose).

**The 30-second hindsight answer (verbatim, rehearse it):** *"Fair — it's the first question we asked ourselves, and we built the firewall for it. Three parts. One: the knowledge base is frozen structural data, every record dated 2018 or earlier — the system doesn't 'know about Angola,' Angola falls out of the graph. Two: all calibration constants come from pre-2024 events only; Red Sea and Hormuz are pure hold-outs. Three: we don't claim to predict outcomes — nobody predicts a 30-day US waiver; that's an explicit branch. Our claim is narrower and testable: the options India eventually chose were in our top five, and our signal triggers fire weeks earlier on publicly timestamped data. And it didn't score perfectly — the misses are on the slide."*

### 2.3 Executability (survives the IOC judge)
**Recommendation = Feasibility-Checked Option Card,** not a purchase order. Fields: lever, grade, origin, contract flag (SPOT/TERM_DIVERSION/ON_WATER), target refinery, 3-tier compatibility + binding dimensions + suggested blend, realistic volume, voyage days + ETA first cargo, tanker availability (JWC-derived amber/red), port (SPM/draft/tankage), **payment rail GREEN/AMBER/RED** with note, cost delta (shown LAST, "indicative"), time-to-first-barrel.

**Always-visible framing line:** "~75% of imports are term contracts (M-2, monthly OSPs) — treated as fixed baseline. TRINETRA optimizes the flexible spot sliver plus crisis levers."

**5-lever crisis playbook** (fixes action-space critique) — gap-fill waterfall UI over 90 days:
1. SPR + inventory drawdown (hours–days)
2. Divert cargoes already on water (2–5 days)
3. Floating storage / prompt purchases (1–2 wks)
4. Reroute procurement — the option cards (3–6 wks)
5. Demand/product-side: run cuts, export diversion to domestic, product imports (1–2 wks)

*Calibration slide that wins the room:* replay 2026 showing levers 1+2+5 carried weeks 1–4; rerouting covered <15% and landed week 5+. **A system that admits rerouting is the slowest, smallest lever is the one the IOC judge believes.**

**Compatibility screen:** 6 dimensions (API, sulfur, TAN, Ni+V, resid yield vs bottoms upgrading, pour point) from public assay libraries (Equinor/BP/Exxon/crudemonitor.ca, ~10 grades hand-curated). **Empirical-envelope trick:** each refinery's capability = convex hull of assays it has ACTUALLY imported (PPAC records) — no guessing unit constraints, import history is revealed capability. Tiers: RUN-NOW / RUN-WITH-BLENDING (computed max blend ratio) / CANNOT-RUN (with the reason shown). Disclaimer on every card: "Pre-LP screen. It shortlists; it does not schedule. We cut 60 candidates to 6 so LP time is spent only on live options."

**Answer to "my LP does this":** *"Your LP optimizes one refinery's diet against candidates your traders already shortlisted — we work the other end: screen the entire global slate across all Indian refineries plus national crisis levers for what's simultaneously compatible, charterable, payable, and landable, in minutes, so your LP only ever runs on live options."*

### 2.4 Thesis + user (fixes timescale & user problems)
**Rebuilt thesis:** TRINETRA compresses the days-to-weeks it takes government and OMCs to converge on a shared, quantified read of a supply shock into minutes — and spends the other 364 days making sure resilience was bought at M-2, not improvised at M-0. The binding constraint in 2026 wasn't route information; it was **institutional convergence latency** (everyone in different spreadsheets for weeks). TRINETRA doesn't buy crude. **It makes the room agree faster.**

**Two-clock structure:**
- *Clock 1 — Peacetime (months):* exposure/concentration scoring; **M-2 nomination alerts** ("your Q4 slate is 46% Hormuz-transiting — here are compatible substitutes") — recommendation delivered at the only moment procurement can act; portfolio stress tests vs scenario library; SPR fill optimization.
- *Clock 2 — Crisis (minutes):* signal → graph re-scores → common operating picture → ranked option sets with honest physical lead times → one-click briefing pack for the crisis committee.

**Honest user:** PPAC as analytical host (already exists, already aggregates OMC data statutorily — sidesteps UPSI), feeding the Empowered Group of Secretaries/crisis committees that demonstrably form in crises. OMC strategy desks get read access to their slice. "We never claim a pipe into a purchase order; we claim the pipe into the meeting where purchase orders get authorized."

**Winning "response time" honestly:** the stopwatch measures institutional sense-making, redefined out loud: "It took government two weeks to converge on a shared picture; watch the convergence step in 60 seconds." Every option card displays its physical execution time. Double win: 60 seconds at crisis time + the M-2 alert that fired 60 days BEFORE the signal.

### 2.5 Demo (scope triage + script)
**Kill/keep:** ONE screen, ONE scenario (Hormuz 2026 replay), ONE 90-second pipeline run. Exposure graph merges into the map; taxonomy = one 5-sec auto-tag beat + slide; backtests cut to one live (Hormuz), Abqaiq+Red Sea as a stats slide; agent debate = the 60-sec climax beat; charter edit = 10-sec beat; option sets merge into arbiter output; stopwatch = passive corner widget labeled "pipeline time (replayed feed)."

**Minute-by-minute:** 0:00–0:40 stakes slide (March 2026 headline, "actual response: 6 days") → 0:40–1:30 signal fires, taxonomy auto-tag (`STRAIT-CLOSURE 4A — analogs: Abqaiq'19 0.87, RedSea'23 0.91`) → 1:30–2:20 graph cascade, refineries pulse red, days-of-cover tick → 2:20–3:30 **THE BEAT** (below) → 3:30–3:45 charter edit, cards re-sort with visible rule traces → 3:45–4:20 decision card zoom, stopwatch freezes ~4 min vs "India: 6 days," backtest stats flash → 4:20–5:00 architecture slide, close on the sentence.

**Fallbacks:** zero network dependencies (local JSON replay bundle); cached deterministic agent outputs (same computation, frozen seed); ≤12 arcs, pre-rendered basemap; test on demo laptop at 1080p by day −2; three tiers: live app → narrated screen-recording (rehearsed to be indistinguishable) → static PNGs. Video on laptop + USB + phone.

**3-min video ≠ live pitch:** video proves generality (uncut Hormuz run + SAME pipeline on Red Sea 2023 + two charter edits → two different plans); live pitch stays Hormuz-only with human theater.

**Deck (9 slides):** Title+sentence / The 6 days / What TRINETRA is / Taxonomy moat / Backtests / Governed debate / Architecture (event-driven, stateless agents, commodity graphs are config) / Scale path (fertilizer, pharma API, food oils) / Close.

### 2.6 Judgment layer ("Decision Charter")
**Reframe that kills the politics objection:** *"This charter doesn't govern India's choices. It governs what India's choices deserve: honest paper."* Politics decides; the charter guarantees the deciding happens on complete, traceable, uncertainty-disclosed analysis.

**7 articles as system-conduct rules:** completeness (no option silently dropped), security-floor precedence (when it binds, show the money left on the table), concentration disclosure, sanctions transparency (list + entry + snapshot date; ambiguity surfaced, never laundered), stated uncertainty (n<30 constants display their n — "disruption elasticity, n=12, ±40%" as a badge), reversibility preference, traceability & human sovereignty (every rank re-derives byte-identically from the audit trace).

**Critic = different code, not a second prompt.** Proposer: LLM over deterministic scoring. **Critic: zero LLM** — pure-function validators (assay screen, voyage-vs-buffer calendar, sanctions list snapshots, data freshness, charter caps/floors, uncertainty audit) emitting structured objections `{article, evidence, severity}`. LLM narrates but cannot add/remove/soften an objection. Arbiter: deterministic severity lattice; LLM writes the memo, the demotion already happened in code. Credibility: dissent ledger (count of past overrules) + show one run where the critic finds nothing.

**The theatrical beat (45s, deterministic):** Proposer ranks Venezuelan Merey #2 on cost → critic fires 3 cited chips (API 16 < Jamnagar min 18, too heavy to run neat / OFAC amber, snapshot 2026-03-01 / 43-day voyage vs 12.2-day buffer) → arbiter demotes to Conditional with named conditions → line: *"The critic didn't have an opinion. It ran the sanctions list, the assay table, and the calendar. The language model just wrote the memo."* → charter edit 10→15 days, two more cards demote, each printing its own cause. Closer: "Run it again — byte-identical. Try that with a prompt."

**Naming:** "Decision Charter" on screen; say "constitutional AI" out loud exactly once. **Prop:** export the run's audit trace as a signed one-page PDF and physically hand it to judges — the artifact a fine-tuned forecaster cannot produce. Innovation pitch: "first governance-native recommendation engine — due process at machine speed" (tie to EU AI Act high-risk rules live Aug 2026 + MeitY AI governance guidelines).

### 2.7 Business story
**Beachhead (commit): crude procurement desks of India's ~8 refining entities.** They already pay $100–300k/desk for Kpler/Vortexa/Platts — we're a line in an existing budget, a 3–6 month corporate sale. The wound is 4 months old: war-risk premiums 5x in 48h, VLCC cover $5–7.5M/voyage, boards must show a response. **First cheque: Reliance or Nayara pilot in <90 days** (no PSU tender rules), BPCL as PSU credibility anchor.

**Expand:** Year 1 desks (~$1M ARR) → Year 2 signal API to banks/insurers/industrial hedgers (~30 × $100k) → Year 3 sovereign war room as *aggregation contract* ($2–5M/yr; PPAC already has statutory access to OMC data — no rival-sharing problem), then export via India-Japan roadmap.

**Scalability answer:** "Resilience OS for import-dependent economies — India is the design partner, not the market." Japan/Korea/Taiwan import 90–98% with identical anatomy; 40+ economies >75%. SAM ~$1.5–2B. Category proof: Windward acquired ~$260M; Kpler $200M+ revenue — and neither answers "what should the buyer DO."

**Moat:** (1) encoded India exposure graph (assay × berth × logistics ground truth incumbents lack), (2) audit-grade judgment layer (boards need defensibility, not awareness), (3) trust flywheel (commercial usage → sovereign contract → national reference dataset → next country's design partnership).

**Pricing:** desk SaaS $75–150k/yr; signal API $50–100k/yr; crisis retainer $20–25k/mo event-activated; sovereign program $2–5M/yr.

---

## PART 3 — DECISIONS LOCKED + OPEN TENSIONS

**Locked by this session:**
1. Replay-first, provenance-chipped data architecture; UKMTO replaces ACLED; JWC circulars = lead-time evidence.
2. Frozen-2018 KB + pre-2024 calibration + Red Sea/Hormuz holdouts + top-5 recall + policy branches + visible misses.
3. Option cards + 5-lever waterfall + empirical-envelope compatibility screen + payment-rail lights.
4. Two-clock thesis; PPAC/crisis-committee as honest user; stopwatch = institutional convergence, redefined out loud.
5. One screen, one scenario, two theatrical beats (critic catch 60s + charter edit 10s); zero network on stage.
6. "Decision Charter" naming; critic as deterministic validators; signed audit-trace PDF as physical prop.
7. Beachhead = refiner desks; sovereign = Year-3 endgame.

**Open tensions to resolve next:**
1. **Demo protagonist vs. business beachhead:** the demo stars the national war room (Business Impact drama); the buyer is a refiner desk. Reconcile in the deck: "same engine, two skins" — decide which skin the live demo wears.
2. **One-liner final pick:** demo sentence (6 days → 4 minutes) vs. thesis line (China's 120 days) vs. venture line (Storage buys days). Suggest: demo sentence opens and closes the pitch; venture line answers Q&A; thesis line lives on the stakes slide.
3. **LPG/LNG exposure** (2026's citizen-facing pain): out of build scope, but decide whether it appears as a scale-path slide bullet.
4. **Product name: LOCKED — TRINETRA** (Shiva's third eye: opens in moments of crisis, sees what ordinary sight cannot). Pitch origin line: *"When the ordinary eyes fail, the third eye opens. TRINETRA is India's third eye on its energy supply chain."*
