import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { SprintSchemaEditor } from './SprintSchemaEditor';
import { STORAGE_KEYS } from '../config/constants';

function renderEditor(onClose = () => {}) {
  return render(
    <I18nProvider>
      <SprintSchemaEditor onClose={onClose} />
    </I18nProvider>
  );
}

function storedSchema() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEMA)!);
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SprintSchemaEditor', () => {
  it('lista las cinco pestanas por defecto con sus columnas', () => {
    renderEditor();
    ['Resolved', 'Created', 'ReOpen', 'High Priority']
      .forEach((label) => expect(screen.getByDisplayValue(label)).toBeInTheDocument());
    // JSD es a la vez el nombre de la pestana y el de su primera columna.
    expect(screen.getAllByDisplayValue('JSD').length).toBe(2);
    // La pestana JSD tiene 3 columnas; 'Date' sale una vez por pestana (5).
    expect(screen.getAllByDisplayValue('Date').length).toBe(5);
  });

  it('renombrar una columna persiste la etiqueta al perder el foco', () => {
    renderEditor();
    // 'Squad' se repite en varias pestanas; la primera en el DOM es la
    // columna squad de la pestana Resolved (tabs[0]).
    const input = screen.getAllByDisplayValue('Squad')[0];
    fireEvent.change(input, { target: { value: 'Equipo' } });
    fireEvent.blur(input);
    const stored = storedSchema();
    expect(stored.sprint.tabs[0].columns[4].label).toBe('Equipo');
    // El id NUNCA cambia: los datos cuelgan de el.
    expect(stored.sprint.tabs[0].columns[4].id).toBe('squad');
  });

  it('anadir una columna la anade al final de esa pestana', () => {
    renderEditor();
    fireEvent.change(screen.getAllByPlaceholderText('New column name')[0], { target: { value: 'Entorno' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Add column' })[0]);
    const stored = storedSchema();
    expect(stored.sprint.tabs[0].columns.at(-1).label).toBe('Entorno');
    expect(stored.sprint.tabs[0].columns.at(-1).id).toBeTruthy();
  });

  it('anadir una columna con nombre vacio no hace nada', () => {
    renderEditor();
    fireEvent.click(screen.getAllByRole('button', { name: 'Add column' })[0]);
    expect(localStorage.getItem(STORAGE_KEYS.SCHEMA)).toBeNull();
  });

  it('una pestana nueva nace con las mismas columnas que Resueltos', () => {
    renderEditor();
    fireEvent.change(screen.getByPlaceholderText('New tab name'), { target: { value: 'Bloqueados' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add tab' }));
    const stored = storedSchema();
    const nueva = stored.sprint.tabs.at(-1);
    expect(nueva.label).toBe('Bloqueados');
    expect(nueva.columns.map((c: { id: string }) => c.id)).toEqual(['ticket', 'fecha', 'prioridad', 'autor', 'squad']);
  });

  it('no deja ocultar la ultima pestana visible', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] }] },
    }));
    renderEditor();
    // Una sola pestana y una sola columna: ambos checkboxes deshabilitados.
    screen.getAllByRole('checkbox').forEach((cb) => expect(cb).toBeDisabled());
  });

  it('una pestana guardada sin columns no tumba el editor', () => {
    // Esquema escrito a mano / backup a medias: `tabs` SI es un array, asi que
    // el fallback por lista no salta. Antes reventaba en `tab.columns.filter` y
    // el ErrorBoundary se llevaba la vista entera, con este boton dentro.
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R' }] },
    }));
    renderEditor();
    expect(screen.getByDisplayValue('R')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeInTheDocument();
  });

  it('Restaurar por defecto solo toca la seccion sprint', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      regression: { ticketFields: [{ id: 'custom', label: 'Mio' }], platforms: [{ id: 'ios', label: 'APPS' }] },
      sprint: { tabs: [{ id: 'x', label: 'X', columns: [{ id: 'c', label: 'C' }] }] },
    }));
    renderEditor();
    // schema.reset ya existe desde la Fase 4 con este texto en ingles; el
    // brief de esta tarea decia 'Restore defaults' por error de redaccion.
    fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    const stored = storedSchema();
    expect(stored.regression.ticketFields).toEqual([{ id: 'custom', label: 'Mio' }]);
    expect(stored.sprint.tabs.map((t: { id: string }) => t.id))
      .toEqual(['resolved', 'created', 'reopened', 'highPriority', 'jsd']);
  });

  it('cierra con el boton de cerrar', () => {
    const onClose = vi.fn();
    renderEditor(onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
