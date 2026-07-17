# Regression Tracker — Design

**Fecha:** 2026-07-17
**Estado:** Aprobado en brainstorm; pendiente de plan de implementación.

## Objetivo

Añadir una décima herramienta, **Regression Tracker**, que ocupa el slot "Más herramientas
próximamente" de la landing. Es un tablero de seguimiento de regresiones ejecutadas por
plataforma, con la misma UX de spreadsheet que el Sprint Tracker.

## Decisiones de producto (validadas con Jorge)

1. **Tablero único permanente**: no hay lista de entidades tipo sprint. Al clicar la
   herramienta se entra directamente al spreadsheet. Cada **fila es una regresión
   ejecutada** (enlace, versión, fecha, notas, status).
2. **Archivar = snapshot + vaciado**: "Archivar Regresión" guarda una copia completa del
   tablero en un historial y lo vacía para empezar de cero.
3. **Historial consultable en solo-lectura**: los snapshots archivados se listan y se
   abren sin posibilidad de edición. Se pueden eliminar.
4. **Status texto libre**: la columna E es una celda normal, sin desplegables ni colores.
5. **Enlaces = URL arbitraria completa**: la columna A acepta cualquier URL (Zephyr,
   Confluence, TestRail…), no solo Jira. Se guarda la URL completa en la celda.

## Enfoque elegido (Opción A)

Extraer el spreadsheet de `SprintDashboard` a un componente compartido **`TrackerGrid`**,
reutilizado por Sprint Tracker y Regression Tracker. Se descartó duplicar el componente
(~400 líneas de lógica compleja mantenidas por duplicado) y parametrizar `SprintDashboard`
in situ (mezcla condicionales de dos dominios).

## Arquitectura

### `TrackerGrid` (nuevo, `src/components/TrackerGrid.tsx`)

Extracción del spreadsheet de `SprintDashboard`: doble fila de cabecera (letras A-F +
nombres de columna), redimensionado de columnas con persistencia de anchos, drag & drop de
filas, navegación con flechas entre celdas, buscador con debounce (250 ms) y contador de
filas, botón "+ Fila", enlace SnapLink y pestañas.

```tsx
interface TrackerGridProps<T extends string> {
  tabs: T[];
  tabLabels: Record<T, string>;
  tabHeaders: Record<T, string[]>;
  tabGrid: Record<T, string[][]>;
  linkMode: 'jira' | 'url';        // comportamiento de la columna A
  readOnly?: boolean;              // snapshots archivados
  colWidthsStorageKey: string;     // clave localStorage de anchos, por herramienta
  searchPlaceholder: string;
  onUpdateGridCell: (tab: T, row: number, col: number, value: string) => void;
  onSetTabGrid: (tab: T, grid: string[][]) => void;
  onMoveRow: (tab: T, fromRow: number, toRow: number) => void;
}
```

- `linkMode: 'jira'` — comportamiento actual de sprints: patrón `^[A-Z]+-\d+`, paste de
  SnapLink `Nombre - https://…/browse/CLAVE` → guarda `CLAVE Nombre`, Ctrl+clic abre
  `${baseUrl}/browse/CLAVE` con la base configurada.
- `linkMode: 'url'` — nuevo: paste de SnapLink `Nombre - https://cualquier.url/…` →
  guarda el texto completo `Nombre - URL`. Si la celda encaja con el patrón
  `/^(?:(.+?)\s*-\s*)?(https?:\/\/\S+)$/` (o es solo una URL), se pinta en color acento y
  **Ctrl+clic abre esa URL exacta** en pestaña nueva.
- **Visualización del nombre (amendment 2026-07-17, aprobado por Jorge):** cuando la celda
  tiene parte de nombre (`Nombre - URL`) y NO tiene el foco, se muestra **solo el nombre**
  (span superpuesto con el mismo padding/fuente, color acento, elipsis; el texto del input
  se vuelve transparente). Al entrar a editar (foco) el overlay desaparece y se ve el valor
  completo `Nombre - URL` para poder corregir el enlace, con caret visible. Una URL sola
  (sin nombre) se muestra tal cual, sin overlay. El modo `jira` no cambia.
- `readOnly` — inputs deshabilitados, sin drag & drop, sin "+ Fila". Ctrl+clic en enlaces
  sigue funcionando.

### `SprintDashboard` (refactor sin cambio de comportamiento)

Queda como envoltorio fino de `TrackerGrid`: pasa sus 5 pestañas
(Resueltos/Creados/ReOpen/Prioridad Alta/JSD), cabeceras actuales, `linkMode: 'jira'`,
clave de anchos existente (`STORAGE_KEYS.SPRINT_COL_WIDTHS_{id}`), y conserva fuera el
botón "Archivar Sprint". **Los 225 tests actuales deben seguir en verde.**

### `RegressionTracker` (nuevo, `src/components/RegressionTracker.tsx`)

Contenedor de la herramienta con tres estados de pantalla:

