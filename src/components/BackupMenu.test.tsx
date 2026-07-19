import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { BackupMenu } from './BackupMenu';
import { I18nProvider } from '../i18n/I18nContext';
import { downloadJson } from '../utils/download';
import { STORAGE_KEYS } from '../config/constants';
import { BACKUP_SCHEMA_VERSION, type BackupFile } from '../services/backup';

vi.mock('../utils/download', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/download')>();
  return { ...actual, downloadJson: vi.fn() };
});

function seedWorkspaceWithArtifact() {
  localStorage.setItem(
    'acgen_workspaces',
    JSON.stringify([{ id: 'w1', name: 'Proyecto', createdAt: 1, artifacts: [{ id: 'a1' }] }]),
  );
}

function seedRecentBackup() {
  localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, JSON.stringify(Date.now()));
}

function makeBackupJson(overrides: Partial<BackupFile> = {}): string {
  return JSON.stringify({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { acgen_theme: '"dark"' },
    ...overrides,
  });
}

function renderMenu(props: Partial<ComponentProps<typeof BackupMenu>> = {}) {
  const onImportLegacyWorkspace = props.onImportLegacyWorkspace ?? vi.fn();
  const onRestored = props.onRestored ?? vi.fn();
  render(
    <I18nProvider>
      <BackupMenu onImportLegacyWorkspace={onImportLegacyWorkspace} onRestored={onRestored} />
    </I18nProvider>,
  );
  return { onImportLegacyWorkspace, onRestored };
}

function openPanel() {
  fireEvent.click(screen.getByRole('button', { name: /copias de seguridad/i }));
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function importJson(json: string, name = 'b.json') {
  fireEvent.change(fileInput(), {
    target: { files: [new File([json], name, { type: 'application/json' })] },
  });
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BackupMenu', () => {
  it('renders the trigger and shows a due badge only while a backup is pending', () => {
    seedWorkspaceWithArtifact();
    renderMenu();
    expect(screen.getByRole('button', { name: /copias de seguridad/i })).toBeInTheDocument();
    expect(document.querySelector('.backup-badge')).toBeInTheDocument();
  });

  it('hides the due badge once a recent backup exists', () => {
    seedWorkspaceWithArtifact();
    seedRecentBackup();
    renderMenu();
    expect(document.querySelector('.backup-badge')).not.toBeInTheDocument();
  });

  it('shows "never" in the panel when there is no prior backup', () => {
    renderMenu();
    openPanel();
    expect(screen.getByText('Nunca')).toBeInTheDocument();
  });

  it('shows the formatted last-backup date once a backup exists', () => {
    seedRecentBackup();
    renderMenu();
    openPanel();
    expect(screen.queryByText('Nunca')).not.toBeInTheDocument();
    expect(screen.getByText(/Última copia:/)).toBeInTheDocument();
  });

  it('exports a backup without API keys by default and records the backup time', () => {
    localStorage.setItem('acgen_key_groq', 'gsk_secret');
    localStorage.setItem('acgen_theme', '"dark"');
    renderMenu();
    openPanel();

    fireEvent.click(screen.getByRole('button', { name: /exportar copia completa/i }));

    expect(downloadJson).toHaveBeenCalledTimes(1);
    const [filename, content] = vi.mocked(downloadJson).mock.calls[0];
    expect(filename).toMatch(/^acgen-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(content).not.toContain('gsk_secret');
    expect(localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)).not.toBeNull();
  });

  it('includes API keys and shows the plaintext warning when the checkbox is checked', () => {
    localStorage.setItem('acgen_key_groq', 'gsk_secret');
    renderMenu();
    openPanel();

    fireEvent.click(screen.getByRole('checkbox', { name: /incluir api keys/i }));
    expect(screen.getByText(/texto plano/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /exportar copia completa/i }));
    const [, content] = vi.mocked(downloadJson).mock.calls[0];
    expect(content).toContain('gsk_secret');
  });

  it('asks for inline confirmation on a valid backup file, then restores and calls onRestored', async () => {
    seedRecentBackup();
    const lastBackupBefore = localStorage.getItem(STORAGE_KEYS.LAST_BACKUP);
    localStorage.setItem('acgen_theme', '"dark"');
    const { onRestored } = renderMenu();
    openPanel();

    importJson(makeBackupJson({ data: { acgen_theme: '"light"' } }));

    expect(await screen.findByText(/reemplazará TODOS/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sí, restaurar/i }));

    await waitFor(() => expect(onRestored).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('acgen_theme')).toBe('"light"');
    expect(localStorage.getItem(STORAGE_KEYS.LAST_BACKUP)).toBe(lastBackupBefore);
  });

  it('leaves localStorage untouched and does not call onRestored when the restore confirm is cancelled', async () => {
    localStorage.setItem('acgen_theme', '"dark"');
    const { onRestored } = renderMenu();
    openPanel();

    importJson(makeBackupJson({ data: { acgen_theme: '"light"' } }));
    await screen.findByText(/reemplazará TODOS/i);

    fireEvent.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(onRestored).not.toHaveBeenCalled();
    expect(localStorage.getItem('acgen_theme')).toBe('"dark"');
  });

  it('alerts on a corrupt import file and writes nothing', async () => {
    renderMenu();
    openPanel();

    importJson('{not json');

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Archivo de copia inválido.'));
    expect(localStorage.getItem('acgen_theme')).toBeNull();
  });

  it('alerts on a future schema version without restoring', async () => {
    renderMenu();
    openPanel();

    importJson(makeBackupJson({ schemaVersion: 99, data: {} }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('Esta copia fue creada por una versión más reciente de ACGen.'),
    );
    expect(localStorage.getItem('acgen_theme')).toBeNull();
  });

  it('delegates a legacy workspace file to onImportLegacyWorkspace and alerts', async () => {
    const legacyJson = JSON.stringify({ id: 'w1', name: 'Legacy', artifacts: [] });
    const { onImportLegacyWorkspace } = renderMenu();
    openPanel();

    importJson(legacyJson, 'legacy.json');

    await waitFor(() => expect(onImportLegacyWorkspace).toHaveBeenCalledWith(legacyJson));
    expect(window.alert).toHaveBeenCalledWith('Workspace importado (formato antiguo).');
  });

  it('closes the panel on click-outside', () => {
    renderMenu();
    openPanel();
    expect(screen.getByText('Copia de seguridad')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText('Copia de seguridad')).not.toBeInTheDocument();
  });
});
