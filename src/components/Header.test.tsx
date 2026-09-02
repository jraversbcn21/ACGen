import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Header } from './Header';
import { I18nProvider } from '../i18n/I18nContext';
import type { Workspace } from '../types/workspace';

function workspace(id: string, name: string): Workspace {
  return { id, name, createdAt: 1, artifacts: [] };
}

function renderHeader(onImportLegacyWorkspace = vi.fn()) {
  render(
    <I18nProvider>
      <Header
        provider="groq"
        model="llama"
        theme="light"
        onToggleTheme={vi.fn()}
        workspaces={[workspace('ws-1', 'Proyecto Alpha')]}
        activeWorkspaceId="ws-1"
        onSelectWorkspace={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onRenameWorkspace={vi.fn()}
        onDeleteWorkspace={vi.fn()}
        onExportWorkspace={vi.fn()}
        onImportWorkspace={vi.fn()}
        onImportLegacyWorkspace={onImportLegacyWorkspace}
      />
    </I18nProvider>,
  );
  return { onImportLegacyWorkspace };
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

describe('Header — BackupMenu integration', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('renders the BackupMenu trigger', () => {
    renderHeader();
    expect(screen.getByRole('button', { name: /copias de seguridad/i })).toBeInTheDocument();
  });

  it('wires a legacy workspace import through to onImportLegacyWorkspace', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { onImportLegacyWorkspace } = renderHeader();

    fireEvent.click(screen.getByRole('button', { name: /copias de seguridad/i }));
    const legacyJson = JSON.stringify({ id: 'w1', name: 'Legacy', artifacts: [] });
    fireEvent.change(fileInput(), {
      target: { files: [new File([legacyJson], 'legacy.json', { type: 'application/json' })] },
    });

    await waitFor(() => expect(onImportLegacyWorkspace).toHaveBeenCalledWith(legacyJson));
  });
});

describe('Header — i18n', () => {
  it('el subtitulo de la marca y el tooltip del tema se traducen', () => {
    localStorage.setItem('acgen_lang', JSON.stringify('en'));
    renderHeader();
    expect(screen.getByText('QA artifact workbench')).toBeInTheDocument();
    expect(screen.getByTitle('Dark mode')).toBeInTheDocument();
  });
});
