import { Icon } from './Icons';

interface HeaderProps {
  onBack?: () => void;
  subtitle?: string;
  model: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ onBack, subtitle, model, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        {onBack ? (
          <>
            <button type="button" className="topbar-back" onClick={onBack} title="Volver">
              <Icon.back size={20} />
            </button>
            <span className="brand-name" style={{ marginLeft: 4 }}>{subtitle}</span>
          </>
        ) : (
          <>
            <span className="brand-mark" style={{ width: 38, height: 38, fontSize: 17 }}>A</span>
            <span className="brand-name">ACGen</span>
            <span className="brand-sub">Generador de artefactos QA</span>
          </>
        )}
      </div>
      <div className="topbar-right">
        <span className="model-chip">
          <Icon.spark size={14} />
          {model}
        </span>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Icon.sun size={18} /> : <Icon.moon size={18} />}
        </button>
      </div>
    </header>
  );
}
