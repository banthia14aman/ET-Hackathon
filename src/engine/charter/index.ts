// SWE5 — src/engine/charter/index.ts. Public API of the charter engine
// (frozen signatures in CONTRACTS.md §2) + combined self check.

export { propose, CACHE_MISS_RATIONALE, type ProposedOptionCard } from './propose';
export {
  criticize, VALIDATORS,
  assayValidator, voyageVsBufferValidator, sanctionsValidator,
  concentrationValidator, freshnessValidator, securityFloorValidator,
} from './criticize';
export { arbitrate, CACHE_MISS_MEMO, type ArbitratedOptionCard } from './arbitrate';
export { appendEntry, verifyChain, traceForOption, type EntryParts, type ChainSeed } from './audit';
export { llmCache, loadLlmCache, type RawCacheEntry } from '../../cache';

import type { ArbiterChain, CriticContext, LlmCache, OptionCard } from '../../contracts/types';
import { llmCache } from '../../cache';
import { propose, selfCheck as proposeSelfCheck } from './propose';
import { criticize, selfCheck as criticizeSelfCheck } from './criticize';
import { arbitrate, selfCheck as arbitrateSelfCheck } from './arbitrate';
import { verifyChain, selfCheck as auditSelfCheck } from './audit';

type CheckResult = { name: string; pass: boolean; detail?: string };

/** All module self checks + the Beat-1 micro-fixture:
    Merey (TAN-binding BLEND + AMBER rail + 38 d eta vs 12 d cover) alongside an SPR bridge
    ⇒ exactly 2 flags + 1 block ⇒ conditional with 3 conditions; chain verifies; re-run
    arbitrate ⇒ identical output hashes. */
export async function charterSelfCheck(): Promise<CheckResult[]> {
  const results: CheckResult[] = [
    ...proposeSelfCheck(),
    ...criticizeSelfCheck(),
    ...(await arbitrateSelfCheck()),
    ...(await auditSelfCheck()),
  ];
  const check = (name: string, pass: boolean, detail?: string): void => {
    results.push(pass ? { name, pass } : { name, pass, detail });
  };

  // ---- Beat-1 micro fixture ----
  const merey: OptionCard = {
    id: 'opt:reroute:gr:merey-16:ref:jamnagar:8', lever: 'reroute', grade: 'gr:merey-16', origin: 'Venezuela',
    target_refinery: 'ref:jamnagar', volume_kb: 2000, voyage_days: 38, eta_days: 38,
    compat_tier: 'BLEND', compat_binding: ['tan'], payment_rail: 'AMBER',
    payment_note: 'OFAC GL snapshot 2026-01-15: AMBER pending renewal', jwc_flag: false,
    port_ok: true, cost_delta_usd_bbl: 3.1, cover_days_gained: 3, status: 'proposed',
    evidence: ['ev:beat1'],
  };
  const spr: OptionCard = {
    id: 'opt:stock_draw:-:ref:jamnagar:0', lever: 'stock_draw', target_refinery: 'ref:jamnagar',
    volume_kb: 800, voyage_days: 0, eta_days: 0, payment_rail: 'GREEN', jwc_flag: false,
    port_ok: true, cover_days_gained: 6, status: 'proposed', evidence: ['ev:beat1'],
  };
  const ctx: CriticContext = {
    scenario: { t_sim: '2026-01-19T14:22:00Z', shocks_active: ['shock:hormuz_closure'],
      node_status: {}, edge_status: {}, cover_days: { 'ref:jamnagar': 12 }, gap_kbd: 1400, brent_usd: 118 },
    graph: { nodes: [], edges: [] },
    grades: [], sanctions: {}, spot: [],
    charter: [{ id: 'A2', title: 'Security floor', param_key: 'min_cover_days', param_value: 10, description: '' }],
    calibration: {},
  };
  const chain: ArbiterChain = { t_sim: ctx.scenario.t_sim, seq_start: 0, prev_hash: 'GENESIS' };
  const cache: LlmCache = llmCache;

  const proposed = propose([merey, spr], cache);
  check('beat1: proposer attaches cached Merey rationale',
    proposed[0].rationale.includes('Merey'), proposed[0].rationale.slice(0, 40));

  const objections = criticize(proposed, ctx);
  const flags = objections.filter((o) => o.severity === 'flag');
  const blocks = objections.filter((o) => o.severity === 'block');
  check('beat1: exactly 3 flags + 0 blocks (floor 10 ≤ cover 12 ⇒ voyage is a flag)',
    flags.length === 3 && blocks.length === 0,
    objections.map((o) => `${o.severity}:${o.rule_id}`).join(','));
  check('beat1: voyage flag message format',
    flags.some((f) => f.message === '38 d voyage vs 12 d cover buffer — Article A2'),
    flags.map((f) => f.message).join(' | '));

  const r1 = await arbitrate(proposed, objections, ctx.charter, chain, cache);
  const decidedMerey = r1.options.find((o) => o.id === merey.id);
  check('beat1: Merey conditional with 3 conditions (3 flag messages, sorted)',
    decidedMerey?.status === 'conditional' && decidedMerey?.conditions?.length === 3,
    JSON.stringify(decidedMerey?.conditions));
  check('beat1: SPR bridge validated', r1.options.find((o) => o.id === spr.id)?.status === 'validated');
  check('beat1: verifyChain passes', verifyChain(r1.audit));

  const r2 = await arbitrate(proposed, objections, ctx.charter, chain, cache);
  check('beat1: deterministic output hashes on re-run',
    JSON.stringify(r1.audit.map((e) => e.output_hash)) === JSON.stringify(r2.audit.map((e) => e.output_hash)));

  return results;
}
