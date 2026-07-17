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
import type { ShockContext } from './contracts/types';
import { advanceSim } from './engine/replay';
import { verifyChain } from './engine/charter/audit';
import { computeAt, computeScenario, rerunWithCharter, type StaticData } from './lib/pipeline';
import { loadBundle, setCharterParam, store, useStore } from './lib/store';
import MapView, { type DarkVessel } from './components/MapView';
import ScenarioBuilder from './components/ScenarioBuilder';
import BacktestScorecard from './components/BacktestScorecard';
import AiAssistPanel from './components/AiAssistPanel';
import {
  AuditTrace, CharterPanel, DebatePanel, OptionCards, Stopwatch, TaxonomyCard, Ticker, Waterfall,
} from './components/panels';
import ProvenanceChip from './components/panels/ProvenanceChip';
import { rankAnalogs } from './lib/analogs';
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
const BEAT_T = '2026-03-15T00:00:00Z'; // canonical crisis timestamp (Beat 1/2 — see docs/beats.md)
const TWO_STRAIT: ShockContext = { t_sim: '2027-01-01T00:00:00Z', shocks_active: ['shock:bab-el-mandeb-severe', 'shock:hormuz-severe'], brent_usd: 145 };
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
      sandbox: false, cursor: r.cursor, scenario: r.scenario, options: r.options,
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

async function runScenario(sc: ShockContext): Promise<void> {
  const r = await computeScenario(DATA, sc, store.getState().charter);
  store.setState({ sandbox: true, playing: false, cursor: r.cursor, scenario: r.scenario, options: r.options, objections: r.objections, audit: r.audit });
}

/** Leave the what-if and return to the live replay at the current sim time. */
function exitSandbox(): void { void runAt(simTime); }

/** Jump the replay to an absolute sim time (used by the guided tour). */
function goTo(iso: string): void { simTime = iso; void runAt(iso); }

/** Place the tour caption card just outside the spotlit panel (below → above → beside), clamped
    to the viewport, so it points at what it's describing without covering it. */
