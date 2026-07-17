// DECISION BRIEF — a human-readable summary of the decision. PURE and deterministic:
// it assembles the deterministic scoring result plus the (advisory) AI pieces and states,
// unambiguously, that the decision was scored by deterministic logic and requires human approval.

import type {
  DecisionBrief, ExtractionResult, Objection, OptionCard, RuleAuditNote, ScenarioState,
} from './deps';
import { optionLabel } from '../../lib/labels';
import { fmtKbd } from '../../lib/fmt';

export const PROVENANCE_STATEMENT =
  'How this decision was made: AI was used ONLY for sense-making (extracting the inputs from '
  + 'your text — every field re-validated by strict schemas and domain rules before use) and '
  + 'for constitutional auditing (advisory notes on rule gaps — read-only, cannot change a score). '
  + 'The scoring itself was produced by DETERMINISTIC logic: the zero-LLM critic and the '
  + 'severity-lattice arbiter. No AI set any score. This brief is a recommendation and REQUIRES '
  + 'HUMAN APPROVAL before any action.';

/** Build the decision brief. Pure — same inputs, same brief. */
export function buildDecisionBrief(
  extraction: ExtractionResult,
  scenario: ScenarioState,
  options: OptionCard[],
  _objections: Objection[],
  notes: RuleAuditNote[],
): DecisionBrief {
  const approved = options.filter((o) => o.status === 'validated').length;
  const conditional = options.filter((o) => o.status === 'conditional').length;
  const rejected = options.filter((o) => o.status === 'rejected').length;
  const gap = Math.round(scenario.gap_kbd);

  const headline = scenario.shocks_active.length === 0
    ? 'No active disruption in the validated facts — nothing to score.'
    : `Shortfall ${fmtKbd(gap)}. Deterministic scoring: ${approved} approved, ${conditional} demoted-with-conditions, ${rejected} blocked.`;

  // decisions, most-actionable first (approved → conditional → rejected)
  const rank: Record<string, number> = { validated: 0, conditional: 1, proposed: 2, rejected: 3 };
  const decisions = [...options]
    .sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9))
    .slice(0, 8)
    .map((o) => ({ option: optionLabel(o), status: o.status, conditions: o.conditions ?? [] }));

  return {
    headline,
    provenance_statement: PROVENANCE_STATEMENT,
    validated_facts: extraction.validated,
    rejected_inputs: extraction.rejected,
    decisions,
    ai_observations: notes,
    approval_required: true,
  };
}
