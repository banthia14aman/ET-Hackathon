// Transparent historical-analog similarity. The crisis facts are real + cited (data/analogs.json);
// the score is a COMPUTED metric — never a measured or invented "% match". It weighs, against the
// current scenario: chokepoint overlap (0.45), disrupted-volume closeness (0.30), price-move
// closeness (0.25). Pure function, deterministic.

import analogsFile from '../../data/analogs.json' with { type: 'json' };

export interface Analog {
  id: string; name: string; years: string; chokepoint: string;
  oil_disrupted_mbd: number; duration_days: number; brent_move_pct: number;
  reroute_days: number; resolution: string; confidence: string; prov: string;
  note: string; sources: { org: string; url: string }[];
}

export const ANALOGS = (analogsFile as { analogs: Analog[] }).analogs;

export interface ScoredAnalog { analog: Analog; score: number }

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Rank the real analogs by computed similarity to the current shock. */
export function rankAnalogs(
  shockedChokepointKeys: string[],
  disruptedMbd: number,
  priceMovePct: number,
): ScoredAnalog[] {
  const scored = ANALOGS.map((a) => {
    const chokeMatch = shockedChokepointKeys.includes(a.chokepoint) ? 1
      : a.chokepoint === 'facility' ? 0.25 : 0.35; // a chokepoint crisis vs a facility outage
    const magScore = clamp01(1 - Math.abs(a.oil_disrupted_mbd - disruptedMbd) / 6);
    const priceScore = clamp01(1 - Math.abs(a.brent_move_pct - priceMovePct) / 30);
    const score = 0.45 * chokeMatch + 0.30 * magScore + 0.25 * priceScore;
    return { analog: a, score: Math.round(score * 1000) / 1000 };
  });
  return scored.sort((x, y) => y.score - x.score);
}
