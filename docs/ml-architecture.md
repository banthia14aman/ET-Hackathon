# TRINETRA — the AI stack (why not "one big LLM")

The owner's question: *why only one LLM, why not our own ML models for things that don't
need generative AI?* The answer is the architecture — **the right tool per layer, chosen by
what each layer is allowed to get wrong.**

| Layer | Job | Tool | Why | Where |
|---|---|---|---|---|
| Enforcement | sanctions / assay / voyage veto | **pure-function rules, zero AI** | must be reproducible + citable or the audit is worthless; cannot hallucinate | `src/engine/charter/criticize.ts` |
| Prediction | crude ↔ refinery compatibility | **our trained model** (softmax regression, frozen weights) | a number must be defensible and byte-identical every run; an LLM gives a different answer each time | `scripts/train-refinery-model.mjs` → `data/refinery_model.json` → `src/engine/refinery_model.ts` |
| Language | proposer rationale + arbiter memo | **LLM, cached at build time** | only the *sentence* is allowed to vary; and even that is frozen so the demo runs offline | `scripts/generate-llm-cache.mjs` (NVIDIA qwen — see `docs/nvidia-bakeoff.md`) |

"One big LLM" fails all three: it would hallucinate the compliance check, give a different
number on every run so nothing is auditable, and can't be replayed — which would destroy the
hash-chained audit trail that is the moat.

## The compatibility model (our own ML)

`scripts/train-refinery-model.mjs` fits a **multinomial logistic regression** (softmax over
`RUN_NOW / BLEND / CANNOT_RUN`) from the 6 assay dimensions of a crude relative to a refinery's
operating envelope. It trains on ~3,600 stratified synthetic crudes labelled by the physical
envelope screen (so it *learns the frontier* rather than hard-coding boxes), reaches ~100%
train accuracy, and ships as **frozen weights** in `data/refinery_model.json`.

- **Runtime inference is pure and deterministic** (`src/engine/refinery_model.ts`): no network,
  no clock, no randomness — byte-identical replay is preserved (asserted in `scripts/check.mjs`).
- **The model is advisory; the deterministic critic stays the authority.** Every reroute card
  shows the model's tier + confidence (e.g. *Merey 16 → Jamnagar · Blend only 86%*); the
  zero-LLM critic still makes the veto. Model ⟷ physical-screen agreement is checked (≥85%).
- **Honest provenance:** labels are expert-derived (`prov: E`), never re-badged as real run
  history. Retrain reproducibly with `node scripts/train-refinery-model.mjs`.

Upgrade path: swap the synthetic-labelled training set for real PPAC/tanker-tracking run
histories and the same pipeline makes the "learned from what each refinery actually ran" claim
literally true, with the model file the only thing that changes.
