// Backtest scorecard — grades TRINETRA's approach against real, cited disruptions. It shows the
// signal, what the market actually did, the detection lead, and — honestly — what TRINETRA does NOT
// claim. Data is real + sourced (data/backtest.json). Presentation-only.

import backtestFile from '../../data/backtest.json' with { type: 'json' };

interface Cited { event?: string; what?: string; date: string; brent_move?: string; source_org: string; source_url: string }
interface Case {
  id: string; name: string; years: string; signal: Cited; market_reaction: Cited;
  lead_days: number; claim: string; caveat: string; verdict: string;
}
const CASES = (backtestFile as { cases: Case[] }).cases;

const VERDICT: Record<string, { label: string; cls: string }> = {
  hit: { label: 'PLAN MATCHED', cls: 'pill-approved' },
  partial: { label: 'PARTIAL', cls: 'pill-demoted' },
  live: { label: 'LIVE CASE', cls: 'pill-demoted' },
  miss: { label: 'MISS', cls: 'pill-blocked' },
};

export default function BacktestScorecard({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 720 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          Backtest — graded against real crises
          <button className="modal-x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-note">
            We froze the approach and let reality grade it. Every figure below is real and cited; the
            "detection lead" is the gap between the disruption signal and the market's reaction.
            Misses and caveats are shown, not hidden.
          </div>
          {CASES.map((c) => {
            const v = VERDICT[c.verdict] ?? VERDICT.miss;
            return (
              <div key={c.id} className="bt-case">
                <div className="bt-head">
                  <span className="bt-name">{c.name} <span style={{ color: 'var(--dim)' }}>{c.years}</span></span>
                  <span className={`pill ${v.cls}`}>{v.label}</span>
                  {c.lead_days > 0 && <span className="bt-lead">{c.lead_days}-day detection lead</span>}
                </div>
                <div className="bt-row"><span className="bt-k">SIGNAL</span><span>{c.signal.event} <span className="bt-date mono">{c.signal.date}</span> <a href={c.signal.source_url} target="_blank" rel="noopener noreferrer" title={c.signal.source_org}>·src</a></span></div>
                <div className="bt-row"><span className="bt-k">MARKET DID</span><span>{c.market_reaction.what} <span className="bt-date mono">{c.market_reaction.date}</span> <a href={c.market_reaction.source_url} target="_blank" rel="noopener noreferrer" title={c.market_reaction.source_org}>·src</a></span></div>
                {c.market_reaction.brent_move && <div className="bt-row"><span className="bt-k">PRICE</span><span className="mono">{c.market_reaction.brent_move}</span></div>}
                <div className="bt-row"><span className="bt-k" style={{ color: 'var(--green)' }}>TRINETRA</span><span>{c.claim}</span></div>
                <div className="bt-row"><span className="bt-k" style={{ color: 'var(--warn)' }}>WE DON'T CLAIM</span><span style={{ color: 'var(--dim)' }}>{c.caveat}</span></div>
              </div>
            );
          })}
        </div>
        <div className="modal-actions">
          <span className="label">n = the full population of major chokepoint disruptions since 2019 · sources cited, misses reported</span>
          <div style={{ flex: 1 }} />
          <button className="btn-primary" onClick={onClose}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
