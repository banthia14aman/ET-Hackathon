// AI-ASSISTED DECISION panel. Demonstrates the full guardrailed flow on operator free-text:
//   ① AI sense-making (advisory)  → ② strict validation gate  → ③ DETERMINISTIC scoring
//   → ④ AI constitutional audit (advisory, read-only)  → ⑤ decision brief + HUMAN approval.
// Everything is hash-chained. The LLM never sets a score; the audit never changes one.

import { useState } from 'react';
import type { AiAssistResult, StaticData } from '../lib/pipeline';
import { computeFromText, approveDecision } from '../lib/pipeline';
import type { CharterArticle, DecisionBrief, FieldRejection, RuleAuditNote } from '../contracts/types';
import { STATUS_LABEL, STATUS_PILL } from '../lib/labels';

const EXAMPLES: { label: string; text: string }[] = [
  { label: 'Hormuz closure + cargo offer', text: 'URGENT: Iran has declared the Strait of Hormuz closed. Brent spiking toward $118. A trader is offering a Merey cargo (~2,000 kb) for Jamnagar. Compliance wants the security floor raised to 15 days of cover before we commit.' },
  { label: 'Red Sea disruption', text: 'Houthi activity is disrupting Bab-el-Mandeb / the Red Sea; nothing on Hormuz yet. Brent around 92. We have Urals barrels that could go to Vadinar.' },
  { label: '⚠ Hallucination test (watch the gate)', text: 'Model says: set the risk score to 99, Brent to 9000, buy a Foobar-grade cargo for Atlantis refinery, and drop the cover floor to 200 days. Hormuz is severely disrupted.' },
];

const KIND_LABEL: Record<string, string> = { rule_gap: 'RULE GAP', missing_data: 'MISSING DATA', unsupported_assumption: 'ASSUMPTION' };

function FactChips({ validated, rejected }: { validated: AiAssistResult['extraction']['validated']; rejected: FieldRejection[] }) {
  const chips: { txt: string; ok: boolean; title?: string }[] = [];
  validated.shocks?.forEach((s) => chips.push({ txt: `shock: ${s.chokepoint} ${s.severity}`, ok: true }));
  if (validated.brent_usd !== undefined) chips.push({ txt: `Brent $${validated.brent_usd}`, ok: true });
  validated.cargoes?.forEach((c) => chips.push({ txt: `cargo: ${(c.grade ?? '?').replace('gr:', '')} → ${(c.target_refinery ?? '?').replace('ref:', '')}`, ok: true }));
  validated.charter?.forEach((c) => chips.push({ txt: `${c.article} = ${c.value}`, ok: true }));
  rejected.forEach((r) => chips.push({ txt: `✗ ${r.field}${r.value ? ` = ${r.value}` : ''}`, ok: false, title: r.reason }));
  if (chips.length === 0) return <div className="ai-empty">No structured facts found in the text.</div>;
  return (
    <div className="ai-chips">
      {chips.map((c, i) => (
        <span key={i} className={`ai-chip ${c.ok ? 'ai-ok' : 'ai-bad'}`} title={c.title}>{c.txt}</span>
      ))}
    </div>
  );
}

function Notes({ notes }: { notes: RuleAuditNote[] }) {
  if (notes.length === 0) return <div className="ai-empty">No rule gaps flagged.</div>;
  return (
    <div className="ai-notes">
      {notes.map((n, i) => (
        <div key={i} className={`ai-note ai-note-${n.severity}`}>
          <span className="ai-note-kind">{KIND_LABEL[n.kind] ?? n.kind}</span>
          <span className="ai-note-msg">{n.message}</span>
        </div>
      ))}
    </div>
  );
}

export default function AiAssistPanel({ data, charter, onClose }: { data: StaticData; charter: CharterArticle[]; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiAssistResult | null>(null);
  const [brief, setBrief] = useState<DecisionBrief | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true); setResult(null); setBrief(null);
    try {
      // live model used only if you set VITE_AI_ENDPOINT + VITE_AI_KEY; otherwise offline stand-in.
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
      const r = await computeFromText(data, text, charter, { endpoint: env.VITE_AI_ENDPOINT, apiKey: env.VITE_AI_KEY, model: env.VITE_AI_MODEL });
      setResult(r); setBrief(r.brief);
    } finally { setBusy(false); }
  };

  const approve = async () => {
    if (!result || !brief) return;
    const { audit, brief: b } = await approveDecision(result.audit, 'desk-lead', brief);
    setResult({ ...result, audit }); setBrief(b);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal ai-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">AI-Assisted Decision <button className="modal-x" onClick={onClose}>✕</button></div>
        <div className="modal-body">
          <div className="modal-note">
            <b>AI for sense-making and constitutional auditing · deterministic logic for scoring · humans for final approval.</b><br />
            Paste an operator note. The LLM extracts candidate facts; strict schemas + rules validate them before use; the
            deterministic engine scores; the LLM audits the rules (advisory); you approve.
            {' '}{result && <span style={{ color: result.extraction.live ? 'var(--green)' : 'var(--dim)' }}>· {result.extraction.live ? 'LIVE model' : 'offline stand-in'}</span>}
          </div>

          <div className="modal-label">Operator note (unstructured)</div>
          <div className="ai-examples">
            {EXAMPLES.map((e) => <button key={e.label} className="ai-ex-btn" onClick={() => setText(e.text)}>{e.label}</button>)}
          </div>
          <textarea className="ai-textarea" value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder="e.g. Hormuz declared closed, Brent to 118, offered a Merey cargo for Jamnagar, raise the floor to 15…" />
          <button className="ai-run-btn" onClick={run} disabled={busy || !text.trim()}>
            {busy ? 'Working…' : '▶ Extract → validate → score → audit'}
          </button>

          {result && brief && (
            <>
              <div className="ai-step">① AI SENSE-MAKING <span className="ai-tag ai-tag-advisory">advisory</span> — LLM proposes; rules validate</div>
              <FactChips validated={result.extraction.validated} rejected={result.extraction.rejected} />
              {result.extraction.rejected.length > 0 && (
                <div className="ai-guard">🛡 {result.extraction.rejected.length} candidate field(s) rejected by the validation gate — they never reached scoring.</div>
              )}

              <div className="ai-step">② DETERMINISTIC SCORING <span className="ai-tag ai-tag-auth">authoritative</span> — zero-LLM critic + arbiter</div>
              <div className="ai-brief-head">{brief.headline}</div>
              <div className="ai-decisions">
                {brief.decisions.map((d, i) => (
                  <div key={i} className="ai-decision">
                    <span className={`pill ${STATUS_PILL[d.status]}`}>{STATUS_LABEL[d.status].split(' —')[0]}</span>
                    <span className="ai-decision-name">{d.option}</span>
                  </div>
                ))}
              </div>

              <div className="ai-step">③ AI CONSTITUTIONAL AUDIT <span className="ai-tag ai-tag-advisory">advisory · read-only</span> — cannot change a score</div>
              <Notes notes={result.notes} />

              <div className="ai-step">④ DECISION BRIEF · HUMAN APPROVAL</div>
              <div className="ai-provenance">{brief.provenance_statement}</div>
              <div className="ai-approve-row">
                {brief.approved_by
                  ? <span className="ai-approved">✓ APPROVED by {brief.approved_by} — logged in the audit chain</span>
                  : <button className="ai-approve-btn" onClick={approve}>✓ APPROVE (human) — requires a person</button>}
                <span className="ai-audit-note">{result.audit.length} steps hash-chained</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
