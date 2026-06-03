import { AVALIABLE_MODELS } from '../config/constants';

interface ModelSelectorProps {
  model: string;
  onChange: (model: string) => void;
}

export function ModelSelector({ model, onChange }: ModelSelectorProps) {
  return (
    <div className="config-section">
      <label htmlFor="model-select" className="config-label">
        Modelo de IA
      </label>
      <select
        id="model-select"
        value={model}
        onChange={(e) => onChange(e.target.value)}
        className="input input-select"
      >
        {AVALIABLE_MODELS.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
