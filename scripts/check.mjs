// INTEGRATION — scripts/check.mjs. Deterministic self-checks + integration checks.
// Run: node --experimental-strip-types scripts/check.mjs   (Node >= 22.6; no npm install needed —
// engines import only from src/, and .ts type stripping handles the TypeScript.)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerHooks } from 'node:module';

// src/ uses bundler-style extensionless relative imports (tsconfig moduleResolution:
// bundler). Node ESM wants extensions — retry with '.ts' appended instead of touching src.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && !path.extname(specifier)) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw err;
    }
  },
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const results = [];
const check = (name, pass, detail) =>
  results.push({ name, pass: !!pass, detail: pass ? undefined : detail });
const mod = (p) => import(new URL(p, import.meta.url).href);
const loadJson = (f) => JSON.parse(readFileSync(path.join(root, 'data', f), 'utf8'));

// ---------- 1. module self checks ----------
const replay = await mod('../src/engine/replay.ts');
for (const r of replay.selfCheck()) check(`replay: ${r.name}`, r.pass, r.detail);

const scenario = await mod('../src/engine/scenario.ts');
try { check('scenario: selfCheck', scenario.selfCheck() === true); }
catch (e) { check('scenario: selfCheck', false, e.message); }

const options = await mod('../src/engine/options.ts');
try { options.selfCheck(); check('options: selfCheck', true); }
catch (e) { check('options: selfCheck', false, e.message); }

const charterMod = await mod('../src/engine/charter/index.ts');
for (const r of await charterMod.charterSelfCheck()) check(`charter: ${r.name}`, r.pass, r.detail);

