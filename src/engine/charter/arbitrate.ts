// SWE5 — src/engine/charter/arbitrate.ts. Deterministic severity lattice + hash-chained audit.
// Lattice (CONTRACTS.md §2): any block ⇒ rejected; else any flag ⇒ conditional; else validated.
// Edge case (charter design): a block that names an explicitly satisfiable condition
// (voyage-vs-buffer with a bridging lever available in the same batch, or a BLEND block)
// does not kill the option — if ALL blocks carry conditions, the option is 'conditional'
// with those conditions listed alongside the flag messages.

import type {
  ArbiterChain, ArbitrationResult, AuditEntry, CharterArticle, LlmCache, Objection, OptionCard,
} from '../../contracts/types';
import { llmCache } from '../../cache';
import { appendEntry } from './audit';

export const CACHE_MISS_MEMO = '[memo pending — cache miss]';

export type ArbitratedOptionCard = OptionCard & { memo: string };

/** A condition string iff this block is explicitly satisfiable; undefined ⇒ hard block. */
function blockCondition(
  obj: Objection, option: OptionCard, all: OptionCard[], charter: CharterArticle[],
): string | undefined {
  if (obj.rule_id === 'A2.voyage_vs_buffer') {
    // INTEGRATION (Beat 2): criticize only blocks when cover < A2 floor — such gaps are
    // not bridgeable by design. Bridge only when no floor is set (legacy/self-check path).
    const cover = Number(/ vs ([\d.]+) d cover/.exec(obj.message)?.[1]);
    const min = charter.find((a) => a.id === 'A2')?.param_value;
    if (min !== undefined && Number.isFinite(cover) && cover < min) return undefined;
    const bridge = all
      .filter((b) => b.id !== option.id
        && (b.lever === 'stock_draw' || b.lever === 'divert_on_water')
        && b.eta_days < option.eta_days)
      .sort((a, b) => a.eta_days - b.eta_days || (a.id < b.id ? -1 : 1))[0];
    if (bridge) return `bridge cover gap via ${bridge.id} (eta ${bridge.eta_days} d) until arrival — ${obj.message}`;
  }
  // ponytail: BLEND normally arrives as a flag; kept so a future BLEND block stays satisfiable.
  if (obj.message.includes('BLEND')) return `blend to spec — ${obj.message}`;
  return undefined;
}

export async function arbitrate(
  options: OptionCard[],
  objections: Objection[],
  charter: CharterArticle[],
  chain: ArbiterChain,
  cache: LlmCache = llmCache,
): Promise<ArbitrationResult> {
  const decided: ArbitratedOptionCard[] = [];
  let audit: AuditEntry[] = [];
  const seed = { seq_start: chain.seq_start, prev_hash: chain.prev_hash };

  for (const option of options) {
    const objs = objections.filter((x) => x.option_id === option.id);
    const blocks = objs.filter((x) => x.severity === 'block');
    const flags = objs.filter((x) => x.severity === 'flag');

    let status: OptionCard['status'];
    let conditions: string[] | undefined;
    if (blocks.length > 0) {
      const blockConds: string[] = [];
      for (const b of blocks) {
        const c = blockCondition(b, option, options, charter);
        if (c !== undefined) blockConds.push(c);
      }
      if (blockConds.length === blocks.length) {
        // every block names a satisfiable condition ⇒ conditional, not rejected
        status = 'conditional';
        conditions = [...new Set([...blockConds, ...flags.map((f) => f.message)])].sort();
      } else {
        status = 'rejected';
      }
    } else if (flags.length > 0) {
      status = 'conditional';
      conditions = [...new Set(flags.map((f) => f.message))].sort();
    } else {
      status = 'validated';
    }

    const out: ArbitratedOptionCard = {
      ...option,
      status,
      ...(conditions ? { conditions } : {}),
      memo: cache[`memo:${option.id}`]?.rationale ?? CACHE_MISS_MEMO,
    };
    decided.push(out);
    audit = await appendEntry(audit, {
      ts_sim: chain.t_sim,
      actor: 'arbiter',
      action: 'arbitrate',
      input: { charter, objections: objs, option },
      output: out,
      refs: [option.id, ...objs.map((x) => x.id)],
      note: status,
    }, seed);
  }
  return { options: decided, audit };
}

// ---------- self check ----------

export async function selfCheck(): Promise<{ name: string; pass: boolean; detail?: string }[]> {
  const card = (id: string, over: Partial<OptionCard> = {}): OptionCard => ({
    id, lever: 'reroute', volume_kb: 100, voyage_days: 10, eta_days: 10, payment_rail: 'GREEN',
    jwc_flag: false, port_ok: true, cover_days_gained: 1, status: 'proposed', evidence: [], ...over,
  });
  const obj = (option_id: string, rule_id: string, severity: Objection['severity'], message: string): Objection => ({
    id: `${rule_id}:${option_id}`, option_id, article: 'A2', rule_id, severity, message, evidence: [], validator: 'selfcheck',
  });
  const chain: ArbiterChain = { t_sim: '2026-01-19T14:22:00Z', seq_start: 0, prev_hash: 'GENESIS' };
  const opts = [card('a'), card('b'), card('c', { eta_days: 40 }), card('d', { lever: 'stock_draw', eta_days: 2 })];
  const objs = [
    obj('a', 'A4.payment_rail', 'block', 'payment rail RED — Article A4'), // no condition ⇒ rejected
    obj('b', 'A4.payment_rail', 'flag', 'payment rail AMBER — Article A4'),
    obj('c', 'A2.voyage_vs_buffer', 'block', '40 d voyage vs 12 d cover buffer — Article A2'), // bridged by d
  ];
  const r1 = await arbitrate(opts, objs, [], chain);
  const r2 = await arbitrate(opts, objs, [], chain);
  const by = (id: string) => r1.options.find((o) => o.id === id);
  return [
    { name: 'lattice: hard block → rejected', pass: by('a')?.status === 'rejected' },
    { name: 'lattice: flag → conditional with sorted messages', pass: by('b')?.status === 'conditional' && by('b')?.conditions?.length === 1 },
    { name: 'lattice: satisfiable block (bridge available) → conditional', pass: by('c')?.status === 'conditional' && !!by('c')?.conditions?.[0].includes('via d (eta 2 d)') },
    { name: 'lattice: clean → validated', pass: by('d')?.status === 'validated' },
    { name: 'memo: cache miss → template', pass: r1.options.every((o) => (o as ArbitratedOptionCard).memo === CACHE_MISS_MEMO) },
    { name: 'audit: one chained entry per option', pass: r1.audit.length === 4 && r1.audit[0].prev_hash === 'GENESIS' && r1.audit.every((e, i) => i === 0 || e.prev_hash === r1.audit[i - 1].output_hash) },
    { name: 'determinism: identical output hashes on re-run', pass: JSON.stringify(r1.audit.map((e) => e.output_hash)) === JSON.stringify(r2.audit.map((e) => e.output_hash)) },
  ];
}
