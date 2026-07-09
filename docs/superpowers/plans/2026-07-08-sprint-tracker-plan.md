# Sprint Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 5th ACGen tool that replaces the manual Excel-based Jira ticket tracking with a live dashboard organized by sprints, with personal notes and historical archiving.

**Architecture:** New endpoint on the existing Express Jira proxy for search queries, a `useSprints` hook for localStorage persistence, and three new components (SprintTracker router, SprintList, SprintDashboard, SprintJqlConfig). Integrates into App.tsx view routing and LandingScreen. No Groq API dependency.

**Tech Stack:** React 18, TypeScript, Vite 5, Express.js (existing proxy), localStorage, Vitest + React Testing Library

## Global Constraints

- Follows existing CSS token system in `App.css` (`.field-input`, `.field-select`, `.btn-primary`, `.btn-ghost`, `.data-table`, `.badge`, `.actions-bar`)
- All text in Spanish
- Models are plain strings in `AVAILABLE_MODELS`
- Jira credentials shared via `useLocalStorage(STORAGE_KEYS.JIRA_TOKEN)` and `useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL)`
- Tests use Vitest + React Testing Library, co-located with source files
- Commands: `npm run lint`, `npm test`, `npm run dev:all` from `acgen/`

---

### Task 1: Jira Search Endpoint + Service Methods

**Files:**
- Modify: `server/jiraRoutes.js:52` (append new route)
- Modify: `src/services/jiraService.ts:45` (append new function)
- Modify: `src/types/index.ts:70` (append new types)

**Interfaces:**
- Produces: `GET /api/jira/search?jql=...` endpoint, `jiraSearch(jql, token, baseUrl)` function, `JiraSearchResult` type

- [ ] **Step 1: Add JiraSearchResult type to src/types/index.ts**

Read the current end of the file (around line 70). Append after the `HistoryEntry` interface:

```typescript
export interface JiraSearchResult {
  key: string;
  summary: string;
  status: string;
  created: string;
  updated: string;
}
```

- [ ] **Step 2: Add search route to server/jiraRoutes.js**

Read the current end of the file (line 52 is `});`). Append after the closing `});` on line 52 (before the final export check — the file ends with `});` at the very end):

