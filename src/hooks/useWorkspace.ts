import { useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import type { Workspace, Artifact } from '../types/workspace';

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useLocalStorage<Workspace[]>(
    STORAGE_KEYS.WORKSPACES,
    [],
  );
  const [activeId, setActiveId] = useLocalStorage<string | null>(
    STORAGE_KEYS.ACTIVE_WORKSPACE,
    null,
  );

  const createWorkspace = useCallback((name: string) => {
    const ws: Workspace = {
      id: crypto.randomUUID(),
      name,
      createdAt: Date.now(),
      artifacts: [],
    };
    setWorkspaces((prev) => [...prev, ws]);
    setActiveId(ws.id);
    return ws;
  }, [setWorkspaces, setActiveId]);

  const renameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === id ? { ...ws, name } : ws)),
    );
  }, [setWorkspaces]);

  const deleteWorkspace = useCallback((id: string) => {
    setWorkspaces((prev) => prev.filter((ws) => ws.id !== id));
    if (activeId === id) {
      setActiveId(null);
    }
  }, [setWorkspaces, setActiveId, activeId]);

  const addArtifact = useCallback((workspaceId: string, artifact: Omit<Artifact, 'id' | 'timestamp'>) => {
    const newArtifact: Artifact = {
      ...artifact,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };
    setWorkspaces((prev) =>
      prev.map((ws) =>
        ws.id === workspaceId
          ? { ...ws, artifacts: [...ws.artifacts, newArtifact].slice(-50) }
          : ws,
      ),
    );
  }, [setWorkspaces]);

  const saveArtifact = useCallback((artifact: Omit<Artifact, 'id' | 'timestamp'>, fallbackName: string) => {
    // activeId can point at a workspace that no longer exists (cleared/corrupt
    // storage, o borrado DURANTE el stream); addArtifact would silently no-op,
    // so fall back to a fresh one. El guard valida contra localStorage, no
    // contra el estado del closure: las herramientas capturan este callback al
    // arrancar la generacion y lo llaman al completar, segundos despues — el
    // closure lleva la lista de entonces, mientras que useLocalStorage escribe
    // localStorage sincronamente en cada update, asi que es lo realmente
    // guardado en el momento de escribir.
    let current: unknown;
    try {
      current = JSON.parse(localStorage.getItem(STORAGE_KEYS.WORKSPACES) ?? '[]');
    } catch {
      current = [];
    }
    const list = Array.isArray(current) ? (current as Workspace[]) : [];
    const targetIsValid = activeId !== null && list.some((w) => w.id === activeId);
    const targetId = targetIsValid ? activeId : createWorkspace(fallbackName).id;
    addArtifact(targetId, artifact);
  }, [activeId, createWorkspace, addArtifact]);

  const exportWorkspace = useCallback((id: string): string | null => {
    const ws = workspaces.find((w) => w.id === id);
    if (!ws) return null;
    return JSON.stringify(ws, null, 2);
  }, [workspaces]);

  const importWorkspace = useCallback((json: string) => {
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') throw new Error('JSON invalido');
    const ws = parsed as Workspace;
    if (!ws.id || !ws.name || !Array.isArray(ws.artifacts)) {
      throw new Error('Estructura de workspace invalida');
    }
    setWorkspaces((prev) => {
      const exists = prev.find((w) => w.id === ws.id);
      if (exists) {
        return prev.map((w) => (w.id === ws.id ? ws : w));
      }
      return [...prev, ws];
    });
    setActiveId(ws.id);
  }, [setWorkspaces, setActiveId]);

  return {
    workspaces,
    activeId,
    setActiveId,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
    addArtifact,
    saveArtifact,
    exportWorkspace,
    importWorkspace,
  };
}
