# TRINETRA — in-app guided demo (and video script)

The app ships a self-driving guided tour. It **drives the real app** (seeks the replay, selects
a route, edits a rule, runs a what-if) while a caption card narrates — so it teaches a new user
how TRINETRA works *and* gives you a ready-made shot list + voiceover for the 3-minute video.

## How to launch

- **`▶ DEMO` button** (top bar) — manual: click NEXT / PREV, or ▶ AUTO-PLAY for hands-free.
- **`?tour=1`** in the URL — opens the tour and **auto-plays** (best for screen-recording; ~9.5s
  per step, ~85s total). e.g. `http://localhost:5173/?tour=1`
- **`?judge=1`** — opens the tour paused (a judge clicks through at their own pace).
- **`?projector=1`** — larger type + lifted background for a projector; combine, e.g. `?tour=1&projector=1`.

Each step spotlights the relevant panel (pulsing amber outline) and performs its action live.
Nothing is faked — the numbers, the critic's objections, and the audit hashes are all real.

## The 9 steps — narration (use verbatim as the voiceover)

1. **What TRINETRA is** — "When Hormuz closed, India took six days to reroute crude. TRINETRA does it in four minutes — an AI proposes, a rules-only machine decides, and every step is on the record." *(resets to pre-crisis)*
2. **The crisis hits** — "March 2026: the Strait of Hormuz is disrupted — roughly 40% of India's crude transits here. The map flies to the affected straits automatically." *(map auto-zooms to Hormuz)*
3. **The exposure** — "Jamnagar's days-of-cover falls below the safe line and a national shortfall opens — about 2,240 kb/d, a third of India's daily crude runs." *(header KPI turns red)*
4. **The options** — "The desk's AI proposes substitute cargoes from around the world. Each carries a provenance chip and a prediction from our own trained compatibility model. Click any card to trace its route on the map." *(spotlights THE PLAN)*
5. **The critic — with no AI** — "A rules-only critic demotes the sanctioned Venezuelan Merey: too heavy and sour to run neat, an OFAC-flagged payment rail, and a 43-day voyage against a 12-day buffer. It cannot hallucinate — it contains no model." *(selects Merey; map highlights the Venezuela→Jamnagar route; objections drop in one at a time)*
6. **Change one rule** — "Raise the security floor from 10 to 15 days of cover — and the plan re-decides itself. Six long-haul cargoes just failed, each flashing amber." *(edits charter A2 10→15; demoted cards flash the amber ring — this is the star moment)*
7. **Ask a what-if** — "Pose a hypothetical future — what if Hormuz AND the Red Sea close at once? The same engine re-scores a scenario that never happened." *(runs the two-strait what-if; SANDBOX banner appears)*
8. **The proof** — "Every step — propose, critique, arbitrate — is hash-chained and re-runs byte-identically, offline. That signed trace is what a regulator can audit." *(spotlights THE PROOF / VERIFIED seal)*
9. **Six days to four minutes** — "An AI that argues under rules you wrote, a machine that enforces them, and a decision on the record. That is TRINETRA."

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

- Run **airplane mode** during capture — proves the no-network claim and avoids a stray request.
- 1080p, browser at 100–125% zoom; hide bookmarks/extensions (fresh profile).
- `?tour=1&projector=1` auto-play gives a clean hands-free take (~85s). For the full 3 minutes,
  record it once with auto-play for pacing, then re-record the two hero beats (steps 5 and 6)
  manually so you can linger on the objections dropping in and the amber re-sort.
- The captions ARE the script — read them over the matching step. Full pitch/Q&A: `docs/pitch.md`.
