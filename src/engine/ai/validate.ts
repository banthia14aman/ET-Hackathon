// THE GUARDRAIL — deterministic validation of LLM-extracted candidate facts.
// Pure: no clock, no network, no randomness. Every candidate field is checked against
// (1) the strict Zod schema and (2) domain rules over the real data (known chokepoints,
// grades, refineries, plausible ranges, charter bounds). Anything that fails is DROPPED
// with a reason and NEVER reaches scoring. This is what makes the LLM safe to use for intake.

import type {
  CandidateFacts, CharterArticle, FieldRejection, ShockContext, SpotCargo, StaticData,
} from './deps';
import { CandidateShockSchema, CandidateCargoSchema, CandidateCharterSchema } from '../../contracts/schemas';

export interface Validated {
  validated: CandidateFacts;
  rejected: FieldRejection[];
}

const BRENT_MIN = 10;
const BRENT_MAX = 500;
// Charter params the engine actually honours, with hard bounds.
const CHARTER_BOUNDS: Record<string, { key: string; min: number; max: number; int: boolean }> = {
  A2: { key: 'min_cover_days', min: 0, max: 90, int: true },
  A3: { key: 'max_corridor_share', min: 0, max: 1, int: false },
};

const KNOWN_KEYS = new Set(['shocks', 'brent_usd', 'cargoes', 'charter', 'summary']);

/** Validate candidate facts field-by-field: STRICT element schemas + domain rules over the real
    data. Field-resilient — one bad field is dropped with a reason, the rest survive. Deterministic. */
export function validateFacts(candidates: CandidateFacts, data: StaticData): Validated {
  const rejected: FieldRejection[] = [];
  const v: CandidateFacts = {};
  const c = (candidates ?? {}) as Record<string, unknown>;

  // (0) reject any unknown top-level key the LLM tried to smuggle in (e.g. a "score")
  for (const k of Object.keys(c)) {
    if (!KNOWN_KEYS.has(k)) rejected.push({ field: k, value: JSON.stringify(c[k]).slice(0, 40), reason: 'unknown field (not in the intake schema)' });
  }

  // known ids from the real data
  const chokeKeys = new Set(data.graph.nodes.filter((n) => n.type === 'chokepoint').map((n) => n.id.replace(/^ck:/, '')));
  const refIds = new Set(data.graph.nodes.filter((n) => n.type === 'refinery').map((n) => n.id));
  const gradeIds = new Set(data.grades.map((g) => g.id));

  // (1) shocks — strict element schema + chokepoint must be a real node
  if (Array.isArray(c.shocks)) {
    const ok: NonNullable<CandidateFacts['shocks']> = [];
    for (const raw of c.shocks) {
      const p = CandidateShockSchema.safeParse(raw);
      if (!p.success) { rejected.push({ field: 'shocks', value: JSON.stringify(raw).slice(0, 40), reason: `schema: ${p.error.issues[0]?.message}` }); continue; }
      if (!chokeKeys.has(p.data.chokepoint)) { rejected.push({ field: `shocks.${p.data.chokepoint}`, value: `${p.data.chokepoint}/${p.data.severity}`, reason: 'unknown chokepoint (not in the graph)' }); continue; }
      ok.push(p.data);
    }
    if (ok.length) v.shocks = ok;
  }

  // (2) brent — finite, plausible
  if (c.brent_usd !== undefined) {
    const n = c.brent_usd;
    if (typeof n === 'number' && Number.isFinite(n) && n >= BRENT_MIN && n <= BRENT_MAX) v.brent_usd = n;
    else rejected.push({ field: 'brent_usd', value: String(n), reason: `out of range [${BRENT_MIN}, ${BRENT_MAX}]` });
  }

  // (3) cargoes — strict element schema + grade/refinery must exist
  if (Array.isArray(c.cargoes)) {
    const ok: NonNullable<CandidateFacts['cargoes']> = [];
    for (const raw of c.cargoes) {
      const p = CandidateCargoSchema.safeParse(raw);
      if (!p.success) { rejected.push({ field: 'cargoes', value: JSON.stringify(raw).slice(0, 40), reason: `schema: ${p.error.issues[0]?.message}` }); continue; }
      const cargo = p.data;
      if (cargo.grade && !gradeIds.has(cargo.grade)) { rejected.push({ field: 'cargoes.grade', value: cargo.grade, reason: 'unknown crude grade' }); continue; }
      if (cargo.target_refinery && !refIds.has(cargo.target_refinery)) { rejected.push({ field: 'cargoes.target_refinery', value: cargo.target_refinery, reason: 'unknown refinery' }); continue; }
      if (!cargo.grade && !cargo.target_refinery) { rejected.push({ field: 'cargoes', value: JSON.stringify(cargo), reason: 'no grade or refinery to act on' }); continue; }
      ok.push(cargo);
    }
    if (ok.length) v.cargoes = ok;
  }

  // (4) charter overrides — strict element schema + only honoured articles, within bounds
  if (Array.isArray(c.charter)) {
    const ok: NonNullable<CandidateFacts['charter']> = [];
    for (const raw of c.charter) {
      const p = CandidateCharterSchema.safeParse(raw);
      if (!p.success) { rejected.push({ field: 'charter', value: JSON.stringify(raw).slice(0, 40), reason: `schema: ${p.error.issues[0]?.message}` }); continue; }
      const o = p.data; const b = CHARTER_BOUNDS[o.article];
      if (!b) { rejected.push({ field: `charter.${o.article}`, value: String(o.value), reason: 'article has no tunable parameter' }); continue; }
      if (o.value < b.min || o.value > b.max || (b.int && !Number.isInteger(o.value))) {
        rejected.push({ field: `charter.${o.article}`, value: String(o.value), reason: `out of bounds [${b.min}, ${b.max}]${b.int ? ' (integer)' : ''}` }); continue;
      }
      ok.push(o);
    }
    if (ok.length) v.charter = ok;
  }

  if (typeof c.summary === 'string') v.summary = c.summary.slice(0, 600);
  return { validated: v, rejected };
}

