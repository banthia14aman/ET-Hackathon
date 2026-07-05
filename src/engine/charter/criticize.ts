// SWE5 — src/engine/charter/criticize.ts. THE ZERO-LLM CRITIC.
// Pure-function validators only: no store, no I/O, no clock, no randomness.
// Output sorted by (option_id, rule_id); Objection.id = `${rule_id}:${option_id}`.

import type {
  ArticleId, CharterArticle, CriticContext, Objection, OptionCard, Severity,
} from '../../contracts/types';

type ValidatorFn = (option: OptionCard, ctx: CriticContext) => Objection[];

function objection(
  rule_id: string, article: ArticleId, validator: string, option: OptionCard,
  severity: Severity, message: string, evidence: string[],
): Objection {
  return { id: `${rule_id}:${option.id}`, option_id: option.id, article, rule_id, severity, message, evidence, validator };
}

function articleParam(charter: CharterArticle[], id: ArticleId): number | undefined {
  return charter.find((a) => a.id === id)?.param_value;
}

// ---------- A5/A2 — assay compatibility ----------

export const assayValidator: ValidatorFn = (o, _ctx) => {
  const ref = o.target_refinery ?? '-';
  if (o.compat_tier === 'CANNOT_RUN') {
    return [objection('A5.assay_compat', 'A5', 'assayValidator', o, 'block',
      `grade ${o.grade ?? '-'} CANNOT_RUN at ${ref} — Article A5`, o.evidence)];
  }
  if (o.compat_tier === 'BLEND') {
    const dims = (o.compat_binding ?? []).slice().sort().join('/') || 'unspecified';
    return [objection('A5.assay_compat', 'A5', 'assayValidator', o, 'flag',
      `grade ${o.grade ?? '-'} needs BLEND at ${ref}: ${dims} binding — Article A5`, o.evidence)];
  }
  return [];
};

// ---------- A2 — voyage time vs cover buffer ----------

export const voyageVsBufferValidator: ValidatorFn = (o, ctx) => {
  if (!o.target_refinery) return [];
  const cover = ctx.scenario.cover_days[o.target_refinery];
  if (cover === undefined) return [];
  const msg = `${o.eta_days} d voyage vs ${Math.round(cover * 10) / 10} d cover buffer — Article A2`;
  if (o.eta_days > cover) {
    // INTEGRATION (Beat 2): below the Article A2 floor a voyage overshoot is a hard
    // exposure (block, unbridgeable); at/above the floor it is manageable (flag).
    const min = articleParam(ctx.charter, 'A2');
    const sev: Severity = min === undefined || cover < min ? 'block' : 'flag';
    return [objection('A2.voyage_vs_buffer', 'A2', 'voyageVsBufferValidator', o, sev, msg, o.evidence)];
  }
  if (o.eta_days > 0.75 * cover) {
    return [objection('A2.voyage_vs_buffer', 'A2', 'voyageVsBufferValidator', o, 'flag', msg, o.evidence)];
  }
  return [];
};

// ---------- A4 — sanctions / payment rail ----------

export const sanctionsValidator: ValidatorFn = (o, _ctx) => {
  if (o.payment_rail === 'RED') {
    return [objection('A4.payment_rail', 'A4', 'sanctionsValidator', o, 'block',
      `payment rail RED for origin ${o.origin ?? '-'} — Article A4`, o.evidence)];
  }
  if (o.payment_rail === 'AMBER') {
    return [objection('A4.payment_rail', 'A4', 'sanctionsValidator', o, 'flag',
      `payment rail AMBER — ${o.payment_note ?? 'no snapshot note on file'} — Article A4`, o.evidence)];
  }
  return [];
};

// ---------- A3 — corridor concentration ----------

/** Corridor node ids this option plausibly transits: corridors on edges into its target
    refinery plus corridors on edges out of its origin supplier.
    ponytail: route-less heuristic — upgrade when OptionCard grows a route field. */
function corridorsFor(o: OptionCard, ctx: CriticContext): string[] {
  const corridorIds = new Set(ctx.graph.nodes.filter((n) => n.type === 'corridor').map((n) => n.id));
  const suppliers = new Set(ctx.graph.nodes
    .filter((n) => n.type === 'supplier' && (n.id === o.origin || n.name === o.origin))
    .map((n) => n.id));
  const hit = new Set<string>();
  for (const e of ctx.graph.edges) {
    if (e.to !== o.target_refinery && !suppliers.has(e.from)) continue;
    for (const id of [e.from, e.to, ...e.via_chokepoints]) if (corridorIds.has(id)) hit.add(id);
  }
  return [...hit].sort();
}

