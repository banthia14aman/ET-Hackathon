import type { CharterArticle } from '../../contracts/types';

export default function CharterPanel({
  charter,
  onParamChange,
}: {
  charter: CharterArticle[];
  onParamChange?: (id: string, value: number) => void;
}) {
  return (
    <div>
      <div className="panel-title">CHARTER</div>
      {charter.map((a) => (
        <div key={a.id} className="charter-row" title={a.description}>
          <span className="charter-id">{a.id}</span>
          <span className="charter-title">{a.title}</span>
          {a.param_key && (
            <label className="charter-param">
              {a.param_key.replace(/_/g, ' ').toUpperCase()}
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
