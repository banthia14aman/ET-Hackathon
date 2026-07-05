// Pure, deterministic inference for the refinery crude-compatibility model.
// Weights are FROZEN (data/refinery_model.json, fit at build time by scripts/train-refinery-model.mjs).
// No network, no LLM, no clock, no randomness — safe on the byte-identical replay path.
// This is TRINETRA's "own model" for a quantitative call: language is the LLM's job, numbers are ours.

import type { AssayEnv, CompatTier, CrudeGrade } from '../contracts/types';
import model from '../../data/refinery_model.json' with { type: 'json' };

const DIMS = model.dims as (keyof AssayEnv & keyof CrudeGrade)[];
const CLASSES = model.classes as CompatTier[];

/** Same feature map as the trainer: signed normalized exceedance per dim + fraction of dims outside. */
function featurize(grade: CrudeGrade, env: AssayEnv): number[] {
  const f: number[] = [];
  let nOut = 0;
  for (const d of DIMS) {
    const [lo, hi] = env[d];
    const v = grade[d] as number;
    const w = hi - lo || 1;
    let e = 0;
    if (v > hi) { e = (v - hi) / w; nOut += 1; }
    else if (v < lo) { e = (v - lo) / w; nOut += 1; }
    f.push(e);
  }
  f.push(nOut / DIMS.length);
  return f;
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, c) => a + c, 0);
  return e.map((v) => v / s);
}

export interface CrudePrediction {
  tier: CompatTier;
  confidence: number; // max class probability, rounded to 3dp (deterministic)
}

/** Predict compatibility tier + confidence for a crude at a refinery envelope. */
export function classifyCrude(grade: CrudeGrade, env: AssayEnv): CrudePrediction {
  const x = featurize(grade, env);
  const xs = x.map((v, j) => (v - model.mean[j]) / model.std[j]);
  const z = model.W.map((wk: number[], k: number) => wk.reduce((a, wkj, j) => a + wkj * xs[j], 0) + model.b[k]);
  const p = softmax(z);
  let arg = 0;
  for (let k = 1; k < p.length; k += 1) if (p[k] > p[arg]) arg = k;
  return { tier: CLASSES[arg], confidence: Math.round(p[arg] * 1000) / 1000 };
}

export const modelMeta = model.meta;
