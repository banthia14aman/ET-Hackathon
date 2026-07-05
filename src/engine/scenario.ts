// SWE3 — src/engine/scenario.ts. Pure, deterministic. No store, no React, no I/O.
import type {
  Calibration, EdgeStatus, Graph, NodeStatus, ScenarioState, ShockContext,
} from '../contracts/types';

type Sev = 'partial' | 'severe';
const SEV_RANK: Record<Sev, number> = { partial: 1, severe: 2 };
const EDGE_STAT: Record<Sev, EdgeStatus> = { partial: 'risk', severe: 'closed' };

/** Calibration lookup with fallback: tries keys in order; mid=true takes the [min,max] midpoint. */
function cal(c: Calibration, keys: string[], fallback: number, mid = false): number {
  for (const k of keys) {
    const p = c[k];
    if (p) return mid ? (p.min + p.max) / 2 : p.value;
  }
  return fallback;
}

/** 'shock:hormuz-partial' → { key: 'hormuz', sev: 'partial' }; anything else → null. */
function parseShock(s: string): { key: string; sev: Sev } | null {
  const m = /^shock:(.+)-(partial|severe)$/.exec(s);
  return m ? { key: m[1], sev: m[2] as Sev } : null;
}

export function rescore(graph: Graph, shocks: ShockContext, calibration: Calibration): ScenarioState {
  // 1. Map shocks → shocked chokepoint node ids (defensive substring match), worst severity wins.
  const shocked = new Map<string, Sev>();
  let worstSev: Sev | null = null;
  for (const s of shocks.shocks_active) {
    const p = parseShock(s);
    if (!p) continue;
    if (!worstSev || SEV_RANK[p.sev] > SEV_RANK[worstSev]) worstSev = p.sev;
    for (const n of graph.nodes) {
      if (n.type !== 'chokepoint' || !n.id.includes(p.key)) continue;
      const prev = shocked.get(n.id);
      if (!prev || SEV_RANK[p.sev] > SEV_RANK[prev]) shocked.set(n.id, p.sev);
    }
  }
  // Flow multipliers under shock — defaults 0.5 / 0.1, overridable via calibration.
  const flow: Record<Sev, number> = {
    partial: cal(calibration, ['flow_mult_partial', 'chokepoint_partial_mult', 'hormuz_partial_flow_mult'], 0.5),
    severe: cal(calibration, ['flow_mult_severe', 'chokepoint_severe_mult', 'hormuz_severe_flow_mult'], 0.1),
  };

  // 2. Edge status + effective volume (worst shocked chokepoint on the route governs).
  const edge_status: Record<string, EdgeStatus> = {};
  const effective = new Map<string, number>();
  for (const e of [...graph.edges].sort((a, b) => a.id.localeCompare(b.id))) {
    let sev: Sev | null = null;
    for (const cp of e.via_chokepoints) {
      const s = shocked.get(cp);
      if (s && (!sev || SEV_RANK[s] > SEV_RANK[sev])) sev = s;
    }
    edge_status[e.id] = sev ? EDGE_STAT[sev] : 'open';
    effective.set(e.id, sev ? e.volume_kbd * flow[sev] : e.volume_kbd);
  }

  // Inbound sums per node (baseline vs effective).
  const inBase = new Map<string, number>();
  const inEff = new Map<string, number>();
  for (const e of graph.edges) {
    inBase.set(e.to, (inBase.get(e.to) ?? 0) + e.volume_kbd);
    inEff.set(e.to, (inEff.get(e.to) ?? 0) + (effective.get(e.id) ?? 0));
  }

  // 3. Node status + cover days. Cover model: cover = baseline * (0.4 + 0.6 * supplyRatio).
  // WHY this simple linear form: it is an explicit, testable assumption — full supply keeps
  // baseline cover, zero supply still leaves a 40% floor (strategic reserves / demand cuts).
  // Ranges and multipliers come from calibration.json; the formula itself stays legible so
  // the debate/waterfall panels can explain every number. No hidden dynamics.
  const node_status: Record<string, NodeStatus> = {};
  const cover_days: Record<string, number> = {};
  for (const n of [...graph.nodes].sort((a, b) => a.id.localeCompare(b.id))) {
    if (n.type === 'chokepoint') {
      node_status[n.id] = shocked.has(n.id) ? 'critical' : 'ok';
    } else if (n.type === 'refinery') {
      const denom = n.capacity_kbd ?? inBase.get(n.id) ?? 0;
      const ratio = denom > 0 ? Math.min(1, (inEff.get(n.id) ?? 0) / denom) : 1;
      node_status[n.id] = ratio >= 0.8 ? 'ok' : ratio >= 0.5 ? 'stressed' : 'critical';
      cover_days[n.id] = (n.cover_days ?? 0) * (0.4 + 0.6 * ratio);
    } else {
      node_status[n.id] = 'ok'; // suppliers, corridors, ports: no degradation model (yet)
    }
  }

  // 4. gap_kbd = lost effective volume on India-bound edges.
  // ponytail: "India-bound" = edges terminating at a refinery node (all refineries in this
  // graph are Indian). Add a country field on nodes if that ever stops being true.
  const refinery = new Set(graph.nodes.filter((n) => n.type === 'refinery').map((n) => n.id));
  let gap_kbd = 0;
  for (const e of graph.edges) {
    if (refinery.has(e.to)) gap_kbd += e.volume_kbd - (effective.get(e.id) ?? 0);
  }

  // 5. Brent: pass through the latest PRICE value when present; otherwise estimate as
  // baseline (71 default) + midpoint of the calibrated spike range for the worst active
  // severity. Fallback ranges when calibration is absent: partial ≈ [+4,+12] → +8,
  // severe ≈ [+15,+35] → +25.
  let brent_usd = shocks.brent_usd;
  if (!(brent_usd > 0)) {
    brent_usd = cal(calibration, ['brent_baseline_usd'], 71)
      + (worstSev === 'severe' ? cal(calibration, ['price_spike_severe'], 25, true)
        : worstSev === 'partial' ? cal(calibration, ['price_spike_partial'], 8, true) : 0);
  }

  return {
    t_sim: shocks.t_sim,
    shocks_active: [...shocks.shocks_active].sort(),
    node_status,
    edge_status,
    cover_days,
    gap_kbd,
    brent_usd,
  };
}

