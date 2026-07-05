# NVIDIA NIM model bakeoff — LLM cache provider selection

2026-07-06. 10 models on `integrate.api.nvidia.com` were tested in parallel against the
project's real build-time prompts (the Merey-16→Jamnagar rationale + memo pair from
`scripts/generate-llm-cache.mjs --dry-run`), then blind-ranked on: trader-grade tone,
factual grounding in the supplied numbers only, format compliance (<120 words;
`MEMO —` + verdict + numbered conditions + sizing line), with latency as tiebreak.

**Winner: `qwen/qwen3.5-397b-a17b`** — now the `NVIDIA_MODEL` default in
`scripts/generate-llm-cache.mjs`. Only candidate that was simultaneously
format-compliant, arithmetically correct (27,000 kb at 1,240 kbd ≈ 22 d of cover),
and free of invented dollar figures or regulatory citations.

| # | Model | Score | Latency (2 calls) | Notes |
|---|-------|-------|-------------------|-------|
| 1 | qwen/qwen3.5-397b-a17b | 8.5 | 52 s | compliant, correct math, grounded |
| 2 | z-ai/glm-5.2 | 8.5* | 52 s | output byte-identical to qwen (suspected API aliasing) — not an independent signal |
| 3 | nvidia/llama-3.3-nemotron-super-49b-v1.5 | 7 | 106 s | crisp, correct cover math; invents $/bbl figures; best *genuine* fallback |
| 4 | openai/gpt-oss-120b | 5.5 | 57 s | 100× volume error (270 kb) |
| 5 | moonshotai/kimi-k2.6 | 5.5 | 29 s | 270 kb error, $1.566M vs $1.566B slip, long memo |
| 6 | nvidia/nemotron-3-ultra-550b-a55b | 5 | 70 s | 10× volume error, invents OFAC GL 44 |
| 7 | mistralai/mistral-large-3-675b-instruct-2512 | 4.5 | 5 s | fastest by far, but 172 words and multiple fabrications |
| 8 | deepseek-ai/deepseek-v4-pro | 4 | 16 s | meta-preamble, 151 words, fabricated prices |
| — | writer/palmyra-fin-70b-32k | fail | — | 404: not enabled for this account |
| — | meta/llama-3.3-70b-instruct | fail | — | server-side timeouts (0 bytes at 120 s), auth/network fine |

Systemic finding: the dominant failure mode across models was **unit mangling of the
27,000 kb cargo** (270 kb / 2,700 kb / 2.7 Mbbl) and **invented prices** — exactly the
failure class TRINETRA's zero-LLM critic exists to catch. Worth citing in the pitch:
even the narration layer's model selection was adversarially validated.

Regeneration command (key via env only — never commit it):

```bash
NVIDIA_API_KEY=nvapi-... node scripts/generate-llm-cache.mjs          # uses the qwen default
NVIDIA_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1.5 NVIDIA_API_KEY=... \
  node scripts/generate-llm-cache.mjs                                  # fallback model
```
