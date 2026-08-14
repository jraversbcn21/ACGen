import { useState, useEffect } from 'react';
import { useT } from '../i18n/I18nContext';

interface SchemaEntryRowProps {
  label: string;
  hidden: boolean;
  /** false cuando esta es la ultima entrada visible de su lista. */
  canHide: boolean;
  inputId: string;
  onRename: (label: string) => void;
  onToggleHidden: (hidden: boolean) => void;
}

/**
 * Una fila del editor de esquema. El input de nombre lleva borrador local y
 * confirma en blur: asi se puede vaciar para escribir otro nombre sin que un
 * valor intermedio en blanco borre la etiqueta. Un borrador vacio al salir se
 * descarta y restaura la etiqueta anterior.
 */
export function SchemaEntryRow({ label, hidden, canHide, inputId, onRename, onToggleHidden }: SchemaEntryRowProps) {
  const t = useT();
  const [draft, setDraft] = useState(label);

  // Resincroniza cuando la etiqueta cambia por fuera (p.ej. "Restaurar por defecto").
  useEffect(() => { setDraft(label); }, [label]);

  const commit = () => {
    const next = draft.trim();
    if (!next) { setDraft(label); return; }
    if (next !== label) onRename(next);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <input
        id={inputId}
        type="text"
        aria-label={t('schema.nameOf', { name: label })}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
          if (e.key === 'Escape') setDraft(label);
        }}
        className="field-input"
        style={{ flex: 1, minWidth: 0 }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
        <input
          type="checkbox"
          checked={hidden}
          disabled={!hidden && !canHide}
          onChange={(e) => onToggleHidden(e.target.checked)}
        />
        {t('schema.hide')}
      </label>
    </div>
  );
}