/** % of sweep steps where the refinery cover-days ranking matches the ranking at the
    current calibration. Powers the rank-stability badge. O(steps × rescore) — cheap. */
export function sweepStability(
  graph: Graph, shocks: ShockContext, calibration: Calibration,
  paramName: string, range: [number, number], steps: number,
): { stable_pct: number } {
  const rank = (c: Calibration): string => {
    const cd = rescore(graph, shocks, c).cover_days;
    return Object.keys(cd).sort((a, b) => cd[b] - cd[a] || a.localeCompare(b)).join('|');
  };
  const base = rank(calibration);
  const n = Math.max(1, Math.floor(steps));
  let stable = 0;
  for (let i = 0; i < n; i++) {
    const value = n === 1 ? range[0] : range[0] + (i * (range[1] - range[0])) / (n - 1);
    const prev = calibration[paramName] ?? { value, min: range[0], max: range[1], source_ref: 'sweep', prov: 'S' as const };
    if (rank({ ...calibration, [paramName]: { ...prev, value } }) === base) stable++;
  }
  return { stable_pct: (stable / n) * 100 };
}

/** Inline micro-fixture sanity check. Throws on failure; returns true otherwise. */
export function selfCheck(): boolean {
  const node = (id: string, type: 'supplier' | 'chokepoint' | 'refinery', extra = {}) => ({
    id, type, name: id, lat: 0, lon: 0, status: 'ok' as NodeStatus, prov: 'S' as const,
    source: 'selfCheck', as_of: '2026-01-01T00:00:00Z', ...extra,
  });
  const graph: Graph = {
    nodes: [node('sup-a', 'supplier'), node('cp-hormuz', 'chokepoint'),
      node('ref-jam', 'refinery', { capacity_kbd: 100, cover_days: 10 })],
    edges: [
      { id: 'e1', from: 'sup-a', to: 'ref-jam', mode: 'vlcc', via_chokepoints: ['cp-hormuz'], transit_days: 10, volume_kbd: 80, cost_usd_bbl: 2, status: 'open' },
      { id: 'e2', from: 'sup-a', to: 'ref-jam', mode: 'pipeline', via_chokepoints: [], transit_days: 5, volume_kbd: 20, cost_usd_bbl: 1, status: 'open' },
    ],
  };
  const ctx = (active: string[]): ShockContext => ({ t_sim: '2026-01-19T00:00:00Z', shocks_active: active, brent_usd: 0 });
  const ok = (c: boolean, msg: string) => { if (!c) throw new Error(`scenario.selfCheck: ${msg}`); };

  const none = rescore(graph, ctx([]), {});
  const part = rescore(graph, ctx(['shock:hormuz-partial']), {});
  const sev = rescore(graph, ctx(['shock:hormuz-severe']), {});
  ok(sev.edge_status['e1'] === 'closed' && sev.node_status['ref-jam'] === 'critical',
    'closed chokepoint must degrade downstream refinery to critical');
  ok(none.cover_days['ref-jam'] > part.cover_days['ref-jam']
    && part.cover_days['ref-jam'] > sev.cover_days['ref-jam'],
    'cover_days must decrease monotonically with severity');
  ok(sweepStability(graph, ctx(['shock:hormuz-severe']), {}, 'brent_baseline_usd', [60, 90], 5).stable_pct === 100,
    'sweep on an irrelevant param must be 100% stable');
  return true;
}
