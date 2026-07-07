#!/usr/bin/env node
// BUILD-TIME. Constructs a maritime sea-lane graph: ~70 ocean waypoints, connected ONLY where the
// straight segment between them stays in water (tested against the bundled Natural Earth coastline).
// Output: data/sea-network.json (points + adjacency). Runtime routing (src/lib/searoutes.ts) then
// Dijkstras over this graph so drawn routes never cross land. Run: node scripts/build-sea-network.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const land = JSON.parse(readFileSync(join(ROOT, 'src', 'assets', 'world-land.geo.json'), 'utf8'));

// ---- ocean waypoints [lat, lon, name]. Must sit in open water. ----
const WP = [
  // Persian Gulf & Arabian Sea
  [29.3, 48.6, 'gulf-head'], [27.2, 51.4, 'gulf-mid'], [25.9, 53.0, 'gulf-c'], [26.2, 55.2, 'gulf-e'],
  [26.57, 56.25, 'hormuz'], [24.2, 59.5, 'oman'],
  [20, 61, 'arabian-nw'], [15, 62, 'arabian-sea'], [12, 58, 'arabian-sw'],
  // India coasts
  [21, 67.5, 'india-nw'], [17, 70.5, 'india-w'], [11, 73, 'india-sw'], [6.5, 78, 'india-s'],
  [10, 81.5, 'india-se'], [15, 84, 'bengal'], [18.5, 89, 'bengal-ne'],
  // Red Sea / Suez (incl. narrow Gulf of Suez centerline so the route hugs the gulf, not Sinai)
  [12.5, 48, 'gulf-aden'], [12.58, 43.33, 'bab'], [18, 40, 'red-sea-s'], [25, 35.5, 'red-sea-n'],
  [27.6, 34.2, 'suez-mouth'], [28.3, 33.0, 'gulf-suez'], [30.2, 32.6, 'suez'],
  // Mediterranean (kythira + ionian-sw thread the passage S of the Peloponnese, Aegean↔Ionian)
  [32, 32, 'e-med'], [34, 25, 'e-med-2'], [36.5, 23.2, 'kythira'], [36.3, 21.0, 'ionian-sw'],
  [35.5, 18.5, 'ionian'], [34.5, 15, 'c-med'],
  [41, 18.2, 'adriatic-s'], [43.8, 13.8, 'adriatic-n'], [38.5, 11, 'tyrrhenian'], [37.8, 6, 'w-med'],
  [37.5, 2, 'balearic'], [36, -2, 'alboran'], [35.95, -5.6, 'gibraltar'],
  // North & mid Atlantic (cadiz-off threads the Gulf of Cadiz S of Portugal, Gibraltar↔Atlantic)
  [40, -10, 'iberia-w'], [36.5, -9.5, 'cadiz-off'], [44.5, -9, 'biscay'], [48.5, -7, 'channel-w'], [42, -20, 'natl-e'],
  [30, -22, 'natl-ec'], [27, -19, 'canaries'], [34, -35, 'natl-mid'], [28, -50, 'natl-w'],
  [26, -66, 'natl-caribbean'], [24, -82, 'florida'], [25.5, -90, 'gulf-mexico'], [13, -63, 'caribbean-e'], [11.3, -66.5, 'venezuela-off'],
  // West & Southern Africa
  [13, -20, 'dakar-off'], [4, -12, 'w-africa'], [1, 2, 'gulf-guinea'], [1.5, 6, 'nigeria-off'],
  [-9, 10, 'angola-off'], [-25, 11, 'namibia-off'], [-34, 13, 'cape-w'], [-34.36, 18.47, 'cape'], [-36, 25, 'cape-e'],
  // South Atlantic (Brazil)
  [-16, -20, 'satl-mid'], [-20, -35, 'brazil-e'], [-4, -34, 'brazil-ne'],
  // Indian Ocean south
  [-27, 45, 'sw-indian'], [-22, 56, 'madagascar-e'], [-8, 64, 'indian-mid'],
  // SE Asia
  [2.5, 101, 'malacca'], [7, 92, 'bengal-e'],
  // Black Sea / Bosphorus / Aegean
  [44, 34, 'black-sea'], [41.1, 29.1, 'bosphorus'], [40.3, 26.2, 'dardanelles'], [38, 24.5, 'aegean'],
  // Baltic / North Sea / Channel (for Baltic loaders)
  [59, 22, 'baltic-e'], [55.5, 15, 'baltic-w'], [57.5, 10.5, 'skagerrak'], [56, 3.5, 'north-sea'],
  [51, 1.8, 'dover'], [50, -2, 'english-ch'], [52.2, 3.2, 'rotterdam-off'],
];

