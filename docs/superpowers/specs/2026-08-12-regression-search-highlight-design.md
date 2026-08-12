# Regression Tracker: resalte de coincidencias en la búsqueda + campo más ancho

**Fecha:** 2026-08-12
**Estado:** Aprobado por Jorge (diseño validado)

## Contexto

El buscador (spec 2026-08-12-regression-reorder-search) filtra tarjetas y
filas, pero no señala DÓNDE coincide lo buscado. Caso real de Jorge: buscando
`1475`, una fila aparece porque la coincidencia está en la **URL oculta** de
una celda-enlace SnapLink cuyo nombre visible no contiene el término — el
usuario ve un resultado que aparentemente no coincide y se confunde.

Objetivo: **resaltar las coincidencias** en los resultados (guiar al usuario),
señalar explícitamente los matches en partes ocultas de celdas-enlace, y
**duplicar el ancho** del campo de búsqueda.

## Decisiones de producto (validadas con Jorge)

1. Match en la parte oculta de una celda-enlace → **nombre visible entero
   tintado + tooltip** "Coincide en la URL del enlace" (elegido sobre mostrar
   la URL cruda o un icono indicador).
2. El resalte solo existe con búsqueda activa; sin query, cero cambios
   visuales ni de comportamiento.
3. Campo de búsqueda: `width: 220` → `width: 440` con `maxWidth: '100%'`
   (la fila ya tiene `flexWrap`, en ventanas estrechas envuelve).

## Helper compartido (`src/utils/highlight.tsx`, nuevo)

```tsx
// Divide `text` por las coincidencias case-insensitive de `needle` y
// devuelve nodos React: fragmentos planos + <mark> por coincidencia.
// needle vacío/blank → [text] tal cual. Escapa los metacaracteres de regex
// del needle. Múltiples coincidencias: todas marcadas.
export function highlightMatches(text: string, needle: string): React.ReactNode[];

// true si `text` contiene `needle` (case-insensitive, tras trim del needle).
export function containsMatch(text: string, needle: string): boolean;
```

Estilo del `<mark>`: fondo acento translúcido + color de texto legible,
inline (sin depender del UA default amarillo, que no casa con el tema):
`background: 'var(--accent)', color: 'var(--surface)', borderRadius: 2,
padding: '0 1px'` — mismo estilo en todos los puntos de uso.

## Aplicación en `RegressionCard` (prop nueva `highlightNeedle?: string`)

`RegressionTracker` pasa `highlightNeedle={needle}` a las tarjetas de la
lista SOLO cuando hay filtro activo (needle no vacío). Sin la prop, el card
se comporta EXACTAMENTE igual que hoy (mismo criterio que
`forceExpanded`/`visibleTicketIds`). Las tarjetas readonly del historial no
la reciben.

Con `highlightNeedle`:

- **Versión** (span de cabecera): `highlightMatches(version, needle)`.
- **Enlace del Excel** (cabecera): si el TEXTO visible (`name ?? url`)
  contiene el needle → subcadena resaltada dentro del anchor; si NO lo
  contiene pero el valor crudo `regression.url` sí (match solo en la parte
  oculta) → anchor entero con el fondo tintado del mark + `title`
  i18n "Coincide en la URL del enlace" (sustituye al title actual solo en
  ese caso).
- **Celdas de tickets** (las 6 columnas): overlay de resalte reutilizando la
  técnica existente de `showNameOverlay`:
  - Celda no-enlace (o columna ≠ ticket) cuyo valor contiene el needle y SIN
    foco → overlay span con `highlightMatches(value, needle)`, texto del
    input transparente. Con foco → overlay fuera, input normal (edición con
    caret visible).
  - Celda-enlace (columna ticket con `parts`): si el nombre visible contiene
    el needle → overlay actual pero con el nombre pasado por
    `highlightMatches`; si el match está solo en el valor crudo (URL oculta)
    → overlay del nombre entero tintado + `title` "Coincide en la URL del
    enlace" en el td (reemplaza al tooltip de Ctrl+Click mientras dure la
    búsqueda en esa celda).
  - El botón ↗ y el Ctrl+Click no cambian.

Precedencia en celdas/anchor con match visible Y oculto a la vez: gana el
resalte de subcadena visible (sin tinte extra ni tooltip especial).

## Campo de búsqueda

En `RegressionTracker`, el input de búsqueda pasa de `width: 220` a
`width: 440, maxWidth: '100%'`. Nada más cambia (contador, ×, aria-label).

## i18n

Clave nueva con paridad ES/EN:
- `regression.matchInUrl`: "Coincide en la URL del enlace" / "Match is in
  the link URL".

## Casos borde

- Needle con metacaracteres de regex (`(`, `[`, `.`, `+`…): escapado en el
  helper, nunca lanza.
- Múltiples coincidencias en un mismo texto: todas marcadas.
- Coincidencia que abarca mayúsculas/minúsculas distintas: el fragmento
  marcado conserva el texto ORIGINAL (no el needle).
- Sin búsqueda activa (`highlightNeedle` undefined): ni overlays nuevos ni
  tooltips nuevos; snapshot del comportamiento actual.
- El overlay de resalte no debe romper el overlay SnapLink existente: son el
  mismo mecanismo, con precedencia única por celda (un solo overlay).

## Testing (direct-TDD, convención del proyecto)

- `highlight.test.tsx` (nuevo): needle vacío, sin match, un match, multi
  match, case-insensitive conservando original, metacaracteres escapados,
  `containsMatch`.
- `RegressionCard.test.tsx`: con `highlightNeedle` — mark en versión, mark
  en overlay de celda de texto, tinte+tooltip en celda-enlace con match solo
  oculto, focus quita el overlay de resalte, sin prop → sin marks.
- `RegressionTracker.test.tsx`: al buscar, las tarjetas reciben el resalte
  (mark presente en el DOM del resultado); ancho 440 del input.
- Verificación final en Chrome real contra build de producción reproduciendo
  el escenario de la captura (match solo-URL → nombre tintado con tooltip).
