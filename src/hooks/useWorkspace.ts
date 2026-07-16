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
    exportWorkspace,
    importWorkspace,
  };
}
