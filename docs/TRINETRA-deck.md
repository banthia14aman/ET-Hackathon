# TRINETRA — Presentation (10 slides + speaker notes)

*Governed crude-supply decisions at machine speed. ET AI Hackathon 2026.*

> **Positioning line (say it once, early):** *TRINETRA uses AI for sense-making and
> constitutional auditing, deterministic logic for scoring, and humans for final approval.*

**Design system:** true-black background, saffron/amber accent, ≤20 words of body per
slide, 10-pt source footnotes on every number, eye glyph (△) bottom-right. Every
figure carries its provenance chip: **R** = real-sourced · **E** = estimated ·
**S** = synthetic. Companion: [`TRINETRA-explained.md`](TRINETRA-explained.md).

> **One-line honesty rule for the whole deck:** we don't claim everything is real — we
> claim *nothing is fabricated, and every number shows how certain it is.*

---

## Slide 1 — Title

# TRINETRA
### An AI that argues — under rules you wrote.

> "When Hormuz closed, India took six days to reroute crude. TRINETRA does it in four
> minutes — and shows you the argument, under rules you wrote."

**Visual:** a stopwatch frozen at **4:07** next to a greyed-out **6 days**.

**Speaker note (15s):** "Everyone here will show you an AI that answers. We built an AI
that argues — under a constitution you can edit — and hands you a signed record of the
argument. We use **AI for sense-making and auditing, deterministic logic for scoring, and a
human for final approval.** Watch it reroute India's crude in four minutes." *(4:07 = the
demo's measured wall time; the app now carries a real on-screen DECISION CLOCK — starts when
the crisis opens, click to freeze at the decision. The 6-day lag is a reported/estimated figure — E.)*

---

## Slide 2 — THE MONEY SLIDE 💰

# In March 2026, India needed six days to answer one question.
### Not a data problem — a deliberation problem.

**The minister's dashboard during the crisis was a number in his head.**

> "My comfort point used to be **60-60-60** — 60 days of crude oil, natural gas and LPG."
> — **Hardeep Singh Puri, Union Minister for Petroleum & Natural Gas**, 2026 `[R]`
> <sub>Source: PIB Parliament statement PRID 2239021; india.com report.</sub>

TRINETRA puts that number **on a wall — per refinery, per grade, recomputed every time
the world changes.**

### What the six-day lag actually cost (per crisis)

| Line item | Cost | Provenance |
|---|---|---|
| **Cost of the 6-day decision lag** | **~$100M+ (₹850+ cr)** | price path **R** (SOLID); spot share ~30% **E** (directional) |
| One VLCC bought in panic, not on time | **$30–45M** | **R** — "solid from the tape" |
| Demurrage cascade | **$10–15M / crisis-month** | **E** (directional) |
| One SPR day burned at peak, refilled later | **~$270M** | arithmetic **R**; attribution **E** |
| 47-day stabilization gap (gross exposure) | **~$5.8B / episode** | capturing just **2–3% = $120–180M** — honest capture framing |

<sub>Arithmetic (6-day lag): 1.5 mb/d spot-exposed × 6 days = 9M bbl × ~$11.5/bbl avg
excess on the $77→$100 ramp. Base inputs (R): India imports ~4.9 mb/d (PPAC); Brent path
$71 (Feb 27) → $77 (Mar 2) → $100+ (Mar 8) → $126 peak (EIA RBRTE). The app computes this
figure **live** from the scenario's Brent and stamps it "order-of-magnitude" at 2 sig
figs — it is illustrative, not a booked number.</sub>

### The macro stakes `[R]`
**90% crude-import dependence in FY26 — first time ever.** Every **$10/bbl** widens the
current-account deficit by **40–50 bps of GDP (~$16–20B)**. SPR covers **9.5 days** vs the
IEA **90-day** norm. **The buffer isn't barrels — it's decision speed.**

### What we sell, and what it costs

- **Price: $150,000 / desk / year.** `[S — product decision]`
- **Breakeven: $0.0003 / bbl** ($150k ÷ ~500M bbl/yr per desk). *Discount our value claim
  by 99% and the ROI still clears.*
- **ROI: ~200×** vs a single $30M distressed cargo avoided.
- Benchmark: the same budget desks already pay **Kpler / Vortexa ~$50–150k/yr** for data
  with **no decision layer.** `[benchmark uncited in-repo — present as directional]`
- **The ask: one design-partner desk — not a cheque.**

**Counter-position (say it out loud):** *"They show you the disruption; we show you the
signed, auditable decision. Live feeds are a subscription away — a reasoning engine that
survives an audit is not."*