// ---- coastline: flatten to polygon edges with bounding boxes for fast segment tests ----
const polys = [];
for (const f of land.features) {
  const g = f.geometry; const rings = g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [];
  for (const ring of rings) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const [x, y] of ring) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    polys.push({ ring, minx, miny, maxx, maxy });
  }
}

const ccw = (ax, ay, bx, by, cx, cy) => (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
const segInt = (ax, ay, bx, by, cx, cy, dx, dy) =>
  ccw(ax, ay, cx, cy, dx, dy) !== ccw(bx, by, cx, cy, dx, dy) && ccw(ax, ay, bx, by, cx, cy) !== ccw(ax, ay, bx, by, dx, dy);

// segment a→b in [lat,lon]; test against coastline (coords are [lon,lat])
function crossesLand(a, b) {
  const ax = a[1], ay = a[0], bx = b[1], by = b[0];
  const sminx = Math.min(ax, bx), smaxx = Math.max(ax, bx), sminy = Math.min(ay, by), smaxy = Math.max(ay, by);
  for (const p of polys) {
    if (p.maxx < sminx || p.minx > smaxx || p.maxy < sminy || p.miny > smaxy) continue;
    const r = p.ring;
    for (let i = 0; i < r.length - 1; i++) {
      if (segInt(ax, ay, bx, by, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1])) return true;
    }
  }
  return false;
}
// point on land? (ray cast) — to warn if a waypoint sits on a continent
function onLand([lat, lon]) {
  let inside = false;
  for (const p of polys) {
    if (lon < p.minx || lon > p.maxx || lat < p.miny || lat > p.maxy) continue;
    const r = p.ring;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
    }
  }
  return inside;
}

// Real transit passages that a coarse coastline walls off (canals + narrow straits). These edges
// are always allowed — ships genuinely pass here.
const PORTALS = [
  // Suez corridor: thread the narrow Gulf of Suez via mid-channel points (never Suez→Red Sea direct — cuts Sinai)
  ['suez', 'e-med'], ['suez', 'gulf-suez'], ['gulf-suez', 'suez-mouth'], ['suez-mouth', 'red-sea-n'],
  ['red-sea-n', 'red-sea-s'], ['red-sea-s', 'bab'], ['bab', 'gulf-aden'],
  ['bosphorus', 'black-sea'], ['bosphorus', 'dardanelles'], ['dardanelles', 'aegean'], ['aegean', 'e-med-2'],
  // Aegean → Ionian rounds the Peloponnese via the Kythira passage (never Aegean→Ionian direct — cuts Greece)
  ['aegean', 'kythira'], ['kythira', 'ionian-sw'], ['ionian-sw', 'ionian'],
  // Gibraltar → Atlantic via the Gulf of Cadiz (never Gibraltar→iberia-w direct — cuts across Portugal)
  ['gibraltar', 'alboran'], ['gibraltar', 'cadiz-off'], ['cadiz-off', 'iberia-w'], ['hormuz', 'oman'],
  // Persian Gulf: down the deep shipping lane south of the Iranian islands (never gulf-mid→hormuz direct — cuts them)
  ['gulf-mid', 'gulf-c'], ['gulf-c', 'gulf-e'], ['gulf-e', 'hormuz'],
  ['malacca', 'bengal-e'], ['bengal-e', 'bengal'], ['bengal-e', 'india-se'],
  ['baltic-e', 'baltic-w'], ['baltic-w', 'skagerrak'], ['skagerrak', 'north-sea'],
  ['north-sea', 'dover'], ['dover', 'english-ch'], ['english-ch', 'channel-w'], ['rotterdam-off', 'north-sea'], ['rotterdam-off', 'dover'],
  ['adriatic-s', 'ionian'], ['adriatic-n', 'adriatic-s'], ['florida', 'natl-caribbean'], ['gulf-mexico', 'florida'],
];

