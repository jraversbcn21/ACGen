# Esquemas configurables de los trackers (Fases 4 y 5)

**Fecha:** 2026-08-14
**Estado:** Aprobado por Jorge (diseño validado)
**Origen:** Fases 4 y 5 del plan de productización de 2026-08-13, descongeladas
con el GO explícito de Jorge del 2026-08-14.

## Contexto

Los dos trackers tienen la estructura del proyecto de Jorge cableada en el
código. Un QA de otro equipo no puede usarlos sin editar fuentes:

- **Regression** (`useRegressions.ts:9,13`): las plataformas son la unión
  cerrada `'ios' | 'webDesktop'`, rotuladas `APPS`/`WEB` como literales sin
  i18n (`RegressionTracker.tsx:10-13`); los campos del ticket son la unión
  `'ticket' | 'fecha' | 'prioridad' | 'creador' | 'squad' | 'status'`,
  **duplicada en seis sitios** — `emptyTicket`, `normalizeTicket`,
  `ticketRowHasContent`, la firma de `updateTicket`, `TICKET_COLUMNS`
  (`RegressionCard.tsx:11-19`) y el filtro de búsqueda
  (`RegressionTracker.tsx:150`).
- **Sprint** (`useSprints.ts:7`): las pestañas son la unión cerrada
  `'resolved' | 'created' | 'reopened' | 'highPriority' | 'jsd'`, y sus
  rótulos y cabeceras son literales en español sin i18n
  (`SprintDashboard.tsx:8-22`) — incluidos `Autor` y `Squad`, que son
  vocabulario del equipo, y la pestaña `JSD`, que es una herramienta interna
  concreta.

Este spec cubre las dos fases porque comparten el modelo: la Fase 5 consume el
tipo y el hook que crea la Fase 4. Son **dos PRs**; cada una se mergea y se
verifica en producción por separado.

## Decisiones de producto (validadas con Jorge)

1. **Alcance del editor: renombrar + añadir + ocultar.** Ocultar es un flag y
   un filtro — barato — y sin él un campo añadido por error sería permanente.
   Borrar de verdad y reordenar quedan fuera (ver "Fuera de alcance").
2. **Los dispositivos van al Perfil, no al esquema.** `IOS_DEVICES` /
   `ANDROID_DEVICES` (`constants.ts:307-315`) solo los consume el desplegable
   del Bug Report; ningún tracker los toca. Meterlos en `TrackerSchema` los
   archivaría donde nadie los busca.
3. **El editor vive en línea, dentro de cada tracker.** Regression y Sprint
   configuran cosas distintas (campos + plataformas vs. pestañas + columnas por
   pestaña); un modal global tendría que llevar pestañas dentro y la Fase 5
   volvería a tocarlo. En línea, cada fase construye su propio editor sin
   depender de la UI de la otra.

## El modelo

```ts
// src/types/schema.ts
export interface SchemaEntry {
  id: string;
  /** Clave i18n de la etiqueta por defecto. */
  labelKey?: string;
  /** Etiqueta literal: la pone el usuario al renombrar, y las entradas por
   *  defecto cuyo texto es idéntico en ES y EN (APPS, WEB, ReOpen, JSD…). */
  label?: string;
  hidden?: boolean;
}

export interface SprintTab extends SchemaEntry {
  /** El índice en este array ES la columna de datos. Ver "El grid del Sprint". */
  headers: SchemaEntry[];
}

export interface TrackerSchema {
  version: 1;
  regression: { ticketFields: SchemaEntry[]; platforms: SchemaEntry[] };
  sprint: { tabs: SprintTab[] };
}
```

Tres reglas cargan todo el peso del diseño:

**1. Los `id` son claves de almacenamiento.** `DEFAULT_SCHEMA` usa los ids que
los datos ya tienen hoy (`ticket`, `fecha`, `prioridad`, `creador`, `squad`,
`status`, `ios`, `webDesktop`, `resolved`, `created`, `reopened`,
`highPriority`, `jsd`). Sin esquema guardado, la app se comporta exactamente
como hoy y **los datos de Jorge no se reescriben nunca**. Las entradas que crea
el usuario reciben `crypto.randomUUID()`.

**2. La etiqueta se resuelve `label ?? t(labelKey!)`.** Las entradas por defecto
llevan `labelKey`, lo que de paso tapa el hueco de i18n de `TAB_LABELS` y
`PLATFORM_LABELS`. En cuanto el usuario renombra una entrada se le escribe
`label`, que gana sobre `labelKey`: a partir de ahí ese rótulo es el mismo en
los dos idiomas. Es el precio inevitable de poder renombrar, y se documenta en
el propio editor.