function placeCard(r: DOMRect): { top: number; left: number } {
  const W = 480, H = 200, m = 14;
  const vw = window.innerWidth, vh = window.innerHeight;
  const cx = r.left + r.width / 2;
  let top: number, left: number;
  if (r.bottom + m + H <= vh) { top = r.bottom + m; left = cx - W / 2; }
  else if (r.top - m - H >= 0) { top = r.top - m - H; left = cx - W / 2; }
  else if (r.right + m + W <= vw) { left = r.right + m; top = r.top; }
  else if (r.left - m - W >= 0) { left = r.left - m - W; top = r.top; }
  else { top = vh - H - m; left = cx - W / 2; }
  left = Math.max(m, Math.min(vw - W - m, left));
  top = Math.max(m, Math.min(vh - H - m, top));
  return { top, left };
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

/** Active shocked-chokepoint keys from the shock ids ('shock:hormuz-severe' → 'hormuz'). */
function shockedChokepointKeys(shocks: string[]): string[] {
  return [...new Set(shocks.map((s) => s.replace(/^shock:/, '').replace(/-(partial|severe|closure-declared)$/, '')))];
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
  const sandbox = useStore((s) => s.sandbox);
  const initialized = useRef(false);
  // map camera selection (presentation-only): a chosen route/node overrides the shock auto-focus
  const [sel, setSel] = useState<{ kind: 'route' | 'node'; id: string } | null>(null);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [backtestOpen, setBacktestOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // Beat-2 amber ring: option ids whose status just changed
  const [changedIds, setChangedIds] = useState<Set<string>>(new Set());
  const prevStatus = useRef<Record<string, string>>({});
  // guided tour / demo
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [tourPlaying, setTourPlaying] = useState(false);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);

  // The guided-demo script. Each caption doubles as the video voiceover; each action drives the
  // real app (seek the replay, select a route, edit a rule, run a what-if) — nothing is faked.
  const TOUR: { area: string; title: string; text: string; action?: () => void }[] = [
    { area: 'header', title: 'What TRINETRA is',
      text: 'When Hormuz closed, India took six days to reroute crude. TRINETRA does it in four minutes — an AI proposes, a rules-only machine decides, and every step is on the record.',
      action: () => { setSel(null); void onCharterParam('A2', 10); goTo(DEMO_START); } },
    { area: 'map', title: 'The crisis hits',
      text: 'March 2026: the Strait of Hormuz is disrupted — roughly 40% of India’s crude transits here. The map flies to the affected straits automatically.',
      action: () => goTo(BEAT_T) },
    { area: 'header', title: 'The exposure',
      text: 'Jamnagar’s days-of-cover falls below the safe line and a national shortfall opens — about 1,660 kb/d, a third of India’s daily crude runs.',
      action: () => goTo(BEAT_T) },
    { area: 'plan', title: 'The options',
      text: 'The desk’s AI proposes substitute cargoes from around the world. Each carries a provenance chip and a prediction from our own trained compatibility model. Click any card to trace its route on the map.',
      action: () => goTo(BEAT_T) },
    { area: 'debate', title: 'The critic — with no AI',
      text: 'A rules-only critic demotes the sanctioned Venezuelan Merey: too heavy and sour to run neat, an OFAC-flagged payment rail, and a 43-day voyage against a 12-day buffer. It cannot hallucinate — it contains no model.',
      action: () => { goTo(BEAT_T); window.setTimeout(() => { const m = store.getState().options.find((o) => o.grade === 'gr:merey-16' && o.target_refinery === 'ref:jamnagar'); if (m) setSel({ kind: 'route', id: m.id }); }, 450); } },
    { area: 'rules', title: 'Change one rule',
      text: 'Raise the security floor from 10 to 15 days of cover — and the plan re-decides itself. Six long-haul cargoes just failed, each flashing amber.',
      action: () => { setSel(null); goTo(BEAT_T); window.setTimeout(() => void onCharterParam('A2', 15), 550); } },
    { area: 'header', title: 'Ask a what-if',
      text: 'Pose a hypothetical future — what if Hormuz AND the Red Sea close at once? The same engine re-scores a scenario that never happened.',
      action: () => { void onCharterParam('A2', 10); void runScenario(TWO_STRAIT); } },
    { area: 'rules', title: 'The proof',
      text: 'Every step — propose, critique, arbitrate — is hash-chained and re-runs byte-identically, offline. That signed trace is what a regulator can audit.',
      action: () => { exitSandbox(); goTo(BEAT_T); } },
    { area: 'header', title: 'Six days to four minutes',
      text: 'An AI that argues under rules you wrote, a machine that enforces them, and a decision on the record. That is TRINETRA.',
      action: () => goTo(BEAT_T) },
  ];

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadBundle(DATA.bundle, CHARTER);
      void runAt(DEMO_START);
      const q = new URLSearchParams(location.search);
      if (q.get('tour') === '1' || q.get('judge') === '1') { setTourStep(0); if (q.get('tour') === '1') setTourPlaying(true); }
    }
    const onKey = (e: KeyboardEvent) => {
      // never hijack typing/caret keys while an input has focus (Beat-2 charter edit, What-if slider)
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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

  // flash the amber ring on any option whose status just changed (Beat 2 star moment)
  useEffect(() => {
    const prev = prevStatus.current;
    const diff = options.filter((o) => prev[o.id] && prev[o.id] !== o.status).map((o) => o.id);
    prevStatus.current = Object.fromEntries(options.map((o) => [o.id, o.status]));
    if (diff.length === 0) return;
    setChangedIds(new Set(diff));
    const t = setTimeout(() => setChangedIds(new Set()), 2100);
    return () => clearTimeout(t);
  }, [options]);

  // drop a route selection whose option no longer exists (after a seek/rerun) so the map doesn't
  // hold a stale "ROUTE ·" focus
  useEffect(() => {
    if (sel?.kind === 'route' && !options.some((o) => o.id === sel.id)) setSel(null);
  }, [options, sel]);

  // guided tour: run the step's action, spotlight its panel, and slide the card beside it
  useEffect(() => {
    document.querySelectorAll('[data-tour]').forEach((el) => el.classList.remove('tour-focus'));
    if (tourStep == null) { setCardPos(null); return; }
    const step = TOUR[tourStep];
    step.action?.();
    const el = document.querySelector(`[data-tour="${step.area}"]`);
    if (el) {
      el.classList.add('tour-focus');
      setCardPos(placeCard(el.getBoundingClientRect()));
    }
    return () => el?.classList.remove('tour-focus');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep]);

  // auto-advance while playing (hands-free for video capture)
  useEffect(() => {
    if (tourStep == null || !tourPlaying) return;
    if (tourStep >= TOUR.length - 1) { setTourPlaying(false); return; }
    const t = setTimeout(() => setTourStep((s) => (s ?? 0) + 1), 9500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourStep, tourPlaying]);

  const applied: ReplayEvent[] = DATA.bundle.events.slice(0, cursor + 1);
  const darkVessels: DarkVessel[] = applied
    .filter((e) => e.geo && typeof e.payload.dark_count === 'number')
    .map((e) => ({ id: e.id, lat: e.geo![0], lon: e.geo![1], count: e.payload.dark_count as number }));
  // firm = arbiter-approved; pending = demoted-with-conditions (never counted as firm cover —
  // the critic just demoted those, and the waterfall must not quietly re-admit them)
  const contributions = (['stock_draw', 'divert_on_water', 'floating_storage', 'reroute', 'demand_side'] as const)
    .map((lever) => {
      const sum = (st: string) => options
        .filter((o) => o.lever === lever && o.status === st)
        .reduce((s, o) => s + o.volume_kb / 30, 0);
      return { lever, kbd: sum('validated'), pending: sum('conditional') };
    })
    .filter((c) => c.kbd > 0 || c.pending > 0);

  // Cost of decision lag — computed live from the scenario's Brent, not a hardcoded number.
  // spot-exposed barrels × 6-day lag × average excess over the ramp (½ of peak excess).
  const SPOT_EXPOSED_KBD = 1500; // ~30% of India's ~4.9 mb/d imports (PPAC-derived; directional, prov E)
  const BASELINE_BRENT = 71;     // pre-crisis Brent, Feb 2026 (prov E)
  const LAG_DAYS = 6;            // India's reported decision lag when Hormuz shut
  const priceExcess = Math.max(0, (scenario?.brent_usd ?? BASELINE_BRENT) - BASELINE_BRENT);
  // round to 2 significant figures so the display doesn't imply more precision than the inputs support
  const costRaw = SPOT_EXPOSED_KBD * 1000 * LAG_DAYS * priceExcess * 0.5;
  const costOfDelayUsd = costRaw > 0 ? Number(costRaw.toPrecision(2)) : 0;
  const costTitle = `1.5 mb/d spot-exposed × ${LAG_DAYS}-day lag × ½ of the $${priceExcess.toFixed(0)}/bbl excess over $${BASELINE_BRENT} pre-crisis Brent (order-of-magnitude). Spot share directional (E); Brent is the scenario's.`;

  const safeLine = charter.find((a) => a.id === 'A2')?.param_value ?? 15;
  const cover = nationalCover(scenario, DATA.graph.nodes);
  const priceRisePct = (priceExcess / BASELINE_BRENT) * 100;
  const analogs = scenario && scenario.shocks_active.length > 0
    ? rankAnalogs(shockedChokepointKeys(scenario.shocks_active), scenario.gap_kbd / 1000, priceRisePct).slice(0, 3)
    : [];
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
      <header className="header" data-tour="header">
        <div className="wordmark">TRIN<span className="eye">△</span>ETRA</div>
        <div className="cmdline">CRUDE DECISION <span className="go-key">GO</span></div>
        <button className="tour-open-btn" onClick={() => { setTourStep(0); setTourPlaying(false); }}>▶ DEMO</button>
        <button className="scn-open-btn" onClick={() => setScenarioOpen(true)}>WHAT-IF ⌂</button>
        <button className="scn-open-btn" onClick={() => setBacktestOpen(true)}>BACKTEST ✓</button>
        <button className="scn-open-btn ai-open-btn" onClick={() => setAiOpen(true)}>AI ASSIST ✦</button>
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
        <Stopwatch ts_sim={scenario?.t_sim ?? DATA.bundle.t0} elapsed_label={simElapsedLabel(scenario?.t_sim ?? DATA.bundle.t0)}
          crisisActive={!!scenario && scenario.shocks_active.length > 0} />
      </header>

      {sandbox && scenario ? (
        <div className="sandbox">
          <span className="sandbox-tag">SANDBOX</span>
          <div className="sandbox-txt">
            <b>Hypothetical scenario</b> — {scenario.shocks_active.map((s) => s.replace('shock:', '').replace(/-(partial|severe)$/, ' ($1)')).join(', ') || 'no disruption'}
            {' · '}Brent ${Math.round(scenario.brent_usd)} · national cover {cover !== null ? cover.toFixed(0) : '—'} d.
            This is what TRINETRA's rules would decide under that future — same engine, not real data.
          </div>
          <button className="btn-ghost" onClick={exitSandbox}>EXIT SANDBOX</button>
        </div>
      ) : (
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
      )}

      <Ticker events={applied} />

      <div className="panel" style={{ gridArea: 'taxonomy' }}>
        <TaxonomyCard shock={scenario?.shocks_active.join(' · ') || undefined} analogs={analogs} />
      </div>
      <div className="panel" style={{ gridArea: 'map', padding: 0 }} data-tour="map">
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
      <div className="panel" style={{ gridArea: 'charter' }} data-tour="rules">
        <CharterPanel charter={charter} onParamChange={(id, v) => void onCharterParam(id, v)} />
        <div style={{ marginTop: 16 }}>
          <AuditTrace entries={audit.slice(-8)} verified={verifyChain(audit)} />
        </div>
      </div>
      <div className="panel" style={{ gridArea: 'debate' }} data-tour="debate">
        <DebatePanel options={options} objections={objections} />
      </div>
      <div className="panel" style={{ gridArea: 'options' }} data-tour="plan">
        <OptionCards options={options} selectedId={sel?.kind === 'route' ? sel.id : undefined} changedIds={changedIds} onSelect={(id) => setSel({ kind: 'route', id })} />
      </div>
      <div className="panel" style={{ gridArea: 'waterfall' }}>
        <Waterfall gap_kbd={scenario?.gap_kbd ?? 0} contributions={contributions} costOfDelayUsd={costOfDelayUsd} costTitle={costTitle} />
      </div>

      {scenarioOpen && (
        <ScenarioBuilder
          nodes={DATA.graph.nodes}
          currentBrent={scenario?.brent_usd ?? 90}
          onClose={() => setScenarioOpen(false)}
          onRun={(sc) => { setScenarioOpen(false); setSel(null); void runScenario(sc); }}
        />
      )}

      {backtestOpen && <BacktestScorecard onClose={() => setBacktestOpen(false)} />}

      {aiOpen && <AiAssistPanel data={DATA} charter={charter} onClose={() => setAiOpen(false)} />}

      {tourStep != null && <div className="tour-dim" />}

      {tourStep != null && (
        <div className="tour-card" style={cardPos ? { top: cardPos.top, left: cardPos.left, bottom: 'auto', transform: 'none' } : undefined}>
          <div className="tour-head">
            <span>▶ Guided demo · TRINETRA</span>
            <span className="tour-step">STEP {tourStep + 1} / {TOUR.length}</span>
          </div>
          <div className="tour-body">
            <div className="tour-title">{TOUR[tourStep].title}</div>
            <div className="tour-text">{TOUR[tourStep].text}</div>
          </div>
          <div className="tour-ctrl">
            <div className="tour-dots">{TOUR.map((_, i) => <span key={i} className={`tour-dot${i === tourStep ? ' on' : ''}`} />)}</div>
            <div className="spacer" />
            <button className="tour-btn" onClick={() => setTourStep((s) => Math.max(0, (s ?? 0) - 1))} disabled={tourStep === 0}>◀ PREV</button>
            <button className="tour-btn" onClick={() => setTourPlaying((p) => !p)}>{tourPlaying ? '❚❚ PAUSE' : '▶ AUTO-PLAY'}</button>
            {tourStep < TOUR.length - 1
              ? <button className="tour-btn primary" onClick={() => setTourStep((s) => (s ?? 0) + 1)}>NEXT ▶</button>
              : <button className="tour-btn primary" onClick={() => { setTourStep(null); setTourPlaying(false); }}>FINISH</button>}
            <button className="tour-btn" onClick={() => { setTourStep(null); setTourPlaying(false); }} title="End tour">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
