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