// Edges the coarse coastline wrongly reads as open water (they actually cut through island fields /
// peninsulas). Never created, even by the auto water-test. Names order-independent.
const BLACKLIST = [
  ['gulf-mid', 'hormuz'], ['gulf-mid', 'gulf-e'], ['gulf-c', 'hormuz'], // Persian Gulf corner-cutters (Kish/Qeshm)
  ['suez', 'red-sea-n'], ['suez', 'suez-mouth'], ['gulf-suez', 'red-sea-n'], // Sinai / Gulf of Suez corner-cutters
  ['gibraltar', 'iberia-w'], ['gibraltar', 'biscay'], // cut across Portugal/Spain
  ['aegean', 'ionian'], ['aegean', 'c-med'], ['dardanelles', 'ionian'], ['kythira', 'ionian'], // cut across the Peloponnese
];
const bl = new Set(BLACKLIST.flatMap(([a, b]) => [`${a}|${b}`, `${b}|${a}`]));

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const MAX = 34; // max edge length in degrees (open ocean chains through waypoints)

// warn on any waypoint that landed on a continent
const onland = WP.filter((w) => onLand(w));
if (onland.length) console.log('⚠ waypoints on land (fix these):', onland.map((w) => w[2]).join(', '));

// build adjacency
const adj = WP.map(() => []);
let edges = 0;
for (let i = 0; i < WP.length; i++) {
  for (let j = i + 1; j < WP.length; j++) {
    const d = dist(WP[i], WP[j]);
    if (d > MAX) continue;
    if (bl.has(`${WP[i][2]}|${WP[j][2]}`)) continue;
    if (crossesLand(WP[i], WP[j])) continue;
    adj[i].push([j, d]); adj[j].push([i, d]); edges++;
  }
}
// force the transit-passage portals
const idxOf = (name) => WP.findIndex((w) => w[2] === name);
for (const [an, bn] of PORTALS) {
  const i = idxOf(an), j = idxOf(bn);
  if (i < 0 || j < 0) { console.log('⚠ portal names not found:', an, bn); continue; }
  if (adj[i].some(([v]) => v === j)) continue;
  const d = dist(WP[i], WP[j]);
  adj[i].push([j, d]); adj[j].push([i, d]); edges++;
}
// connectivity report (BFS components)
const seen = new Array(WP.length).fill(false); const components = [];
for (let s = 0; s < WP.length; s++) {
  if (seen[s]) continue; const q = [s]; seen[s] = true; const members = [];
  while (q.length) { const u = q.pop(); members.push(WP[u][2]); for (const [v] of adj[u]) if (!seen[v]) { seen[v] = true; q.push(v); } }
  components.push(members);
}
const comps = components.length;
components.sort((a, b) => b.length - a.length);
for (const c of components.slice(1)) console.log(`  disconnected group (${c.length}): ${c.join(', ')}`);

writeFileSync(join(ROOT, 'data', 'sea-network.json'),
  `${JSON.stringify({ pts: WP.map(([lat, lon, name]) => ({ lat, lon, name })), adj }, null, 0)}\n`);
console.log(`sea-network: ${WP.length} waypoints, ${edges} water-safe edges, ${comps} component(s)`);
