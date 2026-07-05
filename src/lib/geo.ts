// INTEGRATION (inherited SWE2 scope) — src/lib/geo.ts. Pure projection helpers.
// Equirectangular: 20°W–100°E, 45°N–35°S → 1000×640 viewBox. No wall clock, no I/O.

export const VIEW_W = 1000;
export const VIEW_H = 640;
const LON_MIN = -20;
const LON_MAX = 100;
const LAT_MAX = 45;
const LAT_MIN = -35;

export interface Pt {
  x: number;
  y: number;
}

/** [lat, lon] → viewBox coords. Off-bounds points project off-canvas (SVG clips). */
export function project(lat: number, lon: number): Pt {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW_W,
    y: ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * VIEW_H,
  };
}

/** Pin a projected point inside the viewBox (Atlantic suppliers sit off the 20°W edge). */
export function clampToView(p: Pt, margin = 12): Pt {
  return {
    x: Math.min(VIEW_W - margin, Math.max(margin, p.x)),
    y: Math.min(VIEW_H - margin, Math.max(margin, p.y)),
  };
}

/** Quadratic-bezier "great circle" arc between two [lat, lon] points.
    bend = perpendicular offset as a fraction of chord length (sign flips side). */
export function greatCircleArc(from: [number, number], to: [number, number], bend = 0.12): string {
  const a = clampToView(project(from[0], from[1]));
  const b = clampToView(project(to[0], to[1]));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const r = (n: number) => Math.round(n * 10) / 10;
  return `M ${r(a.x)} ${r(a.y)} Q ${r(cx)} ${r(cy)} ${r(b.x)} ${r(b.y)}`;
}

/** Polyline of [lat, lon] pairs → SVG path string. */
export function coastPath(pts: [number, number][]): string {
  return pts
    .map(([lat, lon], i) => {
      const p = project(lat, lon);
      return `${i === 0 ? 'M' : 'L'} ${Math.round(p.x)} ${Math.round(p.y)}`;
    })
    .join(' ');
}

// Hand-authored simplified coastlines ([lat, lon]). Recognizable, not cartographic.
export const COASTLINES: { name: string; pts: [number, number][] }[] = [
  {
    name: 'arabia-gulf', // Suez → Red Sea east coast → peninsula → Hormuz → Gulf head
    pts: [
      [30.5, 32.3], [28, 33.5], [25, 36.8], [21, 39], [17, 42.3], [12.6, 43.3],
      [12.8, 45], [14.5, 49], [15.5, 52], [17, 55.2], [18.9, 57.5], [20.5, 58.7],
      [22.5, 59.8], [23.6, 58.6], [24.4, 57.3], [25.6, 56.4], [26.4, 56.4],
      [25.8, 56.1], [25.2, 55.3], [24.2, 54.4], [24, 52.5], [24.2, 51.6],
      [25.2, 51.5], [26.1, 51.2], [25.5, 50.8], [26.5, 50.1], [27.5, 49.5],
      [28.8, 48.4], [29.5, 48.1], [30, 47.9],
    ],
  },
  {
    name: 'iran-makran', // Iranian Gulf coast → Hormuz north shore → Makran → Karachi
    pts: [
      [30.4, 48.8], [29.6, 50.2], [28.5, 51], [27.5, 52.5], [26.9, 53.8],
      [26.6, 55], [27.1, 56.3], [26.7, 57.2], [25.8, 58.5], [25.3, 60.5],
      [25.2, 62.5], [25, 64.5], [24.8, 66.8],
    ],
  },
  {
    name: 'india', // Kutch → west coast → Cape Comorin → east coast → Bengal hint
    pts: [
      [24.2, 67.4], [23.8, 68.2], [22.3, 68.9], [22.5, 70], [21.6, 70.6],
      [20.7, 71], [21.6, 72.6], [21.1, 72.7], [19, 72.8], [17.5, 73.2],
      [15.5, 73.9], [12.9, 74.8], [11.2, 75.7], [10, 76.2], [8.1, 77.5],
      [9.3, 79], [10.8, 79.9], [13.1, 80.3], [15.7, 80.3], [16.9, 82.3],
      [17.7, 83.3], [19.9, 86.5], [21.7, 87.5], [21.9, 88.9], [21.5, 91.8],
      [19.5, 93.2], [16, 94.5],
    ],
  },
  {
    name: 'sri-lanka',
    pts: [[9.8, 80.2], [8.5, 81.3], [7, 81.9], [6, 80.6], [7.3, 79.9], [9.8, 80.2]],
  },
  {
    name: 'east-africa', // Red Sea west coast → Horn → Swahili coast → Cape
    pts: [
      [31.2, 32.3], [29.9, 32.6], [27, 33.9], [24, 35.5], [20.5, 37.2],
      [18, 38.5], [15.5, 39.8], [12.5, 43.3], [11.5, 44.3], [10.4, 45.5],
      [11.8, 51.3], [10.5, 51.4], [8, 49.8], [4.5, 47.8], [2, 45.5],
      [-2, 41], [-6.5, 39.3], [-10.5, 40.5], [-15, 40.7], [-19.8, 36.3],
      [-22, 35.5], [-25.9, 32.6], [-29.9, 31], [-33, 27.8], [-34.3, 25],
      [-34.8, 20], [-34.4, 18.5],
    ],
  },
  {
    name: 'west-africa', // Morocco → Dakar → Gulf of Guinea → Angola → Cape
    pts: [
      [35.8, -5.9], [33, -8.6], [28.5, -11.5], [23.5, -16], [20.8, -17.1],
      [14.7, -17.4], [12, -16.5], [9.5, -13.7], [7.2, -12.7], [4.4, -7.5],
      [5.2, -4], [4.7, -1.6], [6.3, 2.4], [6.4, 4.5], [4.3, 6.1], [4.5, 8.5],
      [3.9, 9.7], [1, 9.4], [-0.7, 8.8], [-6.1, 12.3], [-9, 13.2],
      [-12.5, 13.6], [-15.2, 12.1], [-17.3, 11.8], [-22.9, 14.5],
      [-28.6, 16.4], [-32.7, 18], [-34.4, 18.5],
    ],
  },
  {
    name: 'europe-med', // Iberia + north Mediterranean hint → Levant → Suez
    pts: [
      [43.5, -8], [38.7, -9.4], [37, -9], [36, -5.5], [37.5, -1], [39.5, 0],
      [41.3, 2.2], [43.3, 5], [44.1, 8.9], [42, 11.8], [40.3, 15.9],
      [38, 15.6], [39.8, 18.4], [40.5, 22.9], [38, 23.7], [36.5, 27],
      [36.8, 30.6], [36.5, 35.8], [33.9, 35.5], [31.9, 34.7], [31.2, 32.3],
    ],
  },
];
