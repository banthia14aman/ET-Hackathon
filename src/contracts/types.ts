// FROZEN — src/contracts/types.ts. Owned by TEAM LEAD. Change only via lead + CONTRACTS.md bump.
// Every module imports from here. Do NOT redefine these shapes locally.

export type Prov = 'R' | 'E' | 'S'; // Real | Estimated | Synthetic
export type Channel = 'AIS' | 'UKMTO' | 'MARAD' | 'JWC' | 'GDELT' | 'PRICE' | 'MILESTONE';
export type NodeType = 'supplier' | 'corridor' | 'chokepoint' | 'port' | 'refinery';
export type NodeStatus = 'ok' | 'stressed' | 'critical';
export type EdgeMode = 'vlcc' | 'suezmax' | 'pipeline';
export type EdgeStatus = 'open' | 'risk' | 'closed';
export type Lever = 'stock_draw' | 'divert_on_water' | 'floating_storage' | 'reroute' | 'demand_side';
export type CompatTier = 'RUN_NOW' | 'BLEND' | 'CANNOT_RUN';
export type PaymentRail = 'GREEN' | 'AMBER' | 'RED';
export type OptionStatus = 'proposed' | 'validated' | 'conditional' | 'rejected';
export type ArticleId = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';
export type Severity = 'block' | 'flag' | 'note';
export type Actor = 'proposer' | 'critic' | 'arbiter' | 'user' | 'system';

export interface ReplayEvent {
  id: string;
  t: string; // ISO 8601 UTC, e.g. '2026-01-19T14:22:00Z' — the ONLY clock in the system
  channel: Channel;
  headline: string;
  payload: Record<string, unknown>;
  source_ref: string;
  source_url?: string;
  prov: Prov;
  geo?: [number, number]; // [lat, lon]
  triggers?: string[]; // shock ids this event activates (consumed by scenario.rescore)
}

export interface ReplayBundle {
  scenario_id: string;
  version: string;
  t0: string; // ISO 8601
  events: ReplayEvent[]; // MUST be pre-sorted ascending by t, then id
}

export interface AssayEnv {
  api: [number, number];
  sulfur: [number, number];
  tan: [number, number];
  ni_v: [number, number];
  resid: [number, number];
  pour: [number, number];
}

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  lat: number;
  lon: number;
  capacity_kbd?: number;
  assay_env?: AssayEnv; // refineries only
  cover_days?: number; // refineries only — baseline days-of-cover
  port_limits?: { spm: boolean; draft_m: number };
  status: NodeStatus;
  prov: Prov;
  source: string;
  as_of: string; // ISO 8601
}

