#!/usr/bin/env node
// SWE5 — scripts/generate-llm-cache.mjs
// Build-time (NOT runtime) regenerator for src/cache/llm-cache.json.
// Provider-agnostic: ANTHROPIC_API_KEY → Anthropic API, else AWS_BEDROCK_MODEL_ID (+ AWS creds
// resolved by the SDK) → Bedrock. `--dry-run` prints prompts and calls no network.
//
//   node scripts/generate-llm-cache.mjs --dry-run
//   ANTHROPIC_API_KEY=... node scripts/generate-llm-cache.mjs
//   AWS_BEDROCK_MODEL_ID=... AWS_REGION=... node scripts/generate-llm-cache.mjs

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'cache', 'llm-cache.json');
const DRY = process.argv.includes('--dry-run');

// ---------- data context (tolerate missing files — PM1 may not have landed yet) ----------

function loadJson(rel) {
  const p = join(ROOT, 'data', rel);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

const grades = loadJson('grades.json') ?? [];
const nodes = loadJson('graph_nodes.json') ?? [];
const spot = loadJson('spot_availability.json') ?? [];
const charter = loadJson('charter.json') ?? [];
const sanctions = loadJson('sanctions_rules.json') ?? {};

// Hero options. Keys MUST match SWE4's deterministic OptionCard ids
// ('opt:<lever>:<grade|->:<refinery|->:<n>'); update here if ids shift.
// Ids verified against `npm run check` OBSERVED output at T=2026-03-15 (docs/beats.md appendix).
const HEROES = [
  { key: 'opt:reroute:gr:merey-16:ref:jamnagar:8', label: 'Merey 16 (Venezuela) rerouted to Jamnagar', grade: 'gr:merey-16', refinery: 'ref:jamnagar' },
  { key: 'opt:reroute:gr:girassol:ref:jamnagar:2', label: 'Girassol (Angola) rerouted to Jamnagar', grade: 'gr:girassol', refinery: 'ref:jamnagar' },
  { key: 'opt:reroute:gr:wti-midland:ref:jamnagar:7', label: 'WTI Midland (US) rerouted to Jamnagar', grade: 'gr:wti-midland', refinery: 'ref:jamnagar' },
  { key: 'opt:reroute:gr:urals:ref:jamnagar:3', label: 'Urals (Russia) rerouted to Jamnagar under the pre-cutoff waiver rail', grade: 'gr:urals', refinery: 'ref:jamnagar' },
  { key: 'opt:stock_draw:-:-:0', label: 'Strategic reserve (SPR) draw for the Jamnagar system', grade: null, refinery: 'ref:jamnagar' },
  { key: 'opt:demand_side:-:-:0', label: 'Demand-side run-cut / product-import swap, 300 kb/d for 30 days', grade: null, refinery: null },
  { key: 'opt:divert_on_water:-:ref:kochi:0', label: 'Owned on-water cargo diverted to the Kochi system (tranche 1)', grade: null, refinery: 'ref:kochi' },
  { key: 'opt:divert_on_water:-:ref:kochi:1', label: 'Owned on-water cargo diverted to the Kochi system (tranche 2)', grade: null, refinery: 'ref:kochi' },
  { key: 'opt:floating_storage:-:-:0', label: 'Floating storage: 2,000 kb VLCC parcel held for optional discharge', grade: null, refinery: null },
];

function contextFor(hero) {
  const lines = [];
  const g = grades.find((x) => x.id === hero.grade);
  if (g) lines.push(`Assay ${g.name}: API ${g.api}, sulfur ${g.sulfur}%, TAN ${g.tan}, Ni+V ${g.ni_v}, resid ${g.resid}%, pour ${g.pour}C.`);
  const ref = nodes.find((n) => n.id === hero.refinery);
  if (ref) lines.push(`Refinery ${ref.name}: capacity ${ref.capacity_kbd} kbd, baseline cover ${ref.cover_days} d.`);
  const cargo = spot.find((c) => c.grade_id === hero.grade);
  if (cargo) lines.push(`Spot cargo: ${cargo.volume_kb} kb ex ${cargo.loading_port}, available day ${cargo.avail_from_day}.`);
  const rail = g && sanctions[g.origin_country];
  if (rail) lines.push(`Payment rail ${rail.rail}: ${rail.note}`);
  if (charter.length) lines.push(`Charter articles: ${charter.map((a) => `${a.id} ${a.title}`).join('; ')}.`);
  return lines.join('\n') || '(no data/*.json context available — write from the label alone)';
}

function prompts(hero) {
  const ctx = contextFor(hero);
  const style = 'Write trader-grade text: concise, numbers-first, no hedging boilerplate, <120 words.';
  return {
    rationale: `You are the PROPOSER in an oil-supply crisis cell (2026 Hormuz closure, India-centric).\nOption: ${hero.label}.\n${ctx}\n${style}\nExplain why this option is on the board: what it buys, what it costs, the binding constraint, and the timing reality.`,
    memo: `You are the ARBITER writing the decision memo for: ${hero.label}.\n${ctx}\n${style}\nFormat: 'MEMO — <option>. Approve / Approve CONDITIONAL / Reject: numbered conditions if any, then one line of sizing/cost.'`,
  };
}

// ---------- providers (one small function each) ----------

async function callAnthropic(prompt) {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 512, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return { text: body.content.map((b) => b.text ?? '').join(''), model };
}

async function callBedrock(prompt) {
  const model = process.env.AWS_BEDROCK_MODEL_ID;
  const { BedrockRuntimeClient, InvokeModelCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({}); // region + creds from standard AWS env/config chain
  const res = await client.send(new InvokeModelCommand({
    modelId: model,
    contentType: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  }));
  const body = JSON.parse(new TextDecoder().decode(res.body));
  return { text: body.content.map((b) => b.text ?? '').join(''), model };
}

function pickProvider() {
  if (process.env.ANTHROPIC_API_KEY) return callAnthropic;
  if (process.env.AWS_BEDROCK_MODEL_ID) return callBedrock;
  return null;
}

// ---------- main ----------

const jobs = HEROES.flatMap((h) => {
  const p = prompts(h);
  return [
    { key: h.key, kind: 'rationale', prompt: p.rationale },
    { key: h.key, kind: 'memo', prompt: p.memo },
  ];
});

if (DRY) {
  for (const j of jobs) console.log(`\n===== ${j.kind} :: ${j.key} =====\n${j.prompt}`);
  console.log(`\n[dry-run] ${jobs.length} prompts, no network calls, ${OUT} untouched.`);
  process.exit(0);
}

const call = pickProvider();
if (!call) {
  console.error('No credentials: set ANTHROPIC_API_KEY, or AWS_BEDROCK_MODEL_ID + AWS creds. (Use --dry-run to preview prompts.)');
  process.exit(1);
}

const entries = [];
for (const j of jobs) {
  process.stdout.write(`generating ${j.kind} for ${j.key} ... `);
  const { text, model } = await call(j.prompt);
  entries.push({
    key: j.key,
    kind: j.kind,
    text: text.trim(),
    generated_by: `scripts/generate-llm-cache.mjs @ ${new Date().toISOString()}`,
    model,
  });
  console.log('ok');
}

writeFileSync(OUT, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`wrote ${entries.length} entries to ${OUT}`);
