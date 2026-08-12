# Regression Tracker: reorden drag & drop + buscador

**Fecha:** 2026-08-12
**Estado:** Aprobado por Jorge (diseño validado)

## Contexto

Desde el modelo versionado (spec 2026-08-10), cada pestaña APPS/WEB es una
lista de regresiones con sus tickets. `addRegression` ya inserta las nuevas
**al principio** de la lista, pero el orden solo se puede corregir borrando y
recreando — y los datos reales de Jorge tienen la regresión actual (3.3.0)
abajo del todo por haberse creado antes de backfillear las históricas.
Además, con versiones acumulándose, localizar una regresión o un ticket
concreto exige escanear la lista a ojo (el buscador del grid antiguo se
eliminó por YAGNI cuando había 2-4 regresiones; ya no lo es).

Objetivo: **reordenar regresiones arrastrándolas** (a top, a bottom o a
cualquier posición) y **buscar** por versión, nombre del Excel o contenido de
tickets dentro de la pestaña activa.

## Decisiones de producto (validadas con Jorge)

1. Drag & drop **nativo HTML5 con handle** (⠿) — sin librerías nuevas.
2. Buscador: **solo pestaña activa** (el historial de archivadas queda fuera;
   ya tiene su propia pantalla).
3. Coincidencia por ticket → la tarjeta aparece **auto-expandida mostrando
   solo las filas coincidentes**.
4. Coincidencia por cabecera (versión o nombre/URL del Excel) → tarjeta
   normal (colapsada, todos sus tickets al desplegar).
5. Con filtro activo el **drag se deshabilita** (reordenar una lista filtrada
   es ambiguo).
6. **Cero cambios de modelo**: el drag reordena el array existente; el
   buscador es filtrado puro en render. Los datos guardados no se tocan.

## Hook (`useRegressions.ts`)

Nueva operación, misma familia que las existentes:

```ts
moveRegression(platform: PlatformId, id: string, toIndex: number): void
```

- Quita la regresión con ese `id` de la lista y la inserta en `toIndex`
  (clampeado a `[0, length-1]`). Id inexistente → no-op (estado idéntico).
- No toca la otra plataforma ni `archived`. Se persiste vía el efecto actual
  (`lastPersisted`); el formato de `acgen_regressions` no cambia.

## Drag & drop (`RegressionTracker.tsx` + `RegressionCard.tsx`)

- **Handle ⠿** a la izquierda de la cabecera de cada tarjeta (junto al
  chevron ▸), `cursor: grab`, `draggable` **solo en el handle** — no
  interfiere con botones, enlaces, edición inline ni el resize de columnas.
- El handle no se renderiza en `readOnly` (snapshots) ni con búsqueda activa.
- Eventos: `dragstart` en el handle registra el índice origen (estado local
  del tracker, no del card); `dragover` sobre una tarjeta calcula si el
  puntero está en su mitad superior o inferior y muestra una **línea
  indicadora de inserción** (borde superior/inferior acentuado); `drop`
  llama a `moveRegression` con el índice destino; `dragend` limpia el estado
  visual siempre (también si se cancela con Esc o soltando fuera).
- La tarjeta arrastrada se atenúa (`opacity`) mientras dura el drag.
- Sin `dataTransfer` de contenido real (drag interno): se usa
  `effectAllowed = 'move'` y estado React para origen/destino.

## Buscador (`RegressionTracker.tsx`)

- **Campo de búsqueda** en la fila de "+ Nueva regresión", alineado a la
  derecha, con placeholder i18n ("Buscar versión, ticket…") y botón × para
  limpiar. Estado local del componente (no se persiste); se mantiene al
  cambiar de pestaña.
- **Coincidencia** case-insensitive por substring, tras `trim` de la query
  (query vacía o solo espacios = sin filtro), contra:
  - `version`, `url` de la regresión (el texto crudo, que incluye nombre
    SnapLink y URL);
  - los 6 campos de texto de cada ticket (`ticket`, `fecha`, `prioridad`,
    `creador`, `squad`, `status`).
- **Resultado por tarjeta**:
  - Match solo por cabecera → tarjeta normal (colapsada).
  - Match por algún ticket → tarjeta con `forceExpanded` y `visibleTicketIds`
    limitado a las filas coincidentes (nuevas props opcionales de
    `RegressionCard`; sin ellas el card se comporta exactamente como hoy).
  - Sin match → la tarjeta no se renderiza.
- **Contador** "N de M" junto al campo cuando hay filtro; si N = 0, mensaje
  de vacío específico ("Sin coincidencias") distinto del de lista vacía.
- Con filtro activo, las filas visibles **siguen siendo editables**; si una
  edición hace que la fila deje de coincidir, desaparece de la vista (sigue
  existiendo — comportamiento estándar de filtro, decidido a propósito).
- El botón "+ Nueva regresión" sigue operativo con filtro activo; la nueva
  regresión se crea al principio de la lista real (visible o no según el
  filtro vigente).

## Casos borde

- Drop sobre la propia tarjeta o en su posición actual → no-op visual y de
  estado.
- Lista de 1 elemento: el handle existe pero cualquier drop es no-op.
- `moveRegression` con `toIndex` fuera de rango → clamp (defensivo).
- Buscador con tarjeta cuyo match es cabecera **y** tickets → prevalece el
  match por tickets (auto-expandida con filas filtradas): es el caso donde
  el usuario busca un ticket concreto.
- i18n: claves nuevas en ES/EN con paridad (test de paridad existente cubre).

## Testing (TDD, convención del proyecto)

- `useRegressions.test.ts`: `moveRegression` a top / a bottom / posición
  intermedia, id inexistente (no-op), clamp de índice, no afecta a la otra
  plataforma, persiste el nuevo orden.
- `RegressionTracker.test.tsx`: filtrado por versión (tarjeta colapsada),
  por ticket (auto-expande y muestra solo filas coincidentes), contador
  N de M, botón limpiar, mensaje sin coincidencias, handle oculto con filtro
  activo, reorden completo vía eventos `dragstart`/`dragover`/`drop`.
- `RegressionCard.test.tsx`: props nuevas `forceExpanded` y
  `visibleTicketIds` (filtra filas; sin la prop renderiza todo como hoy);
  handle ausente en `readOnly`.
- Verificación final en Chrome real contra build de producción
  (`vite preview`), incluyendo recolocar la 3.3.0 real arriba con drag.