**3. Ocultar no borra.** `hidden: true` filtra el render. El dato sigue en
`localStorage` y reaparece intacto al volver a mostrar la entrada. Se aplica a
campos de Regression, plataformas, pestañas de Sprint y columnas de Sprint.

### `DEFAULT_SCHEMA`

Codificación exacta de la configuración de hoy:

```ts
export const DEFAULT_SCHEMA: TrackerSchema = {
  version: 1,
  regression: {
    ticketFields: [
      { id: 'ticket',    labelKey: 'regression.colTicket' },
      { id: 'fecha',     labelKey: 'regression.colFecha' },
      { id: 'prioridad', labelKey: 'regression.colPrioridad' },
      { id: 'creador',   labelKey: 'regression.colCreador' },
      { id: 'squad',     labelKey: 'regression.colSquad' },
      { id: 'status',    labelKey: 'regression.colStatus' },
    ],
    platforms: [
      { id: 'ios',        label: 'APPS' },
      { id: 'webDesktop', label: 'WEB' },
    ],
  },
  sprint: {
    tabs: [
      { id: 'resolved', labelKey: 'sprint.tabResolved', headers: [
        { id: 'ticket', label: 'Ticket' },
        { id: 'fecha', labelKey: 'sprint.colFecha' },
        { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
        { id: 'autor', labelKey: 'sprint.colAutor' },
        { id: 'squad', label: 'Squad' },
      ]},
      { id: 'created', labelKey: 'sprint.tabCreated', headers: [
        { id: 'ticket', label: 'Ticket' },
        { id: 'fecha', labelKey: 'sprint.colFecha' },
        { id: 'prioridad', labelKey: 'sprint.colPrioridad' },
        { id: 'autor', labelKey: 'sprint.colAutor' },
        { id: 'squad', label: 'Squad' },
      ]},
      { id: 'reopened', label: 'ReOpen', headers: [
        { id: 'ticket', label: 'Ticket' },
        { id: 'fecha', labelKey: 'sprint.colFecha' },
        { id: 'motivo', labelKey: 'sprint.colMotivo' },
        { id: 'squad', label: 'Squad' },
      ]},
      { id: 'highPriority', labelKey: 'sprint.tabHighPriority', headers: [
        { id: 'ticket', label: 'Ticket' },
        { id: 'fecha', labelKey: 'sprint.colFecha' },
        { id: 'motivo', labelKey: 'sprint.colMotivo' },
        { id: 'squad', label: 'Squad' },
      ]},
      { id: 'jsd', label: 'JSD', headers: [
        { id: 'jsd', label: 'JSD' },
        { id: 'fecha', labelKey: 'sprint.colFecha' },
        { id: 'motivo', labelKey: 'sprint.colMotivo' },
      ]},
    ],
  },
};
```

Los rótulos con `label` literal (`APPS`, `WEB`, `ReOpen`, `JSD`, `Ticket`,
`Squad`) son idénticos en ES y EN; darles clave i18n crearía pares de
traducción byte a byte iguales sin ganancia. Los que difieren llevan `labelKey`.

## Almacenamiento

Clave `acgen_schema`, añadida a `STORAGE_KEYS` en `constants.ts`. Se lee con un
hook calcado de `useProfile()` (`ContextProfile.tsx:5-10`):

```ts
// src/hooks/useSchema.ts
export function useSchema(): [TrackerSchema, (value: TrackerSchema) => void] {
  const [stored, setStored] = useLocalStorage<TrackerSchema>(STORAGE_KEYS.SCHEMA, DEFAULT_SCHEMA);
  const schema = useMemo(() => ({
    version: 1 as const,
    regression: stored?.regression ?? DEFAULT_SCHEMA.regression,
    sprint: stored?.sprint ?? DEFAULT_SCHEMA.sprint,
  }), [stored]);
  return [schema, setStored];
}
```

**Sin `SchemaContext` ni provider.** El plan de agosto proponía un contexto de
React; no hace falta. `useLocalStorage` ya sincroniza entre instancias del
**mismo tab** mediante el evento `acgen-local-storage`
(`useLocalStorage.ts:32,53-57`), además del evento `storage` nativo entre tabs.
Dos componentes que llamen a `useSchema()` a la vez — el editor y el tracker que
está detrás — ven el mismo valor sin plumbing. Es el patrón que el proyecto ya
usa para el perfil y que la PR #25 volvió a validar.

