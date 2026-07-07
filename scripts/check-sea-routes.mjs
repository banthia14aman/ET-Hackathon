// Validates that drawn sea routes stay in water. For every edge in BOTH theatres it computes the
// route, samples the smoothed curve, and flags runs of on-land points — excluding the immediate
// vicinity of transit straits (which legitimately thread narrow passages). Run:
//   node --experimental-strip-types scripts/check-sea-routes.mjs

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

registerHooks({ resolve(s, c, n) { try { return n(s, c); } catch (e) { if (s.startsWith('.') && !path.extname(s)) { try { return n(`${s}.ts`, c); } catch { return n(`${s}/index.ts`, c); } } throw e; } } });

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mod = (p) => import(new URL(p, import.meta.url).href);
const loadJson = (f) => JSON.parse(readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const { seaRoute } = await mod('../src/lib/searoutes.ts');
const { ALT_THEATRES } = await mod('../src/lib/theatres.ts');
const land = JSON.parse(readFileSync(path.join(ROOT, 'src', 'assets', 'world-land.geo.json'), 'utf8'));

// coastline polygons for point-in-polygon
const polys = [];
for (const f of land.features) {
  const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates.flat() : [];
  for (const ring of rings) {
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (const [x, y] of ring) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    polys.push({ ring, minx, miny, maxx, maxy });
  }
}
function onLand(lat, lon) {
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

// Legitimate narrow transit passages — canals + straits a coarse coastline walls off. On-land
// samples within ~1.6° of these are real ship transits (a canal is *dug through land* by definition).
const STRAITS = [[26.57, 56.25], [30.3, 32.4], [12.58, 43.33], [41.1, 29.1], [35.95, -5.6], [2.5, 101], [40.3, 26.2], [-34.36, 18.47], [51, 1.5],
  [28.6, 33.0], [29.3, 32.7], [27.7, 33.9], // Suez Canal + Gulf of Suez (Suez↔Red Sea corridor)
  [55.7, 12.6], [56.5, 11.5]]; // Danish straits (Øresund / Kattegat — Baltic exit)
const nearStrait = (lat, lon) => STRAITS.some(([a, b]) => Math.hypot(lat - a, lon - b) < 1.6);

// Sample the SAME clamped cubic-bezier that geo.ts routePath() draws (projection here is ~conformal,
// KX≈KY≈4.8, so lat/lon distances mirror screen distances — the clamp cap agrees). in lat/lon.
function clampT(tx, ty, cap) { const len = Math.hypot(tx, ty); const s = len > cap && len > 0 ? cap / len : 1; return [tx * s, ty * s]; }
function sample(pts, per = 12) {
  if (pts.length < 3) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const cap = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 3;
    const [h1a, h1o] = clampT((p2[0] - p0[0]) / 6, (p2[1] - p0[1]) / 6, cap);
    const [h2a, h2o] = clampT(-(p3[0] - p1[0]) / 6, -(p3[1] - p1[1]) / 6, cap);
    const c1 = [p1[0] + h1a, p1[1] + h1o], c2 = [p2[0] + h2a, p2[1] + h2o];
    for (let s = 1; s <= per; s++) {
      const t = s / per, u = 1 - t;
      const b = (a, x, y, z) => u * u * u * a + 3 * u * u * t * x + 3 * u * t * t * y + t * t * t * z;
      out.push([b(p1[0], c1[0], c2[0], p2[0]), b(p1[1], c1[1], c2[1], p2[1])]);
    }
  }
  return out;
}

function checkTheatre(name, nodes, edges) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let bad = 0;
  for (const e of edges) {
    const from = byId.get(e.from), to = byId.get(e.to);
    if (!from || !to) continue;
    const route = seaRoute(e, from, to, (id) => byId.get(id));
    const pts = sample(route);
    // Ignore the port-approach legs near the route's real endpoints (bays, headlands). seaRoute ends
    // an inland refinery's sea leg at its coastal landing, so exempting the actual endpoints (not the
    // far-inland node) covers the harbour approach; the overland pipeline is drawn separately, uncheck.
    const a = route[0], b = route[route.length - 1];
    const nearEnd = (lat, lon) => Math.hypot(lat - a[0], lon - a[1]) < 2.6 || Math.hypot(lat - b[0], lon - b[1]) < 2.6;
    let landRun = 0, worst = 0, worstAt = null;
    for (const [lat, lon] of pts) {
      if (onLand(lat, lon) && !nearStrait(lat, lon) && !nearEnd(lat, lon)) { landRun++; if (landRun > worst) { worst = landRun; worstAt = [lat.toFixed(1), lon.toFixed(1)]; } }
      else landRun = 0;
    }
    if (worst >= 2) { bad++; console.log(`  ✗ ${name}: ${from.name.split(/[(—/]/)[0].trim()} → ${to.name.split(/[(—/]/)[0].trim()}  (${worst} land pts near ${worstAt})`); }
  }
  return bad;
}

console.log('Checking sea routes for land crossings…');
const crude = { nodes: loadJson('graph_nodes.json'), edges: loadJson('graph_edges.json') };
let bad = checkTheatre('India', crude.nodes, crude.edges);
for (const t of ALT_THEATRES) bad += checkTheatre(t.name, t.data.graph.nodes, t.data.graph.edges);
console.log(bad === 0 ? '\n✓ all routes stay in water (strait transits excepted)' : `\n✗ ${bad} route(s) cross land`);
process.exit(bad === 0 ? 0 : 1);
