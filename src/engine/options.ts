// SWE4 — src/engine/options.ts. Pure option-card generator across the 5 levers.
// Deterministic: no clock, no randomness, stable sorts, ids from inputs only.
import type {
  AssayEnv, CompatTier, CrudeGrade, Graph, GraphNode, Lever, OptionCard,
  SanctionsRules, ScenarioState, SpotCargo,
} from '../contracts/types';
import { classifyCrude } from './refinery_model';

const DIMS = ['api', 'sulfur', 'tan', 'ni_v', 'resid', 'pour'] as const;

/** THE ASSAY SCREEN. Each dim inside [min,max] passes. 0 fails -> RUN_NOW.
 *  1-2 fails -> BLEND; >2 fails, or resid fails with blend ratio < 0.1 -> CANNOT_RUN.
 *  Blend ratio (linear): partner crude assumed at envelope midpoint; max ratio r of this
 *  grade s.t. r*v + (1-r)*mid sits on the violated bound => r = (bound-mid)/(v-mid). */
function assayScreen(g: CrudeGrade, env: AssayEnv): { tier: CompatTier; binding: string[] } {
  const fails: { dim: string; msg: string; ratio: number }[] = [];
  for (const d of DIMS) {
    const [lo, hi] = env[d];
    const v = g[d];
    if (v >= lo && v <= hi) continue;
    const mid = (lo + hi) / 2;
    const bound = v > hi ? hi : lo;
    const ratio = (bound - mid) / (v - mid); // in (0,1): mid inside envelope, v outside
    fails.push({ dim: d, msg: v > hi ? `${d} ${v} > max ${hi}` : `${d} ${v} < min ${lo}`, ratio });
  }
  if (fails.length === 0) return { tier: 'RUN_NOW', binding: [] };
  const maxRatio = Math.min(...fails.map((f) => f.ratio));
  const binding = fails.map((f) => f.msg);
  if (fails.length > 2 || (fails.some((f) => f.dim === 'resid') && maxRatio < 0.1))
    return { tier: 'CANNOT_RUN', binding };
  return { tier: 'BLEND', binding: [...binding, `max_blend_ratio ${maxRatio.toFixed(2)}`] };
}

/** Cost table (USD/bbl delta vs baseline): distance-tier premium + origin discount.
 *    voyage <=10d: +2.0 | <=20d: +3.5 | >20d: +5.0
 *    discounts: Iran -5.0, Russia -4.5, Venezuela -4.0
 *  Deep-discount origins stay cheap on purpose (Beat 1: Merey ranks #2 so the
 *  critic/arbiter demote it, not the generator — Article A1: no silent drops). */
const ORIGIN_DISCOUNT: Record<string, number> = { Iran: -5.0, Russia: -4.5, Venezuela: -4.0 };
const costDelta = (voyage: number, origin: string): number =>
  (voyage <= 10 ? 2.0 : voyage <= 20 ? 3.5 : 5.0) + (ORIGIN_DISCOUNT[origin] ?? 0);

type Draft = Omit<OptionCard, 'id'> & { key: string }; // key = stable rank tiebreak

