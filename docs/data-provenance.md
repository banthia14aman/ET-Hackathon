# TRINETRA — Data Provenance (the honesty ledger)

Provenance is load-bearing (CLAUDE.md hard rule 4). Nothing ships without it. This doc is
the single reference for PM1 (data), SWE6 (chips), and the deck/video (honesty labels).

## 1. The R/E/S convention

Every data leaf is `{value, prov, source, as_of}` (plan.md §6):

| prov | Meaning | Rule |
|---|---|---|
| **R** | Real-sourced: value taken verbatim from a named public record | The demo script only ever zooms in on R fields |
| **E** | Estimated: derived/split from real sources with a stated method | The derivation method lives in `source`; say the estimate out loud in the demo (reads as honesty) |
| **S** | Synthetic: invented for scenario plumbing (e.g. AIS vessel positions) | Never upgraded to R or E. Ever. Labeled on screen. |

Conflicting real sources are never averaged: one canonical source per value, alternates
kept in `alt_values` (landmine 1).

## 2. On-screen provenance-chip mapping (SWE6)

Chips ≥24 px, colored dot + WORD, per plan.md §8 and CONTRACTS.md §2 (SWE6):

| prov | Chip | CSS var | Color | Behavior |
|---|---|---|---|---|
| R | **LIVE** (green) | `--green` | `#34D399` | Ticking timestamp while replaying. The persistent honesty label (`REPLAYED REAL FEED · TIME COMPRESSED · CLOCK IS REAL`) is what makes "LIVE-on-replay" honest — never drop it. |
| E | **CACHED** (amber) | `--amber` | `#FBBF24` | Timestamp **freezes** on the capture/estimate date (plan.md §8 moment 4) |
| S | **SYNTH** (purple) | `--synth` | `#A78BFA` | Static; clicking shows the generation note |

Clicking any chip shows source URL/ref + as_of. Note: plan.md §6 says "S=grey chip" —
**superseded** by the UX palette (§8) and CONTRACTS.md: SYNTH is purple. (Flagged in
docs/beats.md decisions list.)

## 3. Per-file provenance summary (data/ — PM1)

Dominant prov per file; individual leaves still carry their own.

| File | Dominant prov | Source basis (plan.md §6 table) |
|---|---|---|
| `hormuz2026_events.json` | **R** | Wikipedia crisis/war timelines, JWC JWLA-033, UKMTO 2026 advisories, MARAD MSCI 2026-004, EIA TIE #67424; India milestones (Angola 334 kb/d, 30M bbl Urals, waiver, Venezuela) from named press. PRICE events: EIA RBRTE daily. |
| `graph_nodes.json` | **R/E mix** | PPAC country shares + port authority pages (R); refinery `assay_env` = empirical envelope inferred from import history (E — it's a derivation); `cover_days` calibrated to public PPAC/port stats (E). |
| `graph_edges.json` | **E** | Real corridor geometry and transit-day ranges; volumes split country→grade from Kpler-citing press (landmine 2 — labeled E, said out loud). |
| `grades.json` | **R** | One canonical producer assay per grade (Equinor/ExxonMobil/ADNOC, Platts APAG); alternates in `alt_values`, never averaged. |
| `charter.json` | **S** (by nature) | The 7 articles are our product content — user-authored rules, not world data. |
| `sanctions_rules.json` | **R, snapshot-dated** | OFAC SDN XML + EU sanctions map. Every entry carries the snapshot date (e.g. `2026-03-01`); an undated sanctions claim is a bug, not a style issue (Article A4). |
| `calibration.json` | **R ranges / E values** | Pre-2024 events only (Abqaiq #41413 etc.). Stored as `{value, min, max, source_ref}` — ranges with provenance, per the uncertainty display rules. |
| `spot_availability.json` | **E** | JODI + EIA STEO 3-month averages. |
| `ais_snapshot.json` | **S** | ~30 synthetic vessels on real corridor geometry — the canonical SYNTH-chip example. |
| `replay_redsea2324_events.json` (video only) | **R** | Wikipedia timeline, JWLA-032, Suez Canal Authority stats. |

## 4. The 5 data landmines and handling rules (plan.md §6, verbatim intent)

1. **Conflicting assays** → one canonical producer source per grade, alternates in
   `alt_values`, never average.
2. **PPAC is country-level, not grade-level** → country→grade split from Kpler-citing
   press, labeled E; say so in the demo (reads as honesty).
3. **Paywalls/unstable URLs** → download every PDF NOW into `/sources/` with SHA-named
   copies + free-mirror backup URLs.
4. **Venezuela number discrepancy — RESOLVED:** the "292 kb/d" figure did NOT match live
   sources (283–285 Apr / 427 May, agency-dependent). `hormuz2026_events.json` now stores
   `venezuela_kbd: 284` for 2026-04 with the note "292 kb/d figure debunked" — display 284
   (or the 283–285 range) with its month + agency; never a bare 292.
5. **2018-frozen-KB contamination** (Basrah Medium didn't exist until 2021!) → two-layer
   store: `kb_2018/` vs `feed_live/`; CI check below. **This check is the one test the
   dataset needs.**

## 5. KB-freeze discipline (the hindsight-bias firewall)

Two layers, never mixed (CLAUDE.md hard rule 6; brainstorm §2.2):

- **`kb_2018/` — structural knowledge, frozen.** Every record cites a **pre-2019 source**
  and carries its date. Consequences taken seriously: Basrah **Light**, not Basrah Medium
  (which didn't exist until 2021); Urals **unsanctioned**; Angola is not "known" — it
  *emerges* from a query over structural facts. SHA-256 manifest checked at boot;
  mismatch = refuse to start. KB updates are explicit signed events.
- **`feed_live/` — the replayed 2026 event stream.** Dated crisis events, prices,
  advisories. This is what the ticker plays back.
- **Calibration sits between:** constants from **pre-2024 events only**; Red Sea 2023-24
  and Hormuz 2026 are pure holdouts.

**The CI check (10 lines, required):** fail the build if any `kb_2018/` record cites a
source dated after 2018-12-31. This single test is what lets us say "frozen" on stage and
survive the follow-up question.

What we may claim on stage, exactly: replayed real feeds, frozen KB, pre-2024 calibration,
top-5 recall with misses shown in red. What we may never claim: live feeds, prediction of
outcomes (policy is a branch, not a forecast), or R status for any synthetic number.
