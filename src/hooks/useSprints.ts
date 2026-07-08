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
  tabColumns: Record<TabId, string[]>;
  tabCells: Record<TabId, Record<string, Record<string, string>>>;
}

const EMPTY_JQL: SprintJql = {
  resolved: '',
  created: '',
  reopened: '',
  highPriority: '',
};

const DEFAULT_COLUMNS: Record<TabId, string[]> = {
  resolved: ['Squad'],
  created: ['Tipo', 'Autor'],
  reopened: ['Motivo del reopen'],
  highPriority: ['Motivo prioritario'],
};

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return parsed.map((s: Sprint) => ({
        ...s,
        tabColumns: s.tabColumns || { ...DEFAULT_COLUMNS },
        tabCells: s.tabCells || { resolved: {}, created: {}, reopened: {}, highPriority: {} },
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
      tabColumns: { ...DEFAULT_COLUMNS },
      tabCells: { resolved: {}, created: {}, reopened: {}, highPriority: {} },
    };
    setSprints((prev) => {
      const updated = [sprint, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateSprint = useCallback((id: string, partial: Partial<Omit<Sprint, 'id'>>) => {
    setSprints((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...partial } : s));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateCell = useCallback((id: string, tabId: TabId, ticketKey: string, column: string, value: string) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        const tabData = s.tabCells[tabId] || {};
        const ticketData = tabData[ticketKey] || {};
        return {
          ...s,
          tabCells: {
            ...s.tabCells,
            [tabId]: { ...tabData, [ticketKey]: { ...ticketData, [column]: value } },
          },
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateTabColumns = useCallback((id: string, tabId: TabId, columns: string[]) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return {
          ...s,
          tabColumns: { ...s.tabColumns, [tabId]: columns },
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteSprint = useCallback((id: string) => {
    setSprints((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { sprints, addSprint, updateSprint, archiveSprint, updateTabJql, updateCell, updateTabColumns, deleteSprint };
}
