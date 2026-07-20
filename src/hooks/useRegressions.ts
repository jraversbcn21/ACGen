import { useState, useEffect, useRef, useCallback } from 'react';
import { localTodayISO } from '../utils/dates';

const STORAGE_KEY = 'acgen_regressions';

export type PlatformId = 'ios' | 'android' | 'webDesktop';

export const PLATFORM_IDS: readonly PlatformId[] = ['ios', 'android', 'webDesktop'];

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
  };
}

export function boardHasContent(board: Record<PlatformId, string[][]>): boolean {
  return Object.values(board).some((grid) => grid.some((row) => row.some((cell) => cell.trim() !== '')));
}

function persist(state: RegressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('No se pudo guardar el regression tracker en localStorage:', err);
  }
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

  // Persistir como efecto mantiene los updaters puros; la identidad del último
  // estado persistido evita reescribir lo recién hidratado en el mount.
  const lastPersisted = useRef(state);
  useEffect(() => {
    if (lastPersisted.current === state) return;
    lastPersisted.current = state;
    persist(state);
  }, [state]);

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
      return { ...prev, board: { ...prev.board, [tab]: newGrid } };
    });
  }, []);

  const setTabGrid = useCallback((tab: PlatformId, grid: string[][]) => {
    setState((prev) => ({ ...prev, board: { ...prev.board, [tab]: grid } }));
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
      return { ...prev, board: { ...prev.board, [tab]: newGrid } };
    });
  }, []);

  const archiveBoard = useCallback(() => {
    const date = localTodayISO();
    setState((prev) => {
      if (!boardHasContent(prev.board)) return prev;
      const snapshot: ArchivedRegression = {
        id: crypto.randomUUID(),
        name: `Regresión ${date}`,
        archivedAt: date,
        board: prev.board,
      };
      return { board: emptyBoard(), archived: [snapshot, ...prev.archived] };
    });
  }, []);

  const deleteArchived = useCallback((id: string) => {
    setState((prev) => ({ ...prev, archived: prev.archived.filter((a) => a.id !== id) }));
  }, []);

  return { board: state.board, archived: state.archived, updateGridCell, setTabGrid, moveRow, archiveBoard, deleteArchived };
}
