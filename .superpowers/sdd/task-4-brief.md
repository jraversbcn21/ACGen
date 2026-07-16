### Task 3.2.1: Workspace types + hook + tests

**Files:**
- Create: `src/types/workspace.ts`
- Create: `src/hooks/useWorkspace.ts`
- Create: `src/hooks/useWorkspace.test.ts`
- Modify: `src/config/constants.ts` — add STORAGE_KEYS entries

**Interfaces:**
- Produces: `Workspace`, `Artifact` types, `useWorkspace()` hook

**Context:** Workspaces group generated artifacts into named projects. This is additive — no existing files change except constants.ts.

- [ ] **Step 1: Create workspace types**

```typescript
// src/types/workspace.ts
import type { ViewType } from '../config/constants';

export interface Artifact {
  id: string;
  tool: ViewType;
  input: string;
  output: string;
  timestamp: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
  artifacts: Artifact[];
}
```

- [ ] **Step 2: Add STORAGE_KEYS entries to constants.ts**

In `src/config/constants.ts`, add inside the STORAGE_KEYS object:
```typescript
  WORKSPACES: 'acgen_workspaces',
  ACTIVE_WORKSPACE: 'acgen_active_workspace',
```

- [ ] **Step 3: Create useWorkspace hook**

```typescript
// src/hooks/useWorkspace.ts
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
```

- [ ] **Step 4: Create useWorkspace.test.ts**

```typescript
// src/hooks/useWorkspace.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWorkspace } from './useWorkspace';

describe('useWorkspace', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty workspaces and null activeId', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(result.current.workspaces).toEqual([]);
    expect(result.current.activeId).toBeNull();
  });

  it('creates a workspace with a generated id and sets it as active', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.createWorkspace('Proyecto Alpha');
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Proyecto Alpha');
    expect(result.current.workspaces[0].artifacts).toEqual([]);
    expect(result.current.activeId).toBe(result.current.workspaces[0].id);
  });

  it('renames a workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Old Name');
      wsId = ws.id;
    });
    act(() => {
      result.current.renameWorkspace(wsId!, 'New Name');
    });
    expect(result.current.workspaces[0].name).toBe('New Name');
  });

  it('deletes a workspace and unsets activeId if it was active', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('To Delete');
      wsId = ws.id;
    });
    expect(result.current.activeId).toBe(wsId!);
    act(() => {
      result.current.deleteWorkspace(wsId!);
    });
    expect(result.current.workspaces).toHaveLength(0);
    expect(result.current.activeId).toBeNull();
  });

  it('adds an artifact to a workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Test');
      wsId = ws.id;
    });
    act(() => {
      result.current.addArtifact(wsId!, {
        tool: 'acceptance',
        input: 'test input',
        output: 'test output',
      });
    });
    expect(result.current.workspaces[0].artifacts).toHaveLength(1);
    expect(result.current.workspaces[0].artifacts[0].tool).toBe('acceptance');
    expect(result.current.workspaces[0].artifacts[0].input).toBe('test input');
    expect(result.current.workspaces[0].artifacts[0].output).toBe('test output');
    expect(typeof result.current.workspaces[0].artifacts[0].id).toBe('string');
    expect(typeof result.current.workspaces[0].artifacts[0].timestamp).toBe('number');
  });

  it('caps artifacts at 50 per workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    let wsId: string;
    act(() => {
      const ws = result.current.createWorkspace('Full');
      wsId = ws.id;
    });
    act(() => {
      for (let i = 0; i < 55; i++) {
        result.current.addArtifact(wsId!, {
          tool: 'acceptance',
          input: `input ${i}`,
          output: `output ${i}`,
        });
      }
    });
    expect(result.current.workspaces[0].artifacts).toHaveLength(50);
  });

  it('exports a workspace as JSON string', () => {
    const { result } = renderHook(() => useWorkspace());
    act(() => {
      result.current.createWorkspace('Export Test');
    });
    const json = result.current.exportWorkspace(result.current.workspaces[0].id);
    expect(json).not.toBeNull();
    const parsed = JSON.parse(json!);
    expect(parsed.name).toBe('Export Test');
  });

  it('returns null when exporting non-existent workspace', () => {
    const { result } = renderHook(() => useWorkspace());
    const json = result.current.exportWorkspace('non-existent');
    expect(json).toBeNull();
  });

  it('imports a workspace from valid JSON', () => {
    const { result } = renderHook(() => useWorkspace());
    const wsJson = JSON.stringify({
      id: 'imported-id',
      name: 'Imported WS',
      createdAt: 1234567890,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson);
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Imported WS');
    expect(result.current.activeId).toBe('imported-id');
  });

  it('import overwrites existing workspace with same id', () => {
    const { result } = renderHook(() => useWorkspace());
    const wsJson = JSON.stringify({
      id: 'duplicate-id',
      name: 'First',
      createdAt: 1,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson);
    });
    const wsJson2 = JSON.stringify({
      id: 'duplicate-id',
      name: 'Second',
      createdAt: 2,
      artifacts: [],
    });
    act(() => {
      result.current.importWorkspace(wsJson2);
    });
    expect(result.current.workspaces).toHaveLength(1);
    expect(result.current.workspaces[0].name).toBe('Second');
  });

  it('throws on invalid import JSON', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(() => {
      act(() => {
        result.current.importWorkspace('not json');
      });
    }).toThrow();
  });

  it('throws on import with missing fields', () => {
    const { result } = renderHook(() => useWorkspace());
    expect(() => {
      act(() => {
        result.current.importWorkspace(JSON.stringify({ id: 'x', name: 'y' }));
      });
    }).toThrow();
  });
});
```

- [ ] **Step 5: Run workspace tests**

```bash
npx vitest run src/hooks/useWorkspace.test.ts 2>&1
```
Expected: 12 tests pass.

- [ ] **Step 6: Run full test suite**

```bash
npm test 2>&1
```
Expected: 78 + 12 = 90 tests pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(workspaces): types, useWorkspace hook with CRUD + export/import, 12 tests"
```
