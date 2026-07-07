// SVG world map with a camera. Real bundled Natural Earth 50m land, projected with the same
// projection as the supply nodes — no tiles, no tokens, no network. The camera animates the
// viewBox (presentation-only; never touches derivation) to frame a strait when a shock hits,
// or a route when a cargo is selected.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EdgeStatus, GraphEdge, GraphNode, NodeStatus } from '../contracts/types';
import { VIEW_H, VIEW_W, WORLD_BOX, greatCircleArc, landPath, project, routePath, type Box } from '../lib/geo';
import { seaRoute } from '../lib/searoutes';
import worldGeo from '../assets/world-land.geo.json' with { type: 'json' };

export interface DarkVessel { id: string; lat: number; lon: number; count?: number; }

const LAND_D = landPath(worldGeo as never); // computed once at module load (pure)

const EDGE_STYLE: Record<EdgeStatus, { stroke: string; width: number; dash?: string; opacity?: number }> = {
  open: { stroke: 'var(--accent)', width: 1.6 },
  risk: { stroke: 'var(--amber)', width: 1.8, dash: '5 4' },
  closed: { stroke: '#555', width: 1.4, opacity: 0.3 },
};
const NODE_COLOR: Record<NodeStatus, string> = { ok: 'var(--green)', stressed: 'var(--amber)', critical: 'var(--red)' };

