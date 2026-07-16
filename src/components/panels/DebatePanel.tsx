import type { Objection, OptionCard } from '../../contracts/types';
import { articleName, leverPlain, optionLabel, plainMessage, prettify, STATUS_LABEL, STATUS_PILL } from '../../lib/labels';

function ObjectionChip({ o, i }: { o: Objection; i: number }) {
  // stagger the reveal so the critic visibly "computes" one objection at a time
  return (
    <div className={`objection${o.severity === 'block' ? ' objection-block' : ''}`} style={{ animationDelay: `${Math.min(i, 8) * 0.14}s` }}>
      <div className="objection-article">{articleName(o.rule_id)}</div>
      <div className="objection-msg">{plainMessage(o.message)}</div>
      <div className="objection-cite mono" title={`${o.rule_id} · ${o.validator}`}>
        {o.severity === 'block' ? 'BLOCKS' : 'FLAGS'} · cited: {o.evidence.slice(0, 2).join(', ') || o.validator}
      </div>
    </div>
  );
}

export default function DebatePanel({ options, objections }: { options: OptionCard[]; objections: Objection[] }) {
  const empty = options.length === 0 && objections.length === 0;
  // proposer rows: dedupe identical human labels to one ×N line
  const proposed = [...options.reduce((m, o) => {
    const label = `${leverPlain(o.lever)}${o.grade ? ` · ${prettify(o.grade)}` : ''}${o.target_refinery ? ` → ${prettify(o.target_refinery)}` : ''}`;
    const hit = m.get(label);
    if (hit) hit.n += 1; else m.set(label, { n: 1 });
    return m;
  }, new Map<string, { n: number }>()).entries()];

  return (
    <div>
      <div className="panel-title">The debate</div>
      <div className="panel-sub">An AI proposes moves. A rules-only critic (no AI) objects. An arbiter decides.</div>
      {empty && <div className="debate-empty">Awaiting proposals — the desk hasn't moved yet.</div>}
      {!empty && (
        <>
          <div className="debate-group-label">Proposer <span className="debate-role">— the AI suggests substitute cargoes</span></div>
          {proposed.map(([label, { n }]) => (
            <div key={label} className="debate-row">
              <span className="dr-name">{label}</span>
              {n > 1 && <span className="label">×{n}</span>}
            </div>
          ))}

          <div className="debate-group-label">Critic <span className="debate-role">— {objections.length} rule objections, computed with zero AI</span></div>
          {objections.length === 0
            ? <div className="debate-empty">No rule violations.</div>
            : objections.map((o, i) => <ObjectionChip key={o.id} o={o} i={i} />)}

          <div className="debate-group-label">Arbiter <span className="debate-role">— the verdict on each move</span></div>
          {options.map((o) => (
            <div key={o.id} className="debate-row">
              <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status].split(' —')[0]}</span>
              <span className="dr-name">{optionLabel(o)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
