import type { SprintJql } from '../hooks/useSprints';

interface SprintJqlConfigProps {
  jql: SprintJql;
  onChange: (jql: SprintJql) => void;
}

export function SprintJqlConfig({ jql, onChange }: SprintJqlConfigProps) {
  const update = (key: keyof SprintJql, value: string) => {
    onChange({ ...jql, [key]: value });
  };

  return (
    <div>
      <div className="jira-config" style={{ marginTop: '16px' }}>
        <span className="jira-config-title">Configurar JQLs del sprint</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
        {([
          { key: 'resolved' as const, label: 'Tickets Resueltos' },
          { key: 'created' as const, label: 'Tickets Creados' },
          { key: 'reopened' as const, label: 'Tickets ReOpen' },
          { key: 'highPriority' as const, label: 'Tickets Prioridad Alta' },
        ]).map(({ key, label }) => (
          <div key={key}>
            <label className="field-label">{label}</label>
            <textarea
              value={jql[key]}
              onChange={(e) => update(key, e.target.value)}
              placeholder={`JQL para ${label.toLowerCase()}...`}
              className="field-textarea"
              style={{ minHeight: 48 }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
