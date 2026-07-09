# Sprint Tracker — Especificación de Diseño

## Resumen

Quinta herramienta de ACGen. Dashboard que reemplaza el tracking manual en Excel con consultas live a Jira organizadas por sprint, con histórico archivado y notas personales.

## Motivación

Actualmente el QA lleva 4 listas manuales en Excel con copy-paste desde Jira: tickets resueltos, tickets creados como incidencia, tickets reabiertos (con motivo), y tickets de alta prioridad (con justificación). El trabajo es tedioso, propenso a error, y se repite cada sprint de 2 semanas. Al terminar el sprint se archiva y se empieza limpio. El tracking es personal, no compartido.

## Arquitectura

Nueva herramienta `sprinttracker` dentro del view routing de `App.tsx`:

```
src/
├── components/
│   ├── SprintTracker.tsx          # Router interno: lista vs dashboard
│   ├── SprintList.tsx             # Lista de sprints (activo + archivados)
│   ├── SprintDashboard.tsx        # Dashboard con tabs
│   └── SprintJqlConfig.tsx        # Modal/panel de configuración de JQLs
├── hooks/
│   └── useSprints.ts             # Hook de persistencia para sprints
├── services/
│   └── jiraService.ts            # Añadir jiraSearch(query) al existente
server/
└── jiraRoutes.js                  # Añadir GET /api/jira/search?jql=...
```

### Dependencias

- **Jira Proxy existente** (`server/jiraRoutes.js`) — se añade un nuevo endpoint
- **localStorage** — único almacenamiento de notas y metadatos de sprint
- **Tokens de diseño y estilos existentes** en `App.css` (tablas, badges, botones)

### Lo que NO necesita

- Backend/database (todo persiste en localStorage + consultas live a Jira)
- Auth adicional (reutiliza el token Jira ya configurado en las otras herramientas)
- WebSockets o polling (refresco manual bajo demanda)

## Modelo de Datos

Persistido en localStorage bajo la key `acgen_sprints` como array de objetos:

```typescript
interface Sprint {
  id: string;             // crypto.randomUUID()
  name: string;           // "Sprint 24"
  startDate: string;      // YYYY-MM-DD
  endDate: string | null; // null si activo
  archived: boolean;
  jql: {
    resolved: string;
    created: string;
    reopened: string;
    highPriority: string;
  };
  notes: Record<string, string>;  // ticketKey → nota personal
}
```

Las notas son lo único que se guarda localmente. Estados, fechas y datos de tickets se refrescan siempre desde Jira en tiempo real al abrir el sprint.

## Flujo de Datos

### Consulta a Jira

**Nuevo endpoint en `server/jiraRoutes.js`:**

```
GET /api/jira/search?jql=<encoded-jql>
  Headers: X-Jira-Token, X-Jira-Base-Url
  Response: { issues: Array<{ key, summary, status, created, updated }> }
```

El endpoint usa el Jira REST API search endpoint: `{baseUrl}/rest/api/2/search?jql={jql}&fields=key,summary,status,created,updated`.

**Nueva función en `jiraService.ts`:**

```typescript
async function jiraSearch(jql: string, token: string, baseUrl: string): Promise<JiraSearchResult[]>
```

### Refresco

- Al abrir un sprint (activo o archivado): se disparan 4 consultas en paralelo (una por JQL)
- Al cambiar de pestaña dentro del dashboard: se reconsulta solo la JQL de esa pestaña
- Botón "Refrescar" manual en cada pestaña
- Los sprints archivados SÍ se refrescan desde Jira (Jira es dinámico)

### Cruce de notas

Al renderizar una tabla, los tickets que llegan de Jira se cruzan con `sprint.notes[issueKey]` del localStorage. Si un ticket desaparece de Jira, su nota se conserva pero el ticket no se muestra.

## Navegación

4 pantallas lógicas dentro del componente `SprintTracker`:

### 1. Lista de Sprints (SprintList)
- Sprint activo destacado arriba (card con borde accent)
- Sprints archivados abajo, ordenados por `endDate` descendente
- Cada fila: nombre, fechas, conteo de tickets por categoría (x resueltos, x creados, x reopen, x prioritarios)
- Botón "Nuevo Sprint" en la actions-bar
- Click en una fila → navega al dashboard de ese sprint