export const concentrationValidator: ValidatorFn = (o, ctx) => {
  const raw = articleParam(ctx.charter, 'A3');
  if (raw === undefined) return [];
  const cap = raw > 1 ? raw / 100 : raw; // accept 0.4 or 40
  const total = ctx.graph.edges.reduce((s, e) => s + e.volume_kbd, 0);
  if (total <= 0) return [];
  const rate = o.volume_kb / Math.max(o.voyage_days, 1); // kb over the voyage ≈ kbd
  let worst: { id: string; share: number } | undefined;
  for (const c of corridorsFor(o, ctx)) {
    const vol = ctx.graph.edges
      .filter((e) => e.from === c || e.to === c || e.via_chokepoints.includes(c))
      .reduce((s, e) => s + e.volume_kbd, 0);
    const share = (vol + rate) / (total + rate);
    if (share > cap && (!worst || share > worst.share || (share === worst.share && c < worst.id))) {
      worst = { id: c, share };
    }
  }
  if (!worst) return [];
  return [objection('A3.concentration', 'A3', 'concentrationValidator', o, 'flag',
    `corridor ${worst.id} share ${(worst.share * 100).toFixed(1)}% exceeds Article A3 cap ${(cap * 100).toFixed(0)}%`,
    o.evidence)];
};

// ---------- A5 — SYNTH provenance freshness ----------

/** Every id/source string in ctx that is labeled prov 'S'. */
function synthRefs(ctx: CriticContext): Set<string> {
  const s = new Set<string>();
  for (const n of ctx.graph.nodes) if (n.prov === 'S') { s.add(n.id); s.add(n.source); }
  for (const g of ctx.grades) if (g.prov === 'S') { s.add(g.id); s.add(g.source); }
  for (const c of ctx.spot) if (c.prov === 'S') { s.add(c.id); s.add(c.source); }
  for (const [k, p] of Object.entries(ctx.calibration)) if (p.prov === 'S') { s.add(k); s.add(p.source_ref); }
  return s;
}

export const freshnessValidator: ValidatorFn = (o, ctx) => {
  const synth = synthRefs(ctx);
  const hits = o.evidence.filter((e) => synth.has(e)).sort();
  const grade = ctx.grades.find((g) => g.id === o.grade);
  if (grade?.prov === 'S') hits.unshift(grade.id);
  if (hits.length === 0) return [];
  return [objection('A5.synth_provenance', 'A5', 'freshnessValidator', o, 'note',
    `derived from SYNTH-labeled data: ${[...new Set(hits)].join(', ')}`, hits)];
};

// ---------- A2 — security floor ----------

export const securityFloorValidator: ValidatorFn = (o, ctx) => {
  const min = articleParam(ctx.charter, 'A2'); // param_key 'min_cover_days'
  if (min === undefined || !o.target_refinery) return [];
  const cover = ctx.scenario.cover_days[o.target_refinery];
  if (cover === undefined || cover >= min) return [];
  const after = cover + o.cover_days_gained;
  if (after >= min) return [];
  return [objection('A2.security_floor', 'A2', 'securityFloorValidator', o, 'note',
    `+${o.cover_days_gained} d gained lifts ${o.target_refinery} to ${after} d, still below Article A2 floor ${min} d`,
    o.evidence)];
};

// ---------- registry + entry point ----------

export const VALIDATORS: { rule_id: string; article: ArticleId; fn: ValidatorFn }[] = [
  { rule_id: 'A2.security_floor', article: 'A2', fn: securityFloorValidator },
  { rule_id: 'A2.voyage_vs_buffer', article: 'A2', fn: voyageVsBufferValidator },
  { rule_id: 'A3.concentration', article: 'A3', fn: concentrationValidator },
  { rule_id: 'A4.payment_rail', article: 'A4', fn: sanctionsValidator },
  { rule_id: 'A5.assay_compat', article: 'A5', fn: assayValidator },
  { rule_id: 'A5.synth_provenance', article: 'A5', fn: freshnessValidator },
];

export function criticize(options: OptionCard[], ctx: CriticContext): Objection[] {
  const out: Objection[] = [];
  for (const o of options) for (const v of VALIDATORS) out.push(...v.fn(o, ctx));
  return out.sort((a, b) =>
    a.option_id < b.option_id ? -1 : a.option_id > b.option_id ? 1 :
    a.rule_id < b.rule_id ? -1 : a.rule_id > b.rule_id ? 1 : 0);
}

// ---------- self check ----------

