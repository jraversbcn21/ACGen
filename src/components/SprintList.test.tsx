import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { SprintList } from './SprintList';
import type { Sprint } from '../hooks/useSprints';
import { localTodayISO } from '../utils/dates';

const ORIGINAL_TZ = process.env.TZ;

function makeSprint(partial: Partial<Sprint>): Sprint {
  return {
    id: 's1',
    name: 'Sprint 1',
    startDate: '2026-07-20',
    endDate: null,
    archived: false,
    tabGrid: { resolved: [], created: [], reopened: [], highPriority: [], jsd: [] },
    ...partial,
  };
}

function renderList(sprints: Sprint[], overrides: Partial<{
  onAddSprint: (name: string, startDate: string) => void;
  onSelectSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
  onRenameSprint: (id: string, name: string) => void;
  onArchiveSprint: (id: string) => void;
  onUnarchiveSprint: (id: string) => void;
}> = {}) {
  return render(
    <I18nProvider>
      <SprintList
        sprints={sprints}
        onAddSprint={overrides.onAddSprint ?? vi.fn()}
        onSelectSprint={overrides.onSelectSprint ?? vi.fn()}
        onDeleteSprint={overrides.onDeleteSprint ?? vi.fn()}
        onRenameSprint={overrides.onRenameSprint ?? vi.fn()}
        onUnarchiveSprint={overrides.onUnarchiveSprint ?? vi.fn()}
        onArchiveSprint={overrides.onArchiveSprint ?? vi.fn()}
      />
    </I18nProvider>
  );
}

// TZ negativo (UTC-5): donde el parseo UTC de 'YYYY-MM-DD' retrocede un día
beforeAll(() => {
  process.env.TZ = 'America/Bogota';
});

afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('SprintList dates', () => {
  it('shows the sprint start date without UTC shift', () => {
    renderList([makeSprint({ startDate: '2026-07-20' })]);
    // La fecha aparece en el hero, el tile de Inicio y el item lateral; la
    // propiedad es que NINGUNA retroceda un dia por parseo UTC.
    expect(screen.getAllByText(/20\/07\/2026/).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/19\/07\/2026/)).not.toBeInTheDocument();
  });

  it('formats dates per the app language', () => {
    localStorage.setItem('acgen_lang', JSON.stringify('en'));
    renderList([makeSprint({ startDate: '2026-07-20', endDate: '2026-07-21', archived: true })]);
    expect(screen.getByText(/07\/20\/2026/)).toBeInTheDocument();
    expect(screen.getByText(/07\/21\/2026/)).toBeInTheDocument();
  });

  it('defaults the new-sprint form date to the LOCAL day, not the UTC day', () => {
    vi.useFakeTimers();
    // 23:30 en Bogotá => ya es 21 de julio en UTC
    vi.setSystemTime(new Date('2026-07-20T23:30:00-05:00'));
    renderList([]);
    fireEvent.click(screen.getByText('Nuevo Sprint'));
    const dateInput = document.getElementById('sprint-start') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-07-20');
  });
});

describe('SprintList renaming', () => {
  // El rename vive en el hero del sprint seleccionado (el rediseño quitó el
  // boton por tarjeta): un archivado no seleccionado no ofrece Renombrar.
  it('shows a Renombrar button only for the selected active sprint, not archived ones', () => {
    renderList([
      makeSprint({ id: 'active', name: 'Sprint activo', archived: false }),
      makeSprint({ id: 'archived', name: 'Sprint archivado', archived: true }),
    ]);
    expect(screen.getAllByText('Renombrar')).toHaveLength(1);
  });

  it('clicking Renombrar reveals an input pre-filled with the current name', () => {
    renderList([makeSprint({ name: 'Sprint 1' })]);
    fireEvent.click(screen.getByText('Renombrar'));
    const input = screen.getByDisplayValue('Sprint 1') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('saves the new name on Enter', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Renombrar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameSprint).toHaveBeenCalledWith('s1', 'Sprint renombrado');
  });

  it('saves the new name on blur', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Renombrar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.blur(input);
    expect(onRenameSprint).toHaveBeenCalledWith('s1', 'Sprint renombrado');
  });

  it('cancels without saving on Escape', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Renombrar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameSprint).not.toHaveBeenCalled();
    // El nombre viejo sigue en pantalla (hero e item lateral).
    expect(screen.getAllByText('Sprint 1').length).toBeGreaterThanOrEqual(1);
  });

  it('does not save an empty name', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Renombrar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onRenameSprint).not.toHaveBeenCalled();
    expect(screen.getAllByText('Sprint 1').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking Renombrar does not navigate into the sprint', () => {
    const onSelectSprint = vi.fn();
    renderList([makeSprint({ name: 'Sprint 1' })], { onSelectSprint });
    fireEvent.click(screen.getByText('Renombrar'));
    expect(onSelectSprint).not.toHaveBeenCalled();
  });
});