**El fallback por sección no es decorativo:** la Fase 4 se mergea antes que la
5. Un usuario que edite su esquema entre las dos habrá escrito
`{version: 1, regression: {…}}` sin sección `sprint`; al desplegar la Fase 5 esa
sección cae al default en vez de romper.

**Backup:** `backup.ts` fotografía verbatim cualquier clave `acgen_*` no
sensible, así que `acgen_schema` entra sola, sin tocar nada.
`BACKUP_SCHEMA_VERSION` sigue en 1: un backup viejo restaurado tras la feature
no trae la clave, y ausencia de clave es exactamente "los defaults". Un backup
nuevo restaurado en una app vieja trae una clave que nadie lee. Las dos
direcciones son seguras.

---

# Fase 4 — Regression

## El ticket pasa a keyed

```ts
export type RegressionTicket = { id: string } & Record<string, string>;
export type PlatformId = string;
```

Las seis duplicaciones de la lista de campos colapsan en iterar sobre
`schema.regression.ticketFields`. Es **diff negativo neto** en `useRegressions.ts`:

| Hoy | Pasa a ser |
|---|---|
| `emptyTicket()` con 6 literales | `fields.reduce((t,f) => ({...t,[f.id]:''}), {id:uuid()})` |
| `normalizeTicket()` con 6 `?? ''` | mismo reduce, partiendo del ticket guardado |
| `ticketRowHasContent()` sobre 6 campos | `visibleFields.some(f => (t[f.id]??'').trim() !== '')` |
| `updateTicket(…, field: TicketField, …)` | `field: string` |
| `TICKET_COLUMNS` en `RegressionCard` | `visibleFields` desde el esquema |
| filtro de búsqueda sobre 6 campos | sobre `visibleFields` |

**Los campos guardados que ya no estén en el esquema se preservan.**
`normalizeTicket` parte del ticket almacenado y solo *añade* las claves que
falten; nunca poda. Es la convención "huérfano pero intacto" que el repo ya
aplica al `board` legacy (`useRegressions.ts:56-58`).

`useRegressions()` llama a `useSchema()` internamente — es un hook, puede.
`emptyRegressions()` y `emptyBoard()` se derivan de `schema.regression.platforms`
en vez de la constante `PLATFORM_IDS`.

**Búsqueda y recuento usan solo campos visibles.** Un match en un campo oculto
resaltaría una fila sin nada visible que lo justifique, y `filledTicketCount`
contaría contenido que el usuario no ve. El dato sigue ahí; simplemente no
cuenta para lo que se muestra.

**Anchos de columna:** `DEFAULT_COL_WIDTHS` (`RegressionCard.tsx:23-25`) deja de
ser un `Record<TicketField, number>` cerrado y pasa a ser una tabla de consulta
con `?? 120` para ids desconocidos. Los anchos ya se guardan por id de campo, no
por índice — no hay migración.

**Guard de pestaña activa:** `activeTab` (`RegressionTracker.tsx:36`) puede
quedar apuntando a una plataforma que el usuario acaba de ocultar. Se resuelve
con `const safeTab = visiblePlatforms.some(p => p.id === activeTab) ? activeTab : visiblePlatforms[0].id`.

## El editor

Componente `RegressionSchemaEditor`, abierto desde un botón `btn-ghost`
rotulado (no un icono ⚙: `TrackerGrid` ya usa ese glifo para la URL base del
tracker y dos engranajes seguidos serían indistinguibles). El botón va en la
barra de pestañas de `RegressionTracker` (`:176-197`), junto a SnapLink.

Contenido, en dos secciones:

- **Campos del ticket** — una fila por campo: input de texto con la etiqueta
  resuelta, y checkbox "Ocultar". Debajo, "+ Añadir campo" con un input para el
  nombre; crea `{ id: crypto.randomUUID(), label: <nombre> }` al final de la
  lista.
- **Plataformas** — una fila por plataforma, mismos controles.

Más dos remates:

- **"Restaurar por defecto"**, tras `confirm()`. Es la vía de vuelta si alguien
  se enreda renombrando; sin ella el único arreglo sería limpiar `localStorage`.
  **Restaura solo la sección del tracker que se está editando** —
  `setSchema({ ...schema, regression: DEFAULT_SCHEMA.regression })`. Un reset
  global desde el editor de Regression borraría en silencio la configuración de
  Sprint, que el usuario no tiene delante.
