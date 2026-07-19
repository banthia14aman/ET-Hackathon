// AI CONSTITUTIONAL AUDIT — after deterministic scoring, review the decision for rule gaps,
// missing data, and unsupported assumptions. ADVISORY ONLY: this produces read-only notes and
// is structurally incapable of changing a score, status, or verdict (it returns a separate
// array; the caller never feeds it back into the engine).
//   • live: an OpenAI-compatible model, output validated by RuleAuditSchema.
//   • offline: a deterministic detector — the airplane-mode stand-in, and itself a genuine
//     constitutional check (it inspects the real scored result for gaps).

import type { Objection, OptionCard, RuleAuditNote, ScenarioState, StaticData } from './deps';
import { RuleAuditSchema } from '../../contracts/schemas';
import { chatLive, llmEndpoint, DEFAULT_LLM_MODEL } from './llm';

export interface AuditOpts { endpoint?: string; apiKey?: string; model?: string; }

/** Deterministic constitutional audit (pure). Flags real gaps in the scored decision. */
export function deterministicRuleAudit(
  scenario: ScenarioState, options: OptionCard[], objections: Objection[], data: StaticData,
): RuleAuditNote[] {
  const by = 'deterministic-audit';
  const notes: RuleAuditNote[] = [];

  // rule_gap: no validator prices freight / demurrage exposure
  if (!objections.some((o) => /freight|demurrage|cost/i.test(o.message))) {
    notes.push({ kind: 'rule_gap', by, severity: 'warn', refs: ['charter'],
      message: 'No charter article prices freight or demurrage exposure — cost-of-delay is shown but never gates an option.' });
  }
  // missing_data: options resting on SYNTH-labelled data
  const synthGrades = new Set(data.grades.filter((g) => g.prov === 'S').map((g) => g.id));
  const synthOpts = options.filter((o) => o.grade && synthGrades.has(o.grade));
  if (synthOpts.length) {
    notes.push({ kind: 'missing_data', by, severity: 'info', refs: synthOpts.map((o) => o.id),
      message: `${synthOpts.length} option(s) rest on SYNTH-labelled assay data — treat their compatibility tier as illustrative.` });
  }
  // missing_data: validated cargoes that produced no route
  const aiCargoes = data.spot.filter((s) => /AI-extracted/i.test(s.source));
  const scoredGrades = new Set(options.map((o) => o.grade));
  const unrouted = aiCargoes.filter((s) => !scoredGrades.has(s.grade_id));
  if (unrouted.length) {
    notes.push({ kind: 'missing_data', by, severity: 'warn', refs: unrouted.map((s) => s.id),
      message: `${unrouted.length} validated cargo(es) produced no option — no usable route to the named refinery in the current graph.` });
  }
  // unsupported_assumption: the linear cover model near zero supply
  notes.push({ kind: 'unsupported_assumption', by, severity: 'info', refs: ['scenario.ts'],
    message: 'Days-of-cover uses a linear index with a 40% floor; near-zero supply is not modelled convexly. Defend the exposure RANKING, not the absolute day-count.' });
  // unsupported_assumption: concentration heuristic is route-less
  if (objections.some((o) => o.rule_id === 'A3.concentration')) {
    notes.push({ kind: 'unsupported_assumption', by, severity: 'info', refs: ['A3.concentration'],
      message: 'Concentration share is computed from edge adjacency, not an actual route — it over-approximates which corridor a cargo transits.' });
  }
  return notes.slice(0, 12);
}

const SYS = `You are a CONSTITUTIONAL AUDITOR for a deterministic crude-supply decision engine.
You are given a scored decision (scenario, options with statuses, objections). Identify RULE GAPS,
MISSING DATA, and UNSUPPORTED ASSUMPTIONS. You are ADVISORY ONLY — you cannot change any score,
status, or verdict; do not recommend a specific option. Return ONLY minified JSON:
[{kind:"rule_gap"|"missing_data"|"unsupported_assumption",message:string,refs:string[],severity:"info"|"warn",by:string}]`;

async function liveAudit(payload: unknown, o: { endpoint: string; apiKey?: string; model: string }): Promise<RuleAuditNote[]> {
  const rec = await chatLive(
    [{ role: 'system', content: SYS }, { role: 'user', content: JSON.stringify(payload) }],
    { endpoint: o.endpoint, apiKey: o.apiKey, model: o.model, temperature: 0.2 },
  );
  const raw = rec.text.replace(/```json|```/g, '').trim();
  const parsed = RuleAuditSchema.safeParse(JSON.parse(raw)); // reject anything off-schema
  return parsed.success ? parsed.data.map((n) => ({ ...n, by: `${rec.model} (advisory)` })) : [];
}

/** Run the constitutional audit. LIVE BY DEFAULT in the browser (key-holding Worker);
    deterministic offline stand-in in Node or on failure. Never gates. */
export async function ruleAudit(
  scenario: ScenarioState, options: OptionCard[], objections: Objection[], data: StaticData, opts: AuditOpts = {},
): Promise<RuleAuditNote[]> {
  const endpoint = opts.endpoint ?? llmEndpoint();
  if (endpoint) {
    const model = opts.model || DEFAULT_LLM_MODEL;
    try {
      const notes = await liveAudit({ scenario, options: options.map((o) => ({ id: o.id, grade: o.grade, status: o.status, eta_days: o.eta_days })), objections }, { endpoint, apiKey: opts.apiKey, model });
      return notes.length ? notes : deterministicRuleAudit(scenario, options, objections, data);
    } catch {
      return deterministicRuleAudit(scenario, options, objections, data);
    }
  }
  return deterministicRuleAudit(scenario, options, objections, data);
}
