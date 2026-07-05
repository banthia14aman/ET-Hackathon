import type { OptionCard, PaymentRail } from '../../contracts/types';
import { fmtDays, fmtDelta } from '../../lib/fmt';
import { optionLabel, STATUS_LABEL, STATUS_PILL } from '../../lib/labels';

const RAIL_LABEL: Record<PaymentRail, { text: string; color: string }> = {
  GREEN: { text: 'Payment clear', color: 'var(--green)' },
  AMBER: { text: 'Sanctions check', color: 'var(--amber)' },
  RED: { text: 'Payment blocked', color: 'var(--red)' },
};

const TIER_LABEL: Record<string, string> = {
  RUN_NOW: 'Runs neat', BLEND: 'Blend only', CANNOT_RUN: 'Cannot run',
};

function Card({ o }: { o: OptionCard }) {
  const rationale = (o as OptionCard & { rationale?: string }).rationale;
  const rail = RAIL_LABEL[o.payment_rail];
  const model = o as OptionCard & { model_tier?: string; model_confidence?: number };
  return (
    <div className={`option-card option-${o.status}`}>
      <div className="option-title">
        <span className="grow">{optionLabel(o)}</span>
        <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status].split(' —')[0]}</span>
      </div>
      <div className="option-meta">
        <span style={{ color: rail.color }}>● {rail.text}</span>
        {o.compat_tier && <span className="m-val">{TIER_LABEL[o.compat_tier] ?? o.compat_tier}</span>}
        <span>arrives in <span className="m-val mono">{fmtDays(o.eta_days)}</span></span>
        {o.cost_delta_usd_bbl !== undefined && <span className="mono">{fmtDelta(o.cost_delta_usd_bbl)}</span>}
        {model.model_tier && (
          <span className="model-chip" title="Prediction from our trained compatibility model">
            MODEL: {TIER_LABEL[model.model_tier] ?? model.model_tier} {Math.round((model.model_confidence ?? 0) * 100)}%
          </span>
        )}
      </div>
      {o.status === 'conditional' && o.conditions?.map((c) => (
        <div key={c} className="option-condition">⚠ {c}</div>
      ))}
      {rationale && !rationale.startsWith('[') && (
        <>
          <div className="option-rationale">{rationale}</div>
          <div className="option-rationale-meta">
            <span className="chip" style={{ color: 'var(--amber)', borderColor: 'var(--amber)' }}>
              <span className="chip-dot" style={{ background: 'var(--amber)' }} />CACHED
            </span>
            <span className="label">AI rationale · generated offline at build time</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function OptionCards({ options }: { options: OptionCard[] }) {
  const active = options.filter((o) => o.status !== 'rejected');
  const cards = active.slice(0, 3);
  const rows = [...active.slice(3), ...options.filter((o) => o.status === 'rejected')];
  const collapsed = new Map<string, { o: OptionCard; n: number }>();
  for (const o of rows) {
    const label = `${optionLabel(o)}||${o.status}`;
    const hit = collapsed.get(label);
    if (hit) hit.n += 1; else collapsed.set(label, { o, n: 1 });
  }
  return (
    <div>
      <div className="panel-title">The plan</div>
      <div className="panel-sub">Top substitute cargoes the desk can execute now. Losers collapse below.</div>
      {options.length === 0 && <div className="debate-empty">No options yet — the crisis hasn't opened a gap.</div>}
      {cards.map((o) => <Card key={o.id} o={o} />)}
      {[...collapsed.entries()].map(([, { o, n }]) => {
        const model = o as OptionCard & { model_tier?: string; model_confidence?: number };
        return (
          <div key={o.id} className="option-row">
            <span className={`pill ${STATUS_PILL[o.status]}`}>{STATUS_LABEL[o.status].split(' —')[0]}</span>
            <span className="grow">{optionLabel(o)}</span>
            {model.model_tier && (
              <span className="model-chip" title="Prediction from our trained compatibility model">
                {TIER_LABEL[model.model_tier] ?? model.model_tier} {Math.round((model.model_confidence ?? 0) * 100)}%
              </span>
            )}
            {o.status === 'rejected' && o.payment_note ? <span className="label" title={o.payment_note}>why?</span> : null}
            {n > 1 && <span className="label">×{n}</span>}
          </div>
        );
      })}
    </div>
  );
}