- **Guard de al menos uno visible:** el checkbox "Ocultar" se deshabilita cuando
  solo queda una entrada visible en su lista. Ocultar la última dejaría el
  tracker sin columnas y sin plataforma que seleccionar.

La fila de entrada se extrae como `SchemaEntryRow` en
`src/components/SchemaEntryRow.tsx` (input de etiqueta + checkbox de ocultar)
porque la Fase 5 la reutiliza tal cual para pestañas y columnas.

## i18n

Reutiliza las 6 claves `regression.col*` que ya existen. Añade ~12 claves nuevas
bajo el prefijo `schema.` para la UI del editor (título, secciones, añadir,
ocultar, restaurar, aviso de que ocultar conserva los datos, aviso de que
renombrar fija el texto en ambos idiomas). Las plataformas usan `label` literal
y no gastan claves. Paridad ES/EN garantizada por el test existente.

## Dispositivos en el Perfil

`ProjectProfile` gana dos campos:

```ts
/** Dispositivos iOS disponibles para probar, separados por comas. */
iosDevices: string;
/** Dispositivos Android disponibles para probar, separados por comas. */
androidDevices: string;
```

Con los literales de hoy como default: `'iPhone XR, iPhone 11'` y
`'Redmi Note 11 Pro, Moto g35 5G'`. Se editan en el `ProfileEditor` existente
como dos inputs de texto, exactamente igual que `siteMap`, que ya es una lista
separada por comas.

`BugReportTool` ya recibe `profile` como prop (`:23,69`). Sustituye
`IOS_DEVICES` / `ANDROID_DEVICES` por un split del campo correspondiente
(`.split(',').map(s => s.trim()).filter(Boolean)`), con fallback a la lista por
defecto si el campo queda vacío — mismo criterio que el resto del perfil, donde
un campo vaciado cae al default en vez de romper. Las constantes de
`constants.ts` se conservan como fuente de esos defaults.

---

# Fase 5 — Sprint

## Pestañas dinámicas

`TabId` deja de ser unión cerrada:

```ts
export type TabId = string;
export type SprintJql = Record<TabId, string>;
export interface Sprint { …; jql: SprintJql; tabGrid: Record<TabId, string[][]> }
```

El backfill al hidratar ya generaliza sin cambios de forma
(`useSprints.ts:63-66`): `{ ...emptyTabGrid(tabs), ...(s.tabGrid || {}) }`, con
`emptyTabGrid` derivado del esquema en vez de los 5 literales. Igual para
`EMPTY_JQL`. Las pestañas ocultas o eliminadas del esquema conservan su grid en
el objeto guardado — mismo criterio "huérfano pero intacto".

`useSprints()` llama a `useSchema()` internamente, como `useRegressions()`.

## El grid del Sprint

El grid es posicional (`string[][]`), así que **el índice del array `headers` es
la columna de datos**. Esa es la invariante que hace segura toda la fase, y la
razón de que no se pueda reordenar ni borrar columnas.

Ocultar una columna intermedia se resuelve con el patrón que `TrackerGrid` ya
usa para las filas al buscar: `displayRowIndices` (`:147-161`) es una lista de
índices de datos, y el render itera sobre ella usando la posición solo para
navegar con flechas. La versión de columnas es su espejo exacto.

`TrackerGrid` cambia de props así:

```ts
// antes
tabHeaders: Record<T, string[]>;
// después
tabColumns: Record<T, { label: string; dataIndex: number }[]>;
```

El llamante resuelve etiquetas, filtra ocultas y calcula los índices;
**`TrackerGrid` no sabe nada del esquema**. La llamada legacy de
`RegressionTracker` (`:76-88`, snapshots archivados del grid antiguo) pasa
`LEGACY_HEADERS.map((label, i) => ({ label, dataIndex: i }))` y se comporta
igual que hoy.

Dentro de `TrackerGrid`, el índice de datos sigue siendo la identidad en todo:

- anchos de columna, que se guardan como `${activeTab}-${ci}` (`:118,137,341`) —
  si se usara la posición visual, ocultar una columna desplazaría en silencio
  los anchos que el usuario ajustó a mano;
- `cellRefs` (`:449`), `onUpdateGridCell` (`:455`), `data-col` (`:447`);
- la letra de columna `colToLetter(ci)` (`:359`), que con la C oculta muestra
  A, B, D — igual que una hoja de cálculo con una columna oculta, que es
  exactamente lo que es;
