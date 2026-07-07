// scripts/replay-verify.mjs — the byte-identical claim, DEMONSTRATED (not just asserted).
// Runs the full pipeline twice at the Beat-1 timestamp and prints the two audit hash chains
// side by side. Exit 0 iff every hash matches. Run: node --experimental-strip-types scripts/replay-verify.mjs
// (or `npm run verify`). No npm install, no network — imports the TS engine directly.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (err) {
      if (specifier.startsWith('.') && !path.extname(specifier)) {
        try { return nextResolve(`${specifier}.ts`, context); }
        catch { return nextResolve(`${specifier}/index.ts`, context); }
      }
      throw err;
    }
  },
});

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const loadJson = (f) => JSON.parse(readFileSync(path.join(root, 'data', f), 'utf8'));
const mod = (p) => import(new URL(p, import.meta.url).href);

const { computeAt } = await mod('../src/lib/pipeline.ts');
const { canonicalJson } = await mod('../src/lib/canonical.ts');

const data = {
  bundle: loadJson('hormuz2026_events.json'),
  graph: { nodes: loadJson('graph_nodes.json'), edges: loadJson('graph_edges.json') },
  grades: loadJson('grades.json'),
  sanctions: loadJson('sanctions_rules.json'),
  spot: loadJson('spot_availability.json'),
  calibration: loadJson('calibration.json'),
};
const charter = loadJson('charter.json');
const T = process.argv[2] ?? '2026-03-15T00:00:00Z';

const r1 = await computeAt(data, T, charter);
const r2 = await computeAt(data, T, charter);

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nTRINETRA replay --verify   sim time ${T}\n`);
console.log(`${pad('seq', 4)} ${pad('actor', 10)} ${pad('action', 18)} ${pad('run #1 output_hash', 18)} ${pad('run #2 output_hash', 18)} match`);
console.log('-'.repeat(76));

let allMatch = true;
for (let i = 0; i < r1.audit.length; i++) {
  const a = r1.audit[i]; const b = r2.audit[i];
  const m = a.output_hash === b.output_hash;
  if (!m) allMatch = false;
  console.log(`${pad(a.seq, 4)} ${pad(a.actor, 10)} ${pad(a.action, 18)} ${pad(a.output_hash.slice(0, 16), 18)} ${pad(b.output_hash.slice(0, 16), 18)} ${m ? 'OK' : 'XX'}`);
}

const fullMatch = canonicalJson(r1) === canonicalJson(r2);
console.log('-'.repeat(76));
console.log(`audit chain (${r1.audit.length} entries): ${allMatch ? 'IDENTICAL' : 'DIVERGED'}`);
console.log(`full pipeline state (canonicalJson): ${fullMatch ? 'IDENTICAL' : 'DIVERGED'}`);
console.log(`\n${allMatch && fullMatch ? '✓ BYTE-IDENTICAL — the decision reproduces exactly, offline.' : '✗ NON-DETERMINISTIC — replay diverged.'}\n`);
process.exit(allMatch && fullMatch ? 0 : 1);