```javascript
jiraRoutes.get('/search', async (req, res) => {
  const token = req.headers['x-jira-token'];
  const baseUrl = req.headers['x-jira-base-url'];
  const jql = req.query.jql;

  if (!token || !baseUrl) {
    return res.status(400).json({ error: 'Faltan credenciales de Jira (token o URL base).' });
  }

  if (!jql) {
    return res.status(400).json({ error: 'Falta el parámetro JQL.' });
  }

  try {
    const response = await fetch(
      `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=key,summary,status,created,updated&maxResults=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token inválido o expirado.' });
      }
      if (response.status === 400) {
        return res.status(400).json({ error: 'JQL inválida. Revisa la sintaxis.' });
      }
      return res.status(response.status).json({ error: `Error al consultar Jira: ${response.status}` });
    }

    const data = await response.json();
    const issues = (data.issues || []).map((issue) => ({
      key: issue.key,
      summary: issue.fields?.summary || '',
      status: issue.fields?.status?.name || '',
      created: issue.fields?.created || '',
      updated: issue.fields?.updated || '',
    }));

    return res.json({ issues });
  } catch (err) {
    console.error('Jira proxy error:', err);
    return res.status(500).json({ error: 'Error de conexión con el servidor proxy.' });
  }
});
```

- [ ] **Step 3: Add jiraSearch function to src/services/jiraService.ts**

Read the current end of the file. Append after the `formatTicketAsText` function:

```typescript
export async function jiraSearch(
  jql: string,
  token: string,
  baseUrl: string,
): Promise<{ issues: Array<{ key: string; summary: string; status: string; created: string; updated: string }> }> {
  const response = await fetch(
    `${PROXY_URL}/jira/search?jql=${encodeURIComponent(jql)}`,
    {
      headers: {
        'X-Jira-Token': token,
        'X-Jira-Base-Url': baseUrl,
      },
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || `Error HTTP ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors (1 pre-existing warning about Icons.tsx is fine)

- [ ] **Step 5: Test Jira proxy manually (optional)**

Start the proxy: `npm run server`
Test with curl:
```
curl "http://localhost:3002/api/jira/search?jql=project%3DKEY" -H "X-Jira-Token: yourtoken" -H "X-Jira-Base-Url: https://yourjira.com"
```
Expected: JSON with `{ issues: [...] }`

---

### Task 2: useSprints Hook + Unit Tests

**Files:**
- Create: `src/hooks/useSprints.ts`
- Create: `src/hooks/useSprints.test.ts`

**Interfaces:**
- Produces: `useSprints()` hook returning `{ sprints, addSprint, updateSprint, archiveSprint, updateNotes, deleteSprint }`

- [ ] **Step 1: Write the failing tests in src/hooks/useSprints.test.ts**

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useSprints } from './useSprints';

beforeEach(() => {
  localStorage.clear();
});

describe('useSprints', () => {
  it('initializes with an empty array', () => {
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toEqual([]);
  });

  it('addSprint creates a new sprint with defaults', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const sprints = result.current.sprints;
    expect(sprints).toHaveLength(1);
    expect(sprints[0].name).toBe('Sprint 24');
    expect(sprints[0].startDate).toBe('2026-07-08');
    expect(sprints[0].endDate).toBeNull();
    expect(sprints[0].archived).toBe(false);
    expect(sprints[0].id).toBeTruthy();
    expect(sprints[0].jql.resolved).toBe('');
    expect(sprints[0].jql.created).toBe('');
    expect(sprints[0].jql.reopened).toBe('');
    expect(sprints[0].jql.highPriority).toBe('');
    expect(sprints[0].notes).toEqual({});
  });

  it('archiveSprint sets archived true and endDate to today', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-01');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.archiveSprint(id);
    });
    const archived = result.current.sprints[0];
    expect(archived.archived).toBe(true);
    expect(archived.endDate).not.toBeNull();
  });

  it('updateSprint modifies sprint fields', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateSprint(id, {
        name: 'Sprint 25',
        jql: { ...result.current.sprints[0].jql, resolved: 'project = BERSHKA AND status = Done' },
      });
    });
    expect(result.current.sprints[0].name).toBe('Sprint 25');
    expect(result.current.sprints[0].jql.resolved).toBe('project = BERSHKA AND status = Done');
  });

  it('updateNotes sets a note for a ticket key', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.updateNotes(id, 'BERSHKA-123', 'Reabierto por fallo en checkout');
    });
    expect(result.current.sprints[0].notes['BERSHKA-123']).toBe('Reabierto por fallo en checkout');
  });

  it('deleteSprint removes a sprint', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const id = result.current.sprints[0].id;
    act(() => {
      result.current.deleteSprint(id);
    });
    expect(result.current.sprints).toHaveLength(0);
  });

  it('persists sprints to localStorage', () => {
    const { result } = renderHook(() => useSprints());
    act(() => {
      result.current.addSprint('Sprint 24', '2026-07-08');
    });
    const stored = JSON.parse(localStorage.getItem('acgen_sprints') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Sprint 24');
  });

  it('hydrates from localStorage on init', () => {
    const existing = [
      {
        id: 'abc-123',
        name: 'Sprint 23',
        startDate: '2026-06-23',
        endDate: '2026-07-07',
        archived: true,
        jql: { resolved: 'jql1', created: '', reopened: '', highPriority: '' },
        notes: {},
      },
    ];
    localStorage.setItem('acgen_sprints', JSON.stringify(existing));
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toHaveLength(1);
    expect(result.current.sprints[0].name).toBe('Sprint 23');
  });

  it('recovers from invalid JSON in localStorage', () => {
    localStorage.setItem('acgen_sprints', 'not-valid-json');
    const { result } = renderHook(() => useSprints());
    expect(result.current.sprints).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useSprints.test.ts`
Expected: All tests FAIL (module not found)

- [ ] **Step 3: Create src/hooks/useSprints.ts**

```typescript
import { useState, useCallback } from 'react';

const STORAGE_KEY = 'acgen_sprints';

export interface SprintJql {
  resolved: string;
  created: string;
  reopened: string;
  highPriority: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  archived: boolean;
  jql: SprintJql;
  notes: Record<string, string>;
}

const EMPTY_JQL: SprintJql = {
  resolved: '',
  created: '',
  reopened: '',
  highPriority: '',
};

export function useSprints() {
  const [sprints, setSprints] = useState<Sprint[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const persist = useCallback((updated: Sprint[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSprints(updated);
  }, []);

  const addSprint = useCallback((name: string, startDate: string) => {
    const sprint: Sprint = {
      id: crypto.randomUUID(),
      name,
      startDate,
      endDate: null,
      archived: false,
      jql: { ...EMPTY_JQL },
      notes: {},
    };
    setSprints((prev) => {
      const updated = [sprint, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const updateSprint = useCallback((id: string, partial: Partial<Omit<Sprint, 'id'>>) => {
    setSprints((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, ...partial } : s));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const archiveSprint = useCallback((id: string) => {
    const today = new Date().toISOString().split('T')[0];
    updateSprint(id, { archived: true, endDate: today });
  }, [updateSprint]);

  const updateNotes = useCallback((id: string, ticketKey: string, note: string) => {
    setSprints((prev) => {
      const updated = prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, notes: { ...s.notes, [ticketKey]: note } };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const deleteSprint = useCallback((id: string) => {
    setSprints((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { sprints, addSprint, updateSprint, archiveSprint, updateNotes, deleteSprint };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useSprints.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: 28 tests pass (19 existing + 9 new)

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useSprints.ts src/hooks/useSprints.test.ts src/services/jiraService.ts src/types/index.ts server/jiraRoutes.js
git commit -m "feat: add jira search endpoint + useSprints hook"
```

---

### Task 3: SprintJqlConfig Component

**Files:**
- Create: `src/components/SprintJqlConfig.tsx`

**Interfaces:**
- Consumes: `Sprint` type from `useSprints.ts`
- Produces: `<SprintJqlConfig>` component accepting `jql`, `onChange` props

- [ ] **Step 1: Create src/components/SprintJqlConfig.tsx**

```typescript
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
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SprintJqlConfig.tsx
git commit -m "feat: add SprintJqlConfig component"
```

---

### Task 4: SprintDashboard Component

**Files:**
- Create: `src/components/SprintDashboard.tsx`

**Interfaces:**
- Consumes: `Sprint` type from `useSprints.ts`, `JiraSearchResult` from `types`, `jiraSearch` from `jiraService.ts`
- Produces: `<SprintDashboard>` component with tabbed ticket tables

- [ ] **Step 1: Create src/components/SprintDashboard.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { jiraSearch } from '../services/jiraService';
import type { JiraSearchResult } from '../types';
import type { Sprint } from '../hooks/useSprints';

type TabId = 'resolved' | 'created' | 'reopened' | 'highPriority';

const TAB_LABELS: Record<TabId, string> = {
  resolved: 'Resueltos',
  created: 'Creados',
  reopened: 'ReOpen',
  highPriority: 'Prioridad Alta',
};

interface SprintDashboardProps {
  sprint: Sprint;
  jiraToken: string;
  jiraBaseUrl: string;
  onUpdateNotes: (ticketKey: string, note: string) => void;
  onArchive: () => void;
}

export function SprintDashboard({ sprint, jiraToken, jiraBaseUrl, onUpdateNotes, onArchive }: SprintDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('resolved');
  const [results, setResults] = useState<Record<TabId, JiraSearchResult[]>>({
    resolved: [],
    created: [],
    reopened: [],
    highPriority: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTab = useCallback(async (tab: TabId) => {
    const jql = sprint.jql[tab];
    if (!jql.trim()) {
      setResults((prev) => ({ ...prev, [tab]: [] }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await jiraSearch(jql, jiraToken, jiraBaseUrl);
      setResults((prev) => ({ ...prev, [tab]: data.issues }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al consultar Jira');
    } finally {
      setLoading(false);
    }
  }, [sprint.jql, jiraToken, jiraBaseUrl]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  const tabs: TabId[] = ['resolved', 'created', 'reopened', 'highPriority'];

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="sprint-dashboard">
      <div className="sprint-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`btn-ghost ${activeTab === tab ? 'sprint-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {TAB_LABELS[tab]}
            {results[tab].length > 0 && (
              <span className="history-count">{results[tab].length}</span>
            )}
          </button>
        ))}
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fetchTab(activeTab)}
          style={{ marginLeft: 'auto' }}
        >
          Refrescar
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <span className="error-text">{error}</span>
        </div>
      )}

      {loading && (
        <span className="loading-status" style={{ display: 'block', marginTop: 12 }}>Consultando Jira...</span>
      )}

      {!loading && results[activeTab].length === 0 && sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Sin tickets en esta categoria</p>
      )}

      {!loading && !sprint.jql[activeTab].trim() && (
        <p style={{ marginTop: 16, color: 'var(--text-3)', fontSize: 14 }}>Configura la JQL para ver tickets</p>
      )}

      {!loading && results[activeTab].length > 0 && (
        <div className="data-table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Resumen</th>
                <th>Estado</th>
                <th>Fecha</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {results[activeTab].map((ticket) => (
                <tr key={ticket.key}>
                  <td>
                    <a
                      href={`${jiraBaseUrl}/browse/${ticket.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                    >
                      {ticket.key}
                    </a>
                  </td>
                  <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket.summary}</td>
                  <td>
                    <span className="badge badge-info">{ticket.status}</span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {formatDate(activeTab === 'created' ? ticket.created : ticket.updated)}
                  </td>
                  <td>
                    <input
                      type="text"
                      className="field-input"
                      value={sprint.notes[ticket.key] || ''}
                      onChange={(e) => onUpdateNotes(ticket.key, e.target.value)}
                      placeholder="Añadir nota..."
                      style={{ height: 34, fontSize: 12, minWidth: 200 }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!sprint.archived && (
        <div className="actions-bar">
          <button type="button" className="btn-ghost" onClick={onArchive}>
            Archivar Sprint
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SprintDashboard.tsx
git commit -m "feat: add SprintDashboard component with tabbed Jira tables"
```

---

### Task 5: SprintList Component

**Files:**
- Create: `src/components/SprintList.tsx`

**Interfaces:**
- Consumes: `Sprint` type from `useSprints.ts`
- Produces: `<SprintList>` component with sprint cards and "Nuevo Sprint" creation

- [ ] **Step 1: Create src/components/SprintList.tsx**

```typescript
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
    if (!d) return '—';
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
          {sprint.archived ? '📦' : '🟢'}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{sprint.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
            {formatDate(sprint.startDate)} — {sprint.archived ? formatDate(sprint.endDate) : 'En curso'}
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
          onClick={(e) => { e.stopPropagation(); if (confirm('¿Eliminar este sprint?')) onDelete(sprint.id); }}
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SprintList.tsx
git commit -m "feat: add SprintList component"
```

---

### Task 6: SprintTracker Router Component

**Files:**
- Create: `src/components/SprintTracker.tsx`

**Interfaces:**
- Consumes: `SprintList`, `SprintDashboard`, `SprintJqlConfig` components, `useSprints` hook
- Produces: `<SprintTracker>` main component with internal navigation

- [ ] **Step 1: Create src/components/SprintTracker.tsx**

```typescript
import { useState, useCallback } from 'react';
import { SprintList } from './SprintList';
import { SprintDashboard } from './SprintDashboard';
import { SprintJqlConfig } from './SprintJqlConfig';
import { useSprints } from '../hooks/useSprints';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { STORAGE_KEYS } from '../config/constants';
import type { Sprint } from '../hooks/useSprints';

interface SprintTrackerProps {
  jiraToken: string;
  jiraBaseUrl: string;
}

export function SprintTracker({ jiraToken, jiraBaseUrl }: SprintTrackerProps) {
  const { sprints, addSprint, updateSprint, archiveSprint, updateNotes, deleteSprint } = useSprints();
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null);
  const [showJqlConfig, setShowJqlConfig] = useState(false);

  const handleSelectSprint = useCallback((sprint: Sprint) => {
    setSelectedSprint(sprint);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedSprint(null);
    setShowJqlConfig(false);
  }, []);

  const handleArchive = useCallback(() => {
    if (!selectedSprint) return;
    if (!confirm('¿Archivar este sprint? El sprint archivado se movera al historial.')) return;
    archiveSprint(selectedSprint.id);
    setSelectedSprint(null);
  }, [selectedSprint, archiveSprint]);

  const handleUpdateNotes = useCallback((ticketKey: string, note: string) => {
    if (!selectedSprint) return;
    updateNotes(selectedSprint.id, ticketKey, note);
  }, [selectedSprint, updateNotes]);

  const jiraConfigured = jiraToken.trim().length > 0 && jiraBaseUrl.trim().length > 0;

  if (!jiraConfigured) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>
          Sprint Tracker
        </h2>
        <p style={{ color: 'var(--text-2)', marginBottom: 8, fontSize: 15 }}>
          Configura la conexion con Jira para usar el Sprint Tracker.
        </p>
        <p style={{ color: 'var(--text-3)', fontSize: 13 }}>
          Necesitas configurar la URL base y el token PAT de Jira en las herramientas que ya usan Jira
          (Criterios de aceptacion, Bug Report o Datos de Prueba).
        </p>
      </div>
    );
  }

  if (selectedSprint) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button type="button" className="btn-ghost" onClick={handleBack} style={{ padding: '6px 14px' }}>
            ← Volver
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{selectedSprint.name}</h2>
          {selectedSprint.archived && (
            <span className="badge badge-info" style={{ fontSize: 11 }}>Archivado</span>
          )}
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setShowJqlConfig((p) => !p)}
            style={{ marginLeft: 'auto' }}
          >
            {showJqlConfig ? 'Ocultar JQLs' : 'Configurar JQLs'}
          </button>
        </div>

        {showJqlConfig && (
          <SprintJqlConfig
            jql={selectedSprint.jql}
            onChange={(jql) => updateSprint(selectedSprint.id, { jql })}
          />
        )}

        <SprintDashboard
          sprint={selectedSprint}
          jiraToken={jiraToken.trim()}
          jiraBaseUrl={jiraBaseUrl.trim()}
          onUpdateNotes={handleUpdateNotes}
          onArchive={handleArchive}
        />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
        Sprint Tracker
      </h2>
      <SprintList
        sprints={sprints}
        onAddSprint={addSprint}
        onSelectSprint={handleSelectSprint}
        onDeleteSprint={deleteSprint}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/SprintTracker.tsx
git commit -m "feat: add SprintTracker router component"
```

---

### Task 7: Integration — ViewType, App.tsx, LandingScreen, Icons, CSS

**Files:**
- Modify: `src/config/constants.ts:81` (ViewType)
- Modify: `src/components/Icons.tsx:80` (add sprint icon)
- Modify: `src/components/LandingScreen.tsx:1-89` (add tool entry, update count, update types)
- Modify: `src/App.tsx:1-68` (add view routing, jiraToken/jiraBaseUrl state, props)
- Modify: `src/App.css:731` (append styles)

**Interfaces:**
- Consumes: `SprintTracker`, `useLocalStorage`, existing patterns
- Produces: Integrated 5th tool in the app

- [ ] **Step 1: Add 'sprinttracker' to ViewType in constants.ts**

Read line 81 of `src/config/constants.ts`:
```typescript
export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata';
```

Replace with:
```typescript
export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker';
```

- [ ] **Step 2: Add sprint icon to Icons.tsx**

Read the end of `src/components/Icons.tsx` (around line 80). Add before the closing `};`:

```typescript
  sprint: (p: SvgProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.2" />
      <rect x="14" y="3" width="7" height="7" rx="1.2" />
      <rect x="3" y="14" width="7" height="7" rx="1.2" />
      <rect x="14" y="14" width="7" height="7" rx="1.2" />
      <path d="M7 17v3M17 17v3M7 7v-3M17 7v-3" />
      <circle cx="7" cy="20" r="1.2" />
      <circle cx="17" cy="20" r="1.2" />
    </Svg>
  ),
```

- [ ] **Step 3: Add Sprint Tracker tool to LandingScreen.tsx**

First, update the interface line (line 5) to include `'sprinttracker'`:
```
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata') => void;
```
Replace with:
```
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker') => void;
```

Then, update the `tools` array. Read lines 13-42. Add a new entry after the existing tools (before `];`):

```typescript
  {
    id: 'sprinttracker' as const,
    icon: Icon.sprint,
    title: 'Sprint Tracker',
    desc: 'Dashboard de tracking de tickets Jira por sprint',
    tag: 'Tracking',
  },
```

Then, update the count badge from `04` to `05` on the `<span className="sec-count">04</span>` line:
```
<span className="sec-count">04</span>
```
Replace with:
```
<span className="sec-count">05</span>
```

- [ ] **Step 4: Add view routing and Jira state to App.tsx**

Read `src/App.tsx`. Make the following changes:

Add `SprintTracker` import after line 8:
```typescript
import { SprintTracker } from './components/SprintTracker';
```

Add `jiraToken` and `jiraBaseUrl` state after line 22 (`const [model, setModel] = ...`):
```typescript
  const [jiraToken] = useLocalStorage(STORAGE_KEYS.JIRA_TOKEN, '');
  const [jiraBaseUrl] = useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL, '');
```

Add to `toolNames` after `testdata: 'Datos de Prueba',`:
```typescript
  sprinttracker: 'Sprint Tracker',
```

Add view rendering block after line 64 (after `<TestDataTool ... />`):
```typescript
        {view === 'sprinttracker' && (
          <SprintTracker jiraToken={jiraToken} jiraBaseUrl={jiraBaseUrl} />
        )}
```

The `App.tsx` component should receive `apiKey` and `model` but NOT pass them to `SprintTracker` (it doesn't use Groq).

- [ ] **Step 5: Add CSS styles to App.css**

Read the end of `src/App.css` (line 831 after the previous edit). Append:

```css
/* === SPRINT TRACKER === */
.sprint-dashboard {
  animation: fadeIn 0.3s ease;
}

.sprint-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 0;
  flex-wrap: wrap;
}

.sprint-tab-active {
  border-color: var(--accent) !important;
  color: var(--accent) !important;
  background: var(--accent-weak) !important;
}

.sprint-card {
  transition: box-shadow 0.18s var(--ease), background 0.15s var(--ease);
}
.sprint-card:hover {
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 6: Verify lint passes**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: 28 tests pass

- [ ] **Step 8: Commit**

```bash
git add src/config/constants.ts src/components/Icons.tsx src/components/LandingScreen.tsx src/App.tsx src/App.css
git commit -m "feat: integrate Sprint Tracker into app (ViewType, routing, landing, icons, CSS)"
```

---

### Task 8: Final Verification

**Files:**
- No new files; verify all changes

- [ ] **Step 1: Run full lint**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 3: Verify build compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit final state (if any changes from fixes)**

```bash
git add -A
git commit -m "chore: final verification fixes"
```
