import type { Objection, OptionCard } from '../../contracts/types';

function ObjectionChip({ o }: { o: Objection }) {
  // ponytail: verdict = first 4 words of the validator message, uppercased
  const verdict = o.message.split(/\s+/).slice(0, 4).join(' ').toUpperCase();
  return (
    <div className={`objection${o.severity === 'block' ? ' objection-block' : ''}`}>
      <div className="objection-verdict">{verdict}</div>
      <div className="objection-cite">{o.rule_id} · {o.evidence.join(', ') || o.validator}</div>
    </div>
  );
}

export default function DebatePanel({ options, objections }: { options: OptionCard[]; objections: Objection[] }) {
  const empty = options.length === 0 && objections.length === 0;
  return (
    <div>
      <div className="panel-title">DEBATE</div>
      {empty && <div className="debate-empty">Awaiting proposals — 0 objections</div>}
      {!empty && (
        <>
          <div className="label">PROPOSER</div>
          {/* cosmetic dedupe: identical proposer rows (e.g. 14× kochi diverts) collapse to ×N */}
          {[...options.reduce((m, o) => {
            const label = `${o.lever}${o.grade ? ` · ${o.grade}` : ''}${o.target_refinery ? ` → ${o.target_refinery}` : ''}`;
            const hit = m.get(label);
            if (hit) hit.n += 1; else m.set(label, { id: o.id, n: 1 });
            return m;
          }, new Map<string, { id: string; n: number }>()).entries()].map(([label, { id, n }]) => (
            <div key={id} className="debate-row">
              {label}{n > 1 ? ` ×${n}` : ''}
            </div>
          ))}
          <div className="label" style={{ marginTop: 12 }}>CRITIC — {objections.length} OBJECTIONS</div>
          {objections.map((o) => <ObjectionChip key={o.id} o={o} />)}
          <div className="label" style={{ marginTop: 12 }}>ARBITER</div>
          {options.map((o) => (
            <div key={o.id} className="debate-row">
              <span className={`status-${o.status}`}>{o.status.toUpperCase()}</span> {o.id}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
