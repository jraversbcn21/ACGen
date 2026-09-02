import { Icon } from './Icons';
import { WorkspacePicker } from './WorkspacePicker';
import { BackupMenu } from './BackupMenu';
import { useLang, useT } from '../i18n/I18nContext';
import type { Workspace } from '../types/workspace';

interface HeaderProps {
  provider: string;
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
  onImportLegacyWorkspace: (json: string) => void;
}

export function Header({
  provider,
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
  onImportLegacyWorkspace,
}: HeaderProps) {
  const { lang, setLang } = useLang();
  const t = useT();

    return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" style={{ width: 38, height: 38, fontSize: 17 }}>A</span>
        <span className="brand-name">ACGen</span>
        <span className="brand-sub">{t('header.subtitle')}</span>
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
        <BackupMenu onImportLegacyWorkspace={onImportLegacyWorkspace} />
        <span className="model-chip">
          <Icon.spark size={14} />
          {provider !== 'groq' && (<>{provider === 'openrouter' ? 'OR' : 'C'}: </>)}
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
          title={theme === 'dark' ? t('header.themeLight') : t('header.themeDark')}
        >
          {theme === 'dark' ? <Icon.sun size={18} /> : <Icon.moon size={18} />}
        </button>
      </div>
    </header>
  );
}
