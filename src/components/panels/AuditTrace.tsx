import { useState } from 'react';
import type { AuditEntry } from '../../contracts/types';
import { verifyChain } from '../../engine/charter/audit';

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
  // Tamper test (presentation-only): flip one byte of a real entry's hash, re-run the SAME
  // verifyChain the checks assert, watch the seal flip to CHAIN BROKEN, then restore. Makes the
  // integrity check falsifiable on camera; the mutation is explicitly labelled a test.
  const [tampered, setTampered] = useState<{ seq: number } | null>(null);
  const shown: AuditEntry[] = tampered
    ? entries.map((e) => (e.seq === tampered.seq
      ? { ...e, output_hash: (e.output_hash[0] === 'f' ? '0' : 'f') + e.output_hash.slice(1) }
      : e))
    : entries;
  const okNow = tampered ? verifyChain(shown) : (verified ?? verifyChain(entries));

  const runTamper = (): void => {
    const target = entries[Math.max(0, Math.floor(entries.length / 2))];
    if (!target) return;
    setTampered({ seq: target.seq });
    window.setTimeout(() => setTampered(null), 3200);
  };

  return (
    <div className="audit-print-root">
      <div className="panel-title">
        The proof
        <span className={`audit-seal ${okNow ? 'seal-ok' : 'seal-broken'}`} style={{ color: okNow ? 'var(--green)' : 'var(--red)', borderColor: 'currentcolor' }}>
          <span className="chip-dot" style={{ background: 'currentcolor' }} />
          {okNow ? 'VERIFIED ✓' : 'CHAIN BROKEN'}
        </span>
        <button className="audit-print-btn no-print" onClick={runTamper} disabled={!!tampered}
          title="Flip one byte of a recorded hash and re-run verifyChain live — the seal turns red, then restores">⚡ TAMPER TEST</button>
        <button className="audit-print-btn no-print" onClick={printTrace} title="Print the hash-chained trace on white — the signed one-page prop">⎙ PRINT</button>
      </div>
      <div className="panel-sub">
        {tampered
          ? <span style={{ color: 'var(--red)' }}>One byte of step {tampered.seq}’s fingerprint was altered — every later link breaks and the seal fails. Restoring…</span>
          : 'Every step is hash-chained and re-runs byte-identically — offline.'}
      </div>
      <div className="audit-print-head print-only">
        <b>TRINETRA — Decision audit trace (Hormuz 2026 replay)</b><br />
        Hash-chained (SHA-256, prev→output); re-runs byte-identically, offline.
        Chain status: {okNow ? 'VERIFIED' : 'UNVERIFIED'}. Signed: ____________________
      </div>
      {shown.map((e) => {
        const broken = !!tampered && e.seq >= tampered.seq;
        return (
          <div key={e.seq} className={`audit-row${broken ? ' audit-row-broken' : ''}`} title={e.output_hash}>
            <span className="mono" style={{ color: 'var(--dim)' }}>{e.seq}</span>
            <span style={{ color: 'var(--dim)' }}>{e.actor}</span>
            <span>{ACTION_PLAIN[e.action] ?? e.action}</span>
            <span className="a-hash" style={broken ? { color: 'var(--red)' } : undefined}>{e.output_hash.slice(0, 8)}</span>
          </div>
        );
      })}
    </div>
  );
}
