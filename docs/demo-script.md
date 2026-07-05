# TRINETRA — Live Demo Runbook (5:00)

Operator's script for the live pitch. Timings from plan.md §2.5 (brainstorm) / §7; verbatim
speaker lines from plan.md §2 and §11. Rehearse until two consecutive runs land inside the
stopwatch targets with zero manual intervention (plan.md §5 definition-of-done).

## Pre-flight (before you are called up)

1. Laptop on power, battery 100%, brightness max, Do Not Disturb ON.
2. **Airplane mode ON.** Full run once backstage: basemap renders, cached LLM text loads,
   print-to-PDF works, network tab empty (plan.md §10).
3. Fresh Chrome profile, 1920×1080, zoom preset, URL loaded with `?projector=1`.
4. Deck open in second tab (slides 1–2 and 7–9 are shown around the app).
5. Three pen-signed printed audit-trace PDFs in hand; one goes to a judge at the close.
6. Fallback assets verified on laptop + USB + phone (see Fallback ladder below).

## Minute-by-minute

Conventions: `SPACE` = play/pause replay. `1–5` = speed presets (`4` = 8×). `←/→` = seek.
Clicks are named by panel + element. Speaker lines are **verbatim — do not paraphrase**.

### t=0:00–0:40 — Stakes (deck slide 2 on screen, app behind)

- t=0:00 — slide 2 up ("In June 2026, India needed six days to answer one question.").
- SAY (the lead, verbatim):
  > "When Hormuz closed, India took six days to reroute crude; TRINETRA does it in four minutes — and shows you the argument, under rules you wrote."
- SAY (minister anchor, verbatim, plan.md §11):
  > "The minister's dashboard during the crisis was a number in his head. TRINETRA puts that number on a wall, per refinery, per grade, recomputed every time the world changes."
- t=0:35 — `Cmd+Tab` to the app. App is at t0, stopwatch at 0:00, ticker idle
  ("No unconfirmed signals · monitoring 14 feeds").

### t=0:40–1:30 — Signal fires

- **t=0:40 — press `SPACE` to start replay at 8× (speed preset `4` set pre-show).**
  Stopwatch starts ticking (the clock is real — never touch it again).
- t=0:50 — UKMTO/JWC events print on the ticker; taxonomy panel auto-tags:
  `STRAIT-CLOSURE 4A — analogs: Abqaiq'19 0.87, RedSea'23 0.91`.
- SAY: "A war-risk circular, not a headline, is the first tell. The Joint War Committee
  repriced the Gulf before the strikes — that's lead time, publicly timestamped."
- t=1:10 — click the ticker's newest event once → provenance chip expands (LIVE-green,
  source + timestamp). Click again to collapse. Do NOT open more than one.

### t=1:30–2:20 — Cascade

- t=1:30 — the closure trigger event lands (see docs/beats.md, Beat 1 trigger). Map cascade
  runs 4.5 s staged; refineries pulse; days-of-cover counters tick down; waterfall gap opens.
- **No clicks in this window.** Let the cascade finish; ~1 s stillness.
- SAY: "Every refinery you see carries one number — days of cover. That is the minister's
  60-60-60, on a wall, recomputed as the graph re-scores."
- t=2:05 — options panel populates: 5 levers, top 3 cards visible, losers collapsed to rows.

### t=2:20–3:30 — BEAT 1: the critic demotes Merey (the 60-second climax)

- **t=2:20 — click option card #2 (Venezuelan Merey 16, ranked #2 on cost).** Card zooms.
- t=2:25 — press `SPACE` to pause replay (stopwatch keeps running — it measures the
  pipeline, and the pipeline already ran; pausing only stops new events).
- t=2:30 — critic chips fire automatically, 700 ms apart (the sequence IS the theater):
  1. `A2.assay_env` — TAN 3.3 vs limit 1.5
  2. `A4.sanctions` — OFAC AMBER, snapshot 2026-07-01
  3. `A2.voyage_buffer` — 38-day voyage vs 12-day cover
  (exact expected values: docs/beats.md Beat 1 tables)
- t=2:50 — arbiter verdict renders: **CONDITIONAL**, three named conditions printed.
- SAY (verbatim, plan.md §2.6 beat line):
  > "The critic didn't have an opinion. It ran the sanctions list, the assay table, and the calendar. The language model just wrote the memo."
- t=3:10 — click **Audit** tab once: hash-chained entries scroll; point at `prev_hash`.
- SAY: "Every step is hash-chained. Re-derive the run from this trace and you get the same
  bytes."
- t=3:25 — click back to Options.

### t=3:30–3:45 — BEAT 2: the charter edit (highest-value 15 seconds — most rehearsed)

- **t=3:30 — click the Charter panel → Article A2 (`min_cover_days`) → edit `10` → `15`
  → press `ENTER`.** (This is `setCharterParam('A2', 15)`.)
- t=3:33 — 800 ms FLIP re-sort; demoted cards get the 2 s amber ring; rule traces print
  150 ms apart under each changed card (expected traces: docs/beats.md Beat 2 table).
- SAY: "Change one rule, get a different plan — and every card that moved prints the rule
  that moved it."
- SAY (verbatim closer, plan.md §2.6): > "Run it again — byte-identical. Try that with a prompt."

### t=3:45–4:20 — Decision + stopwatch freeze

- **t=3:45 — press `SPACE` to resume; replay runs to the decision milestone.**
- t=3:55 — click the top validated card → decision card zoom; waterfall bars land 5 × 400 ms,
  gap counter syncs to 0 with one green flash.
- t=4:07 — **stopwatch freezes at 4:07** next to the card "India: 6 days". Do not speak
  over the freeze; 2 s silence.
- SAY (verbatim, plan.md §11 / credibility-slide.md):
  > "We didn't ask experts whether the plan is right. India's trading desks validated it — they executed the same pivot, weeks after our system would have surfaced it."
- Backtest stat strip flashes (top-5 recall, misses in red).

### t=4:20–5:00 — Architecture + close

- t=4:20 — `Cmd+Tab` to deck, slide 7 (architecture: "Deterministic Core, LLM at the Edges").
- SAY: "Solid arrows are deterministic flow. Dashed arrows are the LLM. Nothing inside the
  bright border ever calls a model."
- t=4:40 — slide 9. **Hand the printed, pen-signed audit PDF to the nearest judge. Pause
  2 seconds.**
- SAY (the lead again, verbatim, closing):
  > "When Hormuz closed, India took six days to reroute crude; TRINETRA does it in four minutes — and shows you the argument, under rules you wrote."
- Stop. No thank-you slide.

## Fallback ladder (plan.md §10, brainstorm §2.5 — rehearse all three tiers)

1. **Live demo** (default). Wi-Fi off is the normal state — nothing on stage needs network.
   If a panel misrenders: press `←` then `→` (seek is a full deterministic rebuild) and
   continue; do not reload unless dead.
2. **Narrated dress recording.** The Day-7 final dress run is screen-recorded at 1080p and
   rehearsed to be indistinguishable; narrate over it live with the same script above.
   Trigger: app fails to load, projector handshake fails, or any beat breaks twice.
3. **3-minute video** (`TRINETRA_Demo_3min.mp4`, 2:58, captions burned in). Trigger: laptop
   loss. Lives on laptop + USB stick + phone + cloud link.

Decision rule: you get ONE recovery attempt at each tier. Second failure = drop one tier
immediately, without comment, and keep talking.
