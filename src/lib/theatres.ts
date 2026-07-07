// "Scale is config, not code." A theatre is just a data bundle the SAME engine runs — no engine
// change. The primary theatre (India crude, 2026 Hormuz) is the real replay; the alternate below
// is a clearly-labelled ILLUSTRATIVE config (prov S) that proves the engine is region/commodity-
// agnostic: flip to it and the identical pipeline reasons about a different world.

import type { AssayEnv, CharterArticle, CrudeGrade, Graph, GraphNode, NodeType, SanctionsRules, ShockContext, SpotCargo } from '../contracts/types';
import type { StaticData } from './pipeline';

const src = 'illustrative theatre — proves the engine is region/commodity-agnostic (same code, new config)';
const S = { prov: 'S' as const, source: src, as_of: '2026-07-07T00:00:00Z' };
// a medium crude envelope reused for the European refineries
const ENV: AssayEnv = { api: [20, 45], sulfur: [0, 3.6], tan: [0, 1.5], ni_v: [0, 250], resid: [0, 50], pour: [-30, 30] };

const node = (id: string, type: NodeType, name: string, lat: number, lon: number, extra: Partial<GraphNode> = {}): GraphNode =>
  ({ id, type, name, lat, lon, status: 'ok', ...S, ...extra });

const EUROPE_GRAPH: Graph = {
  nodes: [
    node('sup:us-gulf', 'supplier', 'US Gulf Coast (WTI)', 27.8, -93.5),
    node('sup:nigeria', 'supplier', 'Nigeria (Bonny Light)', 4.4, 7.2),
    node('sup:cpc', 'supplier', 'CPC Blend — Novorossiysk (Black Sea)', 44.6, 37.8),
    node('sup:saudi', 'supplier', 'Saudi Arabia — Ras Tanura', 26.6, 50.2),
    node('sup:libya', 'supplier', 'Libya — Es Sider', 30.9, 18.3),
    node('ck:bosphorus', 'chokepoint', 'Bosphorus Strait', 41.1, 29.1),
    node('ck:gibraltar', 'chokepoint', 'Strait of Gibraltar', 35.95, -5.6),
    node('ck:suez', 'chokepoint', 'Suez Canal / SUMED', 30.5, 32.35),
    node('ref:rotterdam', 'refinery', 'Rotterdam (Pernis)', 51.9, 4.3, { capacity_kbd: 400, cover_days: 20, assay_env: ENV }),
    node('ref:fos', 'refinery', 'Fos-sur-Mer (Marseille)', 43.4, 4.9, { capacity_kbd: 300, cover_days: 16, assay_env: ENV }),
    node('ref:trieste', 'refinery', 'Trieste → Schwechat', 45.6, 13.7, { capacity_kbd: 200, cover_days: 14, assay_env: ENV }),
    node('ref:sicily', 'refinery', 'Sicily (Augusta/Priolo)', 37.2, 15.2, { capacity_kbd: 320, cover_days: 15, assay_env: ENV }),
    node('ref:algeciras', 'refinery', 'Algeciras (Gibraltar)', 36.1, -5.4, { capacity_kbd: 250, cover_days: 18, assay_env: ENV }),
  ],
  edges: [
    // Caspian (CPC) crude to Med refineries — all via the Bosphorus (the strait that gets shocked)
    { id: 'e:cpc-trieste', from: 'sup:cpc', to: 'ref:trieste', mode: 'suezmax', via_chokepoints: ['ck:bosphorus'], transit_days: 7, volume_kbd: 180, cost_usd_bbl: 2.2, status: 'open' },
    { id: 'e:cpc-fos', from: 'sup:cpc', to: 'ref:fos', mode: 'suezmax', via_chokepoints: ['ck:bosphorus'], transit_days: 8, volume_kbd: 200, cost_usd_bbl: 2.4, status: 'open' },
    { id: 'e:cpc-sicily', from: 'sup:cpc', to: 'ref:sicily', mode: 'suezmax', via_chokepoints: ['ck:bosphorus'], transit_days: 6, volume_kbd: 150, cost_usd_bbl: 2.1, status: 'open' },
    // alternatives that AVOID the Bosphorus (the reroute paths the critic will weigh)
    { id: 'e:saudi-fos', from: 'sup:saudi', to: 'ref:fos', mode: 'vlcc', via_chokepoints: ['ck:suez'], transit_days: 12, volume_kbd: 60, cost_usd_bbl: 3.0, status: 'open' },
    { id: 'e:saudi-trieste', from: 'sup:saudi', to: 'ref:trieste', mode: 'vlcc', via_chokepoints: ['ck:suez'], transit_days: 13, volume_kbd: 50, cost_usd_bbl: 3.2, status: 'open' },
    { id: 'e:libya-fos', from: 'sup:libya', to: 'ref:fos', mode: 'suezmax', via_chokepoints: [], transit_days: 3, volume_kbd: 60, cost_usd_bbl: 1.8, status: 'open' },
    { id: 'e:libya-trieste', from: 'sup:libya', to: 'ref:trieste', mode: 'suezmax', via_chokepoints: [], transit_days: 3, volume_kbd: 40, cost_usd_bbl: 1.9, status: 'open' },
    { id: 'e:libya-sicily', from: 'sup:libya', to: 'ref:sicily', mode: 'suezmax', via_chokepoints: [], transit_days: 2, volume_kbd: 150, cost_usd_bbl: 1.6, status: 'open' },
    { id: 'e:us-rotterdam', from: 'sup:us-gulf', to: 'ref:rotterdam', mode: 'suezmax', via_chokepoints: [], transit_days: 12, volume_kbd: 200, cost_usd_bbl: 2.8, status: 'open' },
    { id: 'e:us-trieste', from: 'sup:us-gulf', to: 'ref:trieste', mode: 'suezmax', via_chokepoints: ['ck:gibraltar'], transit_days: 16, volume_kbd: 40, cost_usd_bbl: 3.3, status: 'open' },
    { id: 'e:us-sicily', from: 'sup:us-gulf', to: 'ref:sicily', mode: 'suezmax', via_chokepoints: ['ck:gibraltar'], transit_days: 15, volume_kbd: 120, cost_usd_bbl: 3.1, status: 'open' },
    { id: 'e:us-algeciras', from: 'sup:us-gulf', to: 'ref:algeciras', mode: 'suezmax', via_chokepoints: ['ck:gibraltar'], transit_days: 14, volume_kbd: 150, cost_usd_bbl: 2.9, status: 'open' },
    { id: 'e:nigeria-rotterdam', from: 'sup:nigeria', to: 'ref:rotterdam', mode: 'suezmax', via_chokepoints: [], transit_days: 10, volume_kbd: 150, cost_usd_bbl: 2.5, status: 'open' },
    { id: 'e:nigeria-fos', from: 'sup:nigeria', to: 'ref:fos', mode: 'suezmax', via_chokepoints: ['ck:gibraltar'], transit_days: 12, volume_kbd: 60, cost_usd_bbl: 2.7, status: 'open' },
    { id: 'e:nigeria-algeciras', from: 'sup:nigeria', to: 'ref:algeciras', mode: 'suezmax', via_chokepoints: ['ck:gibraltar'], transit_days: 11, volume_kbd: 100, cost_usd_bbl: 2.6, status: 'open' },
  ],
};