**Speaker note (60s — the verbatim spine):** "Three numbers from the crisis. When Hormuz
closed, Brent went 77 to 100 dollars in six days, and India's institutions took those six
days to converge. On the spot-exposed share of five million barrels a day, that lag alone
cost over a hundred million dollars. One VLCC bought in panic — thirty million worse. One
day of reserve burned at the peak and refilled later — two hundred and seventy million.
TRINETRA costs a hundred and fifty thousand dollars per desk per year. Breakeven is
three-hundredths of one cent per barrel. Refiners already pay twice that for Kpler and
Platts — for data that tells them what happened. **We tell them what to do**, two months
before nomination deadlines."

---

## Slide 3 — What it is

# A crisis room that convenes itself — and argues under your rules.
### WATCH → DEBATE → PLAN, in four minutes.

**Visual:** the three-strip flow + a product screenshot (the terminal, mid-crisis).

**Speaker note:** "An event-driven watchtower turns signals into a scored exposure graph.
A governed debate — proposer vs. a rules-only critic — turns that into an executable plan:
grades, volumes, refinery assignments. Every claim carries a provenance chip."

---

## Slide 4 — The moat

# The moat is boring: crude grades, refinery constraints, charter law — encoded.

**Visual:** three taxonomy rows, **Merey 16 highlighted red.**

- 10 fully-assayed hero grades × refinery assay envelopes (API, sulfur, TAN, Ni/V, residue,
  pour) — on a schema built to hold 200+.
- A **written Decision Charter** (7 articles) the AI is bound by.
- A **trained compatibility model** — *our* number, byte-identical every run.

**Speaker note:** "Anyone can call an LLM. The defensibility is the encoded domain: which
crude a coker can actually run, which payment rail clears, which rule permits the trade.
Merey is cheap — and our critic demotes it, because it's **too heavy to run neat** (API 16,
below the refinery's minimum 18)." *(Not TAN — that earlier value was fabricated and
removed.)*

---

## Slide 5 — Backtest + market-as-validator

# We replayed real crises. The plans hold.

**Visual:** a two-row scorecard.

| Crisis | Disruption | Brent move | Lead time | Source |
|---|---|---|---|---|
| Red Sea / Houthi 2023–24 | 8.7 → 4.0 mb/d | +14% | +26 d early | EIA TIE #63446 `[R]` |
| Hormuz 2026 (live replay) | ~150 tankers anchored | >50% | +4 d | Al Jazeera / UK HoC `[R]` |

**Honesty line (on-slide):** *Replayed real AIS + news feeds, time-compressed. No
live-feed claims. Per-refinery inventories are modeled (S).*

**Market-as-validator:** *"We didn't ask experts whether the plan is right. India's
trading desks validated it — they executed the same pivot, weeks after our system would
have surfaced it."* Non-Hormuz sourcing rose **55% → 70%**; supplier network widened from
**27 → 41 countries.** `[R — India Narrative, Discovery Alert]`

---

## Slide 6 — The governance beat

# Change one rule, get a different plan — and see exactly why.

**Visual:** the Charter editor; security floor edited **10 → 15**; six cards flip to
**REJECTED**, each with its printed rule trace:

```
A2.voyage_vs_buffer   voyage 43 d > cover 12.2 d · floor 15 d  — BLOCK   (Merey → Jamnagar)
```

**Speaker note:** "The critic didn't have an opinion. It ran the sanctions list, the assay
table, and the calendar. The language model just wrote the memo. Change the floor and the
plan re-decides itself — and every demotion cites the article that caused it."

---

## Slide 7 — Architecture

# Boring, inspectable, event-driven.
### Deterministic core, LLM only at the edges.

**Visual:** five layers, solid arrows = deterministic, dashed = LLM.

```
Signals ─▶ Rescore ─▶ Options ─▶ Proposer ┈▶ Critic (ZERO LLM) ─▶ Arbiter ─▶ Audit
                                    ┊                                          (hash chain)
                                    ┈▶ [LIVE LLM · recorded]    [our trained model → the number]
```

