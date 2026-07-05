export default function TaxonomyCard({ shock, analogs }: { shock?: string; analogs?: { name: string; score: number }[] }) {
  return (
    <div>
      <div className="label">SHOCK TAXONOMY</div>
      <div className="taxonomy-shock">{shock ?? '—'}</div>
      {analogs && analogs.length > 0 && (
        <>
          <div className="label" style={{ marginTop: 12 }}>HISTORICAL ANALOGS</div>
          {analogs.map((a) => (
            <div key={a.name} className="taxonomy-analog">
              <span>{a.name}</span>
              {/* ponytail: no fmtScore in fmt.ts — reported to lead */}
              <span>{a.score.toFixed(2)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
