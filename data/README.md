# data/ — owned by PM1 (exclusive)

Every file below MUST parse under the named schema from `src/contracts/schemas.ts`.
`npm run check` will validate them at integration. All numbers carry provenance
(`prov`: R = real, E = estimated, S = synthetic) and a `source` / `source_ref`.

| File | Schema | Notes |
|---|---|---|
| `hormuz2026_events.json` | `ReplayBundleSchema` | The 2026 Hormuz crisis timeline. `events` sorted ascending by `t`, ties broken by `id`. `t0` = scenario start. Event `triggers` carry shock ids (e.g. `shock:hormuz_closure`) consumed by scenario rescoring. |
| `graph_nodes.json` | `GraphNodesFileSchema` (`GraphNode[]`) | Suppliers, corridors, chokepoints, ports, refineries. Refineries need `assay_env`, `cover_days`, `capacity_kbd`. Ports need `port_limits`. |
| `graph_edges.json` | `GraphEdgesFileSchema` (`GraphEdge[]`) | `from`/`to`/`via_chokepoints` must reference ids in `graph_nodes.json`. |
| `grades.json` | `GradesFileSchema` (`CrudeGrade[]`) | Crude assay data per grade. |
| `charter.json` | `CharterFileSchema` (`CharterArticle[]`, exactly 7) | Articles A1–A7 in order. Tunable articles set `param_key` + default `param_value`. |
| `sanctions_rules.json` | `SanctionsRulesSchema` | `{ [origin_country]: { rail: 'GREEN'\|'AMBER'\|'RED', note } }`. Country keys must match `origin_country` values used in `grades.json` / `spot_availability.json` exactly. |
| `calibration.json` | `CalibrationSchema` | `{ [param_key]: { value, min, max, unit?, source_ref, prov } }`. Include at minimum: `brent_baseline_usd`, chokepoint closure multipliers, reroute transit deltas, cover-day burn rates. `source_ref` points at an event id or external source. |
| `spot_availability.json` | `SpotAvailabilityFileSchema` (`SpotCargo[]`) | Spot cargoes available during the scenario. `grade_id` must exist in `grades.json`; `avail_from_day` is sim-days after `t0`. |

Cross-file referential integrity (edge endpoints, grade ids, country keys) is PM1's
responsibility; check.mjs will enforce it.
