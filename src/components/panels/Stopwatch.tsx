import { useEffect, useRef, useState } from 'react';
import { fmtTs } from '../../lib/fmt';

/** PRESENTATION-ONLY wall clock (never touches the derivation path — that stays sim-time only).
    Starts the first time the crisis is active, ticks in real time, and freezes on click —
    the honest "six days → four minutes" measurement, taken live in front of the room. */
function DecisionClock({ active }: { active: boolean }) {
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    if (!active || frozen) return;
    if (startRef.current === null) startRef.current = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - (startRef.current ?? Date.now())), 500);
    return () => clearInterval(id);
  }, [active, frozen]);
  if (!active && startRef.current === null) return null;
  const s = Math.floor(elapsed / 1000);
  const mmss = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <span
      className={`decision-clock${frozen ? ' frozen' : ''}`}
      onClick={() => setFrozen((f) => !f)}
      title={frozen ? 'Decision clock frozen — click to resume' : 'Real wall time since the crisis opened — click to freeze at the decision'}
    >
      ⏱ {mmss} <span className="dc-label">{frozen ? 'DECISION TIME · FROZEN' : 'REAL TIME · CLOCK IS REAL'}</span>
    </span>
  );
}

export default function Stopwatch({ ts_sim, elapsed_label, crisisActive }: { ts_sim: string; elapsed_label: string; crisisActive?: boolean }) {
  return (
    <div className="stopwatch">
      <span className="hero-num">{elapsed_label}</span>
      <span className="label">PIPELINE TIME (REPLAYED FEED)</span>
      <span className="stopwatch-ts">{fmtTs(ts_sim)}</span>
      <DecisionClock active={!!crisisActive} />
    </div>
  );
}
