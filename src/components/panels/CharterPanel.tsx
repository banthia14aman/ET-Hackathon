import type { CharterArticle } from '../../contracts/types';

const PARAM_PLAIN: Record<string, string> = {
  min_cover_days: 'min days of cover',
  max_corridor_share: 'max share via one chokepoint',
};

export default function CharterPanel({
  charter,
  onParamChange,
}: {
  charter: CharterArticle[];
  onParamChange?: (id: string, value: number) => void;
}) {
  return (
    <div>
      <div className="panel-title">The rules (charter)</div>
      <div className="panel-sub">The constitution the AI argues under. Edit a number → the plan re-decides itself.</div>
      {charter.map((a) => (
        <div key={a.id} className="charter-row" title={a.description}>
          <span className="charter-id">{a.id}</span>
          <span className="charter-title">{a.title}</span>
          {a.param_key && (
            <label className="charter-param">
              {PARAM_PLAIN[a.param_key] ?? a.param_key.replace(/_/g, ' ')}
              <input
                type="number"
                value={a.param_value ?? 0}
                onChange={(e) => onParamChange?.(a.id, Number(e.target.value))}
              />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
