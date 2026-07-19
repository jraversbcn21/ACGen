import { useState, useRef, useEffect } from 'react';
import { useT, useLang } from '../i18n/I18nContext';
import { useBackupReminder } from '../hooks/useBackupReminder';
import { createBackup, parseImportFile, restoreBackup, type BackupFile } from '../services/backup';
import { downloadJson, toFilename } from '../utils/download';

interface BackupMenuProps {
  onImportLegacyWorkspace: (json: string) => void;
  onRestored?: () => void; // default: () => location.reload()
}

export function BackupMenu({ onImportLegacyWorkspace, onRestored }: BackupMenuProps) {
  const [open, setOpen] = useState(false);
  const [includeApiKeys, setIncludeApiKeys] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<BackupFile | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const { lang } = useLang();
  const { due, lastBackupAt, markDone } = useBackupReminder();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = () => {
    const content = createBackup({ includeApiKeys });
    const filename = toFilename(`acgen-backup-${new Date().toISOString().slice(0, 10)}`, 'json');
    downloadJson(filename, content);
    markDone();
    setOpen(false);
  };

  const handleImportClick = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      const result = parseImportFile(json);
      switch (result.kind) {
        case 'backup':
          setPendingRestore(result.backup);
          break;
        case 'legacyWorkspace':
          onImportLegacyWorkspace(result.json);
          alert(t('backup.legacyImported'));
          setOpen(false);
          break;
        case 'futureVersion':
          alert(t('backup.futureVersion'));
          break;
        case 'invalid':
          alert(t('backup.importError'));
          break;
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmRestore = () => {
    if (!pendingRestore) return;
    const result = restoreBackup(pendingRestore);
    setPendingRestore(null);
    if (result.ok) {
      setOpen(false);
      (onRestored ?? (() => location.reload()))();
    } else {
      alert(t('backup.quotaError'));
    }
  };

  const handleCancelRestore = () => {
    setPendingRestore(null);
  };

  const lastBackupLabel = lastBackupAt
    ? t('backup.lastBackup', { date: new Date(lastBackupAt).toLocaleString(lang === 'es' ? 'es-ES' : 'en-US') })
    : t('backup.never');

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="theme-toggle backup-menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('backup.menuLabel')}
        title={due ? t('backup.reminder') : undefined}
      >
        💾
        {due && <span className="backup-badge" aria-hidden="true" />}
      </button>

      {open && (
        <div className="backup-panel">
          <div className="backup-panel-title">{t('backup.title')}</div>
          <div className="backup-last">{lastBackupLabel}</div>
          {due && <div className="backup-reminder-text">{t('backup.reminder')}</div>}

          <div className="backup-section">
            <label className="backup-checkbox-label">
              <input
                type="checkbox"
                checked={includeApiKeys}
                onChange={(e) => setIncludeApiKeys(e.target.checked)}
              />
              {t('backup.includeKeys')}
            </label>
            {includeApiKeys && <div className="backup-warning">{t('backup.includeKeysWarning')}</div>}
            <button type="button" className="btn-primary" onClick={handleExport}>
              {t('backup.exportAll')}
            </button>
          </div>

          <div className="backup-section">
            {pendingRestore ? (
              <div className="backup-confirm">
                <span>{t('backup.confirmReplace')}</span>
                <div className="backup-confirm-actions">
                  <button type="button" className="btn-primary" onClick={handleConfirmRestore}>
                    {t('backup.confirmReplaceYes')}
                  </button>
                  <button type="button" className="btn-ghost" onClick={handleCancelRestore}>
                    {t('backup.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-ghost" onClick={handleImportClick}>
                {t('backup.import')}
              </button>
            )}
            <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
          </div>
        </div>
      )}
    </div>
  );
}
