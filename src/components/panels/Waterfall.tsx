import { fmtKbd } from '../../lib/fmt';

/** Horizontal waterfall: gap bar on top, lever fills beneath. Hero = remaining gap. */
export default function Waterfall({
  gap_kbd,
  contributions,
}: {
  gap_kbd: number;
  contributions: { lever: string; kbd: number }[];
}) {
  const covered = contributions.reduce((s, c) => s + c.kbd, 0);
  const remaining = Math.max(0, gap_kbd - covered);
  const scale = gap_kbd > 0 ? 100 / gap_kbd : 0;
  return (
    <div className="waterfall">
      <div className="waterfall-hero">
        <span className="hero-num">{fmtKbd(remaining)}</span>
        <span className="label">REMAINING GAP</span>
      </div>
      <div className="waterfall-bars">
        <div className="waterfall-lane">
          <span className="waterfall-label">GAP {fmtKbd(gap_kbd)}</span>
          <div className="waterfall-bar" style={{ width: '100%', background: 'var(--red)' }} />
        </div>
        <div className="waterfall-lane">
          <span className="waterfall-label">
            {contributions.map((c) => `${c.lever} ${fmtKbd(c.kbd)}`).join(' · ') || 'no levers applied'}
          </span>
          <div className="waterfall-fills">
            {contributions.map((c) => (
              <div
                key={c.lever}
                className="waterfall-bar"
                style={{ width: `${Math.min(100, c.kbd * scale)}%`, background: 'var(--green)' }}
                title={`${c.lever}: ${fmtKbd(c.kbd)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
