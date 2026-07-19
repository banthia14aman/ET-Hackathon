// FEED ADAPTERS — the "going live is a license key, not a rewrite" boundary, as code.
// Every signal source implements the same 3-method interface: pull raw payloads, normalize
// them into ReplayEvents, emit them in time order. The engine consumes ONLY emitted
// ReplayEvents, so swapping the replay bundle for a live AIS/news feed changes the adapter,
// never the reasoning. PURE + deterministic: no network, no clock (the production adapters
// are stubs by design — marked "production license" — so this module passes the determinism
// scan; a live adapter would live behind the same interface in its own excepted layer).

import type { ReplayBundle, ReplayEvent } from '../contracts/types';

/** The 3-method adapter contract every feed source implements. */
export interface FeedAdapter<Raw = unknown> {
  /** Name + provenance of the source (shown on provenance chips). */
  readonly source: string;
  /** Pull raw payloads from the source (a file, a socket, an API page). */
  pull(): Raw[];
  /** Normalize one raw payload into the engine's ReplayEvent shape. */
  normalize(raw: Raw): ReplayEvent;
  /** Emit all events, normalized and sorted by event time — the ONLY thing the engine sees. */
  emit(): ReplayEvent[];
}

/** The adapter behind today's demo: replays the committed, provenance-labelled bundle.
    Raw type IS ReplayEvent — the bundle is pre-normalized at build time. */
export class ReplayAdapter implements FeedAdapter<ReplayEvent> {
  readonly source: string;
  private bundle: ReplayBundle;
  constructor(bundle: ReplayBundle) { this.bundle = bundle; this.source = `replay:${bundle.scenario_id ?? 'bundle'}`; }
  pull(): ReplayEvent[] { return [...this.bundle.events]; }
  normalize(raw: ReplayEvent): ReplayEvent { return raw; }
  emit(): ReplayEvent[] {
    return this.pull().map((r) => this.normalize(r))
      .sort((a, b) => a.t.localeCompare(b.t) || a.id.localeCompare(b.id));
  }
}

/** Production-feed stubs: same contract, ~a license key away. They throw rather than fake. */
function licenseStub(source: string): FeedAdapter<never> {
  return {
    source,
    pull(): never[] { throw new Error(`${source}: production license required — adapter stub`); },
    normalize(): never { throw new Error(`${source}: production license required — adapter stub`); },
    emit(): never[] { throw new Error(`${source}: production license required — adapter stub`); },
  };
}
export const SpireAdapter = licenseStub('spire:maritime-ais');   // live AIS positions
export const KplerAdapter = licenseStub('kpler:cargo-flows');    // live cargo flows

// ---------- self check ----------

export function selfCheck(bundle: ReplayBundle): { name: string; pass: boolean; detail?: string }[] {
  const adapter = new ReplayAdapter(bundle);
  const emitted = adapter.emit();
  const sameIds = emitted.length === bundle.events.length
    && emitted.every((e, i) => e.id === [...bundle.events].sort((a, b) => a.t.localeCompare(b.t) || a.id.localeCompare(b.id))[i].id);
  let stubThrows = false;
  try { SpireAdapter.emit(); } catch { stubThrows = true; }
  return [
    { name: 'feeds: ReplayAdapter emits the exact bundle (normalized, time-ordered)', pass: sameIds },
    { name: 'feeds: emit is idempotent (same events every call)', pass: JSON.stringify(adapter.emit()) === JSON.stringify(emitted) },
    { name: 'feeds: production stubs refuse to fake data (throw, never fabricate)', pass: stubThrows },
  ];
}
