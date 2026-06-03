interface RequirementInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  rows?: number;
}

export function RequirementInput({ value, onChange, placeholder, label, rows }: RequirementInputProps) {
  return (
    <div className="section">
      <label htmlFor="requirements" className="section-label">
        {label || 'Requerimientos / Historias de usuario'}
      </label>
      <textarea
        id="requirements"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Pega aquí los requerimientos funcionales, historias de usuario o cualquier información relevante...'}
        className="textarea textarea-input"
        rows={rows ?? 10}
      />
    </div>
  );
}
