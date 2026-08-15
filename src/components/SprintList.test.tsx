import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { SprintList } from './SprintList';
import type { Sprint } from '../hooks/useSprints';

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
}> = {}) {
  return render(
    <I18nProvider>
      <SprintList
        sprints={sprints}
        onAddSprint={overrides.onAddSprint ?? vi.fn()}
        onSelectSprint={overrides.onSelectSprint ?? vi.fn()}
        onDeleteSprint={overrides.onDeleteSprint ?? vi.fn()}
        onRenameSprint={overrides.onRenameSprint ?? vi.fn()}
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
    expect(screen.getByText(/20\/07\/2026/)).toBeInTheDocument();
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
  it('shows an Editar button only for active sprints, not archived ones', () => {
    renderList([
      makeSprint({ id: 'active', name: 'Sprint activo', archived: false }),
      makeSprint({ id: 'archived', name: 'Sprint archivado', archived: true }),
    ]);
    expect(screen.getAllByText('Editar')).toHaveLength(1);
  });

  it('clicking Editar reveals an input pre-filled with the current name', () => {
    renderList([makeSprint({ name: 'Sprint 1' })]);
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Sprint 1') as HTMLInputElement;
    expect(input).toBeInTheDocument();
  });

  it('saves the new name on Enter', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRenameSprint).toHaveBeenCalledWith('s1', 'Sprint renombrado');
  });

  it('saves the new name on blur', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.blur(input);
    expect(onRenameSprint).toHaveBeenCalledWith('s1', 'Sprint renombrado');
  });

  it('cancels without saving on Escape', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: 'Sprint renombrado' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRenameSprint).not.toHaveBeenCalled();
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });

  it('does not save an empty name', () => {
    const onRenameSprint = vi.fn();
    renderList([makeSprint({ id: 's1', name: 'Sprint 1' })], { onRenameSprint });
    fireEvent.click(screen.getByText('Editar'));
    const input = screen.getByDisplayValue('Sprint 1');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(onRenameSprint).not.toHaveBeenCalled();
    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
  });

  it('clicking Editar does not navigate into the sprint', () => {
    const onSelectSprint = vi.fn();
    renderList([makeSprint({ name: 'Sprint 1' })], { onSelectSprint });
    fireEvent.click(screen.getByText('Editar'));
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

  it('archived sprints show a red circle icon and the singular Archivado badge', () => {
    renderList([makeSprint({ id: 'a1', name: 'Sprint viejo', archived: true, endDate: '2026-07-21' })]);
    expect(screen.getByText('🔴')).toBeInTheDocument();
    expect(screen.getByText('Archivado')).toBeInTheDocument();
  });

  it('active sprints keep the green circle icon', () => {
    renderList([makeSprint({ archived: false })]);
    expect(screen.getByText('🟢')).toBeInTheDocument();
  });
});