- el caso especial de enlace `ci === 0` (`:420-423`), que sigue significando "la
  primera columna de datos", sin cambio de semántica.

Solo la navegación con flechas ←/→ pasa a moverse por posición visual
(`displayColIndices[posC ± 1]`), calcada de lo que ArrowUp/ArrowDown ya hacen
con `displayRowIndices` (`:474`).

**`colCount` deja de leerse solo de los datos.** Hoy es `grid[0]?.length || 6`
(`:145`), y por eso la pestaña JSD ya pinta tres columnas anónimas: el grid
siempre nace con 6 (`useSprints.ts:36`) y `TAB_HEADERS` solo nombra 3. Pasa a
ser `Math.max(headers.length, grid[0]?.length ?? 0, 1)`. Con eso, **añadir una
séptima columna no necesita migrar datos**: las celdas más allá del final de la
fila se leen como `''` (`getCellValue`, `:168-170`) y la fila crece sola al
escribir (`useSprints.ts:116`).

**Las columnas sin cabecera siguen existiendo.** Esto es la trampa de toda la
fase: si la lista de columnas se derivara solo de `headers`, la pestaña JSD
pasaría de 6 columnas a 3 y cualquiera que hubiera escrito en las columnas D, E
o F vería sus datos desaparecer de la pantalla. El test guardián lo cazaría, y
tiene que no llegar a cazarlo. La regla es que **`colCount` manda**: se recorren
todos los índices de datos de `0` a `colCount - 1`, y `headers[i]` solo aporta
rótulo y visibilidad si existe:

```ts
const colCount = Math.max(tab.headers.length, grid[0]?.length ?? 0, 1);
const columns = Array.from({ length: colCount }, (_, i) => ({
  label: resolveLabel(tab.headers[i]),   // '' si no hay entrada en esa posición
  dataIndex: i,
  hidden: tab.headers[i]?.hidden ?? false,
}));
```

De ahí sale un efecto útil: en JSD, "+ Añadir columna" no crea una columna
nueva — le pone nombre a la columna D, que ya estaba ahí y puede ya tener datos
dentro. Es el comportamiento correcto, no una fuga.

**Guard de pestaña activa:** `activeTab` arranca en `tabs[0]` (`:65`) y puede
quedar apuntando a una pestaña recién oculta. Se resuelve dentro de
`TrackerGrid`: `const safeTab = tabs.includes(activeTab) ? activeTab : tabs[0]`,
usado en todas las lecturas.

## El editor

Componente `SprintSchemaEditor`, abierto desde un botón rotulado en una barra
propia que `SprintDashboard` renderiza **encima** del `TrackerGrid`. No se
añade ningún prop de toolbar a `TrackerGrid`.

**El editor muestra todas las pestañas con sus columnas a la vez**, no solo la
activa. Es deliberado: `activeTab` es estado interno de `TrackerGrid`, y sacarlo
de ahí para que el editor lo lea sería mucho más invasivo que listar las cinco
pestañas.

Estructura: una lista de pestañas (`SchemaEntryRow` de la Fase 4: renombrar +
ocultar) y, anidada bajo cada una, su lista de columnas con los mismos
controles, más "+ Añadir columna". Debajo de todo, "+ Añadir pestaña" y
"Restaurar por defecto", este último acotado a `sprint` igual que el de la
Fase 4 lo está a `regression`.

El guard de "al menos uno visible" aplica por lista: al menos una pestaña
visible, y al menos una columna visible dentro de cada pestaña.

Una pestaña nueva recibe `crypto.randomUUID()` y arranca con las mismas cinco
columnas que `resolved`, para que no nazca vacía.

## i18n

~7 claves nuevas para los rótulos por defecto que difieren entre ES y EN
(`sprint.tabResolved`, `sprint.tabCreated`, `sprint.tabHighPriority`,
`sprint.colFecha`, `sprint.colPrioridad`, `sprint.colAutor`,
`sprint.colMotivo`) más ~6 para la UI propia del editor (pestañas, columnas,
añadir pestaña, añadir columna y sus placeholders). `ReOpen`, `JSD`, `Ticket` y
`Squad` usan `label` literal.

---

# Errores y casos borde

No hay caminos de red ni asincronía nuevos: el esquema es un objeto en
`localStorage` que se lee sincrónicamente y se escribe con el mismo hook que
todo lo demás.