// ---------- 2. determinism source scan (CONTRACTS.md §3.1/3.2) ----------
const FORBIDDEN = /Date\.now\(|Math\.random\(|performance\.now\(|crypto\.randomUUID|fetch\(|XMLHttpRequest|WebSocket/;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
});
const dirty = [...walk(path.join(root, 'src', 'engine')), ...walk(path.join(root, 'src', 'lib'))]
  .filter((p) => FORBIDDEN.test(readFileSync(p, 'utf8')));
check('determinism: no wall clock / randomness / network in engine+lib', dirty.length === 0, dirty.join(', '));

// ---------- 3. data files: structural + referential integrity ----------
const bundle = loadJson('hormuz2026_events.json');
const nodes = loadJson('graph_nodes.json');
const edges = loadJson('graph_edges.json');
const grades = loadJson('grades.json');
const sanctions = loadJson('sanctions_rules.json');
const spot = loadJson('spot_availability.json');
const calibration = loadJson('calibration.json');
const charter = loadJson('charter.json');

const nodeIds = new Set(nodes.map((n) => n.id));
const nodeNames = new Set(nodes.map((n) => n.name));
const gradeIds = new Set(grades.map((g) => g.id));
check('data: bundle events sorted by (t, id)', bundle.events.every((e, i) => {
  if (i === 0) return true;
  const p = bundle.events[i - 1];
  return p.t < e.t || (p.t === e.t && p.id < e.id);
}));
check('data: every event carries prov + source_ref', bundle.events.every((e) => e.prov && e.source_ref));
const badEdges = edges.filter((e) => !nodeIds.has(e.from) || !nodeIds.has(e.to)
  || e.via_chokepoints.some((c) => !nodeIds.has(c)));
check('data: edge endpoints + chokepoints resolve to nodes', badEdges.length === 0, badEdges.map((e) => e.id).join(','));
const badSpot = spot.filter((s) => !gradeIds.has(s.grade_id)
  || !(nodeIds.has(s.loading_port) || nodeNames.has(s.loading_port)));
check('data: spot cargo grade + loading_port resolve', badSpot.length === 0, badSpot.map((s) => s.id).join(','));
const origins = new Set([...grades.map((g) => g.origin_country), ...spot.map((s) => s.origin_country)]);
const noRail = [...origins].filter((o) => !sanctions[o]);
check('data: every origin_country has a sanctions rail', noRail.length === 0, noRail.join(','));
check('data: charter is exactly A1..A7 with A2 min_cover_days default 10',
  charter.length === 7 && charter.every((a, i) => a.id === `A${i + 1}`)
  && charter.find((a) => a.id === 'A2')?.param_key === 'min_cover_days'
  && charter.find((a) => a.id === 'A2')?.param_value === 10);
const refBad = nodes.filter((n) => n.type === 'refinery' && !(n.assay_env && n.cover_days > 0 && n.capacity_kbd > 0));
check('data: refineries carry assay_env + cover_days + capacity', refBad.length === 0, refBad.map((n) => n.id).join(','));

// ---------- 4. integration checks over the real bundle ----------
const { computeAt, rerunWithCharter } = await mod('../src/lib/pipeline.ts');
const { canonicalJson } = await mod('../src/lib/canonical.ts');
const { verifyChain } = await mod('../src/engine/charter/audit.ts');
const data = { bundle, graph: { nodes, edges }, grades, sanctions, spot, calibration };
const T = '2026-03-15T00:00:00Z'; // post-Mar-11 attack wave: hormuz-partial + hormuz-severe active

// (a) full-pipeline determinism
const r1 = await computeAt(data, T, charter);
const r2 = await computeAt(data, T, charter);
check('integration: pipeline deep-equal on re-run (canonicalJson)', canonicalJson(r1) === canonicalJson(r2));
check('integration: audit hash sequence identical on re-run',
  r1.audit.map((e) => e.output_hash).join() === r2.audit.map((e) => e.output_hash).join());
check('integration: audit chain verifies from GENESIS',
  verifyChain(r1.audit) && r1.audit[0].prev_hash === 'GENESIS');
check('integration: shocks active post-Mar-11',
  r1.scenario.shocks_active.includes('shock:hormuz-partial') && r1.scenario.shocks_active.includes('shock:hormuz-severe'),
  r1.scenario.shocks_active.join(','));

// (b) Beat 1 acceptance — Merey card + TAN/rail/voyage objections
const merey = r1.options.find((o) => o.grade === 'gr:merey-16' && o.target_refinery === 'ref:jamnagar');
check('beat1: Merey→Jamnagar reroute card exists', !!merey, r1.options.map((o) => o.id).join('\n'));
const mereyObjs = merey ? r1.objections.filter((o) => o.option_id === merey.id) : [];
const ruleOf = (rule) => mereyObjs.find((o) => o.rule_id === rule);
// Merey's real assay (API 16, heavy) binds on API/blend, not TAN — the assay objection must fire and name the binding.
check('beat1: assay objection (A5.assay_compat cites the real binding — api/heavy/blend)',
  /\b(api|blend|resid|ni_v)\b/.test(ruleOf('A5.assay_compat')?.message ?? ''),
  ruleOf('A5.assay_compat')?.message);
check('beat1: rail objection (A4.payment_rail AMBER/OFAC)', /AMBER/.test(ruleOf('A4.payment_rail')?.message ?? ''),
  ruleOf('A4.payment_rail')?.message);
check('beat1: voyage objection (A2.voyage_vs_buffer)', !!ruleOf('A2.voyage_vs_buffer'),
  mereyObjs.map((o) => o.rule_id).join(','));
check('beat1: Merey arbitrates to conditional-or-rejected',
  merey && (merey.status === 'conditional' || merey.status === 'rejected'), merey?.status);

// (c) charter edit A2 10 → 15 re-sorts the deck
const charter15 = charter.map((a) => (a.id === 'A2' ? { ...a, param_value: 15 } : a));
const r3 = await rerunWithCharter(data, r1.scenario, charter15, r1.audit, '10 -> 15', 'A2');
const before = new Map(r1.options.map((o) => [o.id, o.status]));
const changed = r3.options.filter((o) => before.get(o.id) !== o.status);
check('beat2: >=1 option changes status at A2=15', changed.length >= 1);
const objKey = (objs) => objs.map((o) => `${o.id}:${o.severity}`).sort().join('|');
check('beat2: objection set changes at A2=15', objKey(r1.objections) !== objKey(r3.objections));
check('beat2: audit chain still verifies after user edit + rerun', verifyChain(r3.audit));
check('beat2: user set_charter_param entry appended',
  r3.audit.some((e) => e.actor === 'user' && e.action === 'set_charter_param' && e.note === '10 -> 15'));

// (d) LLM cache covers the resting-state deck (end of timeline the demo idles on)
const { llmCache } = await mod('../src/cache/index.ts');
const tEnd = bundle.events[bundle.events.length - 1].t;
const rEnd = await computeAt(data, tEnd, charter);
const endCards = rEnd.options.filter((o) => o.status !== 'rejected').slice(0, 3);
check('cache: every resting-state top-3 card has rationale + memo',
  endCards.every((o) => llmCache[o.id] && llmCache[`memo:${o.id}`]),
  endCards.map((o) => `${o.id}: ${llmCache[o.id] ? 'hit' : 'MISS'}/${llmCache[`memo:${o.id}`] ? 'hit' : 'MISS'}`).join('\n'));

// (e) Nayara buyer override fires once Bab el-Mandeb stresses Vadinar (post 2026-04-08)
const rBab = await computeAt(data, '2026-04-20T00:00:00Z', charter);
const nayara = rBab.options.find((o) => o.target_refinery === 'ref:vadinar');
check('nayara: Urals→Vadinar reroute card exists post Bab el-Mandeb shock', !!nayara,
  rBab.options.map((o) => o.id).join('\n'));
check('nayara: buyer override → RED rail → rejected, note names Nayara',
  nayara?.payment_rail === 'RED' && nayara?.status === 'rejected' && /Nayara/.test(nayara?.payment_note ?? ''),
  nayara && `${nayara.payment_rail} ${nayara.status} ${nayara.payment_note}`);
check('nayara: dormant before the Apr-08 advisory (beats at T untouched)',
  !r1.options.some((o) => o.target_refinery === 'ref:vadinar'));

// (f) refinery compatibility model — advisory prediction on every reroute card
const rerouteCards = r1.options.filter((o) => o.lever === 'reroute');
check('model: every reroute card carries a learned tier + confidence',
  rerouteCards.length > 0 && rerouteCards.every((o) => o.model_tier && o.model_confidence > 0 && o.model_confidence <= 1),
  rerouteCards.map((o) => `${o.grade}:${o.model_tier}@${o.model_confidence}`).join(', '));
const agree = rerouteCards.filter((o) => o.model_tier === o.compat_tier).length;
check('model: learned tier agrees with the physical screen on >=85% of reroute cards',
  agree / rerouteCards.length >= 0.85, `${agree}/${rerouteCards.length} agree`);
check('model: prediction is deterministic across pipeline re-runs',
  r2.options.filter((o) => o.lever === 'reroute').every((o, i) =>
    o.model_tier === rerouteCards[i].model_tier && o.model_confidence === rerouteCards[i].model_confidence));

// (g) what-if sandbox — user-built ShockContext runs the same deterministic engine
const { computeScenario } = await mod('../src/lib/pipeline.ts');
const whatIf = { t_sim: '2027-01-01T00:00:00Z', shocks_active: ['shock:bab-el-mandeb-severe', 'shock:hormuz-severe'], brent_usd: 145 };
const w1 = await computeScenario(data, whatIf, charter);
const w2 = await computeScenario(data, whatIf, charter);
check('whatif: scenario is deterministic on re-run (canonicalJson)', canonicalJson(w1) === canonicalJson(w2));
check('whatif: hypothetical two-strait crisis produces options + a wider gap than the Mar-15 replay',
  w1.options.length > 0 && w1.scenario.gap_kbd > r1.scenario.gap_kbd,
  `gap ${w1.scenario.gap_kbd.toFixed(0)} vs ${r1.scenario.gap_kbd.toFixed(0)}`);
check('whatif: audit chain verifies from GENESIS', verifyChain(w1.audit) && w1.audit[0].prev_hash === 'GENESIS');

// (h) scale is config, not code — the same engine runs a different graph, deterministically
const miniGraph = {
  nodes: [
    { id: 'sup:x', type: 'supplier', name: 'X', lat: 0, lon: 0, status: 'ok', prov: 'S', source: 's', as_of: '2026-01-01T00:00:00Z' },
    { id: 'ck:z', type: 'chokepoint', name: 'Z', lat: 0, lon: 0, status: 'ok', prov: 'S', source: 's', as_of: '2026-01-01T00:00:00Z' },
    { id: 'ref:m', type: 'refinery', name: 'M', lat: 0, lon: 0, status: 'ok', capacity_kbd: 200, cover_days: 12, assay_env: { api: [20, 45], sulfur: [0, 3], tan: [0, 1.5], ni_v: [0, 200], resid: [0, 50], pour: [-30, 30] }, prov: 'S', source: 's', as_of: '2026-01-01T00:00:00Z' },
  ],
  edges: [{ id: 'e:x', from: 'sup:x', to: 'ref:m', mode: 'suezmax', via_chokepoints: ['ck:z'], transit_days: 6, volume_kbd: 200, cost_usd_bbl: 2, status: 'open' }],
};
const miniData = { graph: miniGraph, grades: [{ id: 'gr:x', name: 'X', origin_country: 'Xland', api: 34, sulfur: 0.5, tan: 0.1, ni_v: 5, resid: 15, pour: -20, prov: 'S', source: 's', as_of: '2026-01-01T00:00:00Z' }], sanctions: { Xland: { rail: 'GREEN', note: 'ok' } }, spot: [{ id: 'sc:x', grade_id: 'gr:x', origin_country: 'Xland', volume_kb: 500, loading_port: 'sup:x', avail_from_day: 1, prov: 'S', source: 's' }], calibration: {} };
const miniShocks = { t_sim: '2026-07-07T00:00:00Z', shocks_active: ['shock:z-severe'], brent_usd: 90 };
const s1 = await computeScenario(miniData, miniShocks, charter);
const s2 = await computeScenario(miniData, miniShocks, charter);
check('scale: same engine runs a different graph and produces judged options', s1.options.length > 0,
  s1.options.map((o) => `${o.lever}=${o.status}`).join(','));
check('scale: new-config run is deterministic (canonicalJson)', canonicalJson(s1) === canonicalJson(s2));

// ---------- report ----------
let failed = 0;
for (const r of results) {
  if (!r.pass) failed += 1;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass || !r.detail ? '' : `\n      ${r.detail}`}`);
}

console.log('\n--- OBSERVED (integration run at ' + T + ', floor 10) ---');
console.log('gap_kbd:', r1.scenario.gap_kbd.toFixed(1), ' brent:', r1.scenario.brent_usd);
console.log('jamnagar cover_days:', r1.scenario.cover_days['ref:jamnagar']?.toFixed(2));
console.log('merey card:', merey?.id, '->', merey?.status);
for (const c of merey?.conditions ?? []) console.log('  condition:', c);
console.log('statuses:\n  ' + r1.options.map((o) => `${o.id}=${o.status}`).join('\n  '));
console.log('--- OBSERVED (A2 floor 15) demotions ---');
for (const o of changed) console.log(`  ${o.id}: ${before.get(o.id)} -> ${o.status}`);

console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
