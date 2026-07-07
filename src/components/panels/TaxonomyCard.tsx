// Plain-English rendering of the active shock ids + historical analogs.
const SHOCK_PLAIN: Record<string, string> = {
  'shock:hormuz-partial': 'Hormuz partially disrupted',
  'shock:hormuz-severe': 'Hormuz severely disrupted',
  'shock:hormuz-closure-declared': 'Hormuz closure declared',
  'shock:bab-el-mandeb-partial': 'Bab el-Mandeb (Red Sea) disrupted',
  'shock:bosphorus-severe': 'Bosphorus Strait severely disrupted',
  'shock:bosphorus-partial': 'Bosphorus Strait disrupted',
  'shock:gibraltar-severe': 'Strait of Gibraltar disrupted',
  'shock:suez-severe': 'Suez Canal disrupted',
};

function plainShock(shock?: string): { headline: string; detail: string } {
  if (!shock) return { headline: 'No active shock', detail: 'Monitoring the feed — nothing disrupting supply yet.' };
  const ids = shock.split(' · ');
  const worst = ids[ids.length - 1];
  const headline = SHOCK_PLAIN[worst] ?? worst;
  const detail = ids.map((s) => SHOCK_PLAIN[s] ?? s).join(' + ');
  return { headline, detail };
}

import type { ScoredAnalog } from '../../lib/analogs';

export default function TaxonomyCard({ shock, analogs }: { shock?: string; analogs?: ScoredAnalog[] }) {
  const { headline, detail } = plainShock(shock);
  return (
    <div>
      <div className="panel-title">The shock</div>
      <div className="panel-sub">What's disrupting India's crude supply right now.</div>
      <div className="taxonomy-shock">{headline}</div>
      <div className="taxonomy-shock-plain">{detail}</div>
      {analogs && analogs.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 14 }}>
            Closest past crises <span style={{ textTransform: 'none', letterSpacing: 0 }}>· similarity computed from real facts</span>
          </div>
          {analogs.map(({ analog: a, score }) => (
            <div key={a.id} className="taxonomy-analog" title={`${a.note}\n\nSource: ${a.sources.map((s) => s.org).join('; ')}`}>
              <span style={{ flex: 1 }}>
                {a.name} <span style={{ color: 'var(--dim)' }}>{a.years}</span>
                <span className="analog-fact"> · {a.oil_disrupted_mbd} mb/d, Brent +{a.brent_move_pct}%</span>
              </span>
              <span className="mono" style={{ color: 'var(--accent)' }}>{Math.round(score * 100)}%</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
