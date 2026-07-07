# TRINETRA — real data sources

Every value on screen carries a provenance chip: **R** (real, cited public source), **E**
(estimate — sourced but weak/single-source or derived), **S** (synthetic/scenario). Nothing is
invented and passed off as measured. This file lists the real sources behind the `R`/`E` data,
gathered 2026-07-07 by a fleet of web-research agents (each instructed to return only retrieved
values with real URLs, and `null` when it couldn't find something).

## Historical crisis analogs (`data/analogs.json`, prov R)
The on-screen "similarity %" is **computed** (`src/lib/analogs.ts`), never measured or invented.
- Iran–Iraq Tanker War 1984–88 — [Wikipedia](https://en.wikipedia.org/wiki/Tanker_war), [Britannica](https://www.britannica.com/event/Tanker-War)
- Abqaiq–Khurais attack 2019 (5.7 mb/d off; Brent +11.7%) — [EIA TIE #41413](https://www.eia.gov/todayinenergy/detail.php?id=41413)
- Ever Given / Suez 2021 (6 days; Brent +6.4%) — [Wikipedia](https://en.wikipedia.org/wiki/2021_Suez_Canal_obstruction)
- Red Sea / Houthi 2023–24 (8.7→4.0 mb/d; +10–16 d reroute; Brent +14%) — [EIA TIE #63446](https://www.eia.gov/todayinenergy/detail.php?id=63446), [#61363](https://www.eia.gov/todayinenergy/detail.php?id=61363)

## Crude assays (`data/grades.json`)
- **Girassol** (prov R) — [TotalEnergies official assay](https://trading.totalenergies.com/), 2015-02-09
- **Cabinda** (prov R) — [TotalEnergies official assay](https://trading.totalenergies.com/), 2020-01-23
- **Merey 16** (prov E) — broker spec sheet (~2008) + Energy Intelligence crude profile. API 16 / S 2.45 corroborated; TAN 0.69 / V 262 single-source, illustrative. **The old `TAN 3.3` was fabricated and has been removed** — Merey binds because it is *too heavy* (API 16), not high-TAN.
- **Urals** (prov E) — [A Barrel Full assay wiki](http://abarrelfull.wikidot.com/ural-crude-oil) + ThePetroSolutions. Single-assay of a blend; TAN disputed.
- **Murban** (prov R) — ADNOC published assay. **Basrah Medium/Heavy** (prov R) — SOMO assay.
- WTI Midland, Arab Light, Tupi, Bonny Light (prov E) — re-sourcing in progress.

More real assays (all producer/primary, added 2026-07-07): **WTI** (ExxonMobil WTI Light assay),
**Bonny Light** and **Murban** (TotalEnergies official assays), **Basrah Heavy** (BP via Oil & Gas
Journal), **Tupi/Lula** (OGJ), **Arab Light** (Environment Canada ESTS #523).

## Prices, chokepoints, sanctions, refineries, reserves
- **Brent history** — [EIA RBRTE daily](https://www.eia.gov/dnav/pet/hist/rbrted.htm) (exact spot for the 2019/2021/2023–24 windows).
- **Chokepoint oil flows (1H25, EIA)** — Hormuz **20.9 mb/d (~20% of global oil)**, Malacca 23.2, Cape 9.1, Suez+SUMED 4.9, Bab el-Mandeb 4.2 — [EIA World Oil Transit Chokepoints](https://www.eia.gov/international/content/analysis/special_topics/World_Oil_Transit_Chokepoints/).
- **India crude import dependence** — 87.4% (FY23) → 88.6% (FY25, first 10 mo); imports ~4.5 mb/d / 244.5 MMT (FY25); Russia 35.8% of the barrel — PPAC via ORF/EIA.
- **India strategic reserves** — ISPRL 5.33 MMT / 36.92 M bbl = **9.5 days of cover**; ~74 days incl. refiners' commercial stock; vs the **IEA 90-day** norm — [Wikipedia/ISPRL/MoPNG](https://en.wikipedia.org/wiki/Strategic_Petroleum_Reserve_(India)), [IEA](https://www.iea.org/about/oil-security-and-emergency-response).
- **Refinery capacities** — [PPAC installed refinery capacity](https://ppac.gov.in/infrastructure/installed-refinery-capacity) (Govt of India); Nelson complexity via Wikipedia.
- **War-risk / freight** — Red Sea war-risk premium rose ~0.05%→0.7–1.0% of hull (2024); the 2026 Hormuz war pushed premiums to ~2.5% / $2–3M per VLCC and the Baltic TD3C index to a record ~$423,736/day — Caixin, Lloyd's List/Baltic (some via snapshot only).
- **Sanctions** — EU price cap $44.10/bbl eff. 2026-02-01 and $47.60 (18th package, 2025-09-03), [European Commission](https://finance.ec.europa.eu/); Venezuela GL 50A (13 Feb 2026), OFAC; Nayara designation Reg (EU) 2025/1494, 18 Jul 2025, [EUR-Lex](https://eur-lex.europa.eu/); Nayara 49.13% Rosneft.

## The 2026 Hormuz crisis is a REAL event (fact-checked)
The `hormuz-2026-reality` agent confirmed, across independent sources, that the crisis TRINETRA
replays actually happened: **US/Israeli airstrikes on Iran began 28 Feb 2026; Iran declared the
Strait of Hormuz closed on 4 Mar 2026; ~150 tankers anchored; crude rose >50%; a US–Iran
de-escalation began reopening it mid-June 2026.** Corroborated by [Al Jazeera](https://www.aljazeera.com/features/2026/4/28/when-will-strait-of-hormuz-be-safe-for-commercial-shipping-again)
(dated Mar/Apr/Jun 2026), Encyclopaedia Britannica ("2026 Iran war"), the UK House of Commons
Library briefing CBP-10636, and Wikipedia. The project's own timeline (Feb-28 start, March closure)
matches. So the replay is of a **documented event**, not a hypothetical — event records should be
read as R/E, not S. (Distinct from June 2025, when Iran only *threatened* closure and the strait stayed open.)

## What genuinely stays synthetic (prov S) — and why
Some data does not exist publicly at the needed granularity, so it is labeled S and never dressed
up as real:
- **AIS dark-vessel positions** — real-time vessel tracking is proprietary (Kpler/Spire/MarineTraffic).
- **Refinery-level days-of-cover and tank levels** — commercially confidential (the national ~9.5-day figure IS real; per-refinery is modeled).
- **Spot cargo availability** — proprietary (Kpler/Vortexa).

> The honest claim is not "everything is real" — it's "nothing is fabricated, and every number
> shows exactly how certain it is."