export function generateOptions(
  scenario: ScenarioState, graph: Graph, grades: CrudeGrade[],
  sanctions: SanctionsRules, spot: SpotCargo[],
): OptionCard[] {
  const gap = scenario.gap_kbd;
  const node = new Map(graph.nodes.map((n) => [n.id, n]));
  const status = (id: string) => scenario.node_status[id] ?? node.get(id)?.status ?? 'ok';
  const eStatus = (id: string, fallback: string) => scenario.edge_status[id] ?? fallback;
  const refineries = graph.nodes
    .filter((n) => n.type === 'refinery')
    .sort((a, b) => a.id.localeCompare(b.id));
  const critical = refineries.filter((r) => status(r.id) === 'critical');
  const stressed = refineries.filter((r) => status(r.id) !== 'ok');
  const gapCover = (vol: number) => (gap > 0 ? vol / gap : 0);
  const drafts: Draft[] = [];
  const base = {
    voyage_days: 0, jwc_flag: false, port_ok: true,
    payment_rail: 'GREEN' as const, status: 'proposed' as const,
  };

  // 1. stock_draw — SPR release covering the gap, capped at 30,000 kb withdrawal.
  if (gap > 0) {
    const vol = Math.min(gap * 30, 30000);
    drafts.push({ ...base, key: 'spr', lever: 'stock_draw', volume_kb: vol, eta_days: 1,
      cover_days_gained: gapCover(vol), evidence: ['node:spr'] });
  }

  // 2. divert_on_water — open edge into a non-critical refinery while another is critical.
  if (critical.length > 0) {
    for (const e of [...graph.edges].sort((a, b) => a.id.localeCompare(b.id))) {
      const dest = node.get(e.to);
      if (!dest || dest.type !== 'refinery' || status(dest.id) === 'critical') continue;
      if (eStatus(e.id, e.status) !== 'open') continue;
      const vol = e.volume_kbd * 3; // ponytail: 3 days of edge flow = "modest volume"
      drafts.push({ ...base, key: `div:${e.id}`, lever: 'divert_on_water',
        target_refinery: critical[0].id, volume_kb: vol, voyage_days: 3, eta_days: 3,
        cover_days_gained: gapCover(vol), evidence: [e.id] }); // e.id already carries the 'edge:' prefix
    }
  }

  // 3. floating_storage — constant 2,000 kb parcel, prov-noted as an estimate.
  drafts.push({ ...base, key: 'float', lever: 'floating_storage', volume_kb: 2000,
    voyage_days: 10, eta_days: 10, cover_days_gained: gapCover(2000),
    evidence: ['est:floating_storage_2000kb'] });

  // 4. reroute — spot cargo -> stressed/critical refinery over a usable graph edge.
  for (const cargo of [...spot].sort((a, b) => a.id.localeCompare(b.id))) {
    const grade = grades.find((g) => g.id === cargo.grade_id);
    const from = graph.nodes.find((n) => n.id === cargo.loading_port || n.name === cargo.loading_port);
    if (!grade || !from) continue;
    for (const ref of stressed) {
      if (!ref.assay_env) continue;
      const edge = graph.edges
        .filter((e) => e.from === from.id && e.to === ref.id
          && eStatus(e.id, e.status) !== 'closed'
          && !e.via_chokepoints.some((c) => status(c) === 'critical')) // avoid closed chokepoints
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      if (!edge) continue; // no existing route -> skip (new-route estimation is out of scope)
      const { tier, binding } = assayScreen(grade, ref.assay_env);
      // Advisory: the frozen learned model predicts the same tier + a confidence (UI only;
      // the deterministic assayScreen above remains the authority for the decision).
      const pred = classifyCrude(grade, ref.assay_env);
      // buyer designation (key 'buyer:<name>', note names the refinery) overrides origin rail
      const buyerKey = Object.keys(sanctions)
        .filter((k) => k.startsWith('buyer:') && sanctions[k].note.includes(ref.id)).sort()[0];
      const rule = buyerKey ? sanctions[buyerKey] : sanctions[cargo.origin_country];
      const vol = Math.min(cargo.volume_kb, gap > 0 ? gap * 10 : cargo.volume_kb);
      drafts.push({ ...base, key: `${grade.id}:${ref.id}`, lever: 'reroute',
        grade: grade.id, origin: cargo.origin_country, target_refinery: ref.id,
        volume_kb: vol, voyage_days: edge.transit_days, eta_days: edge.transit_days + 5,
        compat_tier: tier, compat_binding: binding,
        model_tier: pred.tier, model_confidence: pred.confidence,
        payment_rail: rule?.rail ?? 'GREEN', payment_note: rule?.note,
        jwc_flag: edge.via_chokepoints.some((c) => status(c) !== 'ok'),
        port_ok: edge.mode === 'vlcc' && ref.port_limits ? ref.port_limits.spm : true,
        cost_delta_usd_bbl: costDelta(edge.transit_days, cargo.origin_country),
        cover_days_gained: ref.capacity_kbd ? vol / ref.capacity_kbd : gapCover(vol),
        evidence: [cargo.id, edge.id, cargo.source] }); // ids already carry their 'sc:'/'edge:' prefixes
    }
  }

  // 5. demand_side — run-cut / product-import equivalent, 300 kb/d for 30 days.
  drafts.push({ ...base, key: 'demand', lever: 'demand_side', volume_kb: 9000,
    eta_days: 7, cover_days_gained: gapCover(9000), evidence: ['est:run_cut_300kbd'] });

  // Rank within each lever by (2-week eta tier asc, cost asc, key) -> that rank is <n>
  // in the id. Nothing is rejected here; proposer/critic/arbiter own judgment.
  const cards: OptionCard[] = [];
  for (const lever of [...new Set(drafts.map((d) => d.lever))]) {
    drafts.filter((d) => d.lever === lever)
      .sort((a, b) => Math.floor(a.eta_days / 14) - Math.floor(b.eta_days / 14)
        || (a.cost_delta_usd_bbl ?? 99) - (b.cost_delta_usd_bbl ?? 99)
        || a.key.localeCompare(b.key))
      .forEach(({ key: _key, ...card }, n) => cards.push(
        { id: `opt:${lever}:${card.grade ?? '-'}:${card.target_refinery ?? '-'}:${n}`, ...card }));
  }
  // Contract output order: (lever, id).
  return cards.sort((a, b) => a.lever.localeCompare(b.lever) || a.id.localeCompare(b.id));
}

