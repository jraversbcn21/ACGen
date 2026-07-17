### Task 3: Hook `useRegressions`

**Files:**
- Create: `src/hooks/useRegressions.ts`
- Create: `src/hooks/useRegressions.test.ts`

**Interfaces:**
- Consumes: nada del resto de tareas (hook autocontenido; persiste en la clave literal `'acgen_regressions'`).
- Produces (lo consume la Task 4):

```ts
export type PlatformId = 'ios' | 'android' | 'webDesktop' | 'webMobile';
export const PLATFORM_IDS: readonly PlatformId[];
export interface ArchivedRegression {
  id: string;
  name: string;        // "Regresión YYYY-MM-DD"
  archivedAt: string;  // YYYY-MM-DD local
  board: Record<PlatformId, string[][]>;
}
export function useRegressions(): {
  board: Record<PlatformId, string[][]>;
  archived: ArchivedRegression[];
  updateGridCell: (tab: PlatformId, row: number, col: number, value: string) => void;
  setTabGrid: (tab: PlatformId, grid: string[][]) => void;
  moveRow: (tab: PlatformId, fromRow: number, toRow: number) => void;
  archiveBoard: () => void;
  deleteArchived: (id: string) => void;
};
```

- [ ] **Step 1: Escribir el test (falla)**

Crear `src/hooks/useRegressions.test.ts`:

```ts
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useRegressions, PLATFORM_IDS } from './useRegressions';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRegressions', () => {
  it('initializes with an empty 20x6 board per platform and no archived', () => {
    const { result } = renderHook(() => useRegressions());
    expect(PLATFORM_IDS).toEqual(['ios', 'android', 'webDesktop', 'webMobile']);
    for (const p of PLATFORM_IDS) {
      expect(result.current.board[p]).toHaveLength(20);
      expect(result.current.board[p][0]).toHaveLength(6);
      expect(result.current.board[p][0][0]).toBe('');
    }
    expect(result.current.archived).toEqual([]);
  });

  it('updateGridCell writes a value in the right platform', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('android', 2, 1, 'v9.1.0');
    });
    expect(result.current.board.android[2][1]).toBe('v9.1.0');
    expect(result.current.board.ios[2][1]).toBe('');
  });

  it('persists to localStorage and hydrates on a fresh mount', () => {
    const first = renderHook(() => useRegressions());
    act(() => {
      first.result.current.updateGridCell('ios', 0, 0, 'Smoke - https://z.example/p/1');
    });
    first.unmount();
    const second = renderHook(() => useRegressions());
    expect(second.result.current.board.ios[0][0]).toBe('Smoke - https://z.example/p/1');
  });

  it('setTabGrid replaces the whole grid of one platform', () => {
    const { result } = renderHook(() => useRegressions());
    const newGrid = [['a', 'b', 'c', 'd', 'e', 'f']];
    act(() => {
      result.current.setTabGrid('webDesktop', newGrid);
    });
    expect(result.current.board.webDesktop).toEqual(newGrid);
    expect(result.current.board.webMobile).toHaveLength(20);
  });

  it('moveRow reorders rows', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'primera');
      result.current.updateGridCell('ios', 1, 0, 'segunda');
    });
    act(() => {
      result.current.moveRow('ios', 0, 2);
    });
    expect(result.current.board.ios[0][0]).toBe('segunda');
    expect(result.current.board.ios[1][0]).toBe('primera');
  });

  it('moveRow ignores out-of-range indices', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'fija');
    });
    act(() => {
      result.current.moveRow('ios', -1, 5);
      result.current.moveRow('ios', 0, 99);
    });
    expect(result.current.board.ios[0][0]).toBe('fija');
  });

  it('archiveBoard snapshots the board, clears it and names it with today', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.updateGridCell('webMobile', 0, 0, 'Regresión checkout');
    });
    act(() => {
      result.current.archiveBoard();
    });
    expect(result.current.archived).toHaveLength(1);
    const snap = result.current.archived[0];
    expect(snap.id).toBeTruthy();
    expect(snap.name).toMatch(/^Regresión \d{4}-\d{2}-\d{2}$/);
    expect(snap.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snap.board.webMobile[0][0]).toBe('Regresión checkout');
    expect(result.current.board.webMobile[0][0]).toBe('');
  });

  it('archiveBoard persists snapshot and cleared board', () => {
    const first = renderHook(() => useRegressions());
    act(() => {
      first.result.current.updateGridCell('ios', 0, 0, 'algo');
      first.result.current.archiveBoard();
    });
    first.unmount();
    const second = renderHook(() => useRegressions());
    expect(second.result.current.archived).toHaveLength(1);
    expect(second.result.current.board.ios[0][0]).toBe('');
  });

  it('deleteArchived removes a snapshot', () => {
    const { result } = renderHook(() => useRegressions());
    act(() => {
      result.current.archiveBoard();
    });
    const id = result.current.archived[0].id;
    act(() => {
      result.current.deleteArchived(id);
    });
    expect(result.current.archived).toEqual([]);
  });

  it('recovers from corrupt JSON in localStorage', () => {
    localStorage.setItem('acgen_regressions', '{no es json');
    const { result } = renderHook(() => useRegressions());
    expect(result.current.board.ios).toHaveLength(20);
    expect(result.current.archived).toEqual([]);
  });

  it('merges missing platforms when hydrating old data', () => {
    localStorage.setItem('acgen_regressions', JSON.stringify({
      board: { ios: [['x', '', '', '', '', '']] },
      archived: [],
    }));
    const { result } = renderHook(() => useRegressions());
    expect(result.current.board.ios[0][0]).toBe('x');
    expect(result.current.board.android).toHaveLength(20);
    expect(result.current.board.webDesktop).toHaveLength(20);
    expect(result.current.board.webMobile).toHaveLength(20);
  });

  it('keeps changes in memory even when localStorage.setItem throws (quota exceeded)', () => {
    const { result } = renderHook(() => useRegressions());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      result.current.updateGridCell('ios', 0, 0, 'sobrevive');
    });
    expect(result.current.board.ios[0][0]).toBe('sobrevive');
    expect(errSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Ejecutar para verificar que falla**

Run: `npm test -- src/hooks/useRegressions.test.ts`
Expected: FAIL — `Failed to resolve import "./useRegressions"`.

- [ ] **Step 3: Crear `src/hooks/useRegressions.ts`**

Contenido completo:

```ts
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'acgen_regressions';

