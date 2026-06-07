import { ApiKeyConfig } from './ApiKeyConfig';
import { ModelSelector } from './ModelSelector';
import { Icon } from './Icons';

interface LandingScreenProps {
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata') => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
}

const tools = [
  {
    id: 'acceptance' as const,
    icon: Icon.criterios,
    title: 'Criterios de aceptación',
    desc: 'Genera criterios desde requerimientos funcionales',
    tag: 'QA',
  },
  {
    id: 'testcase' as const,
    icon: Icon.testcase,
    title: 'Test Case Generator',
    desc: 'Genera casos de prueba QA para ecommerce',
    tag: 'QA',
  },
  {
    id: 'bugreport' as const,
    icon: Icon.bug,
    title: 'Bug Report Generator',
    desc: 'Genera reportes de bugs estructurados para Jira',
    tag: 'QA',
  },
  {
    id: 'testdata' as const,
    icon: Icon.datos,
    title: 'Datos de Prueba',
    desc: 'Genera datos de prueba realistas por mercado',
    tag: 'Datos',
  },
];

export function LandingScreen({ onSelect, apiKey, onApiKeyChange, model, onModelChange }: LandingScreenProps) {
  return (
    <>
      <div className="hero">
        <p className="eyebrow">Sesión de QA · Jorgito</p>
        <h1 className="hero-title">
          <span className="b">AC</span>Gen{' '}
          <span className="greet-serif">¿En qué quieres trabajar hoy?</span>
        </h1>
      </div>

      <div className="config-strip">
        <ApiKeyConfig apiKey={apiKey} onChange={onApiKeyChange} />
        <ModelSelector model={model} onChange={onModelChange} />
      </div>

      <div className="sec-head">
        <h2 className="sec-title">Generadores</h2>
        <span className="sec-count">04</span>
      </div>

      <div className="tool-list">
        {tools.map((t, i) => {
          const num = String(i + 1).padStart(2, '0');
          return (
            <button key={t.id} type="button" className="tool-row" onClick={() => onSelect(t.id)}>
              <span className="row-num">{num}</span>
              <span className="tool-ico"><t.icon size={22} /></span>
              <div className="row-body">
                <span className="row-title">{t.title}</span>
                <span className="row-desc">{t.desc}</span>
              </div>
              <span className="row-tag">{t.tag}</span>
              <span className="row-arrow"><Icon.arrow size={20} /></span>
            </button>
          );
        })}
      </div>

      <div className="add-slot">
        <span className="add-plus">+</span>
        Más generadores próximamente
      </div>
    </>
  );
}
