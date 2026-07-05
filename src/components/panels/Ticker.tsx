import type { ReplayEvent } from '../../contracts/types';
import { fmtTs } from '../../lib/fmt';

/** Last ~8 events in a single 48px scrolling row. CSS-only animation. */
export default function Ticker({ events }: { events: ReplayEvent[] }) {
  const recent = events.slice(-8);
  if (recent.length === 0) {
    return <div className="ticker"><span className="ticker-item" style={{ color: 'var(--muted)' }}>awaiting feed</span></div>;
  }
  return (
    <div className="ticker">
      <div className="ticker-track">
        {recent.map((e) => (
          <span key={e.id} className="ticker-item">
            <span className="ticker-chan">{e.channel}</span>
            {e.headline}
            <span className="ticker-ts">{fmtTs(e.t)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
