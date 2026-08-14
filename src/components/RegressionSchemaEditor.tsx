import { useState } from 'react';
import { useSchema } from '../hooks/useSchema';
import { DEFAULT_SCHEMA, resolveLabel, SchemaEntry } from '../types/schema';
import { useT } from '../i18n/I18nContext';
import { SchemaEntryRow } from './SchemaEntryRow';

type ListName = 'ticketFields' | 'platforms';

interface RegressionSchemaEditorProps {
  onClose: () => void;
}

export function RegressionSchemaEditor({ onClose }: RegressionSchemaEditorProps) {
  const t = useT();
  const [schema, setSchema] = useSchema();
  const [newFieldName, setNewFieldName] = useState('');

  // Escritura directa, sin borrador global: cada cambio persiste en el acto y
  // "Restaurar por defecto" es la via de vuelta.
  const writeList = (list: ListName, entries: SchemaEntry[]) =>
    setSchema({ ...schema, regression: { ...schema.regression, [list]: entries } });

  const patchEntry = (list: ListName, id: string, patch: Partial<SchemaEntry>) =>
    writeList(list, schema.regression[list].map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const addField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    writeList('ticketFields', [...schema.regression.ticketFields, { id: crypto.randomUUID(), label: name }]);
    setNewFieldName('');
  };

  const reset = () => {
    if (!confirm(t('schema.resetConfirm'))) return;
    setSchema({ ...schema, regression: DEFAULT_SCHEMA.regression });
  };

  const renderList = (list: ListName) => {
    const entries = schema.regression[list];
    const visibleCount = entries.filter((e) => !e.hidden).length;
    return entries.map((entry) => (
      <SchemaEntryRow
        key={entry.id}
        inputId={`schema-${list}-${entry.id}`}
        label={resolveLabel(entry, t)}
        hidden={Boolean(entry.hidden)}
        canHide={visibleCount > 1}
        onRename={(label) => patchEntry(list, entry.id, { label })}
        onToggleHidden={(hidden) => patchEntry(list, entry.id, { hidden })}
      />
    ));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{t('schema.title')}</h2>
          <button type="button" className="btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 4 }}>{t('schema.hiddenHint')}</p>
        <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>{t('schema.renameHint')}</p>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.fields')}</h3>
        {renderList('ticketFields')}
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
          <input
            type="text"
            placeholder={t('schema.newFieldPlaceholder')}
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addField(); }}
            className="field-input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <button type="button" className="btn-ghost" onClick={addField}>{t('schema.addField')}</button>
        </div>

        <h3 style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px' }}>{t('schema.platforms')}</h3>
        {renderList('platforms')}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <button type="button" className="btn-ghost" onClick={reset}>{t('schema.reset')}</button>
        </div>
      </div>
    </div>
  );
}
