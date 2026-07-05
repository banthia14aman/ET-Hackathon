// SWE1 — src/engine/replay.ts. Pure replay engine. No store, no React, no I/O.
// Sim time = ISO-8601 UTC 'Z' strings; fixed-width fields mean lexicographic
// string comparison === chronological comparison, so we compare with < / <= directly.

import type { ReplayBundle, ReplayEvent, ReplayStep } from '../contracts/types';

/** Stable order: by t, final tiebreak on id (CONTRACTS.md §3.3). */
function byTThenId(a: ReplayEvent, b: ReplayEvent): number {
  return a.t < b.t ? -1 : a.t > b.t ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Bundle events are contractually pre-sorted, but sort defensively anyway.
    ponytail: O(n log n) per call; cache per bundle if profiling ever cares. */
function ordered(bundle: ReplayBundle): ReplayEvent[] {
  return [...bundle.events].sort(byTThenId);
}

/** Apply exactly the next unapplied event. cursor = index of last applied (-1 = none).
    Returns unchanged cursor + empty events when the bundle is exhausted. */
export function applyNext(cursor: number, bundle: ReplayBundle): ReplayStep {
  const events = ordered(bundle);
  const next = cursor + 1;
  if (next >= events.length) return { cursor, events: [] };
  return { cursor: next, events: [events[next]] };
}

/** Apply all events with t <= t_sim (inclusive), starting after cursor. Used by seek/speed. */
export function applyUntil(cursor: number, bundle: ReplayBundle, t_sim: string): ReplayStep {
  const events = ordered(bundle);
  const applied: ReplayEvent[] = [];
  let c = cursor;
  while (c + 1 < events.length && events[c + 1].t <= t_sim) {
    c += 1;
    applied.push(events[c]);
  }
  return { cursor: c, events: applied };
}

/** Advance sim time by ms. Pure arithmetic on the VALUE via Date.parse/toISOString —
    deterministic (no wall clock is read; the explicit epoch arg satisfies §3.1). */
export function advanceSim(t_sim: string, ms: number): string {
  return new Date(Date.parse(t_sim) + ms).toISOString().replace('.000Z', 'Z');
}

export function bundleStats(bundle: ReplayBundle): {
  count: number;
  t_start: string;
  t_end: string;
  channels: Record<string, number>;
} {
  const events = ordered(bundle);
  const channels: Record<string, number> = {};
  for (const e of events) channels[e.channel] = (channels[e.channel] ?? 0) + 1;
  return {
    count: events.length,
    t_start: events.length ? events[0].t : bundle.t0,
    t_end: events.length ? events[events.length - 1].t : bundle.t0,
    channels,
  };
}

// ---------- self check (wired into scripts/check.mjs by INTEGRATION) ----------

export function selfCheck(): { name: string; pass: boolean; detail?: string }[] {
  const ev = (id: string, t: string): ReplayEvent => ({
    id, t, channel: 'AIS', headline: id, payload: {}, source_ref: 'selfcheck', prov: 'S',
  });
  // 6 events; e2/e3 share a timestamp and are deliberately mis-ordered by id in the array.
  const bundle: ReplayBundle = {
    scenario_id: 'selfcheck', version: '0', t0: '2026-01-01T00:00:00Z',
    events: [
      ev('e1', '2026-01-01T00:00:00Z'),
      ev('e3', '2026-01-01T01:00:00Z'),
      ev('e2', '2026-01-01T01:00:00Z'),
      ev('e4', '2026-01-01T02:00:00Z'),
      ev('e5', '2026-01-01T03:00:00Z'),
      ev('e6', '2026-01-01T04:00:00Z'),
    ],
  };
  const ids = (s: ReplayStep): string => s.events.map((e) => e.id).join(',');
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const check = (name: string, pass: boolean, detail?: string): void => {
    results.push(pass ? { name, pass } : { name, pass, detail });
  };

  const all = applyUntil(-1, bundle, '2026-01-01T04:00:00Z');
  check('ordering stability (equal t → id order)', ids(all) === 'e1,e2,e3,e4,e5,e6', ids(all));

  const boundary = applyUntil(-1, bundle, '2026-01-01T01:00:00Z');
  check('applyUntil boundary inclusivity (t == t_sim applies)',
    boundary.cursor === 2 && ids(boundary) === 'e1,e2,e3', ids(boundary));

  const a = applyNext(1, bundle);
  const b = applyNext(1, bundle);
  check('cursor idempotence (same cursor → identical step)',
    JSON.stringify(a) === JSON.stringify(b) && a.cursor === 2, ids(a));

  const done = applyNext(5, bundle);
  check('exhaustion (cursor unchanged, no events)',
    done.cursor === 5 && done.events.length === 0);

  const t = '2026-01-01T00:00:00Z';
  const rt = advanceSim(advanceSim(t, 90_000), -90_000);
  check('advanceSim roundtrip', rt === t, rt);

  const stats = bundleStats(bundle);
  check('bundleStats', stats.count === 6 && stats.t_start === '2026-01-01T00:00:00Z'
    && stats.t_end === '2026-01-01T04:00:00Z' && stats.channels['AIS'] === 6);

  return results;
}