describe('SprintList archiving', () => {
  it('shows an Archivar button only for active sprints, not archived ones', () => {
    renderList([
      makeSprint({ id: 'active', name: 'Sprint activo', archived: false }),
      makeSprint({ id: 'archived', name: 'Sprint archivado', archived: true, endDate: '2026-07-21' }),
    ]);
    expect(screen.getAllByText('Archivar')).toHaveLength(1);
  });

  it('archives the sprint when the confirm dialog is accepted', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onArchiveSprint = vi.fn();
    renderList([makeSprint({ id: 's1' })], { onArchiveSprint });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onArchiveSprint).toHaveBeenCalledWith('s1');
  });

  it('does not archive when the confirm dialog is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onArchiveSprint = vi.fn();
    renderList([makeSprint({ id: 's1' })], { onArchiveSprint });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onArchiveSprint).not.toHaveBeenCalled();
  });

  it('clicking Archivar does not navigate into the sprint', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onSelectSprint = vi.fn();
    renderList([makeSprint({ id: 's1' })], { onSelectSprint });
    fireEvent.click(screen.getByText('Archivar'));
    expect(onSelectSprint).not.toHaveBeenCalled();
  });

  // Los emojis 🟢/🔴 se sustituyeron por dots CSS; la propiedad que se conserva
  // es que el archivado se distingue visualmente y muestra el badge singular.
  it('archived sprints show the archived dot, and the singular Archivado badge once selected', () => {
    const { container } = renderList([makeSprint({ id: 'a1', name: 'Sprint viejo', archived: true, endDate: '2026-07-21' })]);
    expect(container.querySelector('.sp-dot-archived')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Sprint viejo'));
    expect(screen.getByText('Archivado')).toBeInTheDocument();
  });

  it('the selected sprint and other active sprints get distinct dots', () => {
    const { container } = renderList([
      makeSprint({ id: 's1', name: 'Sprint 1', archived: false }),
      makeSprint({ id: 's2', name: 'Sprint 2', archived: false }),
    ]);
    expect(container.querySelector('.sp-dot-current')).toBeInTheDocument();
    expect(container.querySelector('.sp-dot-active')).toBeInTheDocument();
  });

  it('shows Desarchivar only on archived sprints', () => {
    renderList([
      makeSprint({ id: 'active', name: 'Sprint activo', archived: false }),
      makeSprint({ id: 'archived', name: 'Sprint archivado', archived: true, endDate: '2026-07-21' }),
    ]);
    expect(screen.getAllByRole('button', { name: 'Desarchivar' })).toHaveLength(1);
  });

  it('unarchives without a confirm dialog, and does not navigate into the sprint', () => {
    // Sin confirm a proposito: desarchivar es reversible (basta con volver a
    // archivar) y no destruye nada, al reves que Eliminar.
    const onUnarchiveSprint = vi.fn();
    const onSelectSprint = vi.fn();
    renderList(
      [makeSprint({ id: 'a1', name: 'Sprint viejo', archived: true, endDate: '2026-07-21' })],
      { onUnarchiveSprint, onSelectSprint },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Desarchivar' }));
    expect(onUnarchiveSprint).toHaveBeenCalledWith('a1');
    expect(onSelectSprint).not.toHaveBeenCalled();
  });
});

