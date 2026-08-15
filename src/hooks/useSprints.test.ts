import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useSprints } from './useSprints';
import { STORAGE_KEYS } from '../config/constants';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useSprints', () => {
  it('does not rewrite localStorage on mount/hydration', () => {
    localStorage.setItem('acgen_sprints', JSON.stringify([]));
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    renderHook(() => useSprints(), { wrapper: StrictMode });
    expect(spy.mock.calls.filter(([k]) => k === 'acgen_sprints')).toHaveLength(0);
  });

  it('persists exactly once per update under StrictMode (pure updaters)', () => {
    const { result } = renderHook(() => useSprints(), { wrapper: StrictMode });
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    expect(spy.mock.calls.filter(([k]) => k === 'acgen_sprints')).toHaveLength(1);
  });

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
    expect(sprints[0].tabGrid.resolved).toHaveLength(20);
    expect(sprints[0].tabGrid.resolved[0]).toHaveLength(6);
    expect(sprints[0].tabGrid.resolved[0][0]).toBe('');
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
    expect(result.current.sprints[0].archived).toBe(true);
    expect(result.current.sprints[0].endDate).not.toBeNull();
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
      result.current.updateTabJql(id, 'resolved', 'project = PROJ AND status = Done');
    });
    expect(result.current.sprints[0].jql.resolved).toBe('project = PROJ AND status = Done');
  });

  it('updateGridCell sets a value at row,col', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateGridCell(id, 'resolved', 0, 0, 'PROJ-123');
    });
    expect(result.current.sprints[0].tabGrid.resolved[0][0]).toBe('PROJ-123');
  });

  it('updateGridCell expands grid if col is out of bounds', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateGridCell(id, 'resolved', 0, 15, 'test');
    });
    expect(result.current.sprints[0].tabGrid.resolved[0][15]).toBe('test');
  });

  it('setTabGrid replaces the entire grid for a tab', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    const newGrid = [['PROJ-1', '2026-07-08'], ['PROJ-2', '2026-07-09']];
    act(() => {
      result.current.setTabGrid(id, 'resolved', newGrid);
    });
    expect(result.current.sprints[0].tabGrid.resolved).toEqual(newGrid);
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

  it('deleteSprint removes the matching column-widths key from localStorage', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    localStorage.setItem(`acgen_sprint_col_widths_${id}`, JSON.stringify({ 'resolved-0': 150 }));
    act(() => {
      result.current.deleteSprint(id);
    });
    expect(localStorage.getItem(`acgen_sprint_col_widths_${id}`)).toBeNull();
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
        tabGrid: { resolved: [['PROJ-1', '2026-07-08']], created: [], reopened: [], highPriority: [] },
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(existing));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].name).toBe('Sprint 23');
    expect(result.current.sprints[0].tabGrid.resolved[0][0]).toBe('PROJ-1');
  });

  it('recovers from invalid JSON in localStorage', () => {
    localStorage.setItem('acgen_sprints', 'not-valid-json');
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toEqual([]);
  });

  it('migrates old sprints without tabGrid', () => {
    const oldSprint = [
      {
        id: 'old-1',
        name: 'Sprint 20',
        startDate: '2026-06-01',
        endDate: null,
        archived: false,
        jql: { resolved: '', created: '', reopened: '', highPriority: '' },
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(oldSprint));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].tabGrid.resolved).toHaveLength(20);
    expect(result.current.sprints[0].tabGrid.resolved[0]).toHaveLength(6);
  });

  it('migrates existing sprints that have a tabGrid but are missing the jsd tab', () => {
    const oldSprint = [
      {
        id: 'old-2',
        name: 'Sprint 21',
        startDate: '2026-06-08',
        endDate: null,
        archived: false,
        jql: { resolved: '', created: '', reopened: '', highPriority: '' },
        tabGrid: {
          resolved: [['PROJ-1', '2026-06-08']],
          created: [],
          reopened: [],
          highPriority: [],
        },
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(oldSprint));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].tabGrid.resolved).toEqual([['PROJ-1', '2026-06-08']]);
    expect(result.current.sprints[0].tabGrid.jsd).toHaveLength(20);
    expect(result.current.sprints[0].tabGrid.jsd[0]).toHaveLength(6);
  });

  it('moveRow reorders rows within a tab grid (move down)', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['PROJ-1', 'A'],
      ['PROJ-2', 'B'],
      ['PROJ-3', 'C'],
      ['PROJ-4', 'D'],
      ['PROJ-5', 'E'],
    ];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    act(() => {
      result.current.moveRow(id, 'resolved', 0, 2);
    });

    const moved = result.current.sprints[0].tabGrid.resolved;
    expect(moved[0][0]).toBe('PROJ-2');
    expect(moved[1][0]).toBe('PROJ-1');
    expect(moved[2][0]).toBe('PROJ-3');
    expect(moved[3][0]).toBe('PROJ-4');
    expect(moved[4][0]).toBe('PROJ-5');
  });

  it('moveRow reorders rows within a tab grid (move up)', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['PROJ-1', 'A'],
      ['PROJ-2', 'B'],
      ['PROJ-3', 'C'],
      ['PROJ-4', 'D'],
      ['PROJ-5', 'E'],
    ];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    act(() => {
      result.current.moveRow(id, 'resolved', 4, 0);
    });

    const moved = result.current.sprints[0].tabGrid.resolved;
    expect(moved[0][0]).toBe('PROJ-5');
    expect(moved[1][0]).toBe('PROJ-1');
    expect(moved[2][0]).toBe('PROJ-2');
    expect(moved[3][0]).toBe('PROJ-3');
    expect(moved[4][0]).toBe('PROJ-4');
  });

  it('moveRow is a no-op when source and target are the same', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['PROJ-1'],
      ['PROJ-2'],
    ];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    const before = result.current.sprints[0].tabGrid.resolved;
    act(() => {
      result.current.moveRow(id, 'resolved', 0, 0);
    });
    expect(result.current.sprints[0].tabGrid.resolved).toEqual(before);
  });

  it('moveRow is a no-op for out-of-bounds indices', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [['PROJ-1']];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    const before = result.current.sprints[0].tabGrid.resolved;
    act(() => {
      result.current.moveRow(id, 'resolved', -1, 0);
    });
    expect(result.current.sprints[0].tabGrid.resolved).toEqual(before);

    act(() => {
      result.current.moveRow(id, 'resolved', 0, 99);
    });
    expect(result.current.sprints[0].tabGrid.resolved).toEqual(before);
  });

  it('keeps sprint changes in memory even when localStorage.setItem throws (quota exceeded)', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => {
      act(() => {
        result.current.updateGridCell(id, 'resolved', 0, 0, 'PROJ-1');
      });
    }).not.toThrow();

    expect(result.current.sprints[0].tabGrid.resolved[0][0]).toBe('PROJ-1');
    setItemSpy.mockRestore();
  });

  it('GUARDIAN: un payload pre-esquema hidrata identico sin clave acgen_schema', () => {
    localStorage.removeItem(STORAGE_KEYS.SCHEMA);
    localStorage.setItem('acgen_sprints', JSON.stringify([{
      id: 's1', name: 'Sprint 25', startDate: '2026-08-01', endDate: null, archived: false,
      jql: { resolved: 'q1', created: '', reopened: '', highPriority: '', jsd: '' },
      tabGrid: { resolved: [['ACG-1', '2026-08-01', 'Alta', 'jorge', 'QA']] },
    }]));
    const { result } = renderHook(() => useSprints());
    const s = result.current.sprints[0];
    expect(Object.keys(s.tabGrid).sort())
      .toEqual(['created', 'highPriority', 'jsd', 'reopened', 'resolved']);
    expect(s.tabGrid.resolved[0]).toEqual(['ACG-1', '2026-08-01', 'Alta', 'jorge', 'QA']);
    expect(s.tabGrid.created.length).toBe(20);
    expect(s.jql.resolved).toBe('q1');
  });

  it('una pestana retirada del esquema conserva su grid en el objeto guardado', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [{ id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] }] },
    }));
    localStorage.setItem('acgen_sprints', JSON.stringify([{
      id: 's1', name: 'S', startDate: '2026-08-01', endDate: null, archived: false,
      jql: {}, tabGrid: { resolved: [['a']], jsd: [['dato-huerfano']] },
    }]));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints[0].tabGrid.jsd).toEqual([['dato-huerfano']]);
  });

  it('un sprint nuevo nace con una pestana anadida en el esquema', () => {
    localStorage.setItem(STORAGE_KEYS.SCHEMA, JSON.stringify({
      version: 1,
      sprint: { tabs: [
        { id: 'resolved', label: 'R', columns: [{ id: 'ticket', label: 'T' }] },
        { id: 'nueva', label: 'Nueva', columns: [{ id: 'ticket', label: 'T' }] },
      ] },
    }));
    const { result } = renderHook(() => useSprints());
    act(() => { result.current.addSprint('S1', '2026-08-01'); });
    expect(result.current.sprints[0].tabGrid.nueva.length).toBe(20);
    expect(result.current.sprints[0].jql.nueva).toBe('');
  });
});
