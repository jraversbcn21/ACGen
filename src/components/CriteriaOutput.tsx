interface CriteriaOutputProps {
  value: string;
  onChange: (value: string) => void;
  generatedModel?: string;
}

export function CriteriaOutput({ value, onChange, generatedModel }: CriteriaOutputProps) {
  return (
    <div className="section output-section">
      <div className="output-header">
        <label htmlFor="criteria-output" className="section-label">
          Criterios de aceptación generados
        </label>
        {generatedModel && (
          <span className="model-badge">Modelo: {generatedModel}</span>
        )}
      </div>
      <textarea
        id="criteria-output"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="textarea textarea-output"
        readOnly={false}
        placeholder={!value ? 'Los criterios generados aparecerán aquí...' : undefined}
      />
    </div>
  );
}
