#!/usr/bin/env node
// BUILD-TIME (not runtime) trainer for the refinery crude-compatibility model.
// Fits a multinomial logistic regression (softmax) that predicts RUN_NOW / BLEND / CANNOT_RUN
// for a crude at a refinery, from the 6 assay dimensions relative to that refinery's operating
// envelope. Ships FROZEN weights to data/refinery_model.json; runtime inference is pure and
// deterministic (src/engine/refinery_model.ts), so byte-identical replay is preserved.
//
// Labels are derived from the physical envelope screen (the same rule the desk uses), so the
// model LEARNS the compatibility frontier rather than hard-coding boxes. Provenance: E (expert-
// labelled), never re-badged R. Reproducible: seeded PRNG, fixed iterations.
//
//   node scripts/train-refinery-model.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodes = JSON.parse(readFileSync(join(ROOT, 'data', 'graph_nodes.json'), 'utf8'));
const DIMS = ['api', 'sulfur', 'tan', 'ni_v', 'resid', 'pour'];
const CLASSES = ['RUN_NOW', 'BLEND', 'CANNOT_RUN'];

// seeded PRNG (mulberry32) — reproducible training set, no Math.random
let seed = 0x9e3779b9;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- label + feature functions (mirror engine/options.ts assayScreen exactly) ----
function label(assay, env) {
  const fails = [];
  for (const d of DIMS) {
    const [lo, hi] = env[d];
    const v = assay[d];
    if (v >= lo && v <= hi) continue;
    const mid = (lo + hi) / 2;
    const bound = v > hi ? hi : lo;
    fails.push({ dim: d, ratio: (bound - mid) / (v - mid) });
  }
  if (fails.length === 0) return 0; // RUN_NOW
  const maxRatio = Math.min(...fails.map((f) => f.ratio));
  if (fails.length > 2 || (fails.some((f) => f.dim === 'resid') && maxRatio < 0.1)) return 2; // CANNOT_RUN
  return 1; // BLEND
}

// features: signed normalized exceedance per dim (0 inside envelope) + fraction of dims outside
export function featurize(assay, env) {
  const f = [];
  let nOut = 0;
  for (const d of DIMS) {
    const [lo, hi] = env[d];
    const v = assay[d];
    const w = hi - lo || 1;
    let e = 0;
    if (v > hi) { e = (v - hi) / w; nOut++; }
    else if (v < lo) { e = (v - lo) / w; nOut++; }
    f.push(e);
  }
  f.push(nOut / DIMS.length);
  return f;
}

// ---- build the labelled training set: sample crudes around each refinery envelope ----
const refineries = nodes.filter((n) => n.type === 'refinery' && n.assay_env);
const X = [], Y = [];
const PER_REF = 400;
// Stratify by the number of violated dims so all three classes are well represented
// (uniform-wide sampling makes fully-inside/RUN_NOW crudes <1% of samples).
const K_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10]; // P(0..4 dims outside the envelope)
function pickK() {
  let r = rnd(), acc = 0;
  for (let k = 0; k < K_WEIGHTS.length; k++) { acc += K_WEIGHTS[k]; if (r < acc) return k; }
  return K_WEIGHTS.length - 1;
}
for (const ref of refineries) {
  const env = ref.assay_env;
  for (let i = 0; i < PER_REF; i++) {
    const k = pickK();
    const order = DIMS.map((d) => ({ d, r: rnd() })).sort((a, b) => a.r - b.r).map((o) => o.d);
    const violate = new Set(order.slice(0, k));
    const assay = {};
    for (const d of DIMS) {
      const [lo, hi] = env[d];
      const w = hi - lo || 1;
      if (violate.has(d)) {
        // push outside the envelope on a random side
        assay[d] = rnd() < 0.5 ? lo - (0.05 + rnd() * 0.7) * w : hi + (0.05 + rnd() * 0.7) * w;
      } else {
        assay[d] = lo + rnd() * w; // inside
      }
    }
    X.push(featurize(assay, env));
    Y.push(label(assay, env));
  }
}
const N = X.length;
const F = X[0].length;

// ---- standardize features ----
const mean = Array(F).fill(0), std = Array(F).fill(0);
for (const x of X) for (let j = 0; j < F; j++) mean[j] += x[j];
for (let j = 0; j < F; j++) mean[j] /= N;
for (const x of X) for (let j = 0; j < F; j++) std[j] += (x[j] - mean[j]) ** 2;
for (let j = 0; j < F; j++) std[j] = Math.sqrt(std[j] / N) || 1;
const Xs = X.map((x) => x.map((v, j) => (v - mean[j]) / std[j]));

// ---- softmax regression via gradient descent ----
const K = CLASSES.length;
const W = Array.from({ length: K }, () => Array(F).fill(0));
const b = Array(K).fill(0);
const softmax = (z) => { const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const s = e.reduce((a, c) => a + c, 0); return e.map((v) => v / s); };
const LR = 0.3, ITERS = 400, L2 = 1e-4;
for (let it = 0; it < ITERS; it++) {
  const gW = Array.from({ length: K }, () => Array(F).fill(0));
  const gb = Array(K).fill(0);
  for (let i = 0; i < N; i++) {
    const z = W.map((wk, k) => wk.reduce((a, wkj, j) => a + wkj * Xs[i][j], 0) + b[k]);
    const p = softmax(z);
    for (let k = 0; k < K; k++) {
      const err = p[k] - (Y[i] === k ? 1 : 0);
      gb[k] += err;
      for (let j = 0; j < F; j++) gW[k][j] += err * Xs[i][j];
    }
  }
  for (let k = 0; k < K; k++) {
    b[k] -= LR * gb[k] / N;
    for (let j = 0; j < F; j++) W[k][j] -= LR * (gW[k][j] / N + L2 * W[k][j]);
  }
}

// ---- training accuracy ----
let correct = 0;
for (let i = 0; i < N; i++) {
  const z = W.map((wk, k) => wk.reduce((a, wkj, j) => a + wkj * Xs[i][j], 0) + b[k]);
  const p = softmax(z);
  if (p.indexOf(Math.max(...p)) === Y[i]) correct++;
}
const accuracy = correct / N;

const model = {
  kind: 'multinomial_logistic_regression',
  purpose: 'refinery crude-compatibility (RUN_NOW / BLEND / CANNOT_RUN) from 6 assay dims',
  classes: CLASSES,
  features: [...DIMS.map((d) => `exceedance_${d}`), 'frac_dims_outside'],
  dims: DIMS,
  mean, std, W, b,
  meta: {
    n_samples: N, n_refineries: refineries.length, train_accuracy: Math.round(accuracy * 1e4) / 1e4,
    method: 'softmax regression, 400 iters, seeded synthetic crudes labelled by the physical envelope screen',
    prov: 'E', trained_by: 'scripts/train-refinery-model.mjs', trained_at: new Date().toISOString(),
  },
};
writeFileSync(join(ROOT, 'data', 'refinery_model.json'), `${JSON.stringify(model, null, 2)}\n`);
console.log(`trained on ${N} samples across ${refineries.length} refineries — accuracy ${(accuracy * 100).toFixed(1)}% -> data/refinery_model.json`);
