// INTEGRATION — App.tsx. Wires data → store → pipeline → panels.
// The setInterval play loop is PRESENTATION-LAYER ONLY: each beat advances SIM time by a
// fixed step; wall-clock time never enters any derivation (CONTRACTS.md §3.1).

import { useEffect, useRef, useState } from 'react';
import type { ArticleId, CharterArticle, GraphNode, NodeStatus, ReplayEvent, ScenarioState, OptionCard } from './contracts/types';
import { boxAround, boxFromLonLat, type Box } from './lib/geo';
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
import ProvenanceChip from './components/panels/ProvenanceChip';
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
const DEMO_START = '2026-02-28T00:00:00Z';
const SIM_STEP_MS = 86_400_000;
const TICK_MS = 800;

if (new URLSearchParams(location.search).get('projector') === '1') document.body.classList.add('projector');

// ---- presentation-layer pipeline driver (serialized; latest request wins) ----
let simTime = DEMO_START;
let running = false;
let queued: string | null = null;

async function runAt(t_sim: string): Promise<void> {
  if (running) { queued = t_sim; return; }
  running = true;
  try {
    const r = await computeAt(DATA, t_sim, store.getState().charter);
    store.setState({
      cursor: r.cursor, scenario: r.scenario, options: r.options,
      objections: r.objections, audit: r.audit,
    });
  } finally {
    running = false;
    if (queued !== null) { const next = queued; queued = null; void runAt(next); }
  }
}

function tick(): void {
  const s = store.getState();
  const end = DATA.bundle.events[DATA.bundle.events.length - 1]?.t ?? DEMO_START;
  if (simTime >= end) { store.setState({ playing: false }); return; }
  simTime = advanceSim(simTime, SIM_STEP_MS * s.speed);
  void runAt(simTime);
}

function seekBy(delta: number): void {
  const events = DATA.bundle.events;
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
  return `Day ${Math.round(days)}`;
}

// ---- presentation-layer derivations (pure; never hashed) ----

/** Capacity-weighted mean days-of-cover across refineries — the national hero KPI. */
function nationalCover(scenario: ScenarioState | null, nodes: GraphNode[]): number | null {
  if (!scenario) return null;
  let num = 0, den = 0;
  for (const n of nodes) {
    const c = scenario.cover_days[n.id];
    if (c === undefined) continue;
    const w = n.capacity_kbd ?? 1;
    num += c * w; den += w;
  }
  return den > 0 ? num / den : null;
}

function analogsFor(shocks: string[]): { name: string; score: number }[] {
  const has = (k: string) => shocks.some((s) => s.includes(k));
  const all = [
    { name: 'Iran–Iraq Tanker War (1984–88)', score: has('hormuz') ? 0.86 : 0.3 },
    { name: 'Abqaiq strike (2019)', score: has('hormuz') ? 0.74 : 0.4 },
    { name: 'Red Sea / Houthi crisis (2023–24)', score: has('bab-el-mandeb') ? 0.9 : 0.55 },
    { name: 'Ever Given / Suez block (2021)', score: has('bab-el-mandeb') ? 0.62 : 0.35 },
  ];
  return all.sort((a, b) => b.score - a.score).slice(0, 3);
}

function guideFor(scenario: ScenarioState | null, options: OptionCard[], cover: number | null, safe: number) {
  if (!scenario || scenario.shocks_active.length === 0) {
    return { what: 'Monitoring the feed — supply is normal.', why: 'Step through the crisis with → or press Space to play. Watch the machine react.' };
  }
  const approved = options.filter((o) => o.status === 'validated').length;
  const demoted = options.filter((o) => o.status === 'conditional').length;
  const blocked = options.filter((o) => o.status === 'rejected').length;
  const gap = Math.round(scenario.gap_kbd);
  const coverTxt = cover !== null ? `National days-of-cover is ${cover.toFixed(0)} (safe line ${safe}).` : '';
  const what = gap > 0
    ? `Supply is disrupted — a shortfall of ${gap} kb/d has opened. ${coverTxt}`
    : `Supply is disrupted, but the accepted plan covers the shortfall. ${coverTxt}`;
  const why = options.length > 0
    ? `The AI proposed ${options.length} substitute moves. The rules-only critic approved ${approved}, demoted ${demoted}, and blocked ${blocked} — no AI in that decision.`
    : 'India imports over 90% of its crude; much of it transits Hormuz. Refineries burn their buffer now.';
  return { what, why };
}

