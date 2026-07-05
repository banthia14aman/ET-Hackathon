import type { Prov } from '../../contracts/types';

const LOOK: Record<Prov, { color: string; word: (as_of?: string) => string }> = {
  R: { color: 'var(--green)', word: () => 'LIVE' },
  // ponytail: no fmtDate in fmt.ts — ISO date is the first 10 chars, deterministic
  E: { color: 'var(--amber)', word: (as_of) => `CACHED ${as_of ? as_of.slice(0, 10) : '?'}` },
  S: { color: 'var(--synth)', word: () => 'SYNTH' },
};

export default function ProvenanceChip({ prov, as_of, source }: { prov: Prov; as_of?: string; source?: string }) {
  const { color, word } = LOOK[prov];
  return (
    <span className="chip" style={{ color, borderColor: color }} title={source}>
      <span className="chip-dot" style={{ background: color }} />
      {word(as_of)}
    </span>
  );
}
