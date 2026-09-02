import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { STORAGE_KEYS } from '../config/constants';
import { localTodayISO } from '../utils/dates';
import { writeStorage } from '../services/persistence';
import { useSchema } from './useSchema';

const STORAGE_KEY = 'acgen_sprints';

/** Abierto desde la Fase 5: las pestanas salen del esquema, no de una union
 *  cerrada. Las pestanas retiradas del esquema conservan su grid en el objeto
 *  guardado — convencion "huerfano pero intacto". */
export type TabId = string;

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  archived: boolean;
  tabGrid: Record<TabId, string[][]>;
}

function createEmptyGrid(rows: number = 20, cols: number = 6): string[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
}

function emptyTabGrid(tabIds: string[]): Record<TabId, string[][]> {
  return Object.fromEntries(tabIds.map((id) => [id, createEmptyGrid()]));
}

// Usado por los updaters que leen una grid concreta: el estado en crudo no
// materializa una pestana nueva del esquema hasta que algo la escribe (ver
// visibleSprints mas abajo, que la materializa solo para lectura). Sin este
// fallback, editar una celda de una pestana recien anadida seria un no-op
// silencioso porque `grid.map` sobre `[]` no produce filas.
function gridFor(s: Sprint, tabId: TabId): string[][] {
  return s.tabGrid[tabId] || createEmptyGrid();
}

function hydrate(raw: string | null, tabIds: string[]): Sprint[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((s: Sprint) => ({
      ...s,
      tabGrid: { ...emptyTabGrid(tabIds), ...(s.tabGrid || {}) },
    }));
  } catch {
    return [];
  }
}

export function useSprints() {
  const [schema] = useSchema();
  const tabIds = useMemo(() => schema.sprint.tabs.map((t) => t.id), [schema]);

  const [sprints, setSprints] = useState<Sprint[]>(() => hydrate(localStorage.getItem(STORAGE_KEY), tabIds));

  // Persistir como efecto mantiene los updaters puros; la identidad del último
  // estado persistido evita reescribir lo recién hidratado en el mount.
  const lastPersisted = useRef(sprints);
  useEffect(() => {
    if (lastPersisted.current === sprints) return;
    lastPersisted.current = sprints;
    writeStorage(STORAGE_KEY, sprints);
  }, [sprints]);

  // Otra pestana escribio (o restauro una copia): rehidratar en vez de pisarla
  // con el estado local en la siguiente edicion. lastPersisted evita el rebote.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = hydrate(e.newValue, tabIds);
      lastPersisted.current = next;
      setSprints(next);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [tabIds]);

  const addSprint = useCallback((name: string, startDate: string) => {
    const sprint: Sprint = {
      id: crypto.randomUUID(),
      name,
      startDate,
      endDate: null,
      archived: false,
      tabGrid: emptyTabGrid(tabIds),
    };
    setSprints((prev) => [sprint, ...prev]);
  }, [tabIds]);

  const updateSprint = useCallback((id: string, partial: Partial<Omit<Sprint, 'id'>>) => {
    setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
  }, []);

  const archiveSprint = useCallback((id: string) => {
    updateSprint(id, { archived: true, endDate: localTodayISO() });
  }, [updateSprint]);

  // La vuelta atras de archivar. Existe porque archivar pasa el sprint a solo
  // lectura: sin esta salida, una errata detectada despues de archivar se
  // quedaria congelada para siempre. Limpia endDate para que el sprint vuelva
  // a leerse como "En curso" y no arrastre una fecha de cierre que ya no vale.
  const unarchiveSprint = useCallback((id: string) => {
    updateSprint(id, { archived: false, endDate: null });
  }, [updateSprint]);

  const updateGridCell = useCallback((id: string, tabId: TabId, row: number, col: number, value: string) => {
    setSprints((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      const grid = gridFor(s, tabId);
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
      const grid = gridFor(s, tabId);
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

  // El esquema puede ganar una pestana DESPUES del mount (editor de esquema
  // en vivo). El backfill del useState solo corrio una vez, asi que el
  // estado en crudo puede no traer grid para ella todavia. Derivar aqui, en
  // el retorno, materializa la invariante "todo sprint tiene grid para toda
  // pestana del esquema" en cada render sin tocar el estado ni el efecto de
  // persistencia — evita el bucle de reescritura en localStorage.
  const visibleSprints = useMemo(
    () => sprints.map((s) => ({ ...s, tabGrid: { ...emptyTabGrid(tabIds), ...(s.tabGrid || {}) } })),
    [sprints, tabIds],
  );

  return { sprints: visibleSprints, addSprint, updateSprint, archiveSprint, unarchiveSprint, updateGridCell, setTabGrid, moveRow, deleteSprint };
}
