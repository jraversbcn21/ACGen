import { AVAILABLE_MODELS } from '../config/constants';

interface ModelSelectorProps {
  model: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ model, onChange }: ModelSelectorProps) {
  return (
    <div>
      <label htmlFor="model-select" className="field-label">
        Modelo de IA
      </label>
      <div className="input-wrap">
        <select
          id="model-select"
          value={model}
          onChange={(e) => onChange(e.target.value)}
          className="field-select"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
      </div>
    </div>
  );
}