const grade = (id: string, name: string, origin: string, a: number[]): CrudeGrade =>
  ({ id, name, origin_country: origin, api: a[0], sulfur: a[1], tan: a[2], ni_v: a[3], resid: a[4], pour: a[5], ...S });

const EU_SANCTIONS: SanctionsRules = {
  Kazakhstan: { rail: 'AMBER', note: 'CPC blend transits Russian territory — extra compliance screening. Illustrative.' },
  USA: { rail: 'GREEN', note: 'USD LC.' }, Nigeria: { rail: 'GREEN', note: 'USD LC.' },
  'Saudi Arabia': { rail: 'GREEN', note: 'USD LC.' }, Libya: { rail: 'GREEN', note: 'USD LC.' },
};
const EU_SPOT: SpotCargo[] = [
  { id: 'sc:wti', grade_id: 'gr:wti-eu', origin_country: 'USA', volume_kb: 1000, loading_port: 'sup:us-gulf', avail_from_day: 3, ...S },
  { id: 'sc:bonny', grade_id: 'gr:bonny-eu', origin_country: 'Nigeria', volume_kb: 900, loading_port: 'sup:nigeria', avail_from_day: 2, ...S },
  { id: 'sc:arab', grade_id: 'gr:arab-light-eu', origin_country: 'Saudi Arabia', volume_kb: 1200, loading_port: 'sup:saudi', avail_from_day: 4, ...S },
  { id: 'sc:essider', grade_id: 'gr:essider', origin_country: 'Libya', volume_kb: 700, loading_port: 'sup:libya', avail_from_day: 1, ...S },
];

const EUROPE: StaticData = {
  bundle: { scenario_id: 'europe-crude-illustrative', version: '1.0.0', t0: '2026-07-07T00:00:00Z', events: [] },
  graph: EUROPE_GRAPH,
  grades: [
    grade('gr:cpc', 'CPC Blend', 'Kazakhstan', [45, 0.55, 0.1, 5, 10, -30]),
    grade('gr:wti-eu', 'WTI', 'USA', [44.5, 0.32, 0.05, 1, 10, -25]),
    grade('gr:bonny-eu', 'Bonny Light', 'Nigeria', [34.9, 0.15, 0.26, 4, 29, -18]),
    grade('gr:arab-light-eu', 'Arab Light', 'Saudi Arabia', [31.3, 1.9, 0.1, 15, 22, -21]),
    grade('gr:essider', 'Es Sider', 'Libya', [37, 0.42, 0.1, 8, 16, -12]),
  ],
  sanctions: EU_SANCTIONS,
  spot: EU_SPOT,
  calibration: {},
};

const EU_CHARTER: CharterArticle[] = [
  { id: 'A1', title: 'Completeness', description: '' },
  { id: 'A2', title: 'Security floor', param_key: 'min_cover_days', param_value: 12, description: '' },
  { id: 'A3', title: 'Concentration cap', param_key: 'max_corridor_share', param_value: 0.4, description: '' },
  { id: 'A4', title: 'Sanctions transparency', description: '' },
  { id: 'A5', title: 'Stated uncertainty', description: '' },
];

export interface Theatre {
  id: string; name: string; sub: string; illustrative: boolean;
  data: StaticData; charter: CharterArticle[]; shock: ShockContext;
  focus: { lonMin: number; lonMax: number; latMin: number; latMax: number };
}

/** Alternate theatres shown by the "THEATRE" switch. The primary (India crude) is the app default. */
export const ALT_THEATRES: Theatre[] = [
  {
    id: 'europe-crude',
    name: 'Europe · Crude',
    sub: 'Bosphorus crisis — Caspian crude to Mediterranean refineries',
    illustrative: true,
    data: EUROPE,
    charter: EU_CHARTER,
    shock: { t_sim: '2026-07-07T00:00:00Z', shocks_active: ['shock:bosphorus-severe'], brent_usd: 88 },
    focus: { lonMin: -98, lonMax: 40, latMin: 2, latMax: 55 },
  },
];
