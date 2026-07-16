import { Icon } from './Icons';

interface HeaderProps {
  model: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export function Header({ model, theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" style={{ width: 38, height: 38, fontSize: 17 }}>A</span>
        <span className="brand-name">ACGen</span>
        <span className="brand-sub">Workbench de artefactos QA</span>
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
