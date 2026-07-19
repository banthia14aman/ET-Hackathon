// What-if sandbox builder. Lets the operator pose a hypothetical crisis (which chokepoints are
// disrupted, how hard, and the Brent price) and feed it straight into the deterministic engine.
// Presentation-only: emits a ShockContext; the pipeline does the rest (src/lib/pipeline.computeScenario).

import { useState } from 'react';
import type { GraphNode, ShockContext } from '../contracts/types';

type Sev = '' | 'partial' | 'severe';

const PRESETS: { name: string; sev: Record<string, Sev>; brent: number }[] = [
  { name: 'Full Hormuz closure', sev: { hormuz: 'severe' }, brent: 130 },
  { name: 'Red Sea / Bab-el-Mandeb closure (non-Hormuz)', sev: { 'bab-el-mandeb': 'severe', suez: 'severe' }, brent: 112 },
  { name: 'Two-strait crisis (Hormuz + Red Sea)', sev: { hormuz: 'severe', 'bab-el-mandeb': 'severe' }, brent: 145 },
  { name: 'Every chokepoint stressed', sev: { hormuz: 'partial', 'bab-el-mandeb': 'partial', suez: 'partial', malacca: 'partial' }, brent: 120 },
  { name: 'Calm baseline', sev: {}, brent: 72 },
];

export default function ScenarioBuilder({
  nodes, currentBrent, onRun, onClose,
}: {
  nodes: GraphNode[];
  currentBrent: number;
  onRun: (shocks: ShockContext) => void;
  onClose: () => void;
}) {
  const chokepoints = nodes.filter((n) => n.type === 'chokepoint')
    .map((n) => ({ key: n.id.replace(/^ck:/, ''), name: n.name.split(/[(—/]/)[0].trim() }));
  const [sev, setSev] = useState<Record<string, Sev>>({});
  const [brent, setBrent] = useState<number>(Math.round(currentBrent) || 90);

  const applyPreset = (p: typeof PRESETS[number]) => { setSev({ ...p.sev }); setBrent(p.brent); };

  const run = () => {
    const shocks_active = chokepoints
      .filter((c) => sev[c.key])
      .map((c) => `shock:${c.key}-${sev[c.key]}`)
      .sort();
    onRun({ t_sim: '2027-01-01T00:00:00Z', shocks_active, brent_usd: brent });
  };

  const activeCount = chokepoints.filter((c) => sev[c.key]).length;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          WHAT-IF SCENARIO — hypothetical, not real data
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-note">
            Pose a future crisis. TRINETRA re-scores India's exposure and shows what its critic
            approves, demotes, or blocks — under the same rules, on the same engine.
          </div>

          <div className="modal-label">Presets</div>
          <div className="preset-row">
            {PRESETS.map((p) => (
              <button key={p.name} className="preset-btn" onClick={() => applyPreset(p)}>{p.name}</button>
            ))}
          </div>

          <div className="modal-label">Chokepoint disruption</div>
          {chokepoints.map((c) => (
            <div key={c.key} className="scn-row">
              <span className="scn-name">{c.name}</span>
              <div className="seg">
                {(['', 'partial', 'severe'] as Sev[]).map((s) => (
                  <button key={s || 'off'} className={sev[c.key] === s || (!sev[c.key] && s === '') ? 'on' : ''}
                    onClick={() => setSev({ ...sev, [c.key]: s })}>
                    {s === '' ? 'OPEN' : s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="scn-row" style={{ marginTop: 10 }}>
            <span className="scn-name">Brent price</span>
            <div className="scn-brent">
              <input type="range" min={60} max={180} value={brent} onChange={(e) => setBrent(Number(e.target.value))} />
              <span className="scn-brent-val mono">${brent}/bbl</span>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <span className="label">{activeCount} chokepoint{activeCount === 1 ? '' : 's'} disrupted</span>
          <div style={{ flex: 1 }} />
          <button className="btn-ghost" onClick={onClose}>CANCEL</button>
          <button className="btn-primary" onClick={run}>RUN SCENARIO ▸</button>
        </div>
      </div>
    </div>
  );
}
