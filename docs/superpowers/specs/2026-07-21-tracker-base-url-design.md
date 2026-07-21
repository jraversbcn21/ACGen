# Diseño: configuración de URL base para enlaces Jira en Sprint Tracker

**Fecha:** 2026-07-21
**Estado:** Aprobado por Jorge

## Problema

Los enlaces de tickets del Sprint Tracker no redirigen al ticket de Jira: reabren
la propia app ACGen. Causa raíz (commit `4c258a3`, "remove all Jira surface"):

- La clave de localStorage `acgen_jira_base_url` se renombró a
  `acgen_tracker_base_url`, pero se eliminaron **todos los escritores** (la UI de
  configuración vivía en las herramientas con integración Jira, que desaparecieron).
- `TrackerGrid.tsx` lee `acgen_tracker_base_url`, que siempre está vacía → el
  enlace se construye como `/browse/PROJ-123` (URL **relativa**) → `window.open`
  navega dentro del dominio → el rewrite SPA de Vercel devuelve ACGen.
- El valor que el usuario tenía configurado sigue huérfano bajo la clave antigua
  `acgen_jira_base_url`; nunca se migró.

Regression Tracker no está afectado: usa `linkMode='url'`, cuyo patrón exige una
URL absoluta (`https://...`) escrita en la celda; no depende de `baseUrl`.

## Objetivo

Ctrl + click sobre una celda de ticket (formato `PROJ-123 Texto natural`, pegado
desde SnapLink) abre `<URL base>/browse/PROJ-123` en pestaña nueva — mismo gesto
y comportamiento que Regression Tracker. Debe funcionar también para los tickets
ya pegados (el enlace se reconstruye al vuelo desde la clave del ticket).

## Diseño

### 1. Botón ⚙ + input inline en `TrackerGrid.tsx`

- En la barra de pestañas, junto a "+ SnapLink", un botón ⚙ visible **solo
  cuando `linkMode === 'jira'`** (Regression Tracker no lo muestra).
- Al pulsarlo se despliega un input inline para escribir la URL base
  (placeholder tipo `https://jira.example.com`).
- Se guarda en localStorage (`acgen_tracker_base_url`) al confirmar (Enter o
  blur), normalizando barras finales (`replace(/\/+$/, '')` ya existente).
- Cuando la URL base está vacía, el botón se muestra en color de acento/aviso
  para señalar que falta configuración.

### 2. Migración de la clave antigua

- Al montar el grid en modo jira: si `acgen_tracker_base_url` está vacía y
  existe valor en la clave huérfana `acgen_jira_base_url`, copiar ese valor a la
  clave nueva.
- La clave antigua se deja intacta (mismo criterio que los datos huérfanos de
  Android en el ciclo del Regression Tracker).
- Efecto: transparente para el usuario afectado; sus enlaces vuelven a funcionar
  sin reconfigurar nada.

### 3. Guardia contra URL relativa (defensa en profundidad)

- `getLinkUrl` devuelve `null` cuando `baseUrl` está vacío en modo jira.
- Sin URL base configurada, las celdas de ticket no se renderizan como enlace
  (sin color de acento, sin cursor pointer, sin ctrl+click).
- El `title` de la celda en ese estado indica que hay que configurar la URL
  del tracker (⚙).
- Nunca más una navegación relativa que reabra la app.

### 4. i18n y tests

- Textos nuevos en ambos diccionarios es/en (el test de paridad de claves los
  vigila): tooltip del botón ⚙, placeholder del input, title de celda sin
  configurar.
- Tests nuevos de `TrackerGrid`:
  - Guardia: con baseUrl vacío en modo jira, la celda de ticket no es enlace.
  - Guardado: escribir URL en el input ⚙ persiste en `acgen_tracker_base_url`
    (normalizando barra final) y activa los enlaces.
  - Migración: con clave antigua presente y nueva vacía, el valor se copia y
    los enlaces funcionan; la clave antigua queda intacta.
  - Regression (`linkMode='url'`): el botón ⚙ no se renderiza.

## Fuera de alcance

- Cambiar el formato de celda del modo jira (p. ej. guardar la URL completa
  como hace Regression): rompería la compacidad actual y no arreglaría los
  tickets ya pegados.
- Eliminar la clave antigua de localStorage.
- UI de configuración global (no existe panel de ajustes en Header).
