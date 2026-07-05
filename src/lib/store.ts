// FROZEN SHAPE — tiny typed pub/sub store. Owned by TEAM LEAD.
// Action BODIES are stubs; INTEGRATION wires the engine pipeline inside them.
// SWE1-6: never mutate state directly — read via useStore, write only via these actions.

import { useSyncExternalStore } from 'react';
import type {
  ArticleId,
  AuditEntry,
  CharterArticle,
  Objection,
  OptionCard,
  ReplayBundle,
  ScenarioState,
} from '../contracts/types';

export interface AppState {
  bundle: ReplayBundle | null;
  cursor: number; // index of last applied event; -1 = none applied
  scenario: ScenarioState | null;
  options: OptionCard[];
  objections: Objection[];
  audit: AuditEntry[];
  charter: CharterArticle[];
  playing: boolean;
  speed: number; // sim-time multiplier
}

export const initialState: AppState = {
  bundle: null,
  cursor: -1,
  scenario: null,
  options: [],
  objections: [],
  audit: [],
  charter: [],
  playing: false,
  speed: 1,
};

export interface Store {
  getState(): AppState;
  setState(patch: Partial<AppState>): void;
  subscribe(listener: () => void): () => void;
}

export function createStore(state: AppState = initialState): Store {
  let current = state;
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    setState(patch) {
      current = { ...current, ...patch };
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The single app store instance. */
export const store = createStore();

/**
 * Select state in components. Selectors MUST return stable references
 * (a state field, not a fresh object/array literal) or you re-render every publish.
 */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}

// ---------- actions (shape frozen; bodies stubbed for INTEGRATION) ----------

export function loadBundle(bundle: ReplayBundle, charter: CharterArticle[]): void {
  store.setState({ ...initialState, bundle, charter });
}

/** Advance sim by one event: applyNext -> rescore -> generateOptions -> propose/criticize/arbitrate. */
export function tick(): void {
  // TODO(integration): wire src/engine/* pipeline here. See CONTRACTS.md §3.
}

/** Deterministic replay to an absolute cursor (rebuild state from scratch — no incremental undo). */
export function seek(cursor: number): void {
  // TODO(integration): reset to initial derived state, re-apply events [0..cursor].
  store.setState({ cursor });
}

export function setCharterParam(articleId: ArticleId, value: number): void {
  const s = store.getState();
  store.setState({
    charter: s.charter.map((a) => (a.id === articleId ? { ...a, param_value: value } : a)),
  });
  // TODO(integration): re-run criticize/arbitrate for current options + append user AuditEntry.
}
