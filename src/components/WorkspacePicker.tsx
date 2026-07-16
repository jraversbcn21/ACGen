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