export interface GraphEdge {
  id: string;
  from: string; // GraphNode.id
  to: string; // GraphNode.id
  mode: EdgeMode;
  via_chokepoints: string[]; // GraphNode.id[]
  transit_days: number;
  volume_kbd: number;
  cost_usd_bbl: number;
  status: EdgeStatus;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CrudeGrade {
  id: string;
  name: string;
  origin_country: string;
  api: number;
  sulfur: number;
  tan: number;
  ni_v: number;
  resid: number;
  pour: number;
  prov: Prov;
  source: string;
  as_of: string;
}

export interface OptionCard {
  id: string; // deterministic: 'opt:<lever>:<grade|->:<target_refinery|->:<n>'
  lever: Lever;
  grade?: string; // CrudeGrade.id
  origin?: string; // origin_country
  target_refinery?: string; // GraphNode.id
  volume_kb: number;
  voyage_days: number;
  eta_days: number;
  compat_tier?: CompatTier;
  compat_binding?: string[]; // which assay constraints bind, e.g. ['sulfur','tan']
  payment_rail: PaymentRail;
  payment_note?: string;
  jwc_flag: boolean; // route crosses a JWC listed area
  port_ok: boolean; // fits target port draft/SPM limits
  cost_delta_usd_bbl?: number;
  cover_days_gained: number;
  status: OptionStatus;
  conditions?: string[]; // set by arbiter when status === 'conditional'
  evidence: string[]; // ReplayEvent ids and/or source_refs
  // Advisory prediction from the frozen refinery-compatibility model (src/engine/refinery_model.ts).
  // The deterministic critic remains the authority; this surfaces a learned confidence in the UI.
  model_tier?: CompatTier;
  model_confidence?: number;
}

export interface Objection {
  id: string; // deterministic: '<rule_id>:<option_id>'
  option_id: string;
  article: ArticleId;
  rule_id: string; // e.g. 'A3.jwc_zone'
  severity: Severity;
  message: string;
  evidence: string[];
  validator: string; // pure-function name that emitted this
}

export interface CharterArticle {
  id: ArticleId;
  title: string;
  param_key?: string; // e.g. 'min_cover_days'
  param_value?: number; // user-tunable via setCharterParam
  description: string;
}

export interface AuditEntry {
  seq: number; // monotonic from 0
  ts_sim: string; // sim time ISO 8601 — NEVER wall clock
  actor: Actor;
  action: string; // e.g. 'propose', 'criticize', 'arbitrate', 'set_charter_param'
  input_hash: string; // sha256Hex(canonicalJson(input))
  output_hash: string;
  prev_hash: string; // output_hash of previous entry; 'GENESIS' for seq 0
  refs: string[];
  note?: string;
}

export interface ScenarioState {
  t_sim: string; // ISO 8601
  shocks_active: string[]; // sorted ascending
  node_status: Record<string, NodeStatus>;
  edge_status: Record<string, EdgeStatus>;
  cover_days: Record<string, number>; // refinery node id -> days
  gap_kbd: number;
  brent_usd: number;
}

// ---------- engine I/O shapes (referenced by the frozen signatures in CONTRACTS.md) ----------

/** Result of applying replay events. cursor = index of LAST applied event (-1 = none). */
export interface ReplayStep {
  cursor: number;
  events: ReplayEvent[]; // the events applied by this call, in bundle order
}

/** Accumulated shock context fed to scenario.rescore. Derived by integration from applied events. */
export interface ShockContext {
  t_sim: string;
  shocks_active: string[]; // union of ReplayEvent.triggers of all applied events, sorted
  brent_usd: number; // latest PRICE event value; calibration baseline before first PRICE event
}

export interface CalibrationParam {
  value: number;
  min: number;
  max: number;
  unit?: string;
  source_ref: string; // event id or external source that justifies the range
  prov: Prov;
}
export type Calibration = Record<string, CalibrationParam>;

export interface SanctionRule {
  rail: PaymentRail;
  note: string;
}
export type SanctionsRules = Record<string, SanctionRule>; // key: origin_country

export interface SpotCargo {
  id: string;
  grade_id: string; // CrudeGrade.id
  origin_country: string;
  volume_kb: number;
  loading_port: string;
  avail_from_day: number; // sim-days after bundle t0
  prov: Prov;
  source: string;
}

export interface LlmCacheEntry {
  rationale: string; // pre-generated at build time by scripts/generate-llm-cache.mjs
  model: string;
  prompt_hash: string;
}
export type LlmCache = Record<string, LlmCacheEntry>; // key: OptionCard.id

/** Everything the ZERO-LLM critic validators may read. Nothing else. */
export interface CriticContext {
  scenario: ScenarioState;
  graph: Graph;
  grades: CrudeGrade[];
  sanctions: SanctionsRules;
  spot: SpotCargo[];
  charter: CharterArticle[];
  calibration: Calibration;
}

/** Hash-chain continuation input for the arbiter. */
export interface ArbiterChain {
  t_sim: string;
  seq_start: number; // next AuditEntry.seq to emit
  prev_hash: string; // output_hash of the last existing AuditEntry, or 'GENESIS'
}

export interface ArbitrationResult {
  options: OptionCard[]; // final statuses: validated | conditional | rejected
  audit: AuditEntry[]; // new entries only, hash-chained from ArbiterChain.prev_hash
}
