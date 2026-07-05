import { fmtTs } from '../../lib/fmt';

export default function Stopwatch({ ts_sim, elapsed_label }: { ts_sim: string; elapsed_label: string }) {
  return (
    <div className="stopwatch">
      <span className="hero-num">{elapsed_label}</span>
      <span className="label">PIPELINE TIME (REPLAYED FEED)</span>
      <span className="stopwatch-ts">{fmtTs(ts_sim)}</span>
    </div>
  );
}