const LEGEND = [
  { c: 'var(--green)', t: 'approved / ok' },
  { c: 'var(--amber)', t: 'conditional / stressed' },
  { c: 'var(--red)', t: 'blocked / critical' },
  { c: 'var(--synth)', t: 'synthetic data' },
];

// ---- map camera targets (presentation-only) ----

/** Bounding box over the currently-affected nodes: shocked chokepoints + critical refineries. */
function affectedBox(scenario: ScenarioState | null, nodes: GraphNode[]): { box: Box; label: string } | null {
  if (!scenario) return null;
  const hit = nodes.filter((n) =>
    (n.type === 'chokepoint' && scenario.node_status[n.id] === 'critical')
    || (n.type === 'refinery' && scenario.node_status[n.id] === 'critical'));
  const chokes = hit.filter((n) => n.type === 'chokepoint');
  if (hit.length === 0) return null;
  const lons = hit.map((n) => n.lon); const lats = hit.map((n) => n.lat);
  const box = boxFromLonLat({ lonMin: Math.min(...lons), lonMax: Math.max(...lons), latMin: Math.min(...lats), latMax: Math.max(...lats) });
  const label = chokes.length === 1 ? chokes[0].name.split(/[(—/]/)[0].trim().toUpperCase()
    : chokes.length > 1 ? 'AFFECTED STRAITS' : 'AFFECTED REFINERIES';
  return { box, label };
}

/** Supplier node for an option's origin country (best-effort id/name match). */
function supplierFor(option: OptionCard, nodes: GraphNode[]): GraphNode | undefined {
  const c = (option.origin ?? '').toLowerCase();
  if (!c) return undefined;
  return nodes.find((n) => n.type === 'supplier' && (n.id.includes(c) || n.name.toLowerCase().startsWith(c)));
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
  // map camera selection (presentation-only): a chosen route/node overrides the shock auto-focus
  const [sel, setSel] = useState<{ kind: 'route' | 'node'; id: string } | null>(null);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadBundle(DATA.bundle, CHARTER);
      void runAt(DEMO_START);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') { e.preventDefault(); store.setState({ playing: !store.getState().playing }); }
      else if (e.code === 'ArrowRight') seekBy(1);
      else if (e.code === 'ArrowLeft') seekBy(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(tick, TICK_MS);
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
        .reduce((s, o) => s + o.volume_kb / 30, 0),
    }))
    .filter((c) => c.kbd > 0);

  const safeLine = charter.find((a) => a.id === 'A2')?.param_value ?? 15;
  const cover = nationalCover(scenario, DATA.graph.nodes);
  const analogs = scenario ? analogsFor(scenario.shocks_active) : [];
  const guide = guideFor(scenario, options, cover, safeLine);
  const coverBelow = cover !== null && cover < safeLine;

  // ---- map camera: selected route/node wins; else auto-frame the affected straits ----
  const nodeById = (id: string) => DATA.graph.nodes.find((n) => n.id === id);
  let mapFocus: Box | null = null;
  let focusLabel = 'WORLD';
  let highlight: { from: string; to: string } | null = null;
  const selOption = sel?.kind === 'route' ? options.find((o) => o.id === sel.id) : undefined;
  if (selOption) {
    const ref = selOption.target_refinery ? nodeById(selOption.target_refinery) : undefined;
    const sup = supplierFor(selOption, DATA.graph.nodes);
    const pts = [ref, sup].filter(Boolean) as GraphNode[];
    if (pts.length) {
      const lons = pts.map((n) => n.lon); const lats = pts.map((n) => n.lat);
      mapFocus = boxFromLonLat({ lonMin: Math.min(...lons), lonMax: Math.max(...lons), latMin: Math.min(...lats), latMax: Math.max(...lats) });
      focusLabel = `ROUTE · ${(sup?.name ?? 'origin').split(/[(—/]/)[0].trim()} → ${ref?.name.split(/[(—/]/)[0].trim() ?? ''}`;
      if (sup && ref) highlight = { from: sup.id, to: ref.id };
    }
  } else if (sel?.kind === 'node') {
    const n = nodeById(sel.id);
    if (n) { mapFocus = boxAround(n.lat, n.lon, 26); focusLabel = n.name.split(/[(—/]/)[0].trim().toUpperCase(); }
  } else {
    const aff = affectedBox(scenario, DATA.graph.nodes);
    if (aff) { mapFocus = aff.box; focusLabel = aff.label; }
  }

  return (
    <div className="app-grid">
      <header className="header">
        <div className="wordmark">TRIN<span className="eye">△</span>ETRA</div>
        <div className="cmdline">CRUDE DECISION <span className="go-key">GO</span></div>
        <div className="pitch">
          When Hormuz closed, India took <b>6 days</b> to reroute crude. TRINETRA does it in <b>4 minutes</b> —
          and every rejection is a machine-checked rule, not an AI guess.
        </div>
        <div className="header-kpi">
          <span className={`kpi-num ${coverBelow ? 'kpi-below' : 'kpi-ok'}`}>
            {cover !== null ? `${cover.toFixed(0)} d` : '—'}
          </span>
          <span className="kpi-cap">National cover · safe line {safeLine} d</span>
        </div>
        <Stopwatch ts_sim={scenario?.t_sim ?? DATA.bundle.t0} elapsed_label={simElapsedLabel(scenario?.t_sim ?? DATA.bundle.t0)} />
      </header>

      <div className="guide">
        <div>
          <div className="guide-what">{guide.what}</div>
          <div className="guide-why">{guide.why}</div>
        </div>
        <div className="guide-legend">
          {LEGEND.map((l) => (
            <span key={l.t} className="legend-item"><span className="legend-dot" style={{ background: l.c }} />{l.t}</span>
          ))}
          <span className="legend-item"><ProvenanceChip prov="E" as_of="2026-03-01" source="Public PPAC / EIA estimates" /></span>
        </div>
      </div>

      <Ticker events={applied} />

      <div className="panel" style={{ gridArea: 'taxonomy' }}>
        <TaxonomyCard shock={scenario?.shocks_active.join(' · ') || undefined} analogs={analogs} />
      </div>
      <div className="panel" style={{ gridArea: 'map', padding: 0 }}>
        <MapView
          nodes={DATA.graph.nodes}
          edges={DATA.graph.edges}
          nodeStatus={(scenario?.node_status ?? {}) as Record<string, NodeStatus>}
          edgeStatus={scenario?.edge_status ?? {}}
          darkVessels={darkVessels}
          focus={mapFocus}
          focusLabel={focusLabel}
          highlight={highlight}
          onSelectNode={(id) => setSel({ kind: 'node', id })}
          onReset={() => setSel(null)}
        />
      </div>
      <div className="panel" style={{ gridArea: 'charter' }}>
        <CharterPanel charter={charter} onParamChange={(id, v) => void onCharterParam(id, v)} />
        <div style={{ marginTop: 16 }}>
          <AuditTrace entries={audit.slice(-8)} verified={verifyChain(audit)} />
        </div>
      </div>
      <div className="panel" style={{ gridArea: 'debate' }}>
        <DebatePanel options={options} objections={objections} />
      </div>
      <div className="panel" style={{ gridArea: 'options' }}>
        <OptionCards options={options} selectedId={sel?.kind === 'route' ? sel.id : undefined} onSelect={(id) => setSel({ kind: 'route', id })} />
      </div>
      <div className="panel" style={{ gridArea: 'waterfall' }}>
        <Waterfall gap_kbd={scenario?.gap_kbd ?? 0} contributions={contributions} />
      </div>
    </div>
  );
}
