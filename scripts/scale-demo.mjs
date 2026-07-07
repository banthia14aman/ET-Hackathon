// scripts/scale-demo.mjs — "scale is config, not code", DEMONSTRATED.
// Runs the SAME deterministic engine (rescore -> generateOptions -> criticize -> arbitrate) over a
// DIFFERENT supply graph — a second theatre (Bosphorus/Mediterranean crude) built purely as data,
// with zero engine change. The config below is a small ILLUSTRATIVE graph (prov S), labelled as a
// scalability demo — the point is that the engine reads it generically, not that the graph is real.
// Run: node --experimental-strip-types scripts/scale-demo.mjs   (or `npm run scale-demo`)

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(s, c, n) {
    try { return n(s, c); }
    catch (e) { if (s.startsWith('.') && !path.extname(s)) { try { return n(`${s}.ts`, c); } catch { return n(`${s}/index.ts`, c); } } throw e; }
  },
});
const mod = (p) => import(new URL(p, import.meta.url).href);
const { computeScenario } = await mod('../src/lib/pipeline.ts');

// ---- A DIFFERENT theatre, expressed entirely as config (prov S — illustrative) ----
const S = { prov: 'S', source: 'scale-demo (illustrative config)', as_of: '2026-07-07T00:00:00Z' };
const env = { api: [22, 42], sulfur: [0, 3.5], tan: [0, 1.5], ni_v: [0, 300], resid: [0, 50], pour: [-30, 30] };
const graph = {
  nodes: [
    { id: 'sup:cpc', type: 'supplier', name: 'CPC Blend (Kazakhstan via Novorossiysk)', lat: 44.7, lon: 37.8, status: 'ok', ...S },
    { id: 'sup:azeri', type: 'supplier', name: 'Azeri Light (Ceyhan)', lat: 36.9, lon: 35.8, status: 'ok', ...S },
    { id: 'ck:bosphorus', type: 'chokepoint', name: 'Bosphorus Strait', lat: 41.1, lon: 29.1, status: 'ok', ...S },
    { id: 'ref:med-a', type: 'refinery', name: 'Med Refinery A', lat: 40.6, lon: 22.9, status: 'ok', capacity_kbd: 300, cover_days: 14, assay_env: env, ...S },
    { id: 'ref:med-b', type: 'refinery', name: 'Med Refinery B', lat: 45.4, lon: 12.3, status: 'ok', capacity_kbd: 220, cover_days: 12, assay_env: env, ...S },
  ],
  edges: [
    { id: 'e:cpc-a', from: 'sup:cpc', to: 'ref:med-a', mode: 'suezmax', via_chokepoints: ['ck:bosphorus'], transit_days: 6, volume_kbd: 250, cost_usd_bbl: 2, status: 'open' },
    { id: 'e:cpc-b', from: 'sup:cpc', to: 'ref:med-b', mode: 'suezmax', via_chokepoints: ['ck:bosphorus'], transit_days: 9, volume_kbd: 180, cost_usd_bbl: 2.4, status: 'open' },
    { id: 'e:azeri-a', from: 'sup:azeri', to: 'ref:med-a', mode: 'suezmax', via_chokepoints: [], transit_days: 4, volume_kbd: 150, cost_usd_bbl: 1.8, status: 'open' },
  ],
};
const grades = [
  { id: 'gr:cpc', name: 'CPC Blend', origin_country: 'Kazakhstan', api: 45, sulfur: 0.55, tan: 0.1, ni_v: 5, resid: 10, pour: -30, ...S },
  { id: 'gr:azeri', name: 'Azeri Light', origin_country: 'Azerbaijan', api: 36, sulfur: 0.15, tan: 0.1, ni_v: 3, resid: 12, pour: -18, ...S },
];
const spot = [
  { id: 'sc:cpc', grade_id: 'gr:cpc', origin_country: 'Kazakhstan', volume_kb: 1000, loading_port: 'sup:cpc', avail_from_day: 3, ...S },
  { id: 'sc:azeri', grade_id: 'gr:azeri', origin_country: 'Azerbaijan', volume_kb: 800, loading_port: 'sup:azeri', avail_from_day: 2, ...S },
];
const data = { graph, grades, sanctions: { Kazakhstan: { rail: 'GREEN', note: 'USD LC' }, Azerbaijan: { rail: 'GREEN', note: 'USD LC' } }, spot, calibration: {} };
const charter = [
  { id: 'A2', title: 'Security floor', param_key: 'min_cover_days', param_value: 10, description: '' },
  { id: 'A3', title: 'Concentration cap', param_key: 'max_corridor_share', param_value: 0.4, description: '' },
];

// Shock the Bosphorus — the SAME engine re-scores exposure and generates/judges options.
const shocks = { t_sim: '2026-07-07T00:00:00Z', shocks_active: ['shock:bosphorus-severe'], brent_usd: 95 };
const r = await computeScenario(data, shocks, charter);

console.log('\nTRINETRA scale-demo — "scale is config, not code"\n');
console.log('Loaded a DIFFERENT theatre (Bosphorus / Mediterranean crude):');
console.log(`  ${graph.nodes.length} nodes, ${graph.edges.length} edges, ${grades.length} grades — all data, zero engine change.\n`);
console.log(`Shock: ${shocks.shocks_active.join(', ')}`);
console.log(`Re-scored gap: ${r.scenario.gap_kbd.toFixed(0)} kb/d`);
console.log(`Cover days: ${Object.entries(r.scenario.cover_days).map(([k, v]) => `${k.replace('ref:', '')} ${v.toFixed(1)}d`).join(', ')}\n`);
console.log('Options the SAME engine produced + judged:');
for (const o of r.options) console.log(`  [${o.status.padEnd(11)}] ${o.lever}${o.grade ? ` · ${o.grade}` : ''}${o.target_refinery ? ` -> ${o.target_refinery}` : ''}`);
console.log(`\nAudit chain: ${r.audit.length} entries, hash-chained.`);
console.log('\n✓ The engine ran a new commodity/region with NO code change — only a new JSON config.\n');
process.exit(r.options.length > 0 ? 0 : 1);
