import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      result.current.updateTabJql(id, 'resolved', 'project = BERSHKA AND status = Done');
    });
    expect(result.current.sprints[0].jql.resolved).toBe('project = BERSHKA AND status = Done');
  });

  it('updateGridCell sets a value at row,col', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateGridCell(id, 'resolved', 0, 0, 'BERSHKA-123');
    });
    expect(result.current.sprints[0].tabGrid.resolved[0][0]).toBe('BERSHKA-123');
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
    const newGrid = [['BERSHKA-1', '2026-07-08'], ['BERSHKA-2', '2026-07-09']];
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
        tabGrid: { resolved: [['BERSHKA-1', '2026-07-08']], created: [], reopened: [], highPriority: [] },
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(existing));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].name).toBe('Sprint 23');
    expect(result.current.sprints[0].tabGrid.resolved[0][0]).toBe('BERSHKA-1');
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

  it('moveRow reorders rows within a tab grid (move down)', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['BERSHKA-1', 'A'],
      ['BERSHKA-2', 'B'],
      ['BERSHKA-3', 'C'],
      ['BERSHKA-4', 'D'],
      ['BERSHKA-5', 'E'],
    ];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    act(() => {
      result.current.moveRow(id, 'resolved', 0, 2);
    });

    const moved = result.current.sprints[0].tabGrid.resolved;
    expect(moved[0][0]).toBe('BERSHKA-2');
    expect(moved[1][0]).toBe('BERSHKA-1');
    expect(moved[2][0]).toBe('BERSHKA-3');
    expect(moved[3][0]).toBe('BERSHKA-4');
    expect(moved[4][0]).toBe('BERSHKA-5');
  });

  it('moveRow reorders rows within a tab grid (move up)', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['BERSHKA-1', 'A'],
      ['BERSHKA-2', 'B'],
      ['BERSHKA-3', 'C'],
      ['BERSHKA-4', 'D'],
      ['BERSHKA-5', 'E'],
    ];
    act(() => {
      result.current.setTabGrid(id, 'resolved', grid);
    });

    act(() => {
      result.current.moveRow(id, 'resolved', 4, 0);
    });

    const moved = result.current.sprints[0].tabGrid.resolved;
    expect(moved[0][0]).toBe('BERSHKA-5');
    expect(moved[1][0]).toBe('BERSHKA-1');
    expect(moved[2][0]).toBe('BERSHKA-2');
    expect(moved[3][0]).toBe('BERSHKA-3');
    expect(moved[4][0]).toBe('BERSHKA-4');
  });

  it('moveRow is a no-op when source and target are the same', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;

    const grid = [
      ['BERSHKA-1'],
      ['BERSHKA-2'],
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

    const grid = [['BERSHKA-1']];
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
});
