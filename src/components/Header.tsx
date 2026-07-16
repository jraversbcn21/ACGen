import { Icon } from './Icons';
import { WorkspacePicker } from './WorkspacePicker';
import { useLang } from '../i18n/I18nContext';
import type { Workspace } from '../types/workspace';

interface HeaderProps {
  model: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onExportWorkspace: (id: string) => void;
  onImportWorkspace: (json: string) => void;
}

export function Header({
  model,
  theme,
  onToggleTheme,
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onExportWorkspace,
  onImportWorkspace,
}: HeaderProps) {
  const { lang, setLang } = useLang();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" style={{ width: 38, height: 38, fontSize: 17 }}>A</span>
        <span className="brand-name">ACGen</span>
        <span className="brand-sub">Workbench de artefactos QA</span>
      </div>
      <div className="topbar-right">
        <WorkspacePicker
          workspaces={workspaces}
          activeId={activeWorkspaceId}
          onSelect={onSelectWorkspace}
          onCreate={onCreateWorkspace}
          onRename={onRenameWorkspace}
          onDelete={onDeleteWorkspace}
          onExport={onExportWorkspace}
          onImport={onImportWorkspace}
        />
        <span className="model-chip">
          <Icon.spark size={14} />
          {model}
        </span>
        <button type="button" className="btn-ghost" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
          style={{ fontSize: 12, padding: '2px 8px' }} title="Idioma / Language">
          {lang === 'es' ? 'EN' : 'ES'}
        </button>
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
