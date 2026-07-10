import { useState, useCallback } from 'react';

const STORAGE_KEY = 'acgen_sprints';

export type TabId = 'resolved' | 'created' | 'reopened' | 'highPriority';

export interface SprintJql {
  resolved: string;
  created: string;
  reopened: string;
  highPriority: string;
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
        tabGrid: s.tabGrid || emptyTabGrid(),
      }));
    } catch {
      return [];
    }
  });

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
    setSprints((prev) => {
      const updated = [sprint, ...prev];
      persistSprints(updated);
      return updated;
    });
  }, []);

  const updateSprint = useCallback((id: string, partial: Partial<Omit<Sprint, 'id'>>) => {
    setSprints((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...partial } : s));
      persistSprints(updated);
      return updated;
    });
  }, []);

  const archiveSprint = useCallback((id: string) => {
    const today = new Date().toISOString().split('T')[0];
    updateSprint(id, { archived: true, endDate: today });
  }, [updateSprint]);

  const updateTabJql = useCallback((id: string, tabId: TabId, jql: string) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, jql: { ...s.jql, [tabId]: jql } };
      });
      persistSprints(updated);
      return updated;
    });
  }, []);

  const updateGridCell = useCallback((id: string, tabId: TabId, row: number, col: number, value: string) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
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
      });
      persistSprints(updated);
      return updated;
    });
  }, []);

  const setTabGrid = useCallback((id: string, tabId: TabId, grid: string[][]) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, tabGrid: { ...s.tabGrid, [tabId]: grid } };
      });
      persistSprints(updated);
      return updated;
    });
  }, []);

  const moveRow = useCallback((id: string, tabId: TabId, fromRow: number, toRow: number) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        const grid = s.tabGrid[tabId] || [];
        if (fromRow < 0 || fromRow >= grid.length || toRow < 0 || toRow >= grid.length) return s;
        if (fromRow === toRow) return s;
        const newGrid = [...grid];
        const [movedRow] = newGrid.splice(fromRow, 1);
        newGrid.splice(toRow, 0, movedRow);
        return { ...s, tabGrid: { ...s.tabGrid, [tabId]: newGrid } };
      });
      persistSprints(updated);
      return updated;
    });
  }, []);

  const deleteSprint = useCallback((id: string) => {
    setSprints((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      persistSprints(updated);
      return updated;
    });
  }, []);

  return { sprints, addSprint, updateSprint, archiveSprint, updateTabJql, updateGridCell, setTabGrid, moveRow, deleteSprint };
}
