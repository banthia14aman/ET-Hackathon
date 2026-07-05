// SWE5 — src/engine/charter/propose.ts. Proposer narrates; it never reorders or filters.
// ZERO runtime LLM calls: rationale text comes from src/cache/ (build-time generated).

import type { LlmCache, OptionCard } from '../../contracts/types';

export const CACHE_MISS_RATIONALE = '[rationale pending — cache miss]';

/** OptionCard plus the attached narration. Structurally assignable to OptionCard. */
export type ProposedOptionCard = OptionCard & { rationale: string };

/** Attach cached rationale (keyed by OptionCard.id) to each card. Cache miss ⇒ template
    string, NEVER a throw and NEVER a network call — scripts/check.mjs flags misses. */
export function propose(options: OptionCard[], cache: LlmCache): ProposedOptionCard[] {
  return options.map((o) => ({
    ...o,
    rationale: cache[o.id]?.rationale ?? CACHE_MISS_RATIONALE,
  }));
}

// ---------- self check ----------

export function selfCheck(): { name: string; pass: boolean; detail?: string }[] {
  const card = (id: string): OptionCard => ({
    id, lever: 'stock_draw', volume_kb: 100, voyage_days: 0, eta_days: 0,
    payment_rail: 'GREEN', jwc_flag: false, port_ok: true, cover_days_gained: 1,
    status: 'proposed', evidence: [],
  });
  const cache: LlmCache = { a: { rationale: 'hit', model: 'm', prompt_hash: 'x' } };
  const out = propose([card('b'), card('a')], cache);
  return [
    { name: 'propose: cache hit attached', pass: out[1].rationale === 'hit' },
    { name: 'propose: miss → template, no throw', pass: out[0].rationale === CACHE_MISS_RATIONALE },
    { name: 'propose: no reorder/filter', pass: out.length === 2 && out[0].id === 'b' && out[1].id === 'a' },
  ];
}
