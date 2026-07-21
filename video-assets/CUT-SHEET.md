# TRINETRA — 3-min video cut sheet

21 stills, **3840×2160** (4K) — a 1080p timeline gives you 2× push-in headroom with no softening.
Timecodes match `docs/teleprompter.html` and the final script exactly.

| In | Out | VO beat | Primary asset | Alt / insert |
|---|---|---|---|---|
| 0:00 | 0:22 | The stakes | `01-open-terminal` | `01b-map-world` (slow push in) |
| 0:22 | 0:42 | The real vulnerability | `02-charter-rules` | `01-open-terminal` |
| 0:42 | 1:02 | Structural separation | `06b-critic-full` (left AI ↔ right rules) | `02-charter-rules` |
| 1:02 | 1:20 | Crisis + live model | `03-crisis-full` → `03b-map-hormuz` | **`04-plan-live-chips`** |
| 1:20 | 1:42 | ★ The gate | **`05-gate-rejected-modal`** | ⭐ hold on **`05b-rejected-stamp-closeup`** |
| 1:42 | 2:06 | Constitution + zero-LLM critic | `06-critic-objections` | `02-charter-rules` |
| 2:06 | 2:20 | Human authority | `07-floor15-resorted` | `07b-floor15-full` |
| 2:20 | 2:38 | ★ The proof | **`08-chain-broken`** (red seal) → `08b-chain-verified` | `08c-decision-report` (slow scroll) |
| 2:38 | 2:52 | A graph, not a script | `09-redsea-full` → `09b-map-redsea` | `09c-redsea-shock` |
| 2:52 | 3:00 | ★ Close | **`10-hero-clock`** | `10b-close-full`, then wordmark |

## The three ⭐ shots — do not rush these
- **`05b-rejected-stamp-closeup`** — the retellable frame. Hold ~1.5s in silence, then resume VO.
- **`08-chain-broken`** — cut `08b-chain-verified` → `08-chain-broken` → back to `08b`. The green→red→green
  beat *is* the argument. Shot on a real tampered hash, not a mockup.
- **`10-hero-clock`** — let it sit under the last line, then hard cut to black.

## Motion beats worth screen-recording instead of stills
Stills carry 80% of this, but five moments are *movement* and will read better as 2–4s clips.
Record them from `http://localhost:5173/?tour=1&projector=1` (or `?projector=1` and drive by hand):

1. **Map fly to Hormuz** (tour step 2) — the camera auto-frames the strait.
2. **REJECTED stamp slam** (tour step 5) — it animates in; the still can't show the slam.
3. **Cards re-sorting on the floor edit** (tour step 7) — the amber flash is the star moment.
4. **Seal flipping to CHAIN BROKEN** (⚡ TAMPER TEST) — 3.2s window, then it restores itself.
5. **Hero clock ticking** — a few seconds of the count-up before the freeze.

## Production notes
- **Warm the live model before your take.** NVIDIA's free tier is running ~30s under load right now.
  Run the Hormuz scenario once, wait for the green **LIVE ✦** chips, *then* start recording — the
  record-replay transcript means the second run replays the recorded text instantly, so the chips
  appear immediately on camera. (Client timeout is now 45s so a slow-but-working call still lands.)
- **Everything is `?projector=1`** — larger type, and it's what enables the big hero clock overlay.
- Assets are 16:9 native, so no reframing needed; safe to Ken-Burns 100%→108%.
- Not committed to git (see `.gitignore`) — regenerate any time with
  `scratchpad/capture-broll.py`.
