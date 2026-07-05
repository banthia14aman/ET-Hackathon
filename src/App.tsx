// INTEGRATION — App.tsx. Wires data → store → pipeline → panels.
// The setInterval play loop is PRESENTATION-LAYER ONLY: each beat advances SIM time by a
// fixed step; wall-clock time never enters any derivation (CONTRACTS.md §3.1).

import { useEffect, useRef } from 'react';
import type { ArticleId, CharterArticle, NodeStatus, ReplayEvent } from './contracts/types';
import {
  CalibrationSchema, CharterFileSchema, GradesFileSchema, GraphEdgesFileSchema,
  GraphNodesFileSchema, ReplayBundleSchema, SanctionsRulesSchema, SpotAvailabilityFileSchema,
} from './contracts/schemas';
import { advanceSim } from './engine/replay';
import { verifyChain } from './engine/charter/audit';
import { computeAt, rerunWithCharter, type StaticData } from './lib/pipeline';
import { loadBundle, setCharterParam, store, useStore } from './lib/store';
import MapView, { type DarkVessel } from './components/MapView';
import {
  AuditTrace, CharterPanel, DebatePanel, OptionCards, Stopwatch, TaxonomyCard, Ticker, Waterfall,
} from './components/panels';
import bundleJson from '../data/hormuz2026_events.json' with { type: 'json' };
import nodesJson from '../data/graph_nodes.json' with { type: 'json' };
import edgesJson from '../data/graph_edges.json' with { type: 'json' };
import gradesJson from '../data/grades.json' with { type: 'json' };
import sanctionsJson from '../data/sanctions_rules.json' with { type: 'json' };
import spotJson from '../data/spot_availability.json' with { type: 'json' };
import calibrationJson from '../data/calibration.json' with { type: 'json' };
import charterJson from '../data/charter.json' with { type: 'json' };

// zod-validate every data file once at module load — bad data fails loudly, not mid-demo.
const DATA: StaticData = {
  bundle: ReplayBundleSchema.parse(bundleJson),
  graph: { nodes: GraphNodesFileSchema.parse(nodesJson), edges: GraphEdgesFileSchema.parse(edgesJson) },
  grades: GradesFileSchema.parse(gradesJson),
  sanctions: SanctionsRulesSchema.parse(sanctionsJson),
  spot: SpotAvailabilityFileSchema.parse(spotJson),
  calibration: CalibrationSchema.parse(calibrationJson),
};
const CHARTER: CharterArticle[] = CharterFileSchema.parse(charterJson);
// D5: the demo replays from the Feb 28 shock, not bundle t0.
const DEMO_START = '2026-02-28T00:00:00Z';
const SIM_STEP_MS = 86_400_000; // one interval beat = one sim day (× store.speed)
const TICK_MS = 800;

// ---- presentation-layer pipeline driver (serialized; latest request wins) ----
let simTime = DEMO_START;
let running = false;
let queued: string | null = null;

async function runAt(t_sim: string): Promise<void> {
  if (running) {
    queued = t_sim;
    return;
  }
  running = true;
  try {
    const r = await computeAt(DATA, t_sim, store.getState().charter);
    store.setState({
      cursor: r.cursor, scenario: r.scenario, options: r.options,
      objections: r.objections, audit: r.audit,
    });
  } finally {
    running = false;
    if (queued !== null) {
      const next = queued;
      queued = null;
      void runAt(next);
    }
  }
}

function tick(): void {
  const s = store.getState();
  const end = DATA.bundle.events[DATA.bundle.events.length - 1]?.t ?? DEMO_START;
  if (simTime >= end) {
    store.setState({ playing: false });
    return;
  }
  simTime = advanceSim(simTime, SIM_STEP_MS * s.speed);
  void runAt(simTime);
}

function seekBy(delta: number): void {
  const events = DATA.bundle.events;
  // derive position from simTime (updated synchronously here and in tick), NOT store.cursor —
  // cursor lands only after the async pipeline run, so key mashes would all target cursor+1
  const cur = events.reduce((n, e, i) => (e.t <= simTime ? i : n), -1);
  const target = Math.max(-1, Math.min(events.length - 1, cur + delta));
  simTime = target === -1 ? DATA.bundle.t0 : events[target].t;
  void runAt(simTime);
}

