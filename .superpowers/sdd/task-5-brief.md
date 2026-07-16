### Task 3.2.2: WorkspacePicker UI + wire into App

**Files:**
- Create: `src/components/WorkspacePicker.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/App.tsx`
- Modify: All 8 LLM tool components — add `onSaveArtifact` prop

**Interfaces:**
- Consumes: `useWorkspace()` from Task 3.2.1
- Produces: `<WorkspacePicker>` in Header, workspace name in Sidebar, auto-save artifacts

**Context:** `useWorkspace()` hook with CRUD already exists. This task wires the UI.

- [ ] **Step 1: Create WorkspacePicker.tsx**

```typescript
// src/components/WorkspacePicker.tsx
import { useState, useRef, useEffect } from 'react';
import type { Workspace } from '../types/workspace';

interface WorkspacePickerProps {
  workspaces: Workspace[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  onImport: (json: string) => void;
}

export function WorkspacePicker({
  workspaces,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: WorkspacePickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeWorkspace = workspaces.find((w) => w.id === activeId);

  const handleCreate = () => {
    if (newName.trim()) {
      onCreate(newName.trim());
      setNewName('');
      setCreating(false);
    }
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      onRename(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(reader.result as string);
        setOpen(false);
      } catch {
        alert('Archivo JSON invalido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-ghost workspace-picker-btn"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 13 }}
      >
        {activeWorkspace ? activeWorkspace.name : 'Sin workspace'}
        <span style={{ marginLeft: 6, color: 'var(--text-3)' }}>
          {activeWorkspace ? `(${activeWorkspace.artifacts.length})` : ''}
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 240,
            zIndex: 100,
            padding: 8,
          }}
        >
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 'var(--radius-sm)',
                background: ws.id === activeId ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
              }}
            >
              {editingId === ws.id ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(ws.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  onBlur={() => handleRename(ws.id)}
                  className="field-input"
                  style={{ flex: 1, fontSize: 13 }}
                  autoFocus
                />
              ) : (
                <button
                  type="button"
                  onClick={() => { onSelect(ws.id); setOpen(false); }}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: 'var(--text)',
                  }}
                >
                  {ws.name}
                  <span style={{ color: 'var(--text-3)', marginLeft: 6 }}>
                    {ws.artifacts.length}
                  </span>
                </button>
              )}
              <button type="button" onClick={() => { setEditingId(ws.id); setEditName(ws.name); }}
                className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }} title="Renombrar">✎</button>
              <button type="button" onClick={() => onDelete(ws.id)}
                className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }} title="Eliminar">🗑</button>
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {creating ? (
            <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder="Nombre del workspace" className="field-input" style={{ flex: 1, fontSize: 13 }} autoFocus />
              <button type="button" className="btn-primary" onClick={handleCreate} style={{ fontSize: 12, padding: '2px 8px' }}>Crear</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="btn-ghost" style={{ width: '100%', textAlign: 'left', fontSize: 13 }}>
              + Nuevo workspace
            </button>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 8px' }}>
            <button type="button" className="btn-ghost" style={{ flex: 1, fontSize: 12 }}
              onClick={() => { if (activeId) { onExport(activeId); setOpen(false); } }} disabled={!activeId}>Exportar</button>
            <button type="button" className="btn-ghost" style={{ flex: 1, fontSize: 12 }}
              onClick={handleImport}>Importar</button>
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Integrate into Header.tsx**

Add import:
```typescript
import { WorkspacePicker } from './WorkspacePicker';
import type { Workspace } from '../types/workspace';
```

Add props to HeaderProps:
```typescript
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: (name: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onDeleteWorkspace: (id: string) => void;
  onExportWorkspace: (id: string) => void;
  onImportWorkspace: (json: string) => void;
```

Destructure new props in the function signature. Render WorkspacePicker next to the model chip. Find where the model badge is rendered and add right before it (or after, wherever fits the layout best):

```tsx
<WorkspacePicker
  workspaces={workspaces}
  activeId={activeWorkspaceId}
  onSelect={onSelectWorkspace}
  onCreate={onCreateWorkspace}
  onRename={onRenameWorkspace}
  onDelete={onDeleteWorkspace}
  onExport={onExportWorkspace}
  onImport={onImportWorkspace}
/>
```

- [ ] **Step 3: Integrate workspace into App.tsx**

Add import:
```typescript
import { useWorkspace } from './hooks/useWorkspace';
```

Add workspace hook call after existing hooks:
```typescript
const workspace = useWorkspace();
```

Add `saveArtifact` callback:
```typescript
const saveArtifact = useCallback((artifact: { tool: ViewType; input: string; output: string }) => {
  let targetId = workspace.activeId;
  if (!targetId) {
    targetId = workspace.createWorkspace('Sin nombre').id;
  }
  workspace.addArtifact(targetId, artifact);
}, [workspace]);
```

Pass workspace props to `<Header>`:
```tsx
  workspaces={workspace.workspaces}
  activeWorkspaceId={workspace.activeId}
  onSelectWorkspace={workspace.setActiveId}
  onCreateWorkspace={workspace.createWorkspace}
  onRenameWorkspace={workspace.renameWorkspace}
  onDeleteWorkspace={workspace.deleteWorkspace}
  onExportWorkspace={workspace.exportWorkspace}
  onImportWorkspace={workspace.importWorkspace}
```

Pass `onSaveArtifact` to each tool view. For each of the 8 LLM tool render blocks, add:
```tsx
  onSaveArtifact={(input, output) => saveArtifact({ tool: '<VIEW>', input, output })}
```

- [ ] **Step 4: Add workspace section to Sidebar.tsx**

Add import:
```typescript
import type { Workspace } from '../types/workspace';
```

Add props to the Sidebar component interface:
```typescript
  activeWorkspaceName: string;
```

At top of sidebar (before tool items), render:
```tsx
{activeWorkspaceName && (
  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
      WS: {activeWorkspaceName}
    </span>
  </div>
)}
```

In App.tsx, pass:
```tsx
  activeWorkspaceName={workspace.workspaces.find(w => w.id === workspace.activeId)?.name ?? ''}
```

- [ ] **Step 5: Add onSaveArtifact prop to all 8 LLM tools**

Each tool's Props interface gets:
```typescript
  onSaveArtifact?: (input: string, output: string) => void;
```

In each tool's `doGenerate` success path (after `setResult(fullText)`), call:
```typescript
  onSaveArtifact?.(<originalInput>, fullText);
```

Where `<originalInput>` is the tool's current input text (whatever was passed to the API).

- [ ] **Step 6: Type check**

```bash
npx tsc -b --noEmit 2>&1
```
Expected: zero errors.

- [ ] **Step 7: Run all tests**

```bash
npm test 2>&1
```
Expected: all 90 tests pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(workspaces): WorkspacePicker UI, Header/Sidebar/App integration, auto-save artifacts"
```
