// INTEGRATION (inherited SWE2 scope) — SVG world map. Pure function of props.
// Fixed viewBox, no zoom/pan, no tiles, no tokens, no network.

import type { EdgeStatus, GraphEdge, GraphNode, NodeStatus } from '../contracts/types';
import { COASTLINES, VIEW_H, VIEW_W, clampToView, coastPath, greatCircleArc, project } from '../lib/geo';

export interface DarkVessel {
  id: string;
  lat: number;
  lon: number;
  count?: number;
}

const EDGE_STYLE: Record<EdgeStatus, { stroke: string; width: number; dash?: string; opacity?: number }> = {
  open: { stroke: 'var(--accent)', width: 2 },
  risk: { stroke: 'var(--amber)', width: 2, dash: '6 4' },
  closed: { stroke: '#4B5563', width: 1.5, opacity: 0.35 },
};

const NODE_COLOR: Record<NodeStatus, string> = {
  ok: 'var(--green)',
  stressed: 'var(--amber)',
  critical: 'var(--red)',
};

export default function MapView({
  nodes,
  edges,
  nodeStatus,
  edgeStatus,
  darkVessels = [],
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  darkVessels?: DarkVessel[];
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nStatus = (n: GraphNode): NodeStatus => nodeStatus[n.id] ?? n.status;
  // label only the nodes that matter at 11px density
  const labelled = new Set(['supplier', 'chokepoint', 'refinery']);

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={{ width: '100%', height: '100%', display: 'block' }} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>{`
          @keyframes trinetra-pulse { 0% { opacity: 1; r: 6; } 50% { opacity: 0.35; r: 9; } 100% { opacity: 1; r: 6; } }
          .map-critical { animation: trinetra-pulse 1.6s ease-in-out infinite; }
        `}</style>
      </defs>

      {COASTLINES.map((c) => (
        <path key={c.name} d={coastPath(c.pts)} fill="#0E1420" stroke="var(--border)" strokeWidth={1} />
      ))}

      {edges.map((e) => {
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        if (!from || !to) return null;
        const st = EDGE_STYLE[edgeStatus[e.id] ?? e.status];
        return (
          <path
            key={e.id}
            d={greatCircleArc([from.lat, from.lon], [to.lat, to.lon], e.mode === 'pipeline' ? 0 : 0.12)}
            fill="none"
            stroke={st.stroke}
            strokeWidth={st.width}
            strokeDasharray={st.dash}
            opacity={st.opacity ?? 0.85}
          />
        );
      })}

      {nodes.map((n) => {
        const p = clampToView(project(n.lat, n.lon));
        const color = NODE_COLOR[nStatus(n)];
        return (
          <g key={n.id}>
            {n.type === 'refinery' && (
              <circle className={nStatus(n) === 'critical' ? 'map-critical' : undefined} cx={p.x} cy={p.y} r={6} fill={color} stroke="var(--bg)" strokeWidth={1} />
            )}
            {n.type === 'chokepoint' && (
              <rect
                className={nStatus(n) === 'critical' ? 'map-critical' : undefined}
                x={p.x - 5}
                y={p.y - 5}
                width={10}
                height={10}
                fill={color}
                transform={`rotate(45 ${p.x} ${p.y})`}
              />
            )}
            {n.type === 'supplier' && <circle cx={p.x} cy={p.y} r={4} fill="var(--muted)" />}
            {n.type === 'port' && <rect x={p.x - 2} y={p.y - 2} width={4} height={4} fill="var(--muted)" opacity={0.7} />}
            {labelled.has(n.type) && (
              <text x={p.x + 9} y={p.y + 4} fontSize={11} fill="var(--muted)">
                {n.name.split(/[(—]/)[0].trim()}
              </text>
            )}
          </g>
        );
      })}

      {darkVessels.map((v) => {
        const p = clampToView(project(v.lat, v.lon));
        return (
          <g key={v.id} stroke="var(--synth)" strokeWidth={2}>
            <line x1={p.x - 5} y1={p.y - 5} x2={p.x + 5} y2={p.y + 5} />
            <line x1={p.x - 5} y1={p.y + 5} x2={p.x + 5} y2={p.y - 5} />
            {v.count !== undefined && (
              <text x={p.x + 8} y={p.y - 6} fontSize={11} fill="var(--synth)" stroke="none">
                {v.count} dark
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
