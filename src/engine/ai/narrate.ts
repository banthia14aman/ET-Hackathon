// LIVE PROPOSER NARRATION — the LLM re-writes the rationale for the visible top option cards
// on every decision-state change, through the record-replay client (llm.ts). PROSE ONLY:
// the deterministic engine has already scored/statused every card before this runs, and the
// system prompt forbids the model from contradicting a verdict. On any failure the UI keeps
// the build-time cached rationale — narration can never block or alter a decision.

import type { OptionCard, ScenarioState } from '../../contracts/types';
import { optionLabel } from '../../lib/labels';
import { chatLive, llmEndpoint, type LlmRecord } from './llm';

const SYS = `You are the PROPOSER on an Indian crude-supply crisis desk. Write a 2-sentence
rationale for ONE substitute-cargo option that a deterministic rules engine has ALREADY scored.
Plain prose, no markdown, no lists, under 60 words. State why the desk would execute it and the
key constraint. NEVER contradict, question, or restate the given status/verdict — the rules
engine decides; you only narrate.`;

/** The same top-3 selection OptionCards renders (non-rejected, first three). */
export function narratableCards(options: OptionCard[]): OptionCard[] {
  return options.filter((o) => o.status !== 'rejected').slice(0, 3);
}

/** Narrate the visible cards live. Returns {} when live mode is off; skips failures. */
export async function narrateOptions(
  options: OptionCard[], scenario: ScenarioState,
): Promise<Record<string, LlmRecord>> {
  if (!llmEndpoint()) return {};
  const cards = narratableCards(options);
  const out: Record<string, LlmRecord> = {};
  await Promise.all(cards.map(async (o) => {
    // deterministic fact bundle → deterministic transcript key → seek/replay reuses the record
    const facts = {
      option: optionLabel(o), lever: o.lever, status: o.status,
      volume_kb: Math.round(o.volume_kb), eta_days: Math.round(o.eta_days),
      cover_days_gained: Math.round(o.cover_days_gained * 10) / 10,
      cost_delta_usd_bbl: o.cost_delta_usd_bbl, conditions: o.conditions ?? [],
      payment_rail: o.payment_rail, compat_tier: o.compat_tier,
      national_gap_kbd: Math.round(scenario.gap_kbd), brent_usd: scenario.brent_usd,
    };
    try {
      out[o.id] = await chatLive(
        [{ role: 'system', content: SYS }, { role: 'user', content: JSON.stringify(facts) }],
        { temperature: 0.3, maxTokens: 160 },
      );
    } catch { /* keep the cached rationale for this card */ }
  }));
  return out;
}
