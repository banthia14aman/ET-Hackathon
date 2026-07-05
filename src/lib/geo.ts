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

/** [lat, lon] → viewBox coords. Off-window points project off-canvas (SVG clips). */
export function project(lat: number, lon: number): Pt {
  return { x: (lon - LON_MIN) * KX, y: (LAT_MAX - lat) * KY };
}

const r1 = (n: number): number => Math.round(n * 10) / 10;

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
