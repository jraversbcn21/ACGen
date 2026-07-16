import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspacePicker } from './WorkspacePicker';
import { I18nProvider } from '../i18n/I18nContext';
import type { Workspace } from '../types/workspace';

function workspace(id: string, name: string): Workspace {
  return { id, name, createdAt: 1, artifacts: [] };
}

const ALPHA = workspace('ws-1', 'Proyecto Alpha');
const BETA = workspace('ws-2', 'Proyecto Beta');

function renderPicker(workspaces: Workspace[] = [ALPHA, BETA]) {
  const onDelete = vi.fn();
  render(
    <I18nProvider>
      <WorkspacePicker
        workspaces={workspaces}
        activeId={ALPHA.id}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onRename={vi.fn()}
        onDelete={onDelete}
        onExport={vi.fn()}
        onImport={vi.fn()}
      />
    </I18nProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Proyecto Alpha/ })); // open the dropdown
  return onDelete;
}

const trashButtons = () => screen.getAllByRole('button', { name: /eliminar/i });

/**
 * Deleting a workspace destroys it and up to 50 artifacts with no undo, so the
 * trash icon must not be a one-click action.
 */
describe('WorkspacePicker — delete confirmation', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('does not delete on the first click of the trash icon', () => {
    const onDelete = renderPicker();
    fireEvent.click(trashButtons()[0]);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('asks for confirmation and deletes only after it is given', () => {
    const onDelete = renderPicker();
    fireEvent.click(trashButtons()[0]);

    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('ws-1');
  });

  it('abandons the delete when the confirmation is dismissed', () => {
    const onDelete = renderPicker();
    fireEvent.click(trashButtons()[0]);
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onDelete).not.toHaveBeenCalled();
    // Back to the normal row, ready to try again.
    expect(screen.queryByRole('button', { name: /confirmar/i })).not.toBeInTheDocument();
    expect(trashButtons()).toHaveLength(2);
  });

  it('only ever pends one confirmation at a time', () => {
    renderPicker();
    fireEvent.click(trashButtons()[0]);
    fireEvent.click(trashButtons()[0]); // the remaining trash icon belongs to Beta

    expect(screen.getAllByRole('button', { name: /confirmar/i })).toHaveLength(1);
  });

  it('deletes the workspace whose confirmation was accepted', () => {
    const onDelete = renderPicker();
    fireEvent.click(trashButtons()[1]); // Beta
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    expect(onDelete).toHaveBeenCalledWith('ws-2');
  });
});
