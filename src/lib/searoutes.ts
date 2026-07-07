// Maritime routing (presentation-only). Routes each edge as a shortest WATER path over a bundled
// sea-lane network (data/sea-network.json — waypoints connected only where the segment stays in
// water, plus real transit-strait portals). The route is stitched through the edge's mandatory
// via_chokepoints, so it both follows the sea and passes through the strait it actually transits.
// Built by scripts/build-sea-network.mjs; land-crossing verified by scripts/check-sea-routes.mjs.

import type { GraphEdge, GraphNode } from '../contracts/types';
import net from '../../data/sea-network.json' with { type: 'json' };

export type LL = [number, number]; // [lat, lon]

const PTS = (net as { pts: { lat: number; lon: number }[] }).pts;
const ADJ = (net as unknown as { adj: [number, number][][] }).adj;

// Inland refineries are fed by real crude pipelines from a coastal landing port. The *sea* route
// therefore ends at the landing (coast); the overland leg is drawn separately as a pipeline.
const INLAND_LANDING: Record<string, LL> = {
  'ref:panipat': [22.74, 69.7], // Mundra SPM → Mundra–Panipat–Bathinda crude pipeline
  'ref:koyali': [22.4, 69.7], // Vadinar SPM → Salaya–Koyali pipeline
};

const d2 = (a: LL, p: { lat: number; lon: number }): number => (a[0] - p.lat) ** 2 + (a[1] - p.lon) ** 2;
function nearest(a: LL): number {
  let best = 0; let bd = Infinity;
  for (let i = 0; i < PTS.length; i += 1) { const dd = d2(a, PTS[i]); if (dd < bd) { bd = dd; best = i; } }
  return best;
}

/** Dijkstra over the sea network (~70 nodes — simple O(V^2) is plenty). */
function shortest(s: number, t: number): number[] {
  const dist = new Array(PTS.length).fill(Infinity);
  const prev = new Array(PTS.length).fill(-1);
  const done = new Array(PTS.length).fill(false);
  dist[s] = 0;
  for (;;) {
    let u = -1; let bd = Infinity;
    for (let i = 0; i < PTS.length; i += 1) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === t) break;
    done[u] = true;
    for (const [v, w] of ADJ[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  const path: number[] = [];
  for (let u = t; u >= 0; u = prev[u]) path.unshift(u);
  return path[0] === s ? path : [s, t];
}

/** Water path between two arbitrary points: snap each to the network, route, return [a, …sea…, b]. */
function waterLeg(a: LL, b: LL): LL[] {
  const na = nearest(a); const nb = nearest(b);
  const idx = na === nb ? [na] : shortest(na, nb);
  return [a, ...idx.map((i) => [PTS[i].lat, PTS[i].lon] as LL), b];
}

/** Ordered [lat,lon] waypoints for an edge: source → (sea lanes through each strait it transits) → dest. */
export function seaRoute(edge: GraphEdge, from: GraphNode, to: GraphNode, node: (id: string) => GraphNode | undefined): LL[] {
  const mandatory: LL[] = [[from.lat, from.lon]];
  for (const vid of edge.via_chokepoints ?? []) { const n = node(vid); if (n) mandatory.push([n.lat, n.lon]); }
  mandatory.push(INLAND_LANDING[to.id] ?? [to.lat, to.lon]); // inland refinery → end at its coastal landing
  const out: LL[] = [];
  for (let i = 0; i < mandatory.length - 1; i += 1) {
    for (const p of waterLeg(mandatory[i], mandatory[i + 1])) {
      const last = out[out.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
    }
  }
  return out;
}

/** Overland pipeline leg [landing, refinery] for an inland refinery; null for coastal ones. Drawn dashed. */
export function pipelineTail(to: GraphNode): [LL, LL] | null {
  const landing = INLAND_LANDING[to.id];
  return landing ? [landing, [to.lat, to.lon]] : null;
}
