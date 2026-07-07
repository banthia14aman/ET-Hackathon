// src/lib/geo.ts — pure projection helpers for the map. No wall clock, no I/O.
// Equirectangular (plate carrée) over a window that contains every supply node:
// 102°W–106°E, 62°N–40°S → 1000×490 viewBox. Land geometry + nodes share this projection,
// so coastlines and cargoes line up exactly. Real world geometry is bundled (src/assets).

export const VIEW_W = 1000;
export const VIEW_H = 490;
const LON_MIN = -102;
const LON_MAX = 106;
const LAT_MAX = 62;
const LAT_MIN = -40;
const KX = VIEW_W / (LON_MAX - LON_MIN);
const KY = VIEW_H / (LAT_MAX - LAT_MIN);

export interface Pt { x: number; y: number; }
export interface Box { x: number; y: number; w: number; h: number; }
export interface LonLatBox { lonMin: number; lonMax: number; latMin: number; latMax: number; }

export const WORLD_BOX: Box = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };

/** [lat, lon] → viewBox coords. Off-window points project off-canvas (SVG clips). */
export function project(lat: number, lon: number): Pt {
  return { x: (lon - LON_MIN) * KX, y: (LAT_MAX - lat) * KY };
}

/** A lat/lon bounding box → a viewBox rect, padded and fit to the map's aspect ratio,
    clamped inside the world. Used by the map camera to frame a strait or a route. */
export function boxFromLonLat(b: LonLatBox, padFrac = 0.35): Box {
  const p1 = project(b.latMax, b.lonMin);
  const p2 = project(b.latMin, b.lonMax);
  let x = Math.min(p1.x, p2.x);
  let y = Math.min(p1.y, p2.y);
  let w = Math.max(20, Math.abs(p2.x - p1.x));
  let h = Math.max(20, Math.abs(p2.y - p1.y));
  const padX = w * padFrac; const padY = h * padFrac;
  x -= padX; y -= padY; w += padX * 2; h += padY * 2;
  const aspect = VIEW_W / VIEW_H;
  if (w / h > aspect) h = w / aspect; else w = h * aspect; // grow the short side
  const cx = x + w / 2; const cy = y + h / 2;
  w = Math.min(w, VIEW_W); h = Math.min(h, VIEW_H);
  x = Math.max(0, Math.min(VIEW_W - w, cx - w / 2));
  y = Math.max(0, Math.min(VIEW_H - h, cy - h / 2));
  return { x, y, w, h };
}

/** Center a point with a longitude span → viewBox rect (for framing one chokepoint). */
export function boxAround(lat: number, lon: number, spanLon: number): Box {
  const half = spanLon / 2;
  return boxFromLonLat({ lonMin: lon - half, lonMax: lon + half, latMin: lat - half, latMax: lat + half }, 0.1);
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Bezier handle = base + tangent, but tangent length capped at `cap` (tames Catmull-Rom overshoot). */
function clampHandle(bx: number, by: number, tx: number, ty: number, cap: number): [number, number] {
  const len = Math.hypot(tx, ty);
  const s = len > cap && len > 0 ? cap / len : 1;
  return [bx + tx * s, by + ty * s];
}

/** Quadratic-bezier arc between two [lat, lon] points.
    bend = perpendicular offset as a fraction of chord length (sign flips side). */
export function greatCircleArc(from: [number, number], to: [number, number], bend = 0.12): string {
  const a = project(from[0], from[1]);
  const b = project(to[0], to[1]);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  return `M ${r1(a.x)} ${r1(a.y)} Q ${r1(cx)} ${r1(cy)} ${r1(b.x)} ${r1(b.y)}`;
}

/** Smooth path through a list of [lat, lon] waypoints (Catmull-Rom → cubic bezier), for drawing
    a maritime route that flows along its sea lane. 2 points falls back to the gentle arc. */
export function routePath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return greatCircleArc(pts[0], pts[1], 0.14);
  const P = pts.map(([la, lo]) => project(la, lo));
  let d = `M ${r1(P[0].x)} ${r1(P[0].y)}`;
  for (let i = 0; i < P.length - 1; i += 1) {
    const p0 = P[i - 1] ?? P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] ?? p2;
    // Clamp each control handle to a third of the segment so the curve can't bulge past its
    // endpoints on a sharp turn (which would push a sea lane onto a nearby coast). Keeps routes in water.
    const seg = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const cap = seg / 3;
    const [c1x, c1y] = clampHandle(p1.x, p1.y, (p2.x - p0.x) / 6, (p2.y - p0.y) / 6, cap);
    const [c2x, c2y] = clampHandle(p2.x, p2.y, -(p3.x - p1.x) / 6, -(p3.y - p1.y) / 6, cap);
    d += ` C ${r1(c1x)} ${r1(c1y)}, ${r1(c2x)} ${r1(c2y)}, ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return d;
}

type Ring = [number, number][]; // [lon, lat] per GeoJSON order
interface GeoFeature { geometry: { type: string; coordinates: unknown } }
interface GeoJSON { features: GeoFeature[] }

function ringPath(ring: Ring): string {
  let d = '';
  for (let i = 0; i < ring.length; i += 1) {
    const p = project(ring[i][1], ring[i][0]);
    d += `${i === 0 ? 'M' : 'L'}${r1(p.x)} ${r1(p.y)}`;
  }
  return `${d}Z`;
}

/** Project an entire GeoJSON FeatureCollection (Polygon/MultiPolygon) into one SVG path `d`. */
export function landPath(fc: GeoJSON): string {
  let d = '';
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates as Ring[]) d += ringPath(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as Ring[][]) for (const ring of poly) d += ringPath(ring);
    }
  }
  return d;
}
