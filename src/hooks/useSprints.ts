import { useState, useEffect, useRef, useCallback } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import { localTodayISO } from '../utils/dates';

const STORAGE_KEY = 'acgen_sprints';

export type TabId = 'resolved' | 'created' | 'reopened' | 'highPriority' | 'jsd';

export interface SprintJql {
  resolved: string;
  created: string;
  reopened: string;
  highPriority: string;
  jsd: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  archived: boolean;
  jql: SprintJql;
  tabGrid: Record<TabId, string[][]>;
}

const EMPTY_JQL: SprintJql = {
  resolved: '',
  created: '',
  reopened: '',
  highPriority: '',
  jsd: '',
};

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyTabGrid(): Record<TabId, string[][]> {
  return {
    resolved: createEmptyGrid(),
    created: createEmptyGrid(),
    reopened: createEmptyGrid(),
    highPriority: createEmptyGrid(),
    jsd: createEmptyGrid(),
  };
}

function persistSprints(sprints: Sprint[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sprints));
  } catch (err) {
    console.error('No se pudieron guardar los sprints en localStorage:', err);
  }
}

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.map((s: Sprint) => ({
        ...s,
        tabGrid: { ...emptyTabGrid(), ...(s.tabGrid || {}) },
      }));
    } catch {
      return [];
    }
  });

  // Persistir como efecto mantiene los updaters puros; la identidad del último
  // estado persistido evita reescribir lo recién hidratado en el mount.
  const lastPersisted = useRef(sprints);
  useEffect(() => {
    if (lastPersisted.current === sprints) return;
    lastPersisted.current = sprints;
    persistSprints(sprints);
  }, [sprints]);

  const addSprint = useCallback((name: string, startDate: string) => {
    const sprint: Sprint = {
      id: crypto.randomUUID(),
      name,
      startDate,
      endDate: null,
      archived: false,
      jql: { ...EMPTY_JQL },
      tabGrid: emptyTabGrid(),
    };
    setSprints((prev) => [sprint, ...prev]);
  }, []);

  const updateSprint = useCallback((id: string, partial: Partial<Omit<Sprint, 'id'>>) => {
    setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }, []);

  const archiveSprint = useCallback((id: string) => {
    updateSprint(id, { archived: true, endDate: localTodayISO() });
  }, [updateSprint]);

  const updateTabJql = useCallback((id: string, tabId: TabId, jql: string) => {
    setSprints((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      return { ...s, jql: { ...s.jql, [tabId]: jql } };
    }));
  }, []);

  const updateGridCell = useCallback((id: string, tabId: TabId, row: number, col: number, value: string) => {
    setSprints((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const grid = s.tabGrid[tabId] || [];
      const newGrid = grid.map((r, ri) => {
        if (ri !== row) return r;
        const newRow = [...r];
        while (newRow.length <= col) newRow.push('');
        newRow[col] = value;
        return newRow;
      });
      return { ...s, tabGrid: { ...s.tabGrid, [tabId]: newGrid } };
    }));
  }, []);

  const setTabGrid = useCallback((id: string, tabId: TabId, grid: string[][]) => {
    setSprints((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      return { ...s, tabGrid: { ...s.tabGrid, [tabId]: grid } };
    }));
  }, []);

  const moveRow = useCallback((id: string, tabId: TabId, fromRow: number, toRow: number) => {
    setSprints((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const grid = s.tabGrid[tabId] || [];
      if (fromRow < 0 || fromRow >= grid.length || toRow < 0 || toRow >= grid.length) return s;
      if (fromRow === toRow) return s;
      const newGrid = [...grid];
      const [movedRow] = newGrid.splice(fromRow, 1);
      const targetIndex = fromRow < toRow ? toRow - 1 : toRow;
      newGrid.splice(targetIndex, 0, movedRow);
      return { ...s, tabGrid: { ...s.tabGrid, [tabId]: newGrid } };
    }));
  }, []);

  const deleteSprint = useCallback((id: string) => {
    setSprints((prev) => prev.filter((s) => s.id !== id));
    try {
      localStorage.removeItem(`${STORAGE_KEYS.SPRINT_COL_WIDTHS}_${id}`);
    } catch {
      // ignore
    }
  }, []);

  return { sprints, addSprint, updateSprint, archiveSprint, updateTabJql, updateGridCell, setTabGrid, moveRow, deleteSprint };
}
