interface LandingScreenProps {
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata') => void;
}

export function LandingScreen({ onSelect }: LandingScreenProps) {
  return (
    <div className="landing">
      <h2 className="landing-question">¿En qué quieres trabajar hoy?</h2>
      <div className="landing-buttons">
        <button
          type="button"
          className="btn btn-landing"
          onClick={() => onSelect('acceptance')}
        >
          <span className="landing-icon">📋</span>
          <span className="landing-label">Criterios de aceptación</span>
          <span className="landing-desc">Genera criterios desde requerimientos funcionales</span>
        </button>
        <button
          type="button"
          className="btn btn-landing"
          onClick={() => onSelect('testcase')}
        >
          <span className="landing-icon">🧪</span>
          <span className="landing-label">Test Case Generator</span>
          <span className="landing-desc">Genera casos de prueba QA para ecommerce</span>
        </button>
        <button
          type="button"
          className="btn btn-landing"
          onClick={() => onSelect('bugreport')}
        >
          <span className="landing-icon">🐛</span>
          <span className="landing-label">Bug Report Generator</span>
          <span className="landing-desc">Genera reportes de bugs estructurados para Jira</span>
        </button>
        <button
          type="button"
          className="btn btn-landing"
          onClick={() => onSelect('testdata')}
        >
          <span className="landing-icon">📊</span>
          <span className="landing-label">Datos de Prueba</span>
          <span className="landing-desc">Genera datos de prueba realistas por mercado</span>
        </button>
      </div>
    </div>
  );
}
