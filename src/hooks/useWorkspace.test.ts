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

  describe('saveArtifact', () => {
    it('saves into the active workspace when activeId is valid', () => {
      const { result } = renderHook(() => useWorkspace());
      act(() => {
        result.current.createWorkspace('Mi proyecto');
      });
      act(() => {
        result.current.saveArtifact({ tool: 'acceptance', input: 'in', output: 'out' }, 'Sin nombre');
      });
      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0].name).toBe('Mi proyecto');
      expect(result.current.workspaces[0].artifacts).toHaveLength(1);
      expect(result.current.workspaces[0].artifacts[0].output).toBe('out');
    });

    it('creates a fallback workspace when activeId is null', () => {
      const { result } = renderHook(() => useWorkspace());
      act(() => {
        result.current.saveArtifact({ tool: 'acceptance', input: 'in', output: 'out' }, 'Sin nombre');
      });
      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0].name).toBe('Sin nombre');
      expect(result.current.workspaces[0].artifacts).toHaveLength(1);
      expect(result.current.activeId).toBe(result.current.workspaces[0].id);
    });

    it('does not lose the artifact when activeId points at a workspace that no longer exists', () => {
      localStorage.setItem('acgen_workspaces', JSON.stringify([]));
      localStorage.setItem('acgen_active_workspace', JSON.stringify('ghost-id'));
      const { result } = renderHook(() => useWorkspace());
      expect(result.current.activeId).toBe('ghost-id');
      act(() => {
        result.current.saveArtifact({ tool: 'testcase', input: 'in', output: 'out' }, 'Sin nombre');
      });
      expect(result.current.workspaces).toHaveLength(1);
      expect(result.current.workspaces[0].name).toBe('Sin nombre');
      expect(result.current.workspaces[0].artifacts).toHaveLength(1);
      expect(result.current.workspaces[0].artifacts[0].output).toBe('out');
      expect(result.current.activeId).toBe(result.current.workspaces[0].id);
    });
  });
});
