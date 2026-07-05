import type { OptionCard, PaymentRail } from '../../contracts/types';
import { fmtDays, fmtDelta } from '../../lib/fmt';

const RAIL_COLOR: Record<PaymentRail, string> = {
  GREEN: 'var(--green)',
  AMBER: 'var(--amber)',
  RED: 'var(--red)',
};

function Card({ o }: { o: OptionCard }) {
  // proposer narration attached by propose() (build-time LLM cache; never a network call)
  const rationale = (o as OptionCard & { rationale?: string }).rationale;
  return (
    <div className={`option-card option-${o.status}`}>
      <div className="option-title">
        {o.grade ?? o.lever}
        {o.compat_tier && <span className="tier-badge">{o.compat_tier}</span>}
      </div>
      <div className="option-meta">
        <span style={{ color: RAIL_COLOR[o.payment_rail] }}>
          <span className="chip-dot" style={{ background: RAIL_COLOR[o.payment_rail] }} /> {o.payment_rail}
        </span>
        <span>{fmtDays(o.eta_days)}</span>
        {o.cost_delta_usd_bbl !== undefined && <span>{fmtDelta(o.cost_delta_usd_bbl)}</span>}
      </div>
      {rationale && !rationale.startsWith('[') && (
        <div className="option-rationale">{rationale}</div>
      )}
      {o.status === 'conditional' && o.conditions?.map((c) => (
        <div key={c} className="option-condition">⚠ {c}</div>
      ))}
    </div>
  );
}

export default function OptionCards({ options }: { options: OptionCard[] }) {
  // rejected options collapse to rows; top 3 non-rejected get cards
  const active = options.filter((o) => o.status !== 'rejected');
  const cards = active.slice(0, 3);
  const rows = [...active.slice(3), ...options.filter((o) => o.status === 'rejected')];
  // cosmetic dedupe: identical display rows (e.g. 14× kochi diverts) collapse to one ×N row
  const collapsed = new Map<string, { o: OptionCard; n: number }>();
  for (const o of rows) {
    const label = `${o.grade ?? o.lever} — ${o.status.toUpperCase()}${
      o.status === 'rejected' && o.payment_note ? `: ${o.payment_note}` : ''}`;
    const hit = collapsed.get(label);
    if (hit) hit.n += 1;
    else collapsed.set(label, { o, n: 1 });
  }
  return (
    <div>
      <div className="panel-title">OPTIONS</div>
      {options.length === 0 && <div className="debate-empty">No options yet</div>}
      {cards.map((o) => <Card key={o.id} o={o} />)}
      {[...collapsed.entries()].map(([label, { o, n }]) => (
        <div key={o.id} className="option-row">
          {label}{n > 1 ? ` ×${n}` : ''}
        </div>
      ))}
    </div>
  );
}
