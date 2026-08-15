# Comprobaciones en navegador

Asertos ejecutables contra la app real, con Playwright. **No son parte de `npm test`**
y no corren en el build: son la verificacion manual que se hace antes de dar por
buena una fase, y se dejan aqui para poder repetirla sin reescribirla.

## Por que existen

La suite de Vitest tiene un punto ciego estructural: cada test monta sus hooks con
el estado ya puesto, asi que el camino "algo cambia mientras la app esta viva" no
lo cubre nadie. En la Fase 5 (2026-08-15) eso dejo pasar **tres bugs reales** con
la suite entera en verde:

1. Anadir una pestana la dejaba con 0 filas hasta recargar (el backfill de
   `useSprints` solo corria en el mount).
2. La primera edicion en esa pestana era un no-op silencioso.
3. Ocultar la **ultima** columna nombrada de una pestana no la ocultaba.

El tercero se escapo incluso a la primera version de estos scripts, porque solo
probaban ocultar columnas *intermedias*. De ahi la regla: **cubrir siempre el
primer elemento, uno intermedio y el ultimo.** El caso del extremo es el que muerde.

## Uso

Requieren Playwright **global** (no es dependencia del proyecto: son opcionales y
no justifican ~300MB de navegadores en el `node_modules` de todos):

```bash
npm i -g playwright && npx playwright install chromium
```

Cada script acepta la URL objetivo como primer argumento. Sin argumento apunta al
dev server:

```bash
npm run dev                                   # en otra terminal
node scripts/browser-checks/sprint-schema.mjs
node scripts/browser-checks/sprint-schema.mjs https://acgen.vercel.app
```

Salen con codigo 0 si todo pasa y 1 si algo falla, listando cada aserto. Si
Playwright no se encuentra salen con codigo 2 y explican como instalarlo;
`PLAYWRIGHT_PATH` permite apuntar a otra instalacion.

| Script | Cubre |
|---|---|
| `sprint-schema.mjs` | 13 asertos del esquema del Sprint: render identico sin `acgen_schema`, renombrar, ocultar una columna intermedia sin desplazar anchos ni datos, el dato oculto sigue en localStorage, letras A B D E F, la busqueda encuentra por columnas ocultas, JSD conserva sus 6 columnas de datos, pestana nueva navegable, persistencia tras recargar |
| `sprint-last-column.mjs` | 4 asertos del caso extremo: ocultar la ULTIMA columna nombrada la quita de verdad, y las columnas de datos sin cabecera se siguen pintando |
| `sprint-archived.mjs` | 10 asertos del archivado: celdas de solo lectura, sin "+ Fila" ni editor de esquema, teclear no altera el dato, Desarchivar devuelve a activo limpiando `endDate` y el grid sobrevive al ciclo |

Cada script arranca con un contexto de navegador limpio y borra `acgen_schema`
antes de empezar, asi que **no tocan los datos reales de tu navegador**.

## Aviso

Nadie los ejecuta automaticamente, asi que pueden pudrirse. Si uno falla, sospecha
primero del script (un selector cambiado) antes que del producto — pero
compruebalo, no lo asumas: en la Fase 5 dos "fallos del script" resultaron ser uno
de cada.
