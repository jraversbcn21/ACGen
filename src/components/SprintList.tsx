import { useState } from 'react';
import type { Sprint } from '../hooks/useSprints';
import { useT, useLang } from '../i18n/I18nContext';
import { formatDate, localTodayISO } from '../utils/dates';

interface SprintListProps {
  sprints: Sprint[];
  onAddSprint: (name: string, startDate: string) => void;
  onSelectSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
  onRenameSprint: (id: string, name: string) => void;
}

export function SprintList({ sprints, onAddSprint, onSelectSprint, onDeleteSprint, onRenameSprint }: SprintListProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(localTodayISO);
  const t = useT();

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddSprint(name.trim(), startDate);
    setName('');
    setStartDate(localTodayISO());
    setShowForm(false);
  };

  const active = sprints.filter((s) => !s.archived);
  const archived = sprints.filter((s) => s.archived);

  return (
    <div>
      <div className="actions-bar" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)} style={{ minWidth: 180 }}>
          {t('sprint.newSprint')}
        </button>
      </div>

      {showForm && (
        <div style={{
          marginTop: 16, padding: 16,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div>
            <label htmlFor="sprint-name" className="field-label">{t('sprint.name')}</label>
            <input
              id="sprint-name"
              type="text"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('sprint.namePlaceholder')}
            />
          </div>
          <div>
            <label htmlFor="sprint-start" className="field-label">{t('sprint.startDate')}</label>
            <input
              id="sprint-start"
              type="date"
              className="field-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn-primary" onClick={handleAdd} style={{ minWidth: 120 }}>
              {t('sprint.create')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h3 style={{ marginTop: 28, marginBottom: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
            {t('sprint.active')}
          </h3>
          {active.map((s) => (
            <SprintCard key={s.id} sprint={s} onSelect={onSelectSprint} onDelete={onDeleteSprint} onRename={onRenameSprint} />
          ))}
        </>
      )}

      {archived.length > 0 && (
        <>
          <h3 style={{ marginTop: 28, marginBottom: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>
            {t('sprint.archived')}
          </h3>
          {archived.map((s) => (
            <SprintCard key={s.id} sprint={s} onSelect={onSelectSprint} onDelete={onDeleteSprint} onRename={onRenameSprint} />
          ))}
        </>
      )}

      {sprints.length === 0 && (
        <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          {t('sprint.noSprints')}
        </p>
      )}
    </div>
  );
}

function SprintCard({ sprint, onSelect, onDelete, onRename }: {
  sprint: Sprint;
  onSelect: (s: Sprint) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(sprint.name);

  const saveRename = () => {
    if (editName.trim()) onRename(sprint.id, editName.trim());
    setIsEditing(false);
  };

  return (
    <div
      className="sprint-card"
      style={{
        padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        background: sprint.archived ? 'var(--surface-2)' : 'var(--surface)',
        borderLeft: sprint.archived ? undefined : '3px solid var(--accent)',
        marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'box-shadow .18s var(--ease)',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(sprint)}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {sprint.archived ? '\uD83D\uDCE6' : '\uD83D\uDFE2'}
        </span>
        <div>
          {isEditing ? (
            <input
              type="text"
              className="field-input"
              value={editName}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              onBlur={saveRename}
              style={{ fontSize: 15, fontWeight: 700, padding: '2px 6px' }}
            />
          ) : (
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{sprint.name}</div>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {formatDate(sprint.startDate, lang)} &mdash; {sprint.archived ? formatDate(sprint.endDate, lang) : t('sprint.enCurso')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
          {sprint.archived && (
            <span className="badge badge-info" style={{ fontSize: 11 }}>{t('sprint.archived')}</span>
          )}
          {!sprint.archived && (
            <button
              type="button"
              className="btn-ghost"
              onClick={(e) => { e.stopPropagation(); setEditName(sprint.name); setIsEditing(true); }}
              style={{ padding: '4px 10px', fontSize: 12 }}
            >
              {t('common.edit')}
            </button>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={(e) => { e.stopPropagation(); if (confirm(t('sprint.deleteConfirm'))) onDelete(sprint.id); }}
            style={{ padding: '4px 10px', fontSize: 12 }}
          >
            {t('common.delete')}
        </button>
      </div>
    </div>
  );
}