describe('SprintList redesigned layout', () => {
  it('shows active and archived counters in the subtitle', () => {
    renderList([
      makeSprint({ id: 's1', name: 'S1', archived: false }),
      makeSprint({ id: 's2', name: 'S2', archived: false }),
      makeSprint({ id: 'a1', name: 'A1', archived: true, endDate: '2026-07-21' }),
    ]);
    expect(screen.getByText('2 activos · 1 archivados')).toBeInTheDocument();
  });

  it('Abrir tablero is the only way to navigate into the sprint', () => {
    const onSelectSprint = vi.fn();
    const s1 = makeSprint({ id: 's1', name: 'Sprint 1' });
    renderList([s1], { onSelectSprint });
    fireEvent.click(screen.getByText('Abrir tablero'));
    expect(onSelectSprint).toHaveBeenCalledTimes(1);
    expect(onSelectSprint.mock.calls[0][0].id).toBe('s1');
  });

  it('clicking a side item selects it into the hero without navigating', () => {
    const onSelectSprint = vi.fn();
    renderList([
      makeSprint({ id: 's1', name: 'Sprint 1' }),
      makeSprint({ id: 's2', name: 'Sprint 2' }),
    ], { onSelectSprint });
    fireEvent.click(screen.getByText('Sprint 2'));
    expect(onSelectSprint).not.toHaveBeenCalled();
    // El hero muestra ahora el nombre dos veces en pantalla (hero + item).
    expect(screen.getAllByText('Sprint 2')).toHaveLength(2);
  });

  it('search filters the side list and shows noMatches when nothing matches', () => {
    renderList([
      makeSprint({ id: 's1', name: 'Sprint 25' }),
      makeSprint({ id: 's2', name: 'Sprint 26' }),
    ]);
    const search = screen.getByPlaceholderText('Buscar sprint');
    fireEvent.change(search, { target: { value: '26' } });
    expect(screen.queryAllByText('Sprint 25')).toHaveLength(1); // solo el hero
    fireEvent.change(search, { target: { value: 'zzz' } });
    expect(screen.getByText('Ningún sprint coincide con la búsqueda')).toBeInTheDocument();
  });

  it('shows the noCurrent empty state when only archived sprints exist', () => {
    renderList([makeSprint({ id: 'a1', name: 'Viejo', archived: true, endDate: '2026-07-21' })]);
    expect(screen.getByText('No hay ningún sprint activo')).toBeInTheDocument();
  });

  it('lists recent activity newest first, with unparseable dates last', () => {
    renderList([makeSprint({
      id: 's1',
      name: 'Sprint 1',
      tabGrid: {
        // columnas de 'resolved': ticket, fecha, prioridad, autor, squad
        resolved: [
          ['ACG-100', '19/07/2026', 'Alta', 'jorge', 'Checkout'],
          ['ACG-300', 'pendiente', 'Alta', 'jorge', 'Home'],
          ['ACG-200', '21/07/2026', 'Baja', 'ana', 'Home'],
        ],
        created: [], reopened: [], highPriority: [], jsd: [],
      },
    })]);
    const tickets = [...document.querySelectorAll('.sp-act-ticket')].map((e) => e.textContent);
    expect(tickets).toEqual(['ACG-200', 'ACG-100', 'ACG-300']);
  });

  it('links a ticket to Jira only when the tracker base URL is configured', () => {
    const grid = {
      resolved: [['ACG-100', '19/07/2026', 'Alta', 'jorge', 'Checkout']],
      created: [], reopened: [], highPriority: [], jsd: [],
    };
    const { unmount } = renderList([makeSprint({ id: 's1', tabGrid: grid })]);
    expect(document.querySelector('.sp-act-ticket a')).toBeNull();
    unmount();

    localStorage.setItem('acgen_tracker_base_url', JSON.stringify('https://jira.example.com'));
    renderList([makeSprint({ id: 's1', tabGrid: grid })]);
    expect(document.querySelector('.sp-act-ticket a')).toHaveAttribute('href', 'https://jira.example.com/browse/ACG-100');
  });

  it('groups the squad breakdown and labels blank squads', () => {
    renderList([makeSprint({
      id: 's1',
      tabGrid: {
        resolved: [
          ['ACG-1', '19/07/2026', 'Alta', 'jorge', 'Checkout'],
          ['ACG-2', '19/07/2026', 'Alta', 'jorge', 'Checkout'],
          ['ACG-3', '19/07/2026', 'Alta', 'ana', ''],
        ],
        created: [], reopened: [], highPriority: [], jsd: [],
      },
    })]);
    expect(screen.getByText('Por squad')).toBeInTheDocument();
    const labels = [...document.querySelectorAll('.sp-bar-label')].map((e) => e.textContent);
    // Ordenado por conteo: Checkout (2) antes que Sin squad (1).
    expect(labels.slice(-2)).toEqual(['Checkout', 'Sin squad']);
  });

  it('shows the noActivity hint when the sprint has no rows', () => {
    renderList([makeSprint({ id: 's1' })]);
    expect(screen.getByText('Todavía no hay filas en este sprint')).toBeInTheDocument();
  });

  it('bar panel counts only rows with real content', () => {
    renderList([makeSprint({
      id: 's1',
      name: 'Sprint 1',
      tabGrid: {
        resolved: [['ACG-1', '', ''], ['  ', '', ''], ['ACG-2', 'x', '']],
        created: [], reopened: [], highPriority: [], jsd: [],
      },
    })]);
    // 2 filas reales en Resueltos; el total del panel y el tile coinciden.
    expect(screen.getByText('2 filas en 5 pestañas')).toBeInTheDocument();
  });
});

describe('SprintList — formulario de alta', () => {
  it('crea el sprint con la fecha de hoy si el campo de fecha se vacio (antes: "dia NaN")', () => {
    const onAddSprint = vi.fn();
    renderList([], { onAddSprint });
    fireEvent.click(screen.getByText('Nuevo Sprint'));
    fireEvent.change(document.getElementById('sprint-name')!, { target: { value: 'Sprint 31' } });
    fireEvent.change(document.getElementById('sprint-start')!, { target: { value: '' } });
    fireEvent.click(screen.getByText('Crear'));
    expect(onAddSprint).toHaveBeenCalledWith('Sprint 31', localTodayISO());
  });
});