async function onCharterParam(id: string, value: number): Promise<void> {
  const before = store.getState().charter.find((a) => a.id === id)?.param_value;
  setCharterParam(id as ArticleId, value);
  const s = store.getState();
  if (!s.scenario) return;
  const r = await rerunWithCharter(DATA, s.scenario, s.charter, s.audit, `${before} -> ${value}`, id);
  store.setState({ options: r.options, objections: r.objections, audit: r.audit });
}

function simElapsedLabel(t_sim: string): string {
  const days = (Date.parse(t_sim) - Date.parse(DATA.bundle.t0)) / 86_400_000;
  return `T+${Math.round(days)}d`;
}

export default function App() {
  const cursor = useStore((s) => s.cursor);
  const scenario = useStore((s) => s.scenario);
  const options = useStore((s) => s.options);
  const objections = useStore((s) => s.objections);
  const audit = useStore((s) => s.audit);
  const charter = useStore((s) => s.charter);
  const playing = useStore((s) => s.playing);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadBundle(DATA.bundle, CHARTER);
      void runAt(DEMO_START);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        store.setState({ playing: !store.getState().playing });
      } else if (e.code === 'ArrowRight') seekBy(1);
      else if (e.code === 'ArrowLeft') seekBy(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(tick, TICK_MS); // presentation cadence only — advances SIM time
    return () => clearInterval(id);
  }, [playing]);

  const applied: ReplayEvent[] = DATA.bundle.events.slice(0, cursor + 1);
  const darkVessels: DarkVessel[] = applied
    .filter((e) => e.geo && typeof e.payload.dark_count === 'number')
    .map((e) => ({ id: e.id, lat: e.geo![0], lon: e.geo![1], count: e.payload.dark_count as number }));
  const contributions = (['stock_draw', 'divert_on_water', 'floating_storage', 'reroute', 'demand_side'] as const)
    .map((lever) => ({
      lever,
      kbd: options
        .filter((o) => o.lever === lever && (o.status === 'validated' || o.status === 'conditional'))
        .reduce((s, o) => s + o.volume_kb / 30, 0), // 30-day horizon: kb → kb/d
    }))
    .filter((c) => c.kbd > 0);

  return (
    <div className="app-grid">
      <Ticker events={applied} />
      <div className="panel" style={{ gridArea: 'taxonomy' }}>
        <TaxonomyCard shock={scenario?.shocks_active.join(' · ') || undefined} />
        <div style={{ marginTop: 16 }}>
          <Stopwatch
            ts_sim={scenario?.t_sim ?? DATA.bundle.t0}
            elapsed_label={simElapsedLabel(scenario?.t_sim ?? DATA.bundle.t0)}
          />
        </div>
        <div className="label" style={{ marginTop: 16 }}>
          {playing ? '▶ PLAYING' : '⏸ PAUSED'} — SPACE play/pause · ←/→ seek
        </div>
      </div>
      <div className="panel" style={{ gridArea: 'map', padding: 4 }}>
        <MapView
          nodes={DATA.graph.nodes}
          edges={DATA.graph.edges}
          nodeStatus={(scenario?.node_status ?? {}) as Record<string, NodeStatus>}
          edgeStatus={scenario?.edge_status ?? {}}
          darkVessels={darkVessels}
        />
      </div>
      <div className="panel" style={{ gridArea: 'charter' }}>
        <CharterPanel charter={charter} onParamChange={(id, v) => void onCharterParam(id, v)} />
        <div style={{ marginTop: 16 }}>
          <AuditTrace entries={audit.slice(-12)} verified={verifyChain(audit)} />
        </div>
      </div>
      <div className="panel" style={{ gridArea: 'debate' }}>
        <DebatePanel options={options} objections={objections} />
      </div>
      <div className="panel" style={{ gridArea: 'options' }}>
        <OptionCards options={options} />
      </div>
      <div className="panel" style={{ gridArea: 'waterfall' }}>
        <Waterfall gap_kbd={scenario?.gap_kbd ?? 0} contributions={contributions} />
      </div>
    </div>
  );
}
