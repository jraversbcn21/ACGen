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
    jql: { resolved: '', created: '', reopened: '', highPriority: '', jsd: '' },
    tabGrid: { resolved: [], created: [], reopened: [], highPriority: [], jsd: [] },
    ...partial,
  };
}

function renderList(sprints: Sprint[]) {
  return render(
    <I18nProvider>
      <SprintList sprints={sprints} onAddSprint={vi.fn()} onSelectSprint={vi.fn()} onDeleteSprint={vi.fn()} />
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