export function selfCheck(): { name: string; pass: boolean; detail?: string }[] {
  const base: OptionCard = {
    id: 'opt:reroute:g1:r1:0', lever: 'reroute', grade: 'g1', origin: 'X', target_refinery: 'r1',
    volume_kb: 1000, voyage_days: 10, eta_days: 10, payment_rail: 'GREEN', jwc_flag: false,
    port_ok: true, cover_days_gained: 5, status: 'proposed', evidence: ['ev1'],
  };
  const ctx: CriticContext = {
    scenario: { t_sim: '2026-01-19T00:00:00Z', shocks_active: [], node_status: {}, edge_status: {},
      cover_days: { r1: 12 }, gap_kbd: 0, brent_usd: 90 },
    graph: {
      nodes: [
        { id: 'sup:x', type: 'supplier', name: 'X', lat: 0, lon: 0, status: 'ok', prov: 'R', source: 's', as_of: '2026-01-01T00:00:00Z' },
        { id: 'cor:h', type: 'corridor', name: 'H', lat: 0, lon: 0, status: 'ok', prov: 'R', source: 's', as_of: '2026-01-01T00:00:00Z' },
        { id: 'r1', type: 'refinery', name: 'R1', lat: 0, lon: 0, status: 'ok', prov: 'R', source: 's', as_of: '2026-01-01T00:00:00Z' },
      ],
      edges: [
        { id: 'e1', from: 'sup:x', to: 'cor:h', mode: 'vlcc', via_chokepoints: [], transit_days: 5, volume_kbd: 100, cost_usd_bbl: 1, status: 'open' },
        { id: 'e2', from: 'cor:h', to: 'r1', mode: 'vlcc', via_chokepoints: [], transit_days: 5, volume_kbd: 100, cost_usd_bbl: 1, status: 'open' },
        { id: 'e3', from: 'sup:x', to: 'r1', mode: 'pipeline', via_chokepoints: [], transit_days: 1, volume_kbd: 800, cost_usd_bbl: 1, status: 'open' },
      ],
    },
    grades: [{ id: 'g1', name: 'G1', origin_country: 'X', api: 30, sulfur: 1, tan: 0.2, ni_v: 50, resid: 10, pour: -10, prov: 'S', source: 'synth', as_of: '2026-01-01T00:00:00Z' }],
    sanctions: {}, spot: [],
    charter: [
      { id: 'A2', title: 'Security floor', param_key: 'min_cover_days', param_value: 15, description: '' },
      { id: 'A3', title: 'Concentration', param_key: 'max_corridor_share', param_value: 0.25, description: '' },
    ],
    calibration: {},
  };
  const r: { name: string; pass: boolean; detail?: string }[] = [];
  const one = (v: ValidatorFn, o: Partial<OptionCard>): Objection | undefined => v({ ...base, ...o }, ctx)[0];

  const cr = one(assayValidator, { compat_tier: 'CANNOT_RUN' });
  r.push({ name: 'assay: CANNOT_RUN → block', pass: cr?.severity === 'block' });
  const bl = one(assayValidator, { compat_tier: 'BLEND', compat_binding: ['tan', 'sulfur'] });
  r.push({ name: 'assay: BLEND → flag with binding dims', pass: bl?.severity === 'flag' && !!bl?.message.includes('sulfur/tan'), detail: bl?.message });

  const vb = one(voyageVsBufferValidator, { eta_days: 38 });
  r.push({ name: 'voyage: eta > cover → block, exact format', pass: vb?.severity === 'block' && vb?.message === '38 d voyage vs 12 d cover buffer — Article A2', detail: vb?.message });
  r.push({ name: 'voyage: eta > 0.75*cover → flag', pass: one(voyageVsBufferValidator, { eta_days: 10 })?.severity === 'flag' });
  r.push({ name: 'voyage: eta ≤ 0.75*cover → clean', pass: one(voyageVsBufferValidator, { eta_days: 9 }) === undefined });

  r.push({ name: 'sanctions: RED → block', pass: one(sanctionsValidator, { payment_rail: 'RED' })?.severity === 'block' });
  const am = one(sanctionsValidator, { payment_rail: 'AMBER', payment_note: 'OFAC GL 8L snapshot 2026-01-15' });
  r.push({ name: 'sanctions: AMBER → flag with snapshot note', pass: am?.severity === 'flag' && !!am?.message.includes('2026-01-15') });

  const cc = one(concentrationValidator, {}); // (200+100)/(1000+100) = 27.3% > 25%
  r.push({ name: 'concentration: share above A3 cap → flag naming corridor', pass: cc?.severity === 'flag' && !!cc?.message.includes('cor:h') && !!cc?.message.includes('27.3'), detail: cc?.message });

  const fr = one(freshnessValidator, {}); // grade g1 is prov 'S'
  r.push({ name: 'freshness: SYNTH grade → note', pass: fr?.severity === 'note' && !!fr?.message.startsWith('derived from SYNTH-labeled data') });

  const sf = one(securityFloorValidator, { cover_days_gained: 2 }); // 12+2=14 < 15
  r.push({ name: 'security floor: insufficient gain → note', pass: sf?.severity === 'note' });
  r.push({ name: 'security floor: sufficient gain → clean', pass: one(securityFloorValidator, { cover_days_gained: 3 }) === undefined });

  const all = criticize([{ ...base, eta_days: 38 }, { ...base, id: 'opt:a:-:-:0', target_refinery: undefined, origin: undefined, grade: undefined }], ctx);
  const sorted = all.every((o, i) => i === 0 || all[i - 1].option_id < o.option_id
    || (all[i - 1].option_id === o.option_id && all[i - 1].rule_id <= o.rule_id));
  r.push({ name: 'criticize: sorted by (option_id, rule_id), ids well-formed', pass: sorted && all.every((o) => o.id === `${o.rule_id}:${o.option_id}`) });
  return r;
}
