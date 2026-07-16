import type { ViewType } from '../config/constants';

interface ChainOption {
  view: ViewType;
  label: string;
}

const CHAIN_RULES: Record<string, ChainOption[]> = {
  acceptance: [
    { view: 'testcase', label: 'Generar Casos de Prueba' },
    { view: 'edgecase', label: 'Generar Casos Limite' },
  ],
  userstory: [
    { view: 'acceptance', label: 'Generar Criterios' },
    { view: 'refiner', label: 'Refinar Historia' },
    { view: 'testcase', label: 'Generar Casos de Prueba' },
  ],
  testcase: [
    { view: 'edgecase', label: 'Generar Casos Limite' },
  ],
  refiner: [
    { view: 'userstory', label: 'Generar Historia' },
  ],
};

interface ChainMenuProps {
  sourceView: ViewType;
  content: string;
  onChain: (view: ViewType, prefill: string) => void;
}

export function ChainMenu({ sourceView, content, onChain }: ChainMenuProps) {
  const options = CHAIN_RULES[sourceView];
  if (!options || options.length === 0) return null;

  return (
    <div className="chain-menu" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>Enviar a:</span>
      {options.map((opt) => (
        <button
          key={opt.view}
          type="button"
          className="btn-ghost"
          style={{ fontSize: '0.8rem' }}
          onClick={() => onChain(opt.view, content)}
          title={opt.label}
        >
          {opt.label} →
        </button>
      ))}
    </div>
  );
}
