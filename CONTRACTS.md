# TRINETRA — CONTRACTS v1 (FROZEN)

This is the coordination document. If your work needs something this document
doesn't grant you, you message the TEAM LEAD — you do not edit someone else's file.

## 1. File ownership (exclusive write access)

| Agent | Owns (and NOTHING else) |
|---|---|
| PM1 | `data/*.json` (see `data/README.md` for the exact list + schemas) |
| PM2 | `docs/*` |
| SWE1 | `src/engine/replay.ts` |
| SWE2 | `src/components/MapView.tsx`, `src/lib/geo.ts` |
| SWE3 | `src/engine/scenario.ts` |
| SWE4 | `src/engine/options.ts` |
| SWE5 | `src/engine/charter/*`, `scripts/generate-llm-cache.mjs`, `src/cache/*` |
| SWE6 | `src/components/panels/*`; may **APPEND** to `src/styles.css` below the SWE6 marker only |
| INTEGRATION | `src/App.tsx`, `src/main.tsx`, `scripts/check.mjs`, `README.md`, anything broken |
| LEAD (frozen) | `src/contracts/*`, `src/lib/fmt.ts`, `src/lib/canonical.ts`, `src/lib/store.ts`, `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, this file |

Rules:
- Never create files outside your column. Never edit files in another column.
- Frozen files change only via LEAD, with a version bump of this document.
- Components (SWE2, SWE6) read app state ONLY via `useStore` from `src/lib/store.ts`
  and dispatch ONLY the exported actions. No component calls engine functions directly.

## 2. Frozen module signatures

All engine functions are **pure**: no store access, no I/O, no globals, no mutation
of inputs. Same inputs ⇒ byte-identical outputs (`canonicalJson` equal). All shapes
are from `src/contracts/types.ts`.

### SWE1 — `src/engine/replay.ts`
```ts
import type { ReplayBundle, ReplayStep } from '../contracts/types';

/** Apply exactly the next unapplied event. cursor = index of last applied (-1 = none).
    Returns unchanged cursor + empty events when the bundle is exhausted. */
export function applyNext(cursor: number, bundle: ReplayBundle): ReplayStep;

/** Apply all events with t <= t_sim (inclusive), starting after cursor. Used by seek/speed. */
export function applyUntil(cursor: number, bundle: ReplayBundle, t_sim: string): ReplayStep;
```

### SWE3 — `src/engine/scenario.ts`
```ts
import type { Calibration, Graph, ScenarioState, ShockContext } from '../contracts/types';

/** Re-derive full scenario state (node/edge status, cover-days per refinery, gap_kbd)
    from the static graph + active shocks + calibration. Stateless: no memory of prior calls. */
export function rescore(graph: Graph, shocks: ShockContext, calibration: Calibration): ScenarioState;
```

### SWE4 — `src/engine/options.ts`
```ts
import type { CrudeGrade, Graph, OptionCard, SanctionsRules, ScenarioState, SpotCargo } from '../contracts/types';

/** Generate candidate option cards across the 5 levers, all with status 'proposed'.
    Output sorted by (lever, id). Ids deterministic: 'opt:<lever>:<grade|->:<refinery|->:<n>'. */
export function generateOptions(
  scenario: ScenarioState,
  graph: Graph,
  grades: CrudeGrade[],
  sanctions: SanctionsRules,
  spot: SpotCargo[],
): OptionCard[];
```

### SWE5 — `src/engine/charter/index.ts` (re-export from submodules as you like)
```ts
import type {
  ArbiterChain, ArbitrationResult, CharterArticle, CriticContext,
  LlmCache, Objection, OptionCard,
} from '../../contracts/types';

/** Attach cached LLM rationale (from src/cache/, keyed by OptionCard.id) to each card.
    ZERO runtime LLM calls — cache generated at build time by scripts/generate-llm-cache.mjs.
    Cache miss => deterministic template string, never a network call. */
export function propose(options: OptionCard[], cache: LlmCache): OptionCard[];

/** ZERO-LLM pure-function validators, one per charter article A1–A7.
    Output sorted by (option_id, rule_id). Objection.id = `${rule_id}:${option_id}`. */
export function criticize(options: OptionCard[], ctx: CriticContext): Objection[];

/** Deterministic severity lattice: any 'block' ⇒ rejected; else any 'flag' ⇒ conditional
    (conditions from flag messages, sorted); else validated. Emits hash-chained AuditEntry[]
    (hashes via canonicalJson + sha256Hex — hence async). */
export function arbitrate(
  options: OptionCard[],
  objections: Objection[],
  charter: CharterArticle[],
  chain: ArbiterChain,
): Promise<ArbitrationResult>;
```

### SWE2 — `src/components/MapView.tsx` + `src/lib/geo.ts`
```ts
// MapView.tsx — SVG world map (NOT deck.gl). Reads store via useStore only. No props required:
export default function MapView(): JSX.Element;
// geo.ts — equirectangular projection into the map viewBox; internal to SWE2 but keep pure.
```

### SWE6 — `src/components/panels/`
One default-export React component per panel, no props, store-driven:
`Ticker.tsx`, `Taxonomy.tsx`, `Debate.tsx`, `Charter.tsx`, `Options.tsx`, `Waterfall.tsx`.
Grid areas already exist in `styles.css`: `ticker, taxonomy, debate, charter, options, waterfall`
(map area is SWE2's). All formatting via `src/lib/fmt.ts`; provenance chips use
`--green/--amber/--synth` per R/E/S → LIVE/CACHED/SYNTH.

### Pipeline order (INTEGRATION wires inside store actions — see stubs in `src/lib/store.ts`)
```
tick/seek: applyNext|applyUntil → fold triggers/PRICE into ShockContext → rescore
         → generateOptions → propose → criticize → arbitrate → store.setState(...)
```

## 3. Determinism rules (violations = rejected at integration)

1. **No wall clock, no randomness** in any derivation path (`src/engine/**`, `src/lib/**`,
   anything feeding state): no `Date.now()`, `new Date()` without an explicit ISO arg,
   `Math.random()`, `performance.now()`, `crypto.randomUUID()`. Time is `t_sim` from events only.
2. **No network at runtime**: no `fetch`/XHR/WebSocket anywhere in `src/`. Data enters via
   static JSON imports (`resolveJsonModule` is on). LLM text comes from `src/cache/` only.
3. **Stable ordering everywhere**: never rely on object-key iteration order; every emitted
   array has a documented sort with an explicit final tiebreak on `id`.
4. **Deterministic ids** built from inputs (patterns in §2) — never counters shared across
   calls, never UUIDs.
5. **Hashing**: exclusively `sha256Hex(canonicalJson(x))` from `src/lib/canonical.ts`.
   Audit chain: `entry[0].prev_hash === 'GENESIS'`, `entry[n].prev_hash === entry[n-1].output_hash`.
6. **Formatting only in UI** via `src/lib/fmt.ts`; engine state keeps raw numbers
   (no rounding inside engines except where a contract field is defined as rounded).
7. `seek` = full deterministic rebuild from event 0. No incremental undo state.

## 4. Import boundaries

Allowed imports for every module: `react`, `react-dom`, `zod`, `src/contracts/*`,
`src/lib/*` (components additionally: their own files; SWE5 additionally: `src/cache/*`).

Forbidden: engine→engine imports (replay/scenario/options/charter never import each
other — INTEGRATION composes them), component→engine imports, anything→`App.tsx`,
engines→store (engines are pure functions; only store actions and components touch the store).

— v1, frozen 2026-07-05. Changes require LEAD sign-off and a version bump here.
