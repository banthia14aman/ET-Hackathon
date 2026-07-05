import type { AuditEntry } from '../../contracts/types';

const ACTION_PLAIN: Record<string, string> = {
  propose: 'AI proposed the options',
  criticize: 'critic checked the rules',
  arbitrate: 'arbiter ruled',
  set_charter_param: 'you edited a rule',
};

export default function AuditTrace({ entries, verified }: { entries: AuditEntry[]; verified?: boolean }) {
  return (
    <div>
      <div className="panel-title">
        The proof
        {verified !== undefined && (
          <span className="audit-seal" style={{ color: verified ? 'var(--green)' : 'var(--red)', borderColor: 'currentcolor' }}>
            <span className="chip-dot" style={{ background: 'currentcolor' }} />
            {verified ? 'VERIFIED ✓' : 'CHAIN BROKEN'}
          </span>
        )}
      </div>
      <div className="panel-sub">Every step is hash-chained and re-runs byte-identically — offline.</div>
      {entries.map((e) => (
        <div key={e.seq} className="audit-row" title={e.output_hash}>
          <span className="mono" style={{ color: 'var(--muted)' }}>{e.seq}</span>
          <span style={{ color: 'var(--muted)' }}>{e.actor}</span>
          <span>{ACTION_PLAIN[e.action] ?? e.action}</span>
          <span className="a-hash">{e.output_hash.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  );
}
