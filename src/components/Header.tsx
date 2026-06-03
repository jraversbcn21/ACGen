interface HeaderProps {
  onBack?: () => void;
  subtitle?: string;
}

export function Header({ onBack, subtitle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-top">
        {onBack && (
          <button type="button" className="btn btn-back" onClick={onBack}>
            ← Volver
          </button>
        )}
        <h1>ACGen</h1>
      </div>
      <p className="subtitle">{subtitle || 'Generador automático de criterios de aceptación para QA'}</p>
    </header>
  );
}