- **Esquema corrupto o de otra versión:** `useLocalStorage` ya devuelve el valor
  inicial si `JSON.parse` lanza (`:11-21`). El fallback por sección de
  `useSchema()` cubre secciones ausentes.
- **Cuota de `localStorage` llena:** `useLocalStorage` lo registra en consola y
  sigue (`:29-31`). El esquema son unos cientos de bytes.
- **Renombrar a cadena vacía:** se ignora al guardar y se conserva la etiqueta
  anterior, mismo criterio que la versión de una regresión
  (`useRegressions.ts:191`).
- **Ocultar la última entrada visible:** imposible por el guard del editor.
- **Ids duplicados:** imposible por construcción — los ids nuevos son UUID y los
  por defecto están fijados en la constante.
- **Datos de campos/pestañas ocultos o retirados:** preservados siempre, en
  hidratación y en escritura.

# Testing

Convención del proyecto: direct-TDD con Vitest + `@testing-library/react`.
**Ojo con el idioma:** `detectLang()` lee `navigator.language` y jsdom devuelve
`en-US`, así que en los tests la app renderiza en **inglés** salvo que se fuerce
lo contrario.

**El test que decide si esto se mergea, uno por fase:** sembrar `localStorage`
con datos reales pre-esquema, hidratar **sin** clave `acgen_schema`, y afirmar
que el render es idéntico al de hoy — mismas columnas, mismos rótulos, mismos
valores en las mismas celdas. Si ese test pasa, ningún usuario existente nota la
feature hasta que la usa.

Su pareja, también por fase: ocultar una entrada, comprobar que desaparece del
render **y que su dato sigue en `localStorage`**, volver a mostrarla y
comprobar que reaparece con el mismo valor.

Además, por fase:

- **Fase 4:** renombrar `squad` cambia el rótulo sin tocar el dato; añadir un
  campo lo hace editable y persistente; la búsqueda no encuentra por campos
  ocultos; el guard de "al menos uno visible" deshabilita el último checkbox;
  ocultar la plataforma activa reencamina a la visible; `BugReportTool` lista
  los dispositivos del perfil y cae a los defaults con el campo vacío.
- **Fase 5:** ocultar una columna intermedia mantiene los anchos guardados
  ligados a su columna de datos (la prueba directa de la invariante); las
  flechas ←/→ saltan la columna oculta; añadir una séptima columna es editable y
  persiste; añadir una pestaña la hace navegable con su grid vacío; una pestaña
  oculta conserva su grid en el objeto guardado.

**Churn conocido:** 24 asserts que fijan `jsd`, `creador` o `squad` en cinco
ficheros (`useSprints.test.ts`, `useRegressions.test.ts`,
`RegressionCard.test.tsx`, `RegressionTracker.test.tsx`, `SprintList.test.tsx`).
Se reescriben para leer del esquema en vez de dar los literales por sentados.

**Línea base verificada** con `npx vitest run` el 2026-08-14: 556 tests en 56
ficheros, todos en verde; 285 claves i18n con paridad ES/EN exacta.

# Fuera de alcance

- **Borrar y reordenar columnas del Sprint.** Ambas exigen migrar el grid
  posicional a filas keyed más una migración de los anchos de índice a id. Es la
  vía más corta a corromper los datos de Jorge y no la vale por ahora. Ocultar
  cubre el caso práctico. Limitación documentada en `AGENTS.md`.
- **Borrar de verdad** cualquier entrada, en los dos trackers: ocultar preserva
  y es reversible; borrar no.
- **Esquema por workspace.** Los datos de los trackers son globales hoy
  (`acgen_sprints`, `acgen_regressions`); un esquema por workspace sobre datos
  globales reinterpretaría el mismo grid con otras columnas al cambiar de
  workspace, que se ve exactamente igual que una corrupción. Esquema y datos
  pasan a per-workspace juntos o no pasan — eso es la Fase 7, con su propio GO.
- `SUPPORTED_MARKETS`, `DATA_TYPES` / `DataTypeId`, proveedores y los overrides
  de prompts siguen globales y fijos.
- Los pendientes abiertos que no toca esta rama: `demoData.ts` con literales
  pre-productización, `hasSignificantData()` sin contar perfil ni prompts,
  feedback solo-spinner en las llamadas de visión, `prefill` que no se limpia,
  markdown crudo del Refinador, el `<h2>` sin i18n de `PromptEditor.tsx:61`, y
  que ninguno de los dos editores cierra con `Escape`.
