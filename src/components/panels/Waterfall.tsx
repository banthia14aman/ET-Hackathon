import { fmtKbd, fmtUsdBig } from '../../lib/fmt';
import { leverPlain } from '../../lib/labels';

// India's ~4,900 kb/d crude runs — the denominator behind "% of national runs" (public PPAC, est.).
const NATIONAL_RUNS_KBD = 4900;

/** Gap-closing waterfall. Hero = remaining shortfall, always framed against the starting gap. */
export default function Waterfall({
  gap_kbd,
  contributions,
  costOfDelayUsd,
  costTitle,
}: {
  gap_kbd: number;
  contributions: { lever: string; kbd: number }[];
  costOfDelayUsd?: number;
  costTitle?: string;
}) {
  const covered = contributions.reduce((s, c) => s + c.kbd, 0);
  const remaining = Math.max(0, gap_kbd - covered);
  const scale = gap_kbd > 0 ? 100 / gap_kbd : 0;
  const pctCovered = gap_kbd > 0 ? Math.min(100, Math.round((covered / gap_kbd) * 100)) : 0;
  const pctOfRuns = Math.round((gap_kbd / NATIONAL_RUNS_KBD) * 100);
  return (
    <div className="waterfall">
      <div className="waterfall-hero">
        <span className={`hero-num ${remaining === 0 && gap_kbd > 0 ? 'hit-zero' : ''}`}
          style={{ color: remaining === 0 && gap_kbd > 0 ? 'var(--green)' : 'var(--text)' }}>
          {fmtKbd(remaining)}
        </span>
        <span className="label">Remaining shortfall</span>
        <span className="waterfall-frame">
          Started at <b>{fmtKbd(gap_kbd)}</b>
          {gap_kbd > 0 && <> · <b>{pctCovered}%</b> covered by {contributions.length} levers</>}
        </span>
      </div>
      {costOfDelayUsd !== undefined && costOfDelayUsd > 0 && (
        <div className="waterfall-hero waterfall-cost" title={costTitle}>
          <span className="hero-num" style={{ color: 'var(--red)' }}>{fmtUsdBig(costOfDelayUsd)}</span>
          <span className="label">Cost of a 6-day decision lag</span>
          <span className="waterfall-frame">at the current price excess · <b>every day the desk waits</b></span>
        </div>
      )}
      <div className="waterfall-bars">
        <div className="waterfall-lane">
          <span className="waterfall-label">
            National shortfall <span className="mono">{fmtKbd(gap_kbd)}</span>
            {gap_kbd > 0 && <> — {pctOfRuns}% of India's daily crude runs</>}
          </span>
          <div className="waterfall-bar" style={{ width: '100%', background: 'var(--red)' }} />
        </div>
        <div className="waterfall-lane">
          <span className="waterfall-label">
            {contributions.map((c) => `${leverPlain(c.lever)} ${fmtKbd(c.kbd)}`).join(' · ') || 'no levers applied yet'}
          </span>
          <div className="waterfall-fills">
            {contributions.map((c) => (
              <div
                key={c.lever}
                className="waterfall-bar"
                style={{ width: `${Math.min(100, c.kbd * scale)}%`, background: 'var(--green)' }}
                title={`${leverPlain(c.lever)}: ${fmtKbd(c.kbd)}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