1. **Tablero activo** (estado inicial): título "Regression Tracker" + botón
   "Archivadas (n)" a la derecha (solo si n > 0). `TrackerGrid` con:
   - Pestañas: `ios` · `android` · `webDesktop` · `webMobile`
     (etiquetas literales: `iOS`, `Android`, `Web-Desktop`, `Web-Mobile`).
   - Cabeceras (todas las pestañas iguales): `Regresión, Versión, Fecha, Notas, Status`
     + columna F vacía. Grid de 20 filas × 6 columnas, como sprints.
   - `linkMode: 'url'`.
   - Barra de acciones inferior con **"Archivar Regresión"**: `confirm()` → snapshot con
     nombre `Regresión YYYY-MM-DD` → tablero vaciado.
2. **Lista de archivadas**: tarjetas estilo `SprintCard` (nombre + fecha de archivado,
   botón Eliminar con `confirm()`). Estado vacío con mensaje traducido.
3. **Snapshot archivado**: `TrackerGrid` en `readOnly`, badge "Archivada".
   "← Volver" regresa a la lista; desde la lista, "← Volver" al tablero activo.

### `useRegressions` (nuevo hook, `src/hooks/useRegressions.ts`)

Espejo de `useSprints`. Persistencia en `acgen_regressions` con try/catch de cuota
(mantiene el estado en memoria si `setItem` lanza) e hidratación defensiva (JSON corrupto
→ estado inicial; merge con grids vacíos por si faltan plataformas).

```ts
type PlatformId = 'ios' | 'android' | 'webDesktop' | 'webMobile';

interface ArchivedRegression {
  id: string;          // crypto.randomUUID()
  name: string;        // "Regresión YYYY-MM-DD" (fecha local de archivado)
  archivedAt: string;  // YYYY-MM-DD local
  board: Record<PlatformId, string[][]>;
}

interface RegressionState {
  board: Record<PlatformId, string[][]>;  // tablero activo único
  archived: ArchivedRegression[];
}
```

API: `board`, `archived`, `updateGridCell(tab, row, col, value)`,
`setTabGrid(tab, grid)`, `moveRow(tab, from, to)`, `archiveBoard()`,
`deleteArchived(id)`.

Anchos de columna del tablero activo en clave propia
(`STORAGE_KEYS.REGRESSION_COL_WIDTHS` = `acgen_regression_col_widths`).

## Integración en la app

- **`ViewType`** (`src/config/constants.ts`): añadir `'regressiontracker'`.
- **`App.tsx`**: añadir a `VALID_VIEWS` y renderizar `<RegressionTracker />` (hash
  `#/regressiontracker`), dentro del `ErrorBoundary` keyed como el resto.
- **`LandingScreen`**: décima tarjeta (tag `Tracking`, icono nuevo `Icon.regression` —
  24×24, stroke 1.6, `currentColor`, estilo del set actual). El slot
  "+ Más herramientas próximamente" se mantiene detrás como celda 11.
- **`Sidebar`**: entrada en el grupo **Seguimiento**, junto a Sprint Tracker.
- **i18n**: claves nuevas en `es.json` y `en.json` con paridad exacta
  (guardada por `keyParity.test.ts`): `landing.tool.regressiontracker(+Desc)` y familia
  `regression.*` — título, archivar, confirmación de archivado, confirmación de borrado,
  placeholder del buscador ("Buscar por regresión, versión, status…"), "Archivadas",
  estado vacío, badge. Etiquetas de pestaña y cabeceras de columna quedan literales (como
  `Ticket/Fecha/Squad` en sprints).

## Manejo de errores

- localStorage lleno: mismos patrones que `useSprints` (console.error + estado en memoria).
- JSON corrupto al hidratar: estado inicial limpio.
- `confirm()` cancelado: no-op (archivar y eliminar).
- Snapshot con plataformas ausentes (datos antiguos/manuales): merge con grids vacíos.

## Testing

- **Red de seguridad del refactor**: los 225 tests actuales siguen en verde sin cambiar
  aserciones de comportamiento del sprint tracker (solo se admiten ajustes de imports).
- **`src/hooks/useRegressions.test.ts`** (~12): init vacío, hidratación, JSON corrupto,
  `updateGridCell`, `setTabGrid`, `moveRow`, `archiveBoard` (snapshot íntegro + tablero
  vaciado + nombre/fecha correctos), `deleteArchived`, resiliencia a cuota.
- **`src/components/RegressionTracker.test.tsx`** (~6): 4 pestañas y cabeceras
  renderizadas, paste SnapLink `Nombre - URL` guarda el valor completo y lo pinta como
  enlace, Ctrl+clic llama a `window.open` con la URL exacta, flujo archivar
  (confirm → aparece en la lista → tablero vacío), snapshot en solo-lectura.
- **`src/components/LandingScreen.test.tsx`**: actualizar a 10 tarjetas y slot
  "más próximamente" como celda 11.
- **AGENTS.md**: actualizar tabla de tests, ViewType, arquitectura y herramientas (10).

## Fuera de alcance

- Colores automáticos o desplegable en la columna Status.
- Edición de snapshots archivados.
- Integración con LLM (la herramienta es 100 % local, como Sprint Tracker).
- Export/import del tablero.
