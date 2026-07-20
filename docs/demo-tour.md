# TRINETRA — in-app guided demo (and video script)

The app ships a self-driving guided tour. It **drives the real app** (seeks the replay, selects
a route, edits a rule, runs a what-if) while a caption card narrates — so it teaches a new user
how TRINETRA works *and* gives you a ready-made shot list + voiceover for the 3-minute video.

## How to launch

- **`▶ DEMO` button** (top bar) — manual: click NEXT / PREV, or ▶ AUTO-PLAY for hands-free.
- **`?tour=1`** in the URL — opens the tour and **auto-plays** (best for screen-recording; ~9.5s
  per step, ~95s total across the 10 steps). e.g. `http://localhost:5173/?tour=1`
- **`?judge=1`** — opens the tour paused (a judge clicks through at their own pace).
- **`?projector=1`** — larger type + lifted background for a projector; combine, e.g. `?tour=1&projector=1`.

Each step spotlights the relevant panel (pulsing amber outline) and performs its action live.
Nothing is faked — the numbers, the critic's objections, and the audit hashes are all real.

## The 11 steps — narration (use verbatim as the voiceover)

*(These captions are pinned by `npm run check`: every in-app caption must appear verbatim below,
and the spoken shortfall must match the engine at the beat — the doc can never drift again.)*

1. **What TRINETRA is** — "When Hormuz closed, India took six days to reroute crude. TRINETRA does it in four minutes — an AI proposes, a rules-only machine decides, and every step is on the record." *(resets to pre-crisis)*
2. **The crisis hits** — "March 2026: the Strait of Hormuz is disrupted — roughly 40% of India’s crude transits here. The map flies to the affected straits automatically." *(map auto-zooms to Hormuz)*
3. **The exposure** — "Jamnagar’s days-of-cover falls below the safe line and a national shortfall opens — about 1,660 kb/d, a third of India’s daily crude runs." *(header KPI turns red)*
4. **The options** — "The desk’s AI proposes substitute cargoes from around the world. Each carries a provenance chip, a prediction from our own trained compatibility model — and a rationale written seconds ago by a live NVIDIA model, recorded for replay: the LIVE ✦ chip." *(spotlights THE PLAN; the LIVE ✦ chips are visible when networked)*
5. **The gate catches a lie** — "Feed the AI a poisoned note — Brent at $9,000, a made-up grade, a 200-day cover floor. It reads them as candidates; the deterministic gate strikes every fabrication before it can touch a decision. The model proposes; the rules dispose." *(opens AI ASSIST auto-loaded with the hallucination example; the fabricated fields are struck through under a big REJECTED stamp — needs network for the live model; re-record this beat manually to linger on the strikethrough)*
6. **The critic — with no AI** — "A rules-only critic demotes the sanctioned Venezuelan Merey: too heavy and sour to run neat, an OFAC-flagged payment rail, and a 43-day voyage against a 12-day buffer. It cannot hallucinate — it contains no model." *(selects Merey; map highlights the Venezuela→Jamnagar route; objections drop in one at a time)*
7. **Change one rule** — "Raise the security floor from 10 to 15 days of cover — and the plan re-decides itself. Six long-haul cargoes just failed, each flashing amber." *(edits charter A2 10→15; demoted cards flash the amber ring — this is the star moment)*
8. **Ask a what-if** — "Pose a hypothetical future — what if Hormuz AND the Red Sea close at once? The same engine re-scores a scenario that never happened." *(runs the two-strait what-if; SANDBOX banner appears)*
9. **The proof** — "Every step — propose, critique, arbitrate — is hash-chained and re-runs byte-identically, offline. That signed trace is what a regulator can audit." *(spotlights THE PROOF / VERIFIED seal)*
10. **The report** — "One click writes the whole argument into a plain-English Decision & Audit Report — the problem, every option considered, why the machine blocked what it blocked with cited rules, and the tamper-evident trail. Save as PDF: that is what a regulator signs." *(opens the REPORT ▤ document over the terminal)*
11. **Six days to four minutes** — "An AI that argues under rules you wrote, a machine that enforces them, and a decision on the record. That is TRINETRA." *(closes the report)*

## Bonus beat — AI ASSIST ✦ (not in the auto-tour; show it by hand)

The header's **`AI ASSIST ✦`** button opens the AI-assisted decision flow — the proof behind the
positioning line *"AI for sense-making, deterministic scoring, human approval."* It's a manual
beat (the auto-tour doesn't drive it), ideal for Q&A or a longer cut of the video:

> "Free operator text goes in. The LLM reads it into candidate facts — then a **validation gate**
> throws out whatever it makes up: a hallucinated Brent of 9000, a 200-day floor, a made-up
> grade, all struck through before scoring. Only the survivors reach the same deterministic
> engine. The LLM then audits the result read-only, and a human signs. Every step is on the
> same hash chain." *(Use the "⚠ Hallucination test" example → ▶ Extract → validate → score → audit.)*

## Recording tips

- **Record the main take with the network ON** so the LIVE ✦ NVIDIA chips are visible on the
  option cards (step 4) — the live-model beat is now part of the story. Then capture ONE extra
  shot in **airplane mode** showing the same beats still working (CACHED chips, VERIFIED seal)
  for the "runs in airplane mode / byte-identical" claim — the two shots together are the
  record-replay story on film.
- 1080p, browser at 100–125% zoom; hide bookmarks/extensions (fresh profile).
- `?tour=1&projector=1` auto-play gives a clean hands-free take (~95s). For the full 3 minutes,
  record it once with auto-play for pacing, then re-record the hero beats (steps 5, 6 and 9)
  manually so you can linger on the objections dropping in, the amber re-sort, and a slow scroll
  through the Decision & Audit Report.
- The captions ARE the script — read them over the matching step. Full pitch/Q&A: `docs/pitch.md`.
