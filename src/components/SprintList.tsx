import { useState } from 'react';
import type { Sprint } from '../hooks/useSprints';

interface SprintListProps {
  sprints: Sprint[];
  onAddSprint: (name: string, startDate: string) => void;
  onSelectSprint: (sprint: Sprint) => void;
  onDeleteSprint: (id: string) => void;
}

export function SprintList({ sprints, onAddSprint, onSelectSprint, onDeleteSprint }: SprintListProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAdd = () => {
    if (!name.trim()) return;
    onAddSprint(name.trim(), startDate);
    setName('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setShowForm(false);
  };

  const active = sprints.filter((s) => !s.archived);
  const archived = sprints.filter((s) => s.archived);

  return (
    <div>
      <div className="actions-bar" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="btn-primary" onClick={() => setShowForm(true)} style={{ minWidth: 180 }}>
          Nuevo Sprint
        </button>
      </div>

      {showForm && (
        <div style={{
          marginTop: 16, padding: 16,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div>
            <label htmlFor="sprint-name" className="field-label">Nombre del sprint</label>
            <input
              id="sprint-name"
              type="text"
              className="field-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 25"
            />
          </div>
          <div>
            <label htmlFor="sprint-start" className="field-label">Fecha de inicio</label>
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
              Crear
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h3 style={{ marginTop: 28, marginBottom: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
            Sprint Activo
          </h3>
          {active.map((s) => (
            <SprintCard key={s.id} sprint={s} onSelect={onSelectSprint} onDelete={onDeleteSprint} />
          ))}
        </>
      )}

      {archived.length > 0 && (
        <>
          <h3 style={{ marginTop: 28, marginBottom: 12, fontSize: 14, fontWeight: 700, color: 'var(--text-3)' }}>
            Archivados
          </h3>
          {archived.map((s) => (
            <SprintCard key={s.id} sprint={s} onSelect={onSelectSprint} onDelete={onDeleteSprint} />
          ))}
        </>
      )}

      {sprints.length === 0 && (
        <p style={{ marginTop: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          No hay sprints. Crea tu primer sprint para empezar.
        </p>
      )}
    </div>
  );
}

function SprintCard({ sprint, onSelect, onDelete }: { sprint: Sprint; onSelect: (s: Sprint) => void; onDelete: (id: string) => void }) {
  const formatDate = (d: string | null) => {
    if (!d) return '\u2014';
    return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{sprint.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {formatDate(sprint.startDate)} &mdash; {sprint.archived ? formatDate(sprint.endDate) : 'En curso'}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {sprint.archived && (
          <span className="badge badge-info" style={{ fontSize: 11 }}>Archivado</span>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={(e) => { e.stopPropagation(); if (confirm('\u00BFEliminar este sprint?')) onDelete(sprint.id); }}
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