/** Turn VALIDATED facts into the deterministic engine's inputs. Pure. */
export function factsToInputs(
  validated: CandidateFacts, baseCharter: CharterArticle[], data: StaticData,
): { shocks: ShockContext; charter: CharterArticle[]; data: StaticData } {
  const shocks_active = (validated.shocks ?? [])
    .map((s) => `shock:${s.chokepoint}-${s.severity}`).sort();
  const brent = validated.brent_usd ?? (data.calibration.brent_baseline_usd?.value ?? 71);
  const shocks: ShockContext = { t_sim: '2027-01-01T00:00:00Z', shocks_active, brent_usd: brent };

  // apply validated charter overrides
  const overrides = new Map((validated.charter ?? []).map((o) => [o.article, o.value]));
  const charter = baseCharter.map((a) =>
    overrides.has(a.id) ? { ...a, param_value: overrides.get(a.id) } : a);

  // inject validated cargoes as spot availability (deterministic synthesis; the reroute lever
  // only acts on them if a usable edge exists — otherwise they are validated-but-unscored)
  const extraSpot: SpotCargo[] = (validated.cargoes ?? []).map((cargo, i) => {
    const g = data.grades.find((x) => x.id === cargo.grade);
    const origin = cargo.origin || g?.origin_country || 'Unknown';
    const supplier = data.graph.nodes.find((n) => n.type === 'supplier'
      && (n.name.toLowerCase().includes(origin.toLowerCase()) || n.id.includes((cargo.grade ?? '').replace('gr:', '').split('-')[0])));
    return {
      id: `sc:ai-${i}-${(cargo.grade ?? 'x').replace('gr:', '')}`,
      grade_id: cargo.grade ?? '',
      origin_country: origin,
      volume_kb: cargo.volume_kb ?? 1000,
      loading_port: supplier?.id ?? 'sup:unknown',
      avail_from_day: 5,
      prov: 'E' as const, source: 'AI-extracted, human-validated intake',
      as_of: '2026-03-01T00:00:00Z',
    };
  }).filter((s) => s.grade_id && data.grades.some((g) => g.id === s.grade_id));

  const data2: StaticData = extraSpot.length ? { ...data, spot: [...data.spot, ...extraSpot] } : data;
  return { shocks, charter, data: data2 };
}
