// Maritime routing (presentation-only). Turns an edge into an ordered list of [lat,lon] waypoints
// that follow real sea lanes: source → ocean waypoints + the strait(s) the edge actually transits
// (edge.via_chokepoints) → destination. So the drawn line curves through Hormuz / the Red Sea /
// around the Cape — you can SEE which strait a cargo passes through (and where the shock hits).

import type { GraphEdge, GraphNode } from '../contracts/types';

export type LL = [number, number]; // [lat, lon]

// Ocean waypoints, all in open water, that shape the major corridors.
const WP = {
  engApproach: [47, -8] as LL,   // Bay of Biscay (round western Europe)
  gibraltar: [35.9, -6] as LL,
  wMed: [37, 3] as LL,           // western Mediterranean
  redSea: [20, 38] as LL,        // mid Red Sea (between Suez and Bab el-Mandeb)
  gulfAden: [12.5, 49] as LL,    // Gulf of Aden (after Bab el-Mandeb)
  arabianSea: [16, 62] as LL,    // Arabian Sea approach to India's west coast
  canaries: [26, -18] as LL,     // off NW Africa (Atlantic descent)
  sAtlantic: [-12, -22] as LL,   // mid South Atlantic (east of Brazil)
  sIndian: [-24, 52] as LL,      // SW Indian Ocean (after the Cape)
};

/** Ordered [lat,lon] waypoints for an edge's maritime route. */
export function seaRoute(edge: GraphEdge, from: GraphNode, to: GraphNode, node: (id: string) => GraphNode | undefined): LL[] {
  const via = edge.via_chokepoints ?? [];
  const has = (key: string) => via.some((v) => v.includes(key));
  const cpt = (key: string): LL | null => {
    const id = via.find((v) => v.includes(key));
    const n = id ? node(id) : undefined;
    return n ? [n.lat, n.lon] : null;
  };
  const P: LL[] = [[from.lat, from.lon]];
  const northEurope = from.lat > 45;    // Russia / Baltic loads round Europe first
  const americas = from.lon < -30;      // Atlantic-west loaders sweep the South Atlantic
  const toIndia = to.lon > 58;          // the crude-India theatre uses the corridors below

  if (toIndia && has('hormuz')) {
    const h = cpt('hormuz'); if (h) P.push(h);           // Gulf → Hormuz → India
  } else if (toIndia && has('suez')) {
    if (northEurope) P.push(WP.engApproach, WP.gibraltar, WP.wMed);
    const s = cpt('suez'); if (s) P.push(s);
    P.push(WP.redSea);
    const b = cpt('bab'); if (b) P.push(b);
    P.push(WP.gulfAden, WP.arabianSea);                  // Suez → Red Sea → Bab → Aden → Arabian Sea
  } else if (toIndia && has('cape')) {
    if (northEurope) P.push(WP.engApproach, WP.gibraltar, WP.canaries, WP.sAtlantic);
    else if (americas) P.push(WP.sAtlantic);
    const c = cpt('cape'); if (c) P.push(c);
    P.push(WP.sIndian, WP.arabianSea);                   // Atlantic → around the Cape → Indian Ocean
  } else if (toIndia && has('malacca')) {
    const m = cpt('malacca'); if (m) P.push(m);
  } else {
    // any other theatre: route straight through each strait the edge transits, in order
    for (const vid of via) { const n = node(vid); if (n) P.push([n.lat, n.lon]); }
  }
  P.push([to.lat, to.lon]);
  return P;
}
