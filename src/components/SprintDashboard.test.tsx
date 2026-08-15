import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { SprintDashboard } from './SprintDashboard';
import { STORAGE_KEYS } from '../config/constants';
import type { Sprint } from '../hooks/useSprints';

function makeSprint(overrides: Partial<Sprint> = {}): Sprint {
  return {
    id: 's1', name: 'Sprint 25', startDate: '2026-08-01', endDate: null, archived: false,
    jql: {}, tabGrid: { resolved: [['', '', '', '', '']] }, ...overrides,
  };
}

function renderDashboard(props: Partial<Parameters<typeof SprintDashboard>[0]> = {}) {
  const defaultProps = {
    sprint: makeSprint(),
    onUpdateGridCell: vi.fn(),
    onSetTabGrid: vi.fn(),
    onMoveRow: vi.fn(),
    onArchive: vi.fn(),
  };
  return render(
    <I18nProvider>
      <SprintDashboard {...defaultProps} {...props} />
    </I18nProvider>
  );
}

describe('SprintDashboard con esquema', () => {
  it('GUARDIAN: sin clave acgen_schema pinta las pestanas y columnas de siempre', () => {
    localStorage.removeItem(STORAGE_KEYS.SCHEMA);
    renderDashboard();
    // jsdom reporta en-US, asi que la app renderiza en ingles.
    ['Resolved', 'Created', 'ReOpen', 'High Priority', 'JSD']
      .forEach((label) => expect(screen.getByRole('button', { name: label })).toBeInTheDocument());
    ['Ticket', 'Date', 'Priority', 'Author', 'Squad']
      .forEach((h) => expect(screen.getByText(h)).toBeInTheDocument());
  });

  it('una columna oculta desaparece del render y su dato sigue guardado', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [
        { id: 'ticket', label: 'Ticket' },
        { id: 'fecha', label: 'Fecha', hidden: true },
        { id: 'squad', label: 'Squad' },
      ] }] },
    }));
    const sprint = makeSprint({ tabGrid: { resolved: [['ACG-1', '2026-08-01', 'QA']] } });
    renderDashboard({ sprint });
    expect(screen.queryByText('Fecha')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('2026-08-01')).not.toBeInTheDocument();
    // El dato sigue en el sprint, intacto.
    expect(sprint.tabGrid.resolved[0][1]).toBe('2026-08-01');
  });

  it('una septima columna anadida es editable y escribe en su indice de datos', () => {
    const onUpdateGridCell = vi.fn();
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [
        { id: 'ticket', label: 'Ticket' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' },
        { id: 'd', label: 'D' }, { id: 'e', label: 'E' }, { id: 'f', label: 'F' },
        { id: 'entorno', label: 'Entorno' },
      ] }] },
    }));
    renderDashboard({
      sprint: makeSprint({ tabGrid: { resolved: [['', '', '', '', '', '']] } }),
      onUpdateGridCell,
    });
    expect(screen.getByText('Entorno')).toBeInTheDocument();
    // La fila guardada tiene 6 celdas; la septima se lee como '' y crece al escribir.
    const seventhCol = document.querySelector('input[data-row="0"][data-col="6"]')!;
    fireEvent.change(seventhCol, { target: { value: 'p' } });
    expect(onUpdateGridCell).toHaveBeenCalledWith('resolved', 0, 6, 'p');
  });

  it('una pestana anadida es navegable', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [
        { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'Ticket' }] },
        { id: 'nueva', label: 'Bloqueados', columns: [{ id: 'ticket', label: 'Clave' }] },
      ] },
    }));
    renderDashboard({ sprint: makeSprint({ tabGrid: { resolved: [['a']], nueva: [['']] } }) });
    fireEvent.click(screen.getByRole('button', { name: 'Bloqueados' }));
    expect(screen.getByText('Clave')).toBeInTheDocument();
  });

  it('la pestana oculta no se pinta', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [
        { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] },
        { id: 'jsd', label: 'JSD', hidden: true, columns: [{ id: 'jsd', label: 'J' }] },
      ] },
    }));
    renderDashboard();
    expect(screen.queryByRole('button', { name: 'JSD' })).not.toBeInTheDocument();
  });
});
