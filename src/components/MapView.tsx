// SVG world map. Pure function of props. Real bundled land geometry (Natural Earth 110m),
// projected with the same equirectangular projection as the supply nodes — no tiles, no tokens,
// no network. Runs offline by construction.

import type { EdgeStatus, GraphEdge, GraphNode, NodeStatus } from '../contracts/types';
import { VIEW_H, VIEW_W, greatCircleArc, landPath, project } from '../lib/geo';
import worldGeo from '../assets/world-land.geo.json' with { type: 'json' };

export interface DarkVessel { id: string; lat: number; lon: number; count?: number; }

const LAND_D = landPath(worldGeo as never); // computed once at module load (pure)

const EDGE_STYLE: Record<EdgeStatus, { stroke: string; width: number; dash?: string; opacity?: number }> = {
  open: { stroke: 'var(--accent)', width: 1.6 },
  risk: { stroke: 'var(--amber)', width: 1.8, dash: '6 4' },
  closed: { stroke: '#4B5563', width: 1.4, opacity: 0.3 },
};
const NODE_COLOR: Record<NodeStatus, string> = { ok: 'var(--green)', stressed: 'var(--amber)', critical: 'var(--red)' };

export default function MapView({
  nodes, edges, nodeStatus, edgeStatus, darkVessels = [],
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  darkVessels?: DarkVessel[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nStatus = (n: GraphNode): NodeStatus => nodeStatus[n.id] ?? n.status;
  const labelled = new Set(['supplier', 'chokepoint', 'refinery']);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: '100%', height: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>{`
          @keyframes trinetra-pulse { 0% { opacity: 1; r: 5.5; } 50% { opacity: 0.55; r: 8; } 100% { opacity: 1; r: 5.5; } }
          .map-critical { animation: trinetra-pulse 1.6s ease-in-out infinite; }
          .map-label { font: 11px var(--sans); }
        `}</style>
      </defs>

      {/* real land */}
      <path d={LAND_D} fill="#0F1723" stroke="var(--border)" strokeWidth={0.6} fillRule="evenodd" />

      {/* supply routes */}
      {edges.map((e) => {
        const from = byId.get(e.from); const to = byId.get(e.to);
        if (!from || !to) return null;
        const st = EDGE_STYLE[edgeStatus[e.id] ?? e.status];
        return (
          <path key={e.id} d={greatCircleArc([from.lat, from.lon], [to.lat, to.lon], e.mode === 'pipeline' ? 0 : 0.14)}
            fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} opacity={st.opacity ?? 0.7} />
        );
      })}

      {/* nodes + side-aware labels (west-of-India refineries label left, into the Arabian Sea) */}
      {nodes.map((n) => {
        const p = project(n.lat, n.lon);
        const color = NODE_COLOR[nStatus(n)];
        // west-of-India refineries label into the Arabian Sea; far-east nodes (Malacca) label left to avoid the edge
        const labelLeft = (n.type === 'refinery' && n.lon < 76) || n.lon > 98;
        const name = n.name.split(/[(—/]/)[0].trim();
        return (
          <g key={n.id}>
            {n.type === 'refinery' && (
              <circle className={nStatus(n) === 'critical' ? 'map-critical' : undefined} cx={p.x} cy={p.y} r={5.5} fill={color} stroke="var(--bg)" strokeWidth={1} />
            )}
            {n.type === 'chokepoint' && (
              <rect className={nStatus(n) === 'critical' ? 'map-critical' : undefined} x={p.x - 5} y={p.y - 5} width={10} height={10} fill={color} transform={`rotate(45 ${p.x} ${p.y})`} />
            )}
            {n.type === 'supplier' && <circle cx={p.x} cy={p.y} r={4} fill="var(--muted)" />}
            {n.type === 'port' && <rect x={p.x - 2} y={p.y - 2} width={4} height={4} fill="var(--muted)" opacity={0.7} />}
            {labelled.has(n.type) && (
              <text className="map-label" x={labelLeft ? p.x - 8 : p.x + 8} y={p.y + 3.5}
                textAnchor={labelLeft ? 'end' : 'start'}
                fill={n.type === 'chokepoint' ? 'var(--accent)' : 'var(--muted)'}>
                {name}
              </text>
            )}
          </g>
        );
      })}

      {/* dark vessels */}
      {darkVessels.map((v) => {
        const p = project(v.lat, v.lon);
        return (
          <g key={v.id} stroke="var(--synth)" strokeWidth={2}>
            <line x1={p.x - 5} y1={p.y - 5} x2={p.x + 5} y2={p.y + 5} />
            <line x1={p.x - 5} y1={p.y + 5} x2={p.x + 5} y2={p.y - 5} />
            {v.count !== undefined && (
              <text x={p.x + 8} y={p.y - 6} className="map-label" fill="var(--synth)" stroke="none">{v.count} dark</text>
            )}
          </g>
        );
      })}

      {/* legend */}
      <g transform={`translate(14 ${VIEW_H - 74})`} className="map-label">
        <circle cx={6} cy={0} r={5.5} fill="var(--green)" /><text x={18} y={4} fill="var(--muted)">refinery (colour = stress)</text>
        <rect x={1} y={16} width={10} height={10} fill="var(--accent)" transform="rotate(45 6 21)" /><text x={18} y={25} fill="var(--muted)">chokepoint</text>
        <circle cx={6} cy={42} r={4} fill="var(--muted)" /><text x={18} y={46} fill="var(--muted)">supplier origin</text>
        <g stroke="var(--synth)" strokeWidth={2}><line x1={1} y1={58} x2={11} y2={68} /><line x1={1} y1={68} x2={11} y2={58} /></g>
        <text x={18} y={67} fill="var(--muted)" stroke="none">dark vessels (AIS gap)</text>
      </g>
    </svg>
  );
}
