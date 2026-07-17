// Type-only re-exports for the AI-assist modules (erased at build — no runtime cycle).
export type { StaticData } from '../../lib/pipeline';
export type {
  AuditEntry, CandidateCharter, CandidateFacts, CharterArticle, DecisionBrief, ExtractionResult,
  FieldRejection, Objection, OptionCard, RuleAuditNote, ScenarioState, ShockContext, SpotCargo,
} from '../../contracts/types';
