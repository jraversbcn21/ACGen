import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSprints } from './useSprints';

beforeEach(() => {
  localStorage.clear();
});

describe('useSprints', () => {
  it('initializes with an empty array', () => {
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toEqual([]);
  });

  it('addSprint creates a new sprint with defaults', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const sprints = result.current.sprints;
    expect(sprints).toHaveLength(1);
    expect(sprints[0].name).toBe('Sprint 24');
    expect(sprints[0].startDate).toBe('2026-07-08');
    expect(sprints[0].endDate).toBeNull();
    expect(sprints[0].archived).toBe(false);
    expect(sprints[0].id).toBeTruthy();
    expect(sprints[0].jql.resolved).toBe('');
    expect(sprints[0].tabColumns.resolved).toEqual(['Prioridad', 'Autor']);
    expect(sprints[0].tabColumns.created).toEqual(['Prioridad', 'Autor']);
    expect(sprints[0].tabColumns.reopened).toEqual(['Motivo', 'Squad']);
    expect(sprints[0].tabColumns.highPriority).toEqual(['Motivo', 'Squad']);
    expect(sprints[0].tabCells).toEqual({ resolved: {}, created: {}, reopened: {}, highPriority: {} });
  });

  it('archiveSprint sets archived true and endDate to today', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-01');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.archiveSprint(id);
    });
    const archived = result.current.sprints[0];
    expect(archived.archived).toBe(true);
    expect(archived.endDate).not.toBeNull();
  });

  it('updateSprint modifies sprint fields', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateSprint(id, { name: 'Sprint 25' });
    });
    expect(result.current.sprints[0].name).toBe('Sprint 25');
  });

  it('updateTabJql sets JQL for a tab', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateTabJql(id, 'resolved', 'project = BERSHKA AND status = Done');
    });
    expect(result.current.sprints[0].jql.resolved).toBe('project = BERSHKA AND status = Done');
  });

  it('updateCell sets a value for a ticket column', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateCell(id, 'resolved', 'BERSHKA-123', 'Squad', 'Payment');
    });
    expect(result.current.sprints[0].tabCells.resolved['BERSHKA-123']['Squad']).toBe('Payment');
  });

  it('updateTabColumns replaces columns for a tab', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateTabColumns(id, 'resolved', ['Squad', 'Notas']);
    });
    expect(result.current.sprints[0].tabColumns.resolved).toEqual(['Squad', 'Notas']);
  });

  it('deleteSprint removes a sprint', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.deleteSprint(id);
    });
    expect(result.current.sprints).toHaveLength(0);
  });

  it('persists sprints to localStorage', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const stored = JSON.parse(localStorage.getItem('acgen_sprints') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Sprint 24');
  });

  it('hydrates from localStorage on init', () => {
    const existing = [
      {
        id: 'abc-123',
        name: 'Sprint 23',
        startDate: '2026-06-23',
        endDate: '2026-07-07',
        archived: true,
        jql: { resolved: 'jql1', created: '', reopened: '', highPriority: '' },
        tabColumns: { resolved: ['Squad'], created: ['Tipo'], reopened: ['Motivo'], highPriority: [] },
        tabCells: { resolved: {}, created: {}, reopened: {}, highPriority: {} },
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(existing));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].name).toBe('Sprint 23');
  });

  it('recovers from invalid JSON in localStorage', () => {
    localStorage.setItem('acgen_sprints', 'not-valid-json');
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toEqual([]);
  });

  it('migrates old sprints without tabColumns/tabCells', () => {
    const oldSprint = [
      {
        id: 'old-1',
        name: 'Sprint 20',
        startDate: '2026-06-01',
        endDate: null,
        archived: false,
        jql: { resolved: '', created: '', reopened: '', highPriority: '' },
        notes: {},
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(oldSprint));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].tabColumns.resolved).toEqual(['Prioridad', 'Autor']);
    expect(result.current.sprints[0].tabCells).toEqual({ resolved: {}, created: {}, reopened: {}, highPriority: {} });
  });
});