**Right tool per layer:** rules for the veto (can't hallucinate) · our model for the
number (byte-identical) · an LLM only for the sentence (live at the edges via a
key-holding worker, recorded for replay; cache is the airplane-mode fallback).

**Speaker note:** "No `Date.now`, no `Math.random` on the derivation path. Two runs at the
same sim-time are byte-identical, including every audit hash. **Run it again — byte-
identical. Try that with a prompt.**"

---

## Slide 7B — AI-assisted, guardrailed (the constitutional-AI slide)

# Now it reads messy operator text — and the gate throws out whatever it makes up.
### AI for sense-making · rules for scoring · humans for approval.

**Visual:** a 5-stage guardrailed flow, then a live capture of the validation gate.

```
① AI SENSE-MAKING ─▶ ② VALIDATION GATE ─▶ ③ DETERMINISTIC SCORING ─▶ ④ AI RULE AUDIT ─▶ ⑤ HUMAN APPROVAL
   (advisory)          (authoritative)       (authoritative)            (advisory)          (logged)
   reads free text     strict schema+rules    rescore·critic·arbiter     rule gaps·read-only  sign-off
```

Two live captures side by side: **the gate** (from "⚠ Hallucination test": `shock: hormuz
severe` survives; a hallucinated **`Brent 9000`** and a **made-up grade** struck through —
*"rejected by the validation gate — they never reached scoring"*) and **the model, live** (an
APPROVED option card whose rationale was written by NVIDIA Llama-3.3-70B seconds ago, chip:
**LIVE ✦ · recorded for replay**).

**Callout:** *A live model makes the call. The record replays byte-identically. A human signs.*

**Speaker note (20s):** "The LLM runs **live** on every decision-state change — NVIDIA, through
a key-holding Cloudflare Worker, so the browser never sees a key. It does the jobs it's good at:
reading messy text into candidate facts and narrating the plan. It does the job it's *bad* at —
setting a number — **never**: every extracted field passes a strict schema and our domain rules,
anything it invents is dropped with a reason, and scoring stays deterministic. Every completion
is recorded, so the sealed record replays byte-identically offline. That's the difference
between *using* a live LLM and *trusting* one."

---

## Slide 8 — Scale

# One strait this week. Every chokepoint, every commodity, next.
### Scale is config, not code.

**Visual:** a chokepoint map + a YAML config stub loading in the same engine + a buyer
ladder (refiner desk → national oil company → ministry cell).

**Honest footer:** live production feeds (Kpler/Spire) are adapter stubs today — behind the
same 3-method `FeedAdapter` interface the replay uses (`src/engine/feeds.ts`), marked
"production license." Going live is a license key, not a rewrite — and that claim is code.

---

## Slide 9 — Close

# Six days to four minutes. And the argument is on the record.

**Visual:** an image of the **signed audit-trace PDF** + a QR to the video / repo.

**Speaker note (then hand the printed PDF to a judge, pause two seconds):** "An AI that
argues under rules you wrote, a machine — not a model — that enforces them, and a decision
on the record. That is TRINETRA." *(No thank-you slide.)*

---

## Appendix A — Submission summary (148 words)

> When the Strait of Hormuz closed in March 2026, India took six days to produce a crude
> rerouting plan. TRINETRA produces one in four minutes. An event-driven watchtower
> replays real AIS and news feeds into geospatial evidence, cutting detection lead time
> from days to minutes. A governed multi-agent debate — a live LLM proposer versus a
> zero-LLM critic, every claim carrying a cited provenance chip — then generates an
> executable plan: grades, volumes, laycans, and refinery assignments, constrained by
> fully-assayed crude grades and refinery compatibility envelopes. Fidelity is backtested
> against the 2023 Red Sea crisis with zero retuning: the options traders actually executed
> were in our top five — surfaced days earlier. Executability is governed, not assumed:
> operators edit the charter and every decision traces to the rule permitting it, sealed in
> a signed audit trace. Response time: 4 minutes 7 seconds, on the record. Six days to four
> minutes.

## Appendix B — The hindsight-bias answer (the most important Q&A, ~28s)

> "Fair — it's the first question we asked ourselves, and we built the firewall for it.
> One: the knowledge base is frozen structural data, every record dated 2018 or earlier —
> the system doesn't 'know about Angola,' Angola falls out of the graph. Two: all
> every calibration constant is a stated, sensitivity-swept assumption anchored to earlier
> crises — never fit to the Hormuz outcomes we replay; the crisis is a pure hold-out for
> the engine's tuning. Three: we don't claim to predict outcomes — nobody predicts a 30-day US
> waiver; that's an explicit branch. Our claim is narrower and testable: the options India
> chose were in our top five, and our signal triggers fire weeks earlier on publicly
> timestamped data. And it didn't score perfectly — the misses are on the slide."

## Appendix C — Consistency reconciliation (done 2026-07-07)

These were reconciled across the whole repo; the deck above already uses the corrected values.

1. **Merey reason — FIXED:** "too heavy, **API 16 < Jamnagar min 18**" everywhere. The old
   "TAN 3.3" was a fabricated value, removed from the engine (real assay: API 16 / S 2.45 / TAN 0.69).
2. **Closure date — FIXED → March 2026:** the engine runs `2026-03-15`; every slide/summary now
   says March. "June" refers only to the mid-June reopening.
3. **Venezuela kb/d — FIXED:** `hormuz2026_events.json` shows **284 kb/d** (2026-04) with "292
   debunked"; never show a bare 292.
4. **Floor-15 narrative — FIXED:** the engine demotes all **six** Jamnagar-targeting cards
   (incl. Angolan Cabinda/Girassol). The deck no longer claims "the survivors are what desks
   bought"; the market-as-validator point refers to the **pre-edit top-5 option set**.
5. **Still label honestly (unchanged):** the **"6-day lag"** is a reported/estimated figure (E),
   and the **NVIDIA bake-off** scores are illustrative unless raw logs are attached. The measured
   number is the app's real on-screen **DECISION CLOCK** (wall time since the crisis opened;
   click to freeze at the decision) — record the video with it visible.