const easeOut = (t: number): number => 1 - (1 - t) ** 3;
const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function MapView({
  nodes, edges, nodeStatus, edgeStatus, darkVessels = [], focus = null, focusLabel = 'WORLD', highlight = null, onSelectNode, onReset,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  nodeStatus: Record<string, NodeStatus>;
  edgeStatus: Record<string, EdgeStatus>;
  darkVessels?: DarkVessel[];
  focus?: Box | null;
  focusLabel?: string;
  highlight?: { from: string; to: string } | null;
  onSelectNode?: (id: string) => void;
  onReset?: () => void;
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const nStatus = (n: GraphNode): NodeStatus => nodeStatus[n.id] ?? n.status;
  const labelled = new Set(['supplier', 'chokepoint', 'refinery']);

  // Sea-lane path for each edge (through its via_chokepoints). Pure of zoom, so compute once —
  // the SVG viewBox scales the drawn geometry; the path 'd' never changes.
  const routes = useMemo(() => {
    const map = new Map(nodes.map((n) => [n.id, n]));
    return edges.flatMap((e) => {
      const from = map.get(e.from); const to = map.get(e.to);
      if (!from || !to) return [];
      return [{ id: e.id, from: e.from, to: e.to, status: e.status, d: routePath(seaRoute(e, from, to, (id) => map.get(id))) }];
    });
  }, [edges, nodes]);

  const [vb, setVb] = useState<Box>(WORLD_BOX);
  const vbRef = useRef<Box>(WORLD_BOX);
  const rafRef = useRef<number>(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFs, setIsFs] = useState(false);
  const dragRef = useRef<{ x: number; y: number; vb: Box; moved: boolean } | null>(null);
  const draggedRef = useRef(false);
  const setBox = (b: Box) => { vbRef.current = b; setVb(b); };

  /** Animate the camera to a target viewBox (used by auto-focus + zoom-to-fit). */
  const animateTo = useCallback((target: Box) => {
    cancelAnimationFrame(rafRef.current);
    const from = vbRef.current;
    if (reduceMotion) { setBox(target); return; }
    const t0 = performance.now();
    const DUR = 640;
    const step = (now: number) => {
      const k = easeOut(Math.min(1, (now - t0) / DUR));
      setBox({
        x: from.x + (target.x - from.x) * k, y: from.y + (target.y - from.y) * k,
        w: from.w + (target.w - from.w) * k, h: from.h + (target.h - from.h) * k,
      });
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // auto-camera: fly to the focused strait/route when it changes
  useEffect(() => {
    animateTo(focus ?? WORLD_BOX);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.x, focus?.y, focus?.w, focus?.h]);

  // keep vb within the world and aspect-correct
  const clamp = (b: Box): Box => {
    const w = Math.max(55, Math.min(VIEW_W, b.w));
    const h = w * (VIEW_H / VIEW_W);
    return { w, h, x: Math.max(0, Math.min(VIEW_W - w, b.x)), y: Math.max(0, Math.min(VIEW_H - h, b.y)) };
  };
  const zoomAt = (cx: number, cy: number, factor: number) => {
    cancelAnimationFrame(rafRef.current);
    const cur = vbRef.current;
    const w = Math.max(55, Math.min(VIEW_W, cur.w * factor));
    const scale = w / cur.w;
    setBox(clamp({ x: cx - (cx - cur.x) * scale, y: cy - (cy - cur.y) * scale, w, h: w * (VIEW_H / VIEW_W) }));
  };
  // wheel-zoom centred on the cursor (native listener so we can preventDefault the page scroll)
  useEffect(() => {
    const el = svgRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cur = vbRef.current;
      const cx = cur.x + ((e.clientX - r.left) / r.width) * cur.w;
      const cy = cur.y + ((e.clientY - r.top) / r.height) * cur.h;
      zoomAt(cx, cy, e.deltaY > 0 ? 1.15 : 0.87);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(rafRef.current);
    dragRef.current = { x: e.clientX, y: e.clientY, vb: vbRef.current, moved: false };
    draggedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current; if (!d) return;
    const r = e.currentTarget.getBoundingClientRect();
    if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 3) { d.moved = true; draggedRef.current = true; }
    const dx = ((e.clientX - d.x) / r.width) * d.vb.w;
    const dy = ((e.clientY - d.y) / r.height) * d.vb.h;
    setBox(clamp({ x: d.vb.x - dx, y: d.vb.y - dy, w: d.vb.w, h: d.vb.h }));
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  // fullscreen (native Fullscreen API on the map container; Esc exits)
  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement ?? (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement ?? null;
      setIsFs(el === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => { document.removeEventListener('fullscreenchange', onChange); document.removeEventListener('webkitfullscreenchange', onChange); };
  }, []);
  const toggleFs = () => {
    const el = containerRef.current as (HTMLDivElement & { webkitRequestFullscreen?: () => void }) | null;
    const doc = document as Document & { webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element };
    const r = (document.fullscreenElement || doc.webkitFullscreenElement)
      ? (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document)
      : el && (el.requestFullscreen ?? el.webkitRequestFullscreen)?.call(el);
    if (r && typeof (r as Promise<void>).catch === 'function') (r as Promise<void>).catch(() => { /* blocked — ignore */ });
  };

  const z = VIEW_W / vb.w; // zoom factor — keep glyphs/labels constant screen size
  const s = (px: number): number => px / z;
  const hiFrom = highlight?.from; const hiTo = highlight?.to;
  const dimOthers = !!highlight;

  return (
    <div ref={containerRef} className="map-container" style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
      <svg ref={svgRef} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab', touchAction: 'none' }}
        className="map-svg" xmlns="http://www.w3.org/2000/svg"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <defs><style>{`
          @keyframes trinetra-pulse { 0% { opacity: 1; } 50% { opacity: 0.35; } 100% { opacity: 1; } }
          .map-critical { animation: trinetra-pulse 1.5s ease-in-out infinite; }
          .map-node { cursor: pointer; }
          .map-svg:active { cursor: grabbing; }
        `}</style></defs>

        <path d={LAND_D} fill="#0a0a0a" stroke="#333" strokeWidth={s(0.6)} fillRule="evenodd" />

        {routes.map((rt) => {
          const isHi = hiFrom === rt.from && hiTo === rt.to;
          const st = EDGE_STYLE[edgeStatus[rt.id] ?? rt.status];
          return (
            <path key={rt.id} d={rt.d} fill="none"
              stroke={isHi ? 'var(--amber)' : st.stroke} strokeWidth={s(isHi ? 3 : st.width)}
              strokeDasharray={st.dash ? `${s(5)} ${s(4)}` : undefined}
              opacity={isHi ? 1 : dimOthers ? 0.12 : st.opacity ?? 0.7} />
          );
        })}

        {/* highlighted route not backed by a graph edge (e.g. an owned-cargo divert): draw a
            plain arc so the selection still shows */}
        {highlight && !routes.some((rt) => rt.from === highlight.from && rt.to === highlight.to) && (() => {
          const a = byId.get(highlight.from); const b = byId.get(highlight.to);
          if (!a || !b) return null;
          return <path d={greatCircleArc([a.lat, a.lon], [b.lat, b.lon], 0.16)} fill="none" stroke="var(--amber)" strokeWidth={s(3)} opacity={1} />;
        })()}

        {nodes.map((n) => {
          const p = project(n.lat, n.lon);
          const color = NODE_COLOR[nStatus(n)];
          const labelLeft = (n.type === 'refinery' && n.lon < 76) || n.lon > 98;
          const name = n.name.split(/[(—/]/)[0].trim();
          const hot = hiFrom === n.id || hiTo === n.id;
          const faded = dimOthers && !hot ? 0.35 : 1;
          return (
            <g key={n.id} className="map-node" opacity={faded} onClick={() => { if (draggedRef.current) return; onSelectNode?.(n.id); }}>
              {n.type === 'refinery' && (
                <circle className={nStatus(n) === 'critical' ? 'map-critical' : undefined} cx={p.x} cy={p.y} r={s(5.5)} fill={color} stroke="#000" strokeWidth={s(1)} />
              )}
              {n.type === 'chokepoint' && (
                <rect className={nStatus(n) === 'critical' ? 'map-critical' : undefined} x={p.x - s(5)} y={p.y - s(5)} width={s(10)} height={s(10)} fill={color} transform={`rotate(45 ${p.x} ${p.y})`} />
              )}
              {n.type === 'supplier' && <circle cx={p.x} cy={p.y} r={s(4)} fill={color === 'var(--green)' ? '#888' : color} />}
              {n.type === 'port' && <rect x={p.x - s(2)} y={p.y - s(2)} width={s(4)} height={s(4)} fill="#888" opacity={0.7} />}
              {labelled.has(n.type) && (
                <text x={labelLeft ? p.x - s(8) : p.x + s(8)} y={p.y + s(3.5)} textAnchor={labelLeft ? 'end' : 'start'}
                  style={{ font: `${s(11)}px var(--mono)` }} fill={hot ? 'var(--amber)' : n.type === 'chokepoint' ? 'var(--accent)' : '#9aa'}>
                  {name}
                </text>
              )}
            </g>
          );
        })}

        {darkVessels.map((v) => {
          const p = project(v.lat, v.lon);
          return (
            <g key={v.id} stroke="var(--synth)" strokeWidth={s(2)}>
              <line x1={p.x - s(5)} y1={p.y - s(5)} x2={p.x + s(5)} y2={p.y + s(5)} />
              <line x1={p.x - s(5)} y1={p.y + s(5)} x2={p.x + s(5)} y2={p.y - s(5)} />
              {v.count !== undefined && <text x={p.x + s(8)} y={p.y - s(6)} style={{ font: `${s(11)}px var(--mono)` }} fill="var(--synth)" stroke="none">{v.count} dark</text>}
            </g>
          );
        })}
      </svg>

      {/* HUD: current camera focus + zoom controls */}
      <div className="map-hud">
        <span className="map-hud-label">◎ {focusLabel}</span>
        <button className="map-hud-btn" title="Zoom in" onClick={() => zoomAt(vbRef.current.x + vbRef.current.w / 2, vbRef.current.y + vbRef.current.h / 2, 0.7)}>+</button>
        <button className="map-hud-btn" title="Zoom out" onClick={() => zoomAt(vbRef.current.x + vbRef.current.w / 2, vbRef.current.y + vbRef.current.h / 2, 1.43)}>−</button>
        <button className="map-hud-btn" title="Fit / reset view" onClick={() => { animateTo(focus ?? WORLD_BOX); onReset?.(); }}>WORLD ⤢</button>
        <button className="map-hud-btn" title={isFs ? 'Exit full screen' : 'Full screen'} onClick={toggleFs}>{isFs ? '⤡ EXIT' : '⛶ FULL'}</button>
      </div>

      {/* legend (HTML overlay — unaffected by zoom) */}
      <div className="map-legend">
        <span><i className="lg-dot" style={{ background: 'var(--green)' }} />refinery (colour=stress)</span>
        <span><i className="lg-dia" style={{ background: 'var(--accent)' }} />chokepoint</span>
        <span><i className="lg-dot" style={{ background: '#888' }} />supplier</span>
        <span><i className="lg-x">✕</i>dark vessels</span>
        <span style={{ color: '#667' }}>scroll to zoom · drag to pan · click a cargo to trace</span>
      </div>
    </div>
  );
}
