import type { AuditEntry } from '../../contracts/types';

export default function AuditTrace({ entries, verified }: { entries: AuditEntry[]; verified?: boolean }) {
  return (
    <div>
      <div className="panel-title">
        AUDIT
        {verified !== undefined && (
          <span className="chip" style={{ marginLeft: 8, color: verified ? 'var(--green)' : 'var(--red)', borderColor: 'currentcolor' }}>
            <span className="chip-dot" style={{ background: 'currentcolor' }} />
            {verified ? 'VERIFIED' : 'CHAIN BROKEN'}
          </span>
        )}
      </div>
      {entries.map((e) => (
        <div key={e.seq} className="audit-row" title={e.output_hash}>
          <span style={{ color: 'var(--muted)' }}>{e.seq}</span>
          <span>{e.actor}</span>
          <span>{e.action}</span>
          <span style={{ color: 'var(--accent)' }}>{e.output_hash.slice(0, 8)}</span>
        </div>
      ))}
    </div>
  );
}