export type PlatformId = 'ios' | 'android' | 'webDesktop' | 'webMobile';

export const PLATFORM_IDS: readonly PlatformId[] = ['ios', 'android', 'webDesktop', 'webMobile'];

export interface ArchivedRegression {
  id: string;
  name: string;
  archivedAt: string;
  board: Record<PlatformId, string[][]>;
}

interface RegressionState {
  board: Record<PlatformId, string[][]>;
  archived: ArchivedRegression[];
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyBoard(): Record<PlatformId, string[][]> {
  return {
    ios: createEmptyGrid(),
    android: createEmptyGrid(),
    webDesktop: createEmptyGrid(),
    webMobile: createEmptyGrid(),
  };
}

function persist(state: RegressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar el regression tracker en localStorage:', err);
  }
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function useRegressions() {
  const [state, setState] = useState<RegressionState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { board: emptyBoard(), archived: [] };
      const parsed = JSON.parse(raw);
      const archived: ArchivedRegression[] = Array.isArray(parsed.archived)
        ? parsed.archived.map((a: ArchivedRegression) => ({
            ...a,
            board: { ...emptyBoard(), ...(a.board || {}) },
          }))
        : [];
      return {
        board: { ...emptyBoard(), ...(parsed.board || {}) },
        archived,
      };
    } catch {
      return { board: emptyBoard(), archived: [] };
    }
  });

  const updateGridCell = useCallback((tab: PlatformId, row: number, col: number, value: string) => {
    setState((prev) => {
      const grid = prev.board[tab] || [];
      const newGrid = grid.map((r, ri) => {
        if (ri !== row) return r;
        const newRow = [...r];
        while (newRow.length <= col) newRow.push('');
        newRow[col] = value;
        return newRow;
      });
      const updated = { ...prev, board: { ...prev.board, [tab]: newGrid } };
      persist(updated);
      return updated;
    });
  }, []);

  const setTabGrid = useCallback((tab: PlatformId, grid: string[][]) => {
    setState((prev) => {
      const updated = { ...prev, board: { ...prev.board, [tab]: grid } };
      persist(updated);
      return updated;
    });
  }, []);

  const moveRow = useCallback((tab: PlatformId, fromRow: number, toRow: number) => {
    setState((prev) => {
      const grid = prev.board[tab] || [];
      if (fromRow < 0 || fromRow >= grid.length || toRow < 0 || toRow >= grid.length) return prev;
      if (fromRow === toRow) return prev;
      const newGrid = [...grid];
      const [movedRow] = newGrid.splice(fromRow, 1);
      const targetIndex = fromRow < toRow ? toRow - 1 : toRow;
      newGrid.splice(targetIndex, 0, movedRow);
      const updated = { ...prev, board: { ...prev.board, [tab]: newGrid } };
      persist(updated);
      return updated;
    });
  }, []);

  const archiveBoard = useCallback(() => {
    const date = localToday();
    setState((prev) => {
      const snapshot: ArchivedRegression = {
        id: crypto.randomUUID(),
        name: `Regresión ${date}`,
        archivedAt: date,
        board: prev.board,
      };
      const updated = { board: emptyBoard(), archived: [snapshot, ...prev.archived] };
      persist(updated);
      return updated;
    });
  }, []);

  const deleteArchived = useCallback((id: string) => {
    setState((prev) => {
      const updated = { ...prev, archived: prev.archived.filter((a) => a.id !== id) };
      persist(updated);
      return updated;
    });
  }, []);

  return { board: state.board, archived: state.archived, updateGridCell, setTabGrid, moveRow, archiveBoard, deleteArchived };
}
```

- [ ] **Step 4: Ejecutar los tests**

Run: `npm test -- src/hooks/useRegressions.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRegressions.ts src/hooks/useRegressions.test.ts
git commit -m "feat(regression): useRegressions hook with single board + archived snapshots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