### 2. Dashboard del Sprint (SprintDashboard)
- 4 pestañas horizontales: Resueltos, Creados, ReOpen, Prioridad Alta
- Cada pestaña: tabla con columnas Key (enlace clicable a Jira), Resumen, Estado, Fecha, Notas (textarea inline editable, debounce 1s guardando a localStorage)
- Cabecera de pestaña: nombre + badge con conteo + botón "Refrescar"
- Si una JQL no devuelve resultados: "Sin tickets en esta categoría"
- Sidebar/botón "Configurar JQLs" para editar las queries
- Si el sprint está activo: botón "Archivar Sprint" que marca `archived: true` y `endDate: today`

### 3. Configuración de JQLs (SprintJqlConfig)
- Panel o modal con 4 campos textarea para las JQLs
- Sugerencias pre-rellenadas: `project = BERSHKA AND sprint = "<sprint-name>" AND status = Done`
- Cada campo con label descriptivo (Resueltos, Creados, ReOpen, Prioridad Alta)
- Botón "Guardar"

### 4. Vista de Sprint Archivado
- Mismo layout que el dashboard
- Badge "Archivado" visible
- Los datos se refrescan desde Jira al entrar (igual que el activo)

## Layout / CSS

- Reutiliza clases existentes: `.data-table-wrap`, `.data-table`, `.badge`, `.btn-ghost`, `.btn-primary`, `.actions-bar`, `.field-textarea`, `.field-input`, `.field-label`
- Nuevas clases necesarias:
  - `.sprint-list` — contenedor de la lista de sprints
  - `.sprint-card` — card individual con hover
  - `.sprint-card-active` — variante con borde accent
  - `.sprint-dashboard` — contenedor del dashboard
  - `.sprint-tabs` — barra de pestañas horizontales (similar a `.actions-bar` pero con tabs)
  - `.sprint-tab` — pestaña individual
  - `.sprint-tab.active` — pestaña activa con indicador accent
  - `.sprint-notes-input` — textarea inline de 1 línea para notas

## Integración con el proyecto existente

### View routing en App.tsx

Añadir `'sprinttracker'` al tipo `ViewType` en `constants.ts`. Añadir ruta en el switch de `App.tsx`. Añadir entrada en `LandingScreen.tsx` (tool-list con icono, título "Sprint Tracker", descripción).

### Configuración Jira

La configuración de Jira (token + base URL) se comparte con las otras herramientas vía `useLocalStorage(STORAGE_KEYS.JIRA_TOKEN)` y `useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL)`. Sprint Tracker los recibe como props desde `App.tsx` igual que el resto.

### Sin dependencia de API de Groq

A diferencia de las otras herramientas, Sprint Tracker NO usa la API de Groq. Solo consulta Jira. No necesita `apiKey` ni `model` como props.

## Estados y Edge Cases

| Caso | Comportamiento |
|---|---|
| Jira no configurado | Mensaje "Configura Jira para usar el Sprint Tracker" + enlace a configuración |
| Token Jira inválido/expirado | Error banner con mensaje descriptivo (reutiliza manejo de errores existente) |
| JQL malformada | La consulta falla → error banner en la pestaña correspondiente |
| JQL sin resultados | Mensaje "Sin tickets en esta categoría" en la tabla |
| Sprint sin JQLs configuradas | Al crear un sprint nuevo, botón "Configurar JQLs" prominente. Sin JQLs, las pestañas muestran placeholder. |
| Nota muy larga | El textarea inline trunca a 1 línea visual; expande con doble click o similar. La nota completa se guarda en localStorage. |
| Ticket desaparece de Jira | La nota asociada se conserva en localStorage pero el ticket no se renderiza. |
| localStorage lleno/corrupto | `useSprints` hook maneja recuperación (similar a `useHistory`) |

## Testing

- `useSprints` hook: tests unitarios (inicialización, crear sprint, archivar sprint, actualizar notas, límite de sprints, recuperación de JSON corrupto)
- `jiraSearch()`: respuesta exitosa, error 401, error 400 (JQL inválida)

## Implementación

Fases recomendadas:

1. **Endpoint Jira Search** — `server/jiraRoutes.js` + `jiraService.ts`
2. **Hook useSprints** — persistencia de sprints + notas
3. **Componente SprintTracker** — router interno + lista + dashboard + JQL config
4. **Integración** — App.tsx, LandingScreen, ViewType, CSS
5. **Tests** — hook + servicio
