import { useState, useRef, useEffect } from 'react';
import { useT } from '../i18n/I18nContext';
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
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useT();

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
    // Sin esto, reelegir el MISMO fichero tras un import fallido (el dropdown
    // sigue abierto y el input retiene el nombre) no dispara change y el
    // reintento se ignora en silencio. Mismo guard que BackupMenu.
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onImport(reader.result as string);
        setOpen(false);
      } catch {
        alert(t('workspace.importError'));
      }
    };
    reader.readAsText(file);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn-ghost"
        onClick={() => setOpen((o) => !o)}
        style={{ fontSize: 13 }}
      >
        {activeWorkspace ? activeWorkspace.name : t('workspace.none')}
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
              {confirmingId === ws.id ? (
                <>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>
                    {t('workspace.confirmDelete', { name: ws.name })}
                  </span>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }}
                    aria-label={t('common.confirm')} title={t('common.confirm')}
                    onClick={() => { onDelete(ws.id); setConfirmingId(null); }}>✓</button>
                  <button type="button" className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }}
                    aria-label={t('common.cancel')} title={t('common.cancel')}
                    onClick={() => setConfirmingId(null)}>✗</button>
                </>
              ) : (
                <>
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
                    className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }}
                    aria-label={t('common.rename')} title={t('common.rename')}>✎</button>
                  <button type="button" onClick={() => setConfirmingId(ws.id)}
                    className="btn-ghost" style={{ padding: '2px 4px', fontSize: 12 }}
                    aria-label={t('common.delete')} title={t('common.delete')}>🗑</button>
                </>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

          {creating ? (
            <div style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                placeholder={t('workspace.namePlaceholder')} className="field-input" style={{ flex: 1, fontSize: 13, height: 32 }} autoFocus />
              <button type="button" className="btn-primary" onClick={handleCreate} style={{ fontSize: 12, padding: '2px 12px', minWidth: 0 }}>{t('workspace.create')}</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCreating(true)} className="btn-ghost" style={{ width: '100%', textAlign: 'left', fontSize: 13 }}>
              {t('workspace.new')}
            </button>
          )}

          <div style={{ display: 'flex', gap: 4, marginTop: 4, padding: '0 8px' }}>
            <button type="button" className="btn-ghost" style={{ flex: 1, fontSize: 12 }}
              onClick={() => { if (activeId) { onExport(activeId); setOpen(false); } }} disabled={!activeId}>{t('common.export')}</button>
            <button type="button" className="btn-ghost" style={{ flex: 1, fontSize: 12 }}
              onClick={handleImport}>{t('common.import')}</button>
          </div>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </div>
      )}
    </div>
  );
}
