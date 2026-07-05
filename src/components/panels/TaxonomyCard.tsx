// Plain-English rendering of the active shock ids + historical analogs.
const SHOCK_PLAIN: Record<string, string> = {
  'shock:hormuz-partial': 'Hormuz partially disrupted',
  'shock:hormuz-severe': 'Hormuz severely disrupted',
  'shock:hormuz-closure-declared': 'Hormuz closure declared',
  'shock:bab-el-mandeb-partial': 'Bab el-Mandeb (Red Sea) disrupted',
};

function plainShock(shock?: string): { headline: string; detail: string } {
  if (!shock) return { headline: 'No active shock', detail: 'Monitoring the feed — nothing disrupting supply yet.' };
  const ids = shock.split(' · ');
  const worst = ids[ids.length - 1];
  const headline = SHOCK_PLAIN[worst] ?? worst;
  const detail = ids.map((s) => SHOCK_PLAIN[s] ?? s).join(' + ');
  return { headline, detail };
}

export default function TaxonomyCard({ shock, analogs }: { shock?: string; analogs?: { name: string; score: number }[] }) {
  const { headline, detail } = plainShock(shock);
  return (
    <div>
      <div className="panel-title">The shock</div>
      <div className="panel-sub">What's disrupting India's crude supply right now.</div>
      <div className="taxonomy-shock">{headline}</div>
      <div className="taxonomy-shock-plain">{detail}</div>
      {analogs && analogs.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 14 }}>Closest past crises</div>
          {analogs.map((a) => (
            <div key={a.name} className="taxonomy-analog">
              <span style={{ flex: 1 }}>{a.name}</span>
              <span className="mono" style={{ color: 'var(--muted)' }}>{Math.round(a.score * 100)}% match</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
