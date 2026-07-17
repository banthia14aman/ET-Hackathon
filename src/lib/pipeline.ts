// INTEGRATION — src/lib/pipeline.ts. Composes the pure engines (CONTRACTS.md §2 order):
// applyUntil → fold triggers/PRICE → rescore → generateOptions → propose → criticize → arbitrate.
// Pure of store/React/DOM so scripts/check.mjs can drive it under plain Node.

import type {
  AuditEntry, Calibration, CharterArticle, CriticContext, CrudeGrade, Graph, Objection,
  OptionCard, ReplayBundle, ReplayEvent, SanctionsRules, ScenarioState, ShockContext, SpotCargo,
} from '../contracts/types';
import { applyUntil } from '../engine/replay';
import { rescore } from '../engine/scenario';
import { generateOptions } from '../engine/options';
import { propose } from '../engine/charter/propose';
import { criticize } from '../engine/charter/criticize';
import { arbitrate } from '../engine/charter/arbitrate';
import { appendEntry } from '../engine/charter/audit';
import { sha256Hex } from './canonical';
import { extractFacts, type ExtractOpts } from '../engine/ai/extract';
import { validateFacts, factsToInputs } from '../engine/ai/validate';
import { ruleAudit } from '../engine/ai/ruleAudit';
import { buildDecisionBrief } from '../engine/ai/brief';
import type { DecisionBrief, ExtractionResult, RuleAuditNote } from '../contracts/types';
import { llmCache } from '../cache';

export interface StaticData {
  bundle: ReplayBundle;
  graph: Graph;
  grades: CrudeGrade[];
  sanctions: SanctionsRules;
  spot: SpotCargo[];
  calibration: Calibration;
}

export interface PipelineState {
  cursor: number;
  applied: ReplayEvent[];
  scenario: ScenarioState;
  options: OptionCard[];
  objections: Objection[];
  audit: AuditEntry[];
}

/** Fold applied events into a ShockContext: union of triggers + latest PRICE value. */
export function foldShocks(applied: ReplayEvent[], t_sim: string): ShockContext {
  const shocks = new Set<string>();
  let brent = 0;
  for (const e of applied) {
    for (const t of e.triggers ?? []) shocks.add(t);
    if (e.channel === 'PRICE' && typeof e.payload.brent_usd === 'number') {
      brent = e.payload.brent_usd;
    }
  }
  return { t_sim, shocks_active: [...shocks].sort(), brent_usd: brent };
}

/** generateOptions → propose → criticize → arbitrate, audit chained onto priorAudit. */
export async function decide(
  data: StaticData,
  scenario: ScenarioState,
  charter: CharterArticle[],
  priorAudit: AuditEntry[] = [],
): Promise<{ options: OptionCard[]; objections: Objection[]; audit: AuditEntry[] }> {
  const cards = generateOptions(scenario, data.graph, data.grades, data.sanctions, data.spot);
  const proposed = propose(cards, llmCache);
  let audit = await appendEntry(priorAudit, {
    ts_sim: scenario.t_sim,
    actor: 'proposer',
    action: 'propose',
    input: cards,
    output: proposed,
    refs: cards.map((c) => c.id),
  });
  const ctx: CriticContext = {
    scenario,
    graph: data.graph,
    grades: data.grades,
    sanctions: data.sanctions,
    spot: data.spot,
    charter,
    calibration: data.calibration,
  };
  const objections = criticize(proposed, ctx);
  audit = await appendEntry(audit, {
    ts_sim: scenario.t_sim,
    actor: 'critic',
    action: 'criticize',
    input: proposed,
    output: objections,
    refs: objections.map((o) => o.id),
  });
  const last = audit[audit.length - 1];
  const res = await arbitrate(proposed, objections, charter, {
    t_sim: scenario.t_sim,
    seq_start: last.seq + 1,
    prev_hash: last.output_hash,
  });
  return { options: res.options, objections, audit: [...audit, ...res.audit] };
}

/** Full deterministic derivation at sim time t_sim — always replays from event 0
    (CONTRACTS.md §3.7: seek = full rebuild, no incremental undo). */
export async function computeAt(
  data: StaticData,
  t_sim: string,
  charter: CharterArticle[],
): Promise<PipelineState> {
  const step = applyUntil(-1, data.bundle, t_sim);
  const shocks = foldShocks(step.events, t_sim);
  const scenario = rescore(data.graph, shocks, data.calibration);
  const d = await decide(data, scenario, charter, []);
  return { cursor: step.cursor, applied: step.events, scenario, ...d };
}

/** What-if sandbox: run the full derivation from a USER-BUILT ShockContext (bypasses event
    replay). Same pure engine → same determinism; only the shock inputs are hypothetical. */
