# TRINETRA — Pitch Card (rehearse verbatim)

Consolidated verbatim from docs/plan.md §2 and §9. Do not rewrite; do not paraphrase on stage.

## The lead (opens and closes everything)

> "When Hormuz closed, India took six days to reroute crude; TRINETRA does it in four minutes — and shows you the argument, under rules you wrote."

## 30-second innovation pitch

> "Everyone here will show you an AI that answers. TRINETRA is an AI that argues — under rules you wrote. The model proposes; a critic with zero LLM inside it, so it cannot hallucinate, strikes down anything that breaks sanctions law, refinery chemistry, or the physics of a tanker's voyage; and a constitution you can edit live decides the tie. We froze our knowledge base before the 2026 crises and let reality grade us — and we'll show you what we got wrong. Watch it reroute India's crude in four minutes, and show its work."

## 60-second business impact segment

> "Three numbers from March this year. When Hormuz closed, Brent went from 77 to 100 dollars in six days. India's institutions took those six days to converge on a plan. On the spot-exposed share of our five million barrels a day, that lag alone cost over a hundred million dollars. One VLCC bought in panic instead of on time — thirty million dollars worse. One day of strategic reserve burned at the peak and refilled later — two hundred and seventy million. TRINETRA costs a hundred and fifty thousand dollars per desk per year. Breakeven is three-hundredths of one cent per barrel. Refiners already pay twice that for Kpler and Platts — data that tells them what happened. We tell them what to do, two months before nomination deadlines. India just crossed ninety percent import dependence. Storage buys you nine and a half days. TRINETRA makes them count."

## The hindsight-bias answer (28 seconds — the most important Q&A answer)

> "Fair — it's the first question we asked ourselves, and we built the firewall for it. Three parts. One: the knowledge base is frozen structural data, every record dated 2018 or earlier — the system doesn't 'know about Angola,' Angola falls out of the graph. Two: all calibration constants come from pre-2024 events only; Red Sea and Hormuz are pure hold-outs. Three: we don't claim to predict outcomes — nobody predicts a 30-day US waiver; that's an explicit branch. Our claim is narrower and testable: the options India eventually chose were in our top five, and our signal triggers fire weeks earlier on publicly timestamped data. And it didn't score perfectly — the misses are on the slide."

## Q&A bank (12 — rehearse all; 20-second answers)

1. **"Isn't this hindsight bias?"** → the verbatim answer above.
2. **"Where does tank-level data come from? Ours is confidential."** → "That's why every number wears a provenance chip — those are SYNTH, labeled, calibrated to public PPAC and port stats. The engine is data-source-agnostic: a refiner plugs in real inventories and the reasoning doesn't change. We sell the reasoning; they keep the data."
3. **"Held-out validation on n=2?"** → "Two isn't a sample — it's the full population of major chokepoint disruptions since our 2018 freeze, which is why we pre-registered on git and report misses instead of claiming significance. The n=40 is underneath: taxonomy firings and top-5 option recall per sub-signal. We claim calibration and honesty, not p-values."
4. **"Who pays, how much, have you spoken to a buyer?"** → "The crude-scheduling and risk desk — the same budget that pays Kpler or Vortexa $50-150k/yr for data with no decision layer. Priced per desk below that. One week old, so not sold yet — our ask today is one design-partner desk, not a cheque."
5. **"IOC would never lift sanctioned Merey. Why is it in your option set?"** → "Because your traders will hear the offer anyway — and our critic kills it in the open, with a dated OFAC citation and a TAN incompatibility, demoting it to Conditional under an explicit waiver branch. A system that silently omits options can't be audited."
6. **"Solo dev, replayed feed — what breaks live?"** → "Nothing in the reasoning — replay and live adapters share one interface, which is why the stopwatch honestly says 'replayed feed.' Going live requires data licensing, not code. The deterministic pipeline was the hard part; feeds are a purchase order."
7. **"Why a ZERO-LLM critic?"** → "Deliberately — the boundary sits where liability sits. A procurement objection must be reproducible and citable or the audit PDF is worthless. LLMs propose creatively upstream; deterministic rules dispose downstream. Every objection regenerates bit-identically tomorrow."
8. **"LLMs aren't deterministic — byte-identical replay is marketing."** → "Correct — which is why replay never calls the model. Every LLM request/response is written into the append-only log at run time, content-hashed. Replay is a pure fold; recorded text splices back at the same positions; the hashes match, and I can show you them matching live."
9. **"Frozen 2018 KB — isn't the model stale?"** → "Frozen deliberately, and surfaced. Constants are ranges with sensitivity sweeps — we present a recommendation only when its RANK is stable across the sweep. The critic has a data-freshness validator: staleness becomes a structured objection on the charter, not a silent assumption. And KB updates are explicit signed events — exactly what a compliance officer wants."
10. **"SQLite/single process — real scale?"** → "The boundaries are drawn, not paid for: adapters are the same 3-method interface (going live = license key); every stage is a stateless function (scale = same functions behind a queue); the append-only log maps 1:1 onto Kafka+Postgres. And commodities are the cheapest axis: LNG is a new YAML against the identical engine."
11. **"Who maintains 40 country graphs?"** → "Nobody maintains 40 — the world maintains one. Hormuz is the same node in India's and Japan's graphs. One global reference graph plus thin country overlays — and the overlay is exactly the artifact a sovereign customer wants to own. It's the Bloomberg model: shared reference data, client-owned configuration."
12. **"LLM costs at scale?"** → "Near-flat — the LLM isn't in the data path. Deterministic code processes every event; the LLM narrates state changes: dozens of calls/day/desk, not per message. Cost scales with seats, which is the axis revenue scales with."

*(If asked "did any practitioner review this?", the guard lives in docs/credibility-slide.md — deliver it verbatim.)*