/** Micro-fixture self check. Throws on failure. */
export function selfCheck(): void {
  const env: AssayEnv = { api: [15, 45], sulfur: [0, 3.5], tan: [0, 1.5],
    ni_v: [0, 120], resid: [0, 60], pour: [-40, 30] };
  const gn = (n: Partial<GraphNode> & Pick<GraphNode, 'id' | 'type' | 'name' | 'status'>): GraphNode =>
    ({ lat: 0, lon: 0, prov: 'S', source: 'fixture', as_of: '2026-01-01T00:00:00Z', ...n });
  const graph: Graph = {
    nodes: [
      gn({ id: 'sup:ru', type: 'supplier', name: 'Primorsk', status: 'ok' }),
      gn({ id: 'sup:ve', type: 'supplier', name: 'Jose', status: 'ok' }),
      gn({ id: 'sup:ae', type: 'supplier', name: 'Fujairah', status: 'ok' }),
      gn({ id: 'cp:hormuz', type: 'chokepoint', name: 'Hormuz', status: 'stressed' }),
      gn({ id: 'ref:jam', type: 'refinery', name: 'Jamnagar', status: 'critical',
        capacity_kbd: 1200, assay_env: env, cover_days: 12, port_limits: { spm: true, draft_m: 23 } }),
      gn({ id: 'ref:ok', type: 'refinery', name: 'Kochi', status: 'ok', capacity_kbd: 300 }),
    ],
    edges: [
      { id: 'e:ru', from: 'sup:ru', to: 'ref:jam', mode: 'vlcc', via_chokepoints: [], transit_days: 15, volume_kbd: 800, cost_usd_bbl: 2, status: 'open' },
      { id: 'e:ve', from: 'sup:ve', to: 'ref:jam', mode: 'vlcc', via_chokepoints: [], transit_days: 22, volume_kbd: 500, cost_usd_bbl: 3, status: 'open' },
      { id: 'e:ae', from: 'sup:ae', to: 'ref:jam', mode: 'vlcc', via_chokepoints: ['cp:hormuz'], transit_days: 12, volume_kbd: 600, cost_usd_bbl: 1.5, status: 'open' },
      { id: 'e:div', from: 'sup:ae', to: 'ref:ok', mode: 'suezmax', via_chokepoints: [], transit_days: 10, volume_kbd: 200, cost_usd_bbl: 1, status: 'open' },
    ],
  };
  const g = (id: string, name: string, oc: string, a: number[]): CrudeGrade => ({
    id, name, origin_country: oc, api: a[0], sulfur: a[1], tan: a[2], ni_v: a[3],
    resid: a[4], pour: a[5], prov: 'S', source: 'fixture', as_of: '2026-01-01T00:00:00Z' });
  const grades = [
    g('gr:urals', 'Urals', 'Russia', [31, 1.7, 0.1, 90, 30, -10]),
    g('gr:merey', 'Merey', 'Venezuela', [16, 2.9, 3.3, 450, 55, -20]),
    g('gr:murban', 'Murban', 'UAE', [40, 0.8, 0.05, 20, 15, 5]),
  ];
  const sanctions: SanctionsRules = {
    Russia: { rail: 'AMBER', note: 'price-cap attestation required' },
    Venezuela: { rail: 'RED', note: 'OFAC general license required' },
  };
  const spot: SpotCargo[] = [
    { id: 's1', grade_id: 'gr:urals', origin_country: 'Russia', volume_kb: 2000, loading_port: 'sup:ru', avail_from_day: 0, prov: 'S', source: 'fixture' },
    { id: 's2', grade_id: 'gr:merey', origin_country: 'Venezuela', volume_kb: 1000, loading_port: 'sup:ve', avail_from_day: 2, prov: 'S', source: 'fixture' },
    { id: 's3', grade_id: 'gr:murban', origin_country: 'UAE', volume_kb: 1000, loading_port: 'sup:ae', avail_from_day: 1, prov: 'S', source: 'fixture' },
  ];
  const scenario: ScenarioState = { t_sim: '2026-01-20T00:00:00Z', shocks_active: ['shock:hormuz'],
    node_status: {}, edge_status: {}, cover_days: { 'ref:jam': 12 }, gap_kbd: 500, brent_usd: 95 };

  const out = generateOptions(scenario, graph, grades, sanctions, spot);
  const fail = (m: string) => { throw new Error(`options.selfCheck: ${m}`); };
  // Merey vs TAN-1.5-max refinery -> BLEND/CANNOT_RUN with TAN binding.
  const merey = out.find((c) => c.grade === 'gr:merey') ?? fail('no Merey card') as never;
  if (merey.compat_tier === 'RUN_NOW') fail('Merey must not be RUN_NOW');
  if (!merey.compat_binding?.some((b) => b.startsWith('tan'))) fail('TAN not in compat_binding');
  // Sanctioned origin -> AMBER/RED rail.
  if (merey.payment_rail === 'GREEN') fail('Venezuela rail must not be GREEN');
  // Merey ranks #2 within reroute (second-lowest cost_delta) -> id suffix ':1'.
  if (!merey.id.endsWith(':1')) fail(`Merey rank != #2 (id ${merey.id})`);
  // No lever missing when gap > 0.
  const levers: Lever[] = ['demand_side', 'divert_on_water', 'floating_storage', 'reroute', 'stock_draw'];
  for (const l of levers) if (!out.some((c) => c.lever === l)) fail(`missing lever ${l}`);
  // Determinism: two calls -> deep-equal.
  if (JSON.stringify(out) !== JSON.stringify(generateOptions(scenario, graph, grades, sanctions, spot)))
    fail('non-deterministic output');
}