export async function computeScenario(
  data: StaticData,
  shocks: ShockContext,
  charter: CharterArticle[],
): Promise<PipelineState> {
  const scenario = rescore(data.graph, shocks, data.calibration);
  const d = await decide(data, scenario, charter, []);
  return { cursor: -1, applied: [], scenario, ...d };
}

/** Charter edit (Beat 2): append a user audit entry, then re-run from the scenario
    stage (generateOptions is pure ⇒ re-proposing is idempotent). */
export async function rerunWithCharter(
  data: StaticData,
  scenario: ScenarioState,
  charter: CharterArticle[],
  priorAudit: AuditEntry[],
  note: string,
  articleId: string,
): Promise<{ options: OptionCard[]; objections: Objection[]; audit: AuditEntry[] }> {
  const withUser = await appendEntry(priorAudit, {
    ts_sim: scenario.t_sim,
    actor: 'user',
    action: 'set_charter_param',
    input: { articleId, note },
    output: charter,
    refs: [articleId],
    note,
  });
  return decide(data, scenario, charter, withUser);
}

// ---------------------------------------------------------------------------
// AI-ASSISTED RULES ENGINE (constitutional guardrails)
// unstructured text → [AI extract] → [DETERMINISTIC validate gate] → [DETERMINISTIC score]
//                   → [AI constitutional audit, advisory] → decision brief → [HUMAN approval]
// Every step is hash-chained. The LLM never sets a score; the audit never changes one.
// ---------------------------------------------------------------------------

export interface AiAssistResult extends PipelineState {
  extraction: ExtractionResult;
  notes: RuleAuditNote[];
  brief: DecisionBrief;
}

const T0 = '2027-01-01T00:00:00Z'; // sim time for an operator-posed scenario (never wall clock)

export async function computeFromText(
  data: StaticData, text: string, baseCharter: CharterArticle[], opts: ExtractOpts = {},
): Promise<AiAssistResult> {
  // 1. AI SENSE-MAKING — candidate facts (untrusted)
  const { candidates, model, live } = await extractFacts(text, opts);
  // 2. DETERMINISTIC VALIDATION GATE — strict schema + domain rules
  const { validated, rejected } = validateFacts(candidates, data);
  const extraction: ExtractionResult = { source_text: text, candidates, validated, rejected, model, live };
  // log the AI extraction + its validation outcome (text hashed, not stored raw beyond the ref)
  let audit = await appendEntry([], {
    ts_sim: T0, actor: 'ai_extractor', action: 'ai_extract',
    input: { text_sha256: await sha256Hex(text) },
    output: { validated, rejected, model, live },
    refs: rejected.map((r) => r.field),
    note: `AI extracted ${Object.keys(validated).length} validated field-group(s); ${rejected.length} rejected by rules`,
  });

  // 3. DETERMINISTIC SCORING — the LLM has no hand in this
  const { shocks, charter, data: data2 } = factsToInputs(validated, baseCharter, data);
  const scenario = rescore(data2.graph, shocks, data2.calibration);
  const d = await decide(data2, scenario, charter, audit);
  audit = d.audit;

  // 4. AI CONSTITUTIONAL AUDIT — advisory, read-only, cannot change a score
  const notes = await ruleAudit(scenario, d.options, d.objections, data2, opts);
  audit = await appendEntry(audit, {
    ts_sim: T0, actor: 'ai_auditor', action: 'ai_rule_audit',
    input: { option_statuses: d.options.map((o) => ({ id: o.id, status: o.status })) },
    output: notes,
    refs: notes.map((n) => n.kind),
    note: `AI flagged ${notes.length} advisory observation(s) — read-only, no score changed`,
  });

  // 5. DECISION BRIEF — deterministic; states provenance + human-approval requirement
  const brief = buildDecisionBrief(extraction, scenario, d.options, d.objections, notes);
  return { cursor: -1, applied: [], scenario, options: d.options, objections: d.objections, audit, extraction, notes, brief };
}

/** Human approval — the final, deliberate act. Appends a hash-chained user entry. */
export async function approveDecision(
  audit: AuditEntry[], approver: string, decision: DecisionBrief,
): Promise<{ audit: AuditEntry[]; brief: DecisionBrief }> {
  const nextAudit = await appendEntry(audit, {
    ts_sim: T0, actor: 'user', action: 'approve_decision',
    input: { headline: decision.headline, decisions: decision.decisions },
    output: { approved_by: approver },
    refs: ['human-approval'],
    note: `Human ${approver} approved the deterministic decision`,
  });
  return { audit: nextAudit, brief: { ...decision, approved_by: approver, approved_ts_sim: T0 } };
}
