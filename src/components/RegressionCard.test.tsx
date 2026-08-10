import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionCard } from './RegressionCard';
import type { Regression } from '../hooks/useRegressions';

function makeRegression(overrides: Partial<Regression> = {}): Regression {
  return {
    id: 'reg-1',
    version: '1.0.0',
    url: 'Excel Regresión - https://sheets.example.com/reg/1',
    fecha: '2026-08-10',
    tickets: [
      { id: 't1', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
      { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
      { id: 't3', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
    ],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof RegressionCard>> = {}) {
  return render(
    <I18nProvider>
      <RegressionCard regression={makeRegression()} {...props} />
    </I18nProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RegressionCard', () => {
  it('shows version, formatted date, excel link name and filled-ticket badge', () => {
    renderCard({
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: 'PROJ-1 - https://j.example/browse/PROJ-1', fecha: '', prioridad: '', creador: '', squad: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
        ],
      }),
    });
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('10/08/2026')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Excel Regresión/ });
    expect(link).toHaveAttribute('href', 'https://sheets.example.com/reg/1');
    expect(screen.getByText('1 tickets')).toBeInTheDocument();
  });

  it('starts collapsed and expands to show the ticket table with its headers and 3 rows', () => {
    renderCard();
    expect(screen.queryByText('Prioridad')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    for (const h of ['Ticket', 'Prioridad', 'Creador', 'Squad']) {
      expect(screen.getByText(h)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('add ticket button calls onAddTicket; per-row × calls onDeleteTicket (confirm only when the row has content)', () => {
    const onAddTicket = vi.fn();
    const onDeleteTicket = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderCard({
      onAddTicket,
      onDeleteTicket,
      regression: makeRegression({
        tickets: [
          { id: 't1', ticket: '', fecha: '', prioridad: 'Alta', creador: '', squad: '' },
          { id: 't2', ticket: '', fecha: '', prioridad: '', creador: '', squad: '' },
        ],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    fireEvent.click(screen.getByText('+ Añadir ticket'));
    expect(onAddTicket).toHaveBeenCalledOnce();
    const deleteButtons = screen.getAllByLabelText('Eliminar');
    fireEvent.click(deleteButtons[1]); // fila vacía: sin confirm
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onDeleteTicket).toHaveBeenCalledWith('t2');
    fireEvent.click(deleteButtons[0]); // fila con contenido: confirm
    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onDeleteTicket).toHaveBeenCalledWith('t1');
  });

  it('editing a ticket cell calls onUpdateTicket with field and value', () => {
    const onUpdateTicket = vi.fn();
    renderCard({ onUpdateTicket });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    const firstRowInputs = document.querySelectorAll('tbody tr:first-child input');
    fireEvent.change(firstRowInputs[2], { target: { value: 'Alta' } });
    expect(onUpdateTicket).toHaveBeenCalledWith('t1', 'prioridad', 'Alta');
  });

  it('a "Nombre - URL" ticket cell shows the name overlay and ctrl+click opens the url', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderCard({
      regression: makeRegression({
        tickets: [{ id: 't1', ticket: 'PROJ-9 - https://j.example/browse/PROJ-9', fecha: '', prioridad: '', creador: '', squad: '' }],
      }),
    });
    fireEvent.click(screen.getByLabelText('Mostrar u ocultar tickets'));
    expect(screen.getByText('PROJ-9')).toBeInTheDocument();
    fireEvent.click(screen.getByDisplayValue('PROJ-9 - https://j.example/browse/PROJ-9'), { ctrlKey: true });
    expect(open).toHaveBeenCalledWith('https://j.example/browse/PROJ-9', '_blank', 'noopener,noreferrer');
  });

  it('Editar swaps the header for inputs and Guardar sends the patch', () => {
    const onUpdateRegression = vi.fn();
    renderCard({ onUpdateRegression });
    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByDisplayValue('1.0.0'), { target: { value: '1.0.1' } });
    fireEvent.click(screen.getByText('Guardar'));
    expect(onUpdateRegression).toHaveBeenCalledWith(
      expect.objectContaining({ version: '1.0.1', fecha: '2026-08-10' })
    );
  });

  it('Archivar and Eliminar delegate to their callbacks', () => {
    const onArchive = vi.fn();
    const onDelete = vi.fn();
    renderCard({ onArchive, onDelete });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onArchive).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Eliminar'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('readOnly + defaultExpanded: opens expanded, inputs readOnly, no mutation buttons', () => {
    renderCard({ readOnly: true, defaultExpanded: true });
    expect(screen.getByText('Prioridad')).toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
    expect(screen.queryByText('Archivar')).not.toBeInTheDocument();
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
    expect(screen.queryByText('+ Añadir ticket')).not.toBeInTheDocument();
    const input = document.querySelector('tbody input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
  });
});
