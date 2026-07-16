// FROZEN — src/contracts/schemas.ts. Owned by TEAM LEAD.
// Zod runtime mirrors of types.ts. Each schema is pinned to its interface via
// z.ZodType<T> so any drift between the two files is a compile error.

import { z } from 'zod';
import type {
  AssayEnv,
  AuditEntry,
  Calibration,
  CharterArticle,
  CrudeGrade,
  GraphEdge,
  GraphNode,
  LlmCache,
  Objection,
  OptionCard,
  ReplayBundle,
  ReplayEvent,
  SanctionsRules,
  ScenarioState,
  SpotCargo,
} from './types';

export const ProvSchema = z.enum(['R', 'E', 'S']);
export const ChannelSchema = z.enum(['AIS', 'UKMTO', 'MARAD', 'JWC', 'GDELT', 'PRICE', 'MILESTONE']);
export const NodeStatusSchema = z.enum(['ok', 'stressed', 'critical']);
export const EdgeStatusSchema = z.enum(['open', 'risk', 'closed']);
export const PaymentRailSchema = z.enum(['GREEN', 'AMBER', 'RED']);
export const SeveritySchema = z.enum(['block', 'flag', 'note']);
export const ArticleIdSchema = z.enum(['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);

const range = z.tuple([z.number(), z.number()]);

export const ReplayEventSchema: z.ZodType<ReplayEvent> = z.object({
  id: z.string().min(1),
  t: z.string().datetime(),
  channel: ChannelSchema,
  headline: z.string().min(1),
  payload: z.record(z.unknown()),
  source_ref: z.string().min(1),
  source_url: z.string().url().optional(),
  prov: ProvSchema,
  geo: range.optional(),
  triggers: z.array(z.string()).optional(),
});

export const ReplayBundleSchema: z.ZodType<ReplayBundle> = z.object({
  scenario_id: z.string().min(1),
  version: z.string().min(1),
  t0: z.string().datetime(),
  events: z.array(ReplayEventSchema),
});

export const AssayEnvSchema: z.ZodType<AssayEnv> = z.object({
  api: range,
  sulfur: range,
  tan: range,
  ni_v: range,
  resid: range,
  pour: range,
});

export const GraphNodeSchema: z.ZodType<GraphNode> = z.object({
  id: z.string().min(1),
  type: z.enum(['supplier', 'corridor', 'chokepoint', 'port', 'refinery']),
  name: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  capacity_kbd: z.number().nonnegative().optional(),
  assay_env: AssayEnvSchema.optional(),
  cover_days: z.number().nonnegative().optional(),
  port_limits: z.object({ spm: z.boolean(), draft_m: z.number() }).optional(),
  status: NodeStatusSchema,
  prov: ProvSchema,
  source: z.string().min(1),
  as_of: z.string(),
});

export const GraphEdgeSchema: z.ZodType<GraphEdge> = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  mode: z.enum(['vlcc', 'suezmax', 'pipeline']),
  via_chokepoints: z.array(z.string()),
  transit_days: z.number().nonnegative(),
  volume_kbd: z.number().nonnegative(),
  cost_usd_bbl: z.number(),
  status: EdgeStatusSchema,
});

export const CrudeGradeSchema: z.ZodType<CrudeGrade> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  origin_country: z.string().min(1),
  api: z.number(),
  sulfur: z.number(),
  tan: z.number(),
  ni_v: z.number(),
  resid: z.number(),
  pour: z.number(),
  prov: ProvSchema,
  source: z.string().min(1),
  as_of: z.string(),
});

export const OptionCardSchema: z.ZodType<OptionCard> = z.object({
  id: z.string().min(1),
  lever: z.enum(['stock_draw', 'divert_on_water', 'floating_storage', 'reroute', 'demand_side']),
  grade: z.string().optional(),
  origin: z.string().optional(),
  target_refinery: z.string().optional(),
  volume_kb: z.number().nonnegative(),
  voyage_days: z.number().nonnegative(),
  eta_days: z.number().nonnegative(),
  compat_tier: z.enum(['RUN_NOW', 'BLEND', 'CANNOT_RUN']).optional(),
  compat_binding: z.array(z.string()).optional(),
  payment_rail: PaymentRailSchema,
  payment_note: z.string().optional(),
  jwc_flag: z.boolean(),
  port_ok: z.boolean(),
  cost_delta_usd_bbl: z.number().optional(),
  cover_days_gained: z.number(),
  status: z.enum(['proposed', 'validated', 'conditional', 'rejected']),
  conditions: z.array(z.string()).optional(),
  evidence: z.array(z.string()),
});

export const ObjectionSchema: z.ZodType<Objection> = z.object({
  id: z.string().min(1),
  option_id: z.string().min(1),
  article: ArticleIdSchema,
  rule_id: z.string().min(1),
  severity: SeveritySchema,
  message: z.string().min(1),
  evidence: z.array(z.string()),
  validator: z.string().min(1),
});

export const CharterArticleSchema: z.ZodType<CharterArticle> = z.object({
  id: ArticleIdSchema,
  title: z.string().min(1),
  param_key: z.string().optional(),
  param_value: z.number().optional(),
  description: z.string(),
});

export const AuditEntrySchema: z.ZodType<AuditEntry> = z.object({
  seq: z.number().int().nonnegative(),
  ts_sim: z.string(),
  actor: z.enum(['proposer', 'critic', 'arbiter', 'user', 'system']),
  action: z.string().min(1),
  input_hash: z.string(),
  output_hash: z.string(),
  prev_hash: z.string(),
  refs: z.array(z.string()),
  note: z.string().optional(),
});

export const ScenarioStateSchema: z.ZodType<ScenarioState> = z.object({
  t_sim: z.string(),
  shocks_active: z.array(z.string()),
  node_status: z.record(NodeStatusSchema),
  edge_status: z.record(EdgeStatusSchema),
  cover_days: z.record(z.number()),
  gap_kbd: z.number(),
  brent_usd: z.number(),
});

// ---------- data-file schemas (what PM1 produces, what check.mjs validates) ----------

export const SanctionsRulesSchema: z.ZodType<SanctionsRules> = z.record(
  z.object({ rail: PaymentRailSchema, note: z.string(), as_of: z.string().optional() }),
);

export const CalibrationSchema: z.ZodType<Calibration> = z.record(
  z.object({
    value: z.number(),
    min: z.number(),
    max: z.number(),
    unit: z.string().optional(),
    source_ref: z.string().min(1),
    prov: ProvSchema,
  }),
);

export const SpotCargoSchema: z.ZodType<SpotCargo> = z.object({
  id: z.string().min(1),
  grade_id: z.string().min(1),
  origin_country: z.string().min(1),
  volume_kb: z.number().nonnegative(),
  loading_port: z.string().min(1),
  avail_from_day: z.number().nonnegative(),
  prov: ProvSchema,
  source: z.string().min(1),
  as_of: z.string().optional(),
});

export const LlmCacheSchema: z.ZodType<LlmCache> = z.record(
  z.object({ rationale: z.string().min(1), model: z.string().min(1), prompt_hash: z.string().min(1) }),
);

export const GraphNodesFileSchema = z.array(GraphNodeSchema);
export const GraphEdgesFileSchema = z.array(GraphEdgeSchema);
export const GradesFileSchema = z.array(CrudeGradeSchema);
export const CharterFileSchema = z.array(CharterArticleSchema).length(7);
export const SpotAvailabilityFileSchema = z.array(SpotCargoSchema);
