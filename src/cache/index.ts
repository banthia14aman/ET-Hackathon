// SWE5 — src/cache/index.ts. Loads the build-time LLM cache (static JSON import,
// CONTRACTS.md §3.2) into the frozen LlmCache shape. Memos are keyed 'memo:<option_id>'.

import type { LlmCache } from '../contracts/types';
import raw from './llm-cache.json' with { type: 'json' };

export interface RawCacheEntry {
  key: string; // OptionCard.id
  kind: 'rationale' | 'memo';
  text: string;
  generated_by: string;
  model: string | null;
}

export function loadLlmCache(entries: RawCacheEntry[]): LlmCache {
  const cache: LlmCache = {};
  for (const e of entries) {
    cache[e.kind === 'memo' ? `memo:${e.key}` : e.key] = {
      rationale: e.text,
      model: e.model ?? 'PLACEHOLDER',
      prompt_hash: 'PLACEHOLDER',
    };
  }
  return cache;
}

/** The app-wide cache. Regenerate the JSON via scripts/generate-llm-cache.mjs. */
export const llmCache: LlmCache = loadLlmCache(raw as RawCacheEntry[]);
