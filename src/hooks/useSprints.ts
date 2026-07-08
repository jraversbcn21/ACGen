import { useState, useCallback } from 'react';

const STORAGE_KEY = 'acgen_sprints';

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
  notes: Record<string, string>;
}

const EMPTY_JQL: SprintJql = {
  resolved: '',
  created: '',
  reopened: '',
  highPriority: '',
};

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
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
      notes: {},
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

  const updateNotes = useCallback((id: string, ticketKey: string, note: string) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, notes: { ...s.notes, [ticketKey]: note } };
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

  return { sprints, addSprint, updateSprint, archiveSprint, updateNotes, deleteSprint };
}
