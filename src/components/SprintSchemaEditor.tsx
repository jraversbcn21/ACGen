import { useState } from 'react';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, SchemaEntry, SprintTabSchema } from '../types/schema';
import { useT } from '../i18n/I18nContext';
import { SchemaEntryRow } from './SchemaEntryRow';

interface SprintSchemaEditorProps {
  onClose: () => void;
}

/**
 * Muestra TODAS las pestanas con sus columnas a la vez, no solo la activa:
 * `activeTab` es estado interno de TrackerGrid y sacarlo de ahi para que el
 * editor lo lea seria mucho mas invasivo que listar las cinco pestanas.
 *
 * Ni borrar ni reordenar: el grid es posicional y el indice de `columns` es la
 * columna de datos. Ocultar preserva y es reversible.
 */
export function SprintSchemaEditor({ onClose }: SprintSchemaEditorProps) {
  const t = useT();
  const [schema, setSchema] = useSchema();
  const [newTabName, setNewTabName] = useState('');
  // Un borrador de columna nueva por pestana, por id: dos pestanas pueden tener
  // un nombre a medio escribir a la vez sin pisarse.
  const [newColName, setNewColName] = useState<Record<string, string>>({});

  const tabs = schema.sprint.tabs;
  const writeTabs = (next: SprintTabSchema[]) =>
    setSchema({ ...schema, sprint: { ...schema.sprint, tabs: next } });

  const patchTab = (id: string, patch: Partial<SchemaEntry>) =>
    writeTabs(tabs.map((tab) => (tab.id === id ? { ...tab, ...patch } : tab)));

  const patchColumn = (tabId: string, colId: string, patch: Partial<SchemaEntry>) =>
    writeTabs(tabs.map((tab) => (tab.id !== tabId ? tab : {
      ...tab,
      columns: tab.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)),
    })));

  const addColumn = (tabId: string) => {
    const name = (newColName[tabId] ?? '').trim();
    if (!name) return;
    writeTabs(tabs.map((tab) => (tab.id !== tabId ? tab : {
      ...tab,
      columns: [...tab.columns, { id: crypto.randomUUID(), label: name }],
    })));
    setNewColName((prev) => ({ ...prev, [tabId]: '' }));
  };

  const addTab = () => {
    const name = newTabName.trim();
    if (!name) return;
    // Arranca con las columnas de la primera pestana por defecto para que no
    // nazca vacia y sin columna que mostrar. Se CLONAN: meter la referencia de
    // DEFAULT_SCHEMA en el estado la dejaria compartida con la constante.
    const columns = DEFAULT_SCHEMA.sprint.tabs[0].columns.map((c) => ({ ...c }));
    writeTabs([...tabs, { id: crypto.randomUUID(), label: name, columns }]);
    setNewTabName('');
  };

  const reset = () => {
    if (!confirm(t('schema.resetSprintConfirm'))) return;
    setSchema({ ...schema, sprint: DEFAULT_SCHEMA.sprint });
  };

  const visibleTabCount = tabs.filter((tab) => !tab.hidden).length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('schema.sprintTitle')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('schema.hiddenHint')}</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>{t('schema.renameHint')}</p>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.tabs')}</h3>

        {tabs.map((tab) => {
          const visibleColCount = tab.columns.filter((c) => !c.hidden).length;
          return (
            <div key={tab.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
              <SchemaEntryRow
                inputId={`schema-sprint-tab-${tab.id}`}
                label={resolveLabel(tab, t)}
                hidden={Boolean(tab.hidden)}
                canHide={visibleTabCount > 1}
                onRename={(label) => patchTab(tab.id, { label })}
                onToggleHidden={(hidden) => patchTab(tab.id, { hidden })}
              />
              <div style={{ marginLeft: 16, marginTop: 8 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-2)' }}>{t('schema.columns')}</h4>
                {tab.columns.map((col) => (
                  <SchemaEntryRow
                    key={col.id}
                    inputId={`schema-sprint-col-${tab.id}-${col.id}`}
                    label={resolveLabel(col, t)}
                    hidden={Boolean(col.hidden)}
                    canHide={visibleColCount > 1}
                    onRename={(label) => patchColumn(tab.id, col.id, { label })}
                    onToggleHidden={(hidden) => patchColumn(tab.id, col.id, { hidden })}
                  />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder={t('schema.newColumnPlaceholder')}
                    value={newColName[tab.id] ?? ''}
                    onChange={(e) => setNewColName((prev) => ({ ...prev, [tab.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') addColumn(tab.id); }}
                    className="field-input"
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="button" className="btn-ghost" onClick={() => addColumn(tab.id)}>{t('schema.addColumn')}</button>
                </div>
              </div>
            </div>
          );
        })}

        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder={t('schema.newTabPlaceholder')}
            value={newTabName}
            onChange={(e) => setNewTabName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTab(); }}
            className="field-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" className="btn-ghost" onClick={addTab}>{t('schema.addTab')}</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn-ghost" onClick={reset}>{t('schema.reset')}</button>
        </div>
      </div>
    </div>
  );
}
