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
    expect(PLATFORM_IDS).toEqual(['ios', 'android', 'webDesktop']);
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
    expect(result.current.board.android).toHaveLength(20);
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
      result.current.updateGridCell('webDesktop', 0, 0, 'Regresión checkout');
    });
    act(() => {
      result.current.archiveBoard();
    });
    expect(result.current.archived).toHaveLength(1);
    const snap = result.current.archived[0];
    expect(snap.id).toBeTruthy();
    expect(snap.name).toMatch(/^Regresión \d{4}-\d{2}-\d{2}$/);
    expect(snap.archivedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(snap.board.webDesktop[0][0]).toBe('Regresión checkout');
    expect(result.current.board.webDesktop[0][0]).toBe('');
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
