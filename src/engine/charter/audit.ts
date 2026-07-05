// SWE5 — src/engine/charter/audit.ts. Immutable hash-chained audit log.
// Hashing exclusively sha256Hex(canonicalJson(x)) per CONTRACTS.md §3.5.

import { canonicalJson, sha256Hex } from '../../lib/canonical';
import type { Actor, AuditEntry } from '../../contracts/types';

export interface EntryParts {
  ts_sim: string; // sim time — NEVER wall clock
  actor: Actor;
  action: string;
  input: unknown; // hashed, not stored
  output: unknown; // hashed, not stored
  refs: string[];
  note?: string;
}

/** Continuation seed when `chain` is empty (e.g. resuming from ArbiterChain). */
export interface ChainSeed { seq_start: number; prev_hash: string }

const HEX64 = /^[0-9a-f]{64}$/;

/** Append one entry, returning a NEW chain (input untouched). */
export async function appendEntry(
  chain: AuditEntry[], parts: EntryParts, seed?: ChainSeed,
): Promise<AuditEntry[]> {
  const last = chain[chain.length - 1];
  const entry: AuditEntry = {
    seq: last ? last.seq + 1 : seed?.seq_start ?? 0,
    ts_sim: parts.ts_sim,
    actor: parts.actor,
    action: parts.action,
    input_hash: await sha256Hex(canonicalJson(parts.input)),
    output_hash: await sha256Hex(canonicalJson(parts.output)),
    prev_hash: last ? last.output_hash : seed?.prev_hash ?? 'GENESIS',
    refs: parts.refs,
    ...(parts.note !== undefined ? { note: parts.note } : {}),
  };
  return [...chain, entry];
}

/** Re-walk every link: seq monotonic, prev_hash === prior output_hash, hashes well-formed,
    seq-0 entries anchored at 'GENESIS'. */
export function verifyChain(chain: AuditEntry[]): boolean {
  for (let i = 0; i < chain.length; i++) {
    const e = chain[i];
    if (!HEX64.test(e.input_hash) || !HEX64.test(e.output_hash)) return false;
    if (i === 0) {
      if (e.seq === 0 && e.prev_hash !== 'GENESIS') return false;
      if (e.seq !== 0 && !HEX64.test(e.prev_hash)) return false;
    } else {
      if (e.seq !== chain[i - 1].seq + 1) return false;
      if (e.prev_hash !== chain[i - 1].output_hash) return false;
    }
  }
  return true;
}

/** All entries referencing an option id, in chain order. */
export function traceForOption(chain: AuditEntry[], optionId: string): AuditEntry[] {
  return chain.filter((e) => e.refs.includes(optionId));
}

// ---------- self check ----------

export async function selfCheck(): Promise<{ name: string; pass: boolean; detail?: string }[]> {
  const t = '2026-01-19T14:22:00Z';
  let chain: AuditEntry[] = [];
  chain = await appendEntry(chain, { ts_sim: t, actor: 'arbiter', action: 'arbitrate', input: { a: 1 }, output: { b: 2 }, refs: ['opt:x'] });
  chain = await appendEntry(chain, { ts_sim: t, actor: 'arbiter', action: 'arbitrate', input: { a: 2 }, output: { b: 3 }, refs: ['opt:y'], note: 'n' });
  chain = await appendEntry(chain, { ts_sim: t, actor: 'system', action: 'tick', input: null, output: null, refs: ['opt:x', 'opt:y'] });
  const tampered = chain.map((e, i) => (i === 1 ? { ...e, output_hash: 'f'.repeat(64) } : e));
  const seeded = await appendEntry([], { ts_sim: t, actor: 'arbiter', action: 'a', input: 1, output: 2, refs: [] }, { seq_start: 7, prev_hash: 'a'.repeat(64) });
  return [
    { name: 'audit: genesis + linkage verifies', pass: chain[0].prev_hash === 'GENESIS' && verifyChain(chain) },
    { name: 'audit: tampered link fails verify', pass: !verifyChain(tampered) },
    { name: 'audit: appendEntry immutable', pass: chain.length === 3 },
    { name: 'audit: seed continues seq/prev_hash', pass: seeded[0].seq === 7 && seeded[0].prev_hash === 'a'.repeat(64) && verifyChain(seeded) },
    { name: 'audit: traceForOption filters by ref', pass: traceForOption(chain, 'opt:x').length === 2 && traceForOption(chain, 'opt:y').length === 2 },
  ];
}
