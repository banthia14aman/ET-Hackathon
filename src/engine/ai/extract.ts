// AI SENSE-MAKING — turn unstructured operator text into CANDIDATE structured facts.
// Two adapters, one output shape:
//   • live: an OpenAI-compatible chat model (set VITE_AI_ENDPOINT + VITE_AI_KEY), asked for
//     strict JSON matching CandidateFactsSchema. Provider-agnostic; runs only when configured.
//   • offline: a deterministic keyword extractor — the airplane-mode stand-in for the LLM,
//     clearly labelled, so the demo works with no network.
// CRITICAL: whatever comes back is a CANDIDATE. It is NOT trusted here. The deterministic
// validate.ts gate (strict schema + domain rules) decides what actually reaches the engine.

import type { CandidateFacts } from '../../contracts/types';
import { chatLive, llmEndpoint, DEFAULT_LLM_MODEL } from './llm';

export interface ExtractOpts { endpoint?: string; apiKey?: string; model?: string; }

const CHOKES: [RegExp, string][] = [
  [/strait of hormuz|hormuz/i, 'hormuz'],
  [/bab[- ]?el[- ]?mandeb|red sea|houthi/i, 'bab-el-mandeb'],
  [/suez|sumed/i, 'suez'],
  [/malacca/i, 'malacca'],
];
const GRADES: [RegExp, string][] = [
  [/merey/i, 'gr:merey-16'], [/urals/i, 'gr:urals'], [/girassol/i, 'gr:girassol'],
  [/cabinda/i, 'gr:cabinda'], [/wti|midland/i, 'gr:wti-midland'], [/bonny/i, 'gr:bonny-light'],
  [/tupi|lula/i, 'gr:tupi'], [/murban/i, 'gr:murban'], [/arab light/i, 'gr:arab-light'],
  [/basrah/i, 'gr:basrah-heavy'],
];
const REFS: [RegExp, string][] = [
  [/jamnagar/i, 'ref:jamnagar'], [/vadinar/i, 'ref:vadinar'], [/paradip/i, 'ref:paradip'],
  [/kochi/i, 'ref:kochi'], [/mangalore/i, 'ref:mangalore'], [/mumbai/i, 'ref:mumbai'],
  [/visakh/i, 'ref:visakh'], [/panipat/i, 'ref:panipat'], [/koyali/i, 'ref:koyali'],
];

/** Deterministic offline stand-in for the LLM. Pure (no clock/network/randomness). */
export function heuristicExtract(text: string): CandidateFacts {
  const out: CandidateFacts = {};
  const severe = /clos|shut|block|sever|halt|declar/i.test(text);
  const shocks = CHOKES.filter(([re]) => re.test(text))
    .map(([, key]) => ({ chokepoint: key, severity: (severe ? 'severe' : 'partial') as 'partial' | 'severe' }));
  if (shocks.length) out.shocks = shocks;

  // capture up to 4 digits on purpose — an absurd price ($9000) is EXTRACTED as a candidate and
  // then REJECTED by the deterministic gate, which is exactly the guardrail we want to show.
  const brentM = /(?:brent|crude|oil|price)[^.$0-9]{0,14}\$?\s?(\d{2,4})/i.exec(text) || /\$\s?(\d{2,4})\b/.exec(text);
  if (brentM) out.brent_usd = Number(brentM[1]);

  const grade = GRADES.find(([re]) => re.test(text))?.[1];
  const ref = REFS.find(([re]) => re.test(text))?.[1];
  if (grade || ref) {
    const volM = /(\d{1,4})\s*(?:kb|mb|mbbl|kbd|k bbl|thousand barrels)/i.exec(text);
    const cargo: CandidateFacts['cargoes'] = [{
      ...(grade ? { grade } : {}), ...(ref ? { target_refinery: ref } : {}),
      ...(volM ? { volume_kb: Number(volM[1]) * (/mb|mbbl/i.test(volM[0]) ? 1000 : 1) } : {}),
    }];
    out.cargoes = cargo;
  }

  // up to 3 digits so an absurd floor (200) is EXTRACTED then REJECTED by the gate (>90).
  const floorM = /(?:floor|cover|days? of cover|min[- ]?cover)[^0-9]{0,12}(\d{1,3})/i.exec(text)
    || /(\d{1,3})\s*days? of cover/i.exec(text);
  if (floorM) out.charter = [{ article: 'A2', value: Number(floorM[1]) }];

  out.summary = `Read ${shocks.length} chokepoint disruption(s)${out.brent_usd ? `, Brent ~$${out.brent_usd}` : ''}${out.cargoes ? ', a cargo offer' : ''}${out.charter ? ', a charter change' : ''}.`;
  return out;
}

const SYS = `You extract STRUCTURED CANDIDATE FACTS from a crude-supply operator note.
Return ONLY minified JSON matching this TypeScript type — no prose, no markdown fence:
{shocks?:{chokepoint:"hormuz"|"bab-el-mandeb"|"suez"|"malacca",severity:"partial"|"severe"}[],
 brent_usd?:number, cargoes?:{grade?:string,origin?:string,volume_kb?:number,target_refinery?:string}[],
 charter?:{article:"A2"|"A3",value:number}[], summary?:string}
RULES: extract ONLY facts explicitly stated in the text; never invent a number, grade, or refinery;
never output a score, ranking, verdict, or recommendation; omit any field you are unsure about.`;

/** Extract candidate facts. LIVE BY DEFAULT in the browser (via the key-holding Cloudflare
    Worker — record-replay in llm.ts); deterministic offline stand-in in Node or on failure. */
export async function extractFacts(
  text: string, opts: ExtractOpts = {},
): Promise<{ candidates: CandidateFacts; model: string; live: boolean }> {
  const endpoint = opts.endpoint ?? llmEndpoint();
  if (endpoint) {
    const model = opts.model || DEFAULT_LLM_MODEL;
    try {
      const rec = await chatLive(
        [{ role: 'system', content: SYS }, { role: 'user', content: text }],
        { endpoint, apiKey: opts.apiKey, model, temperature: 0.1 },
      );
      const raw = rec.text.replace(/```json|```/g, '').trim();
      // still a CANDIDATE — validate.ts gates it
      return { candidates: JSON.parse(raw) as CandidateFacts, model: rec.model, live: true };
    } catch {
      return { candidates: heuristicExtract(text), model: `offline-heuristic (live ${model} unreachable)`, live: false };
    }
  }
  return { candidates: heuristicExtract(text), model: 'offline-heuristic (deterministic stand-in)', live: false };
}
