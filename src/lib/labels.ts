// Presentation-only vocabulary. Maps the engine's internal ids/enums to plain English
// for the UI. The engine's own strings (status enum, rule_id) are NEVER renamed — they are
// mapped here at render time only, so the 67 checks and the audit JSON stay byte-identical.

import type { OptionCard, OptionStatus } from '../contracts/types';

// Nice display names for a few known ids; everything else falls back to prettify().
const NAMES: Record<string, string> = {
  'gr:merey-16': 'Merey 16 (Venezuela)',
  'gr:urals': 'Urals (Russia)',
  'gr:girassol': 'Girassol (Angola)',
  'gr:cabinda': 'Cabinda (Angola)',
  'gr:wti-midland': 'WTI Midland (US)',
  'gr:bonny-light': 'Bonny Light (Nigeria)',
  'gr:tupi': 'Tupi (Brazil)',
  'ref:jamnagar': 'Jamnagar',
  'ref:vadinar': 'Vadinar',
  'ref:paradip': 'Paradip',
  'ref:kochi': 'Kochi',
  'ref:mangalore': 'Mangalore',
  'ref:mumbai': 'Mumbai',
  'ref:visakh': 'Visakhapatnam',
};

/** 'gr:merey-16' -> 'Merey 16'. Generic fallback: strip prefix, de-kebab, title-case. */
export function prettify(id?: string): string {
  if (!id) return '';
  if (NAMES[id]) return NAMES[id];
  const tail = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return tail.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const LEVER_VERB: Record<string, string> = {
  reroute: 'Reroute',
  divert_on_water: 'Divert on-water cargo',
  stock_draw: 'Draw strategic reserve',
  floating_storage: 'Discharge floating storage',
  demand_side: 'Cut demand / import products',
};

/** Human option name, e.g. 'Reroute Merey 16 (Venezuela) → Jamnagar'. Never shows an id. */
export function optionLabel(o: OptionCard): string {
  const verb = LEVER_VERB[o.lever] ?? prettify(o.lever);
  if (o.lever === 'reroute' || o.lever === 'divert_on_water') {
    const grade = o.grade ? prettify(o.grade) : 'owned cargo';
    const dest = o.target_refinery ? ` → ${prettify(o.target_refinery)}` : '';
    return o.lever === 'reroute' ? `${verb} ${grade}${dest}` : `${verb}${dest}`;
  }
  return verb;
}

/** APPROVED / DEMOTED — conditions apply / BLOCKED (render-only; enum unchanged in engine). */
export const STATUS_LABEL: Record<OptionStatus, string> = {
  proposed: 'PROPOSED',
  validated: 'APPROVED',
  conditional: 'DEMOTED — conditions apply',
  rejected: 'BLOCKED',
};
export const STATUS_PILL: Record<OptionStatus, string> = {
  proposed: 'pill-demoted',
  validated: 'pill-approved',
  conditional: 'pill-demoted',
  rejected: 'pill-blocked',
};

// Real rule_ids from the engine (src/engine/charter/criticize.ts + docs/beats.md APPENDIX).
const ARTICLE: Record<string, string> = {
  'A2.voyage_vs_buffer': 'Article A2 · Security floor — voyage longer than days-of-cover',
  'A2.security_floor': 'Article A2 · Security floor — leaves the refinery below the safe line',
  'A3.concentration': 'Article A3 · Concentration cap — too much crude through one chokepoint',
  'A4.payment_rail': 'Article A4 · Sanctions — payment rail needs clearance',
  'A5.assay_compat': 'Article A5 · Refinery chemistry — crude too heavy/sour to run neat',
  'A5.synth_provenance': 'Article A5 · Provenance — rests on demo (synthetic) data',
};
export function articleName(rule_id: string): string {
  return ARTICLE[rule_id] ?? rule_id;
}

/** Presentation-only: humanize an engine message for display — map internal ids to names,
    tame runaway float precision, and space slash-joined dim lists. The engine string itself
    is NEVER changed (it feeds the hash chain); this runs at render time only. */
export function plainMessage(msg: string): string {
  return msg
    .replace(/\b(?:gr|ref|sup|ck|cor|sc|edge|node|est|evt):[a-z0-9_-]+/gi, (m) => prettify(m))
    .replace(/\d+\.\d{3,}/g, (m) => String(Math.round(parseFloat(m) * 10) / 10))
    .replace(/(\w)\/(\w)/g, '$1 · $2');
}

const LEVER_PLAIN: Record<string, string> = {
  reroute: 'reroute spot cargo',
  divert_on_water: 'divert on-water cargo',
  stock_draw: 'strategic reserve draw',
  floating_storage: 'floating storage',
  demand_side: 'demand cut',
};
export const leverPlain = (l: string): string => LEVER_PLAIN[l] ?? prettify(l);
