import type { AuditEntry } from '../../contracts/types';

const ACTION_PLAIN: Record<string, string> = {
  propose: 'AI proposed the options',
  criticize: 'critic checked the rules',
  arbitrate: 'arbiter ruled',
  set_charter_param: 'you edited a rule',
};

/** Print just the audit trace on white — the signed one-page prop (presentation-only). */
function printTrace(): void {
  document.body.classList.add('print-audit');
  const done = () => document.body.classList.remove('print-audit');
  window.addEventListener('afterprint', done, { once: true });
  window.print();
}

export default function AuditTrace({ entries, verified }: { entries: AuditEntry[]; verified?: boolean }) {
  return (
    <div className="audit-print-root">
      <div className="panel-title">
        The proof
        {verified !== undefined && (
          <span className="audit-seal" style={{ color: verified ? 'var(--green)' : 'var(--red)', borderColor: 'currentcolor' }}>
            <span className="chip-dot" style={{ background: 'currentcolor' }} />
            {verified ? 'VERIFIED ✓' : 'CHAIN BROKEN'}
          </span>
        )}
        <button className="audit-print-btn no-print" onClick={printTrace} title="Print the hash-chained trace on white — the signed one-page prop">⎙ PRINT</button>
      </div>
      <div className="panel-sub">Every step is hash-chained and re-runs byte-identically — offline.</div>
      <div className="audit-print-head print-only">
        <b>TRINETRA — Decision audit trace (Hormuz 2026 replay)</b><br />
        Hash-chained (SHA-256, prev→output); re-runs byte-identically, offline.
        Chain status: {verified ? 'VERIFIED' : 'UNVERIFIED'}. Signed: ____________________
      </div>
      {entries.map((e) => (
        <div key={e.seq} className="audit-row" title={e.output_hash}>
          <span className="mono" style={{ color: 'var(--dim)' }}>{e.seq}</span>
          <span style={{ color: 'var(--dim)' }}>{e.actor}</span>
          <span>{ACTION_PLAIN[e.action] ?? e.action}</span>
          <span className="a-hash">{e.output_hash.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  );
}
