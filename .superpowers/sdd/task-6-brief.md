### Task 3.3: i18n ES/EN — Full UI Internationalization

**Files:**
- Create: `src/i18n/es.json` — ~200 keys
- Create: `src/i18n/en.json` — ~200 keys  
- Create: `src/i18n/I18nContext.tsx` — React context + useT() + useLang()
- Modify: `src/App.tsx` — wrap in I18nProvider
- Modify: `src/components/Header.tsx` — language toggle
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/LandingScreen.tsx`
- Modify: `src/components/GenerateButton.tsx` — remove label/loadingLabel props
- Modify: `src/components/Toast.tsx`
- Modify: `src/components/AcceptanceCriteriaTool.tsx`
- Modify: `src/components/TestCaseTool.tsx`
- Modify: `src/components/BugReportTool.tsx`
- Modify: `src/components/TestDataTool.tsx`
- Modify: `src/components/UserStoryTool.tsx`
- Modify: `src/components/RefinerTool.tsx`
- Modify: `src/components/EdgeCaseTool.tsx`
- Modify: `src/components/ConverterTool.tsx`
- Modify: `src/components/SprintTracker.tsx`
- Modify: `src/components/SprintDashboard.tsx`
- Modify: `src/components/SprintList.tsx`
- Modify: `src/components/AnonymizerReview.tsx`
- Modify: `src/components/ConfidentialToggle.tsx`
- Modify: `src/components/ChainMenu.tsx`

**Context:** This is a refactor — all existing behavior is preserved, only UI strings are externalized. Prompts are NOT translated (always Spanish).

**Order: infrastructure first → small components → tool components last.**

---

### Step 1: Create es.json

```json
{
  "common.generate": "Generar",
  "common.generating": "Generando...",
  "common.clear": "Limpiar",
  "common.cleared": "Campos limpiados",
  "common.undo": "Deshacer",
  "common.copy": "Copiar",
  "common.copied": "Copiado!",
  "common.cancel": "Cancelar",
  "common.confirm": "Confirmar",
  "common.save": "Guardar",
  "common.delete": "Eliminar",
  "common.rename": "Renombrar",
  "common.export": "Exportar",
  "common.import": "Importar",
  "common.back": "Volver",
  "common.close": "Cerrar",
  "common.loading": "Cargando...",
  "common.example": "Ver ejemplo",
  "common.retry": "Reintentar",
  "common.optional": "Opcional",
  "common.required": "Requerido",
  "common.noResults": "Sin resultados",
  "common.search": "Buscar...",
  "common.rows": "filas",
  "header.model": "Modelo",
  "header.language": "Idioma",
  "sidebar.generar": "Generar",
  "sidebar.refinar": "Refinar",
  "sidebar.seguimiento": "Seguimiento",
  "sidebar.convertir": "Convertir",
  "sidebar.criterios": "Criterios",
  "sidebar.testcase": "Casos de Prueba",
  "sidebar.bugreport": "Bug Report",
  "sidebar.testdata": "Datos de Prueba",
  "sidebar.userstory": "Hist. de Usuario",
  "sidebar.refiner": "Refinador",
  "sidebar.edgecase": "Casos Limite",
  "sidebar.converter": "Conversor",
  "sidebar.sprint": "Sprint",
  "sidebar.prompts": "Prompts",
  "landing.hero": "ACGen",
  "landing.subtitle": "Workbench de artefactos agiles con IA",
  "landing.eyebrow": "Quality Assurance",
  "landing.generators": "Generadores",
  "landing.config": "Configuracion",
  "landing.apiKey": "API Key",
  "landing.apiKeyPlaceholder": "gsk_...",
  "landing.model": "Modelo",
  "acceptance.title": "Criterios de Aceptacion",
  "acceptance.inputPlaceholder": "Describe la funcionalidad o el flujo que necesita criterios de aceptacion...",
  "acceptance.loadExample": "Ver ejemplo",
  "acceptance.history": "Historial",
  "acceptance.copyJira": "Copiar como tabla Jira",
  "acceptance.outputPlaceholder": "Los criterios de aceptacion apareceran aqui...",
  "testcase.title": "Casos de Prueba",
  "testcase.inputPlaceholder": "Describe la funcionalidad a probar...",
  "testcase.loadExample": "Ver ejemplo",
  "testcase.quantity": "Cantidad",
  "testcase.exportJira": "Copiar como tabla Jira",
  "testcase.exportPdf": "Descargar PDF",
  "testcase.priority": "Prioridad",
  "testcase.type": "Tipo",
  "testcase.preconditions": "Precondiciones",
  "testcase.testSteps": "Pasos",
  "testcase.expectedResult": "Resultado esperado",
  "testcase.noResults": "No hay casos de prueba generados.",
  "bugreport.title": "Bug Report",
  "bugreport.platform": "Plataforma",
  "bugreport.market": "Mercado",
  "bugreport.description": "Descripcion del bug",
  "bugreport.descriptionPlaceholder": "Describe el bug que encontraste...",
  "bugreport.browser": "Navegador",
  "bugreport.url": "URL",
  "bugreport.appVersion": "Version",
  "bugreport.device": "Dispositivo",
  "bugreport.osVersion": "OS",
  "bugreport.additionalContext": "Contexto adicional",
  "bugreport.additionalContextPlaceholder": "Pega aqui la descripcion del ticket, notas, etc...",
  "bugreport.copy": "Copiar reporte",
  "bugreport.history": "Historial",
  "bugreport.outputPlaceholder": "El bug report aparecera aqui...",
  "testdata.title": "Datos de Prueba",
  "testdata.dataType": "Tipo de dato",
  "testdata.market": "Mercado",
  "testdata.quantity": "Cantidad",
  "testdata.additionalContext": "Contexto adicional",
  "testdata.additionalContextPlaceholder": "Pega aqui informacion adicional...",
  "testdata.loadExample": "Ver ejemplo",
  "testdata.exportCsv": "Descargar CSV",
  "testdata.exportTsv": "Copiar TSV",
  "testdata.noData": "No hay datos generados.",
  "userstory.title": "Historias de Usuario",
  "userstory.inputPlaceholder": "Describe la necesidad o funcionalidad deseada...",
  "userstory.loadExample": "Ver ejemplo",
  "userstory.outputPlaceholder": "La historia de usuario aparecera aqui...",
  "refiner.title": "Refinador de Requisitos",
  "refiner.inputPlaceholder": "Pega el requisito o historia de usuario a refinar...",
  "refiner.outputPlaceholder": "El analisis de refinamiento aparecera aqui...",
  "edgecase.title": "Casos Limite",
  "edgecase.inputPlaceholder": "Describe la funcionalidad para generar casos limite...",
  "edgecase.loadExample": "Ver ejemplo",
  "edgecase.category": "Categoria",
  "edgecase.scenario": "Escenario",
  "edgecase.expectedResult": "Resultado esperado",
  "converter.title": "Conversor de Formatos",
  "converter.inputFormat": "Formato origen",
  "converter.outputFormat": "Formato destino",
  "converter.inputPlaceholder": "Pega el texto a convertir...",
  "converter.outputPlaceholder": "El resultado aparecera aqui...",
  "converter.convert": "Convertir",
  "converter.converting": "Convirtiendo...",
  "sprint.title": "Sprint Tracker",
  "sprint.newSprint": "Nuevo Sprint",
  "sprint.name": "Nombre",
  "sprint.goal": "Objetivo",
  "sprint.startDate": "Inicio",
  "sprint.endDate": "Fin",
  "sprint.archive": "Archivar Sprint",
  "sprint.archived": "Archivados",
  "sprint.active": "Activo",
  "sprint.rowsOf": "de",
  "chain.sendTo": "Enviar a...",
  "chain.acceptance": "Criterios",
  "chain.testcase": "Casos de Prueba",
  "chain.bugreport": "Bug Report",
  "chain.refiner": "Refinador",
  "chain.edgecase": "Casos Limite",
  "confidential.toggle": "Modo confidencial",
  "confidential.review": "sustituciones — Revisar",
  "confidential.title": "Revision de datos — Modo Confidencial",
  "confidential.subtitle": "Se detectaron {count} datos sensibles. Revisa los reemplazos antes de enviar.",
  "confidential.original": "Original",
  "confidential.sentAs": "Se enviara como",
  "confidential.confirmSend": "Confirmar y enviar",
  "error.apiKey": "API Key invalida. Verifica tu clave e intenta de nuevo.",
  "error.rateLimit": "Limite de peticiones alcanzado. Espera unos segundos y vuelve a intentar.",
  "error.modelDecommissioned": "El modelo seleccionado ya no esta disponible. Por favor selecciona otro modelo.",
  "error.unexpected": "Error inesperado. Intenta de nuevo.",
  "error.noContent": "La API no devolvio contenido. Intenta de nuevo.",
  "error.invalidJson": "La respuesta no es JSON valido. Intenta de nuevo.",
  "error.noTestCases": "No se generaron casos de prueba. Intenta con una descripcion mas detallada.",
  "error.noTestData": "No se pudieron generar los datos de prueba. Intenta de nuevo.",
  "error.invalidFormat": "La respuesta no tiene el formato esperado.",
  "error.boundary": "Algo salio mal. Por favor, recarga la pagina o intenta de nuevo."
}
```

### Step 2: Create en.json

```json
{
  "common.generate": "Generate",
  "common.generating": "Generating...",
  "common.clear": "Clear",
  "common.cleared": "Fields cleared",
  "common.undo": "Undo",
  "common.copy": "Copy",
  "common.copied": "Copied!",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.rename": "Rename",
  "common.export": "Export",
  "common.import": "Import",
  "common.back": "Back",
  "common.close": "Close",
  "common.loading": "Loading...",
  "common.example": "See example",
  "common.retry": "Retry",
  "common.optional": "Optional",
  "common.required": "Required",
  "common.noResults": "No results",
  "common.search": "Search...",
  "common.rows": "rows",
  "header.model": "Model",
  "header.language": "Language",
  "sidebar.generar": "Generate",
  "sidebar.refinar": "Refine",
  "sidebar.seguimiento": "Tracking",
  "sidebar.convertir": "Convert",
  "sidebar.criterios": "Criteria",
  "sidebar.testcase": "Test Cases",
  "sidebar.bugreport": "Bug Report",
  "sidebar.testdata": "Test Data",
  "sidebar.userstory": "User Stories",
  "sidebar.refiner": "Refiner",
  "sidebar.edgecase": "Edge Cases",
  "sidebar.converter": "Converter",
  "sidebar.sprint": "Sprint",
  "sidebar.prompts": "Prompts",
  "landing.hero": "ACGen",
  "landing.subtitle": "AI-powered Agile Artifact Workbench",
  "landing.eyebrow": "Quality Assurance",
  "landing.generators": "Generators",
  "landing.config": "Configuration",
  "landing.apiKey": "API Key",
  "landing.apiKeyPlaceholder": "gsk_...",
  "landing.model": "Model",
  "acceptance.title": "Acceptance Criteria",
  "acceptance.inputPlaceholder": "Describe the functionality or flow that needs acceptance criteria...",
  "acceptance.loadExample": "See example",
  "acceptance.history": "History",
  "acceptance.copyJira": "Copy as Jira table",
  "acceptance.outputPlaceholder": "Acceptance criteria will appear here...",
  "testcase.title": "Test Cases",
  "testcase.inputPlaceholder": "Describe the functionality to test...",
  "testcase.loadExample": "See example",
  "testcase.quantity": "Quantity",
  "testcase.exportJira": "Copy as Jira table",
  "testcase.exportPdf": "Download PDF",
  "testcase.priority": "Priority",
  "testcase.type": "Type",
  "testcase.preconditions": "Preconditions",
  "testcase.testSteps": "Steps",
  "testcase.expectedResult": "Expected result",
  "testcase.noResults": "No test cases generated.",
  "bugreport.title": "Bug Report",
  "bugreport.platform": "Platform",
  "bugreport.market": "Market",
  "bugreport.description": "Bug description",
  "bugreport.descriptionPlaceholder": "Describe the bug you found...",
  "bugreport.browser": "Browser",
  "bugreport.url": "URL",
  "bugreport.appVersion": "Version",
  "bugreport.device": "Device",
  "bugreport.osVersion": "OS",
  "bugreport.additionalContext": "Additional context",
  "bugreport.additionalContextPlaceholder": "Paste ticket description, notes, etc. here...",
  "bugreport.copy": "Copy report",
  "bugreport.history": "History",
  "bugreport.outputPlaceholder": "Bug report will appear here...",
  "testdata.title": "Test Data",
  "testdata.dataType": "Data type",
  "testdata.market": "Market",
  "testdata.quantity": "Quantity",
  "testdata.additionalContext": "Additional context",
  "testdata.additionalContextPlaceholder": "Paste additional context here...",
  "testdata.loadExample": "See example",
  "testdata.exportCsv": "Download CSV",
  "testdata.exportTsv": "Copy TSV",
  "testdata.noData": "No data generated.",
  "userstory.title": "User Stories",
  "userstory.inputPlaceholder": "Describe the need or desired functionality...",
  "userstory.loadExample": "See example",
  "userstory.outputPlaceholder": "User story will appear here...",
  "refiner.title": "Requirement Refiner",
  "refiner.inputPlaceholder": "Paste the requirement or user story to refine...",
  "refiner.outputPlaceholder": "Refinement analysis will appear here...",
  "edgecase.title": "Edge Cases",
  "edgecase.inputPlaceholder": "Describe the functionality to generate edge cases for...",
  "edgecase.loadExample": "See example",
  "edgecase.category": "Category",
  "edgecase.scenario": "Scenario",
  "edgecase.expectedResult": "Expected result",
  "converter.title": "Format Converter",
  "converter.inputFormat": "Source format",
  "converter.outputFormat": "Target format",
  "converter.inputPlaceholder": "Paste the text to convert...",
  "converter.outputPlaceholder": "Result will appear here...",
  "converter.convert": "Convert",
  "converter.converting": "Converting...",
  "sprint.title": "Sprint Tracker",
  "sprint.newSprint": "New Sprint",
  "sprint.name": "Name",
  "sprint.goal": "Goal",
  "sprint.startDate": "Start",
  "sprint.endDate": "End",
  "sprint.archive": "Archive Sprint",
  "sprint.archived": "Archived",
  "sprint.active": "Active",
  "sprint.rowsOf": "of",
  "chain.sendTo": "Send to...",
  "chain.acceptance": "Criteria",
  "chain.testcase": "Test Cases",
  "chain.bugreport": "Bug Report",
  "chain.refiner": "Refiner",
  "chain.edgecase": "Edge Cases",
  "confidential.toggle": "Confidential mode",
  "confidential.review": "substitutions — Review",
  "confidential.title": "Data Review — Confidential Mode",
  "confidential.subtitle": "{count} sensitive data items detected. Review replacements before sending.",
  "confidential.original": "Original",
  "confidential.sentAs": "Will be sent as",
  "confidential.confirmSend": "Confirm & send",
  "error.apiKey": "Invalid API key. Verify your key and try again.",
  "error.rateLimit": "Rate limit reached. Wait a few seconds and try again.",
  "error.modelDecommissioned": "The selected model is no longer available. Please select another model.",
  "error.unexpected": "Unexpected error. Try again.",
  "error.noContent": "The API returned no content. Try again.",
  "error.invalidJson": "Response is not valid JSON. Try again.",
  "error.noTestCases": "No test cases were generated. Try a more detailed description.",
  "error.noTestData": "Could not generate test data. Try again.",
  "error.invalidFormat": "Response does not have the expected format.",
  "error.boundary": "Something went wrong. Please reload or try again."
}
```

### Step 3: Create I18nContext.tsx

```typescript
// src/i18n/I18nContext.tsx
import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import es from './es.json';
import en from './en.json';

type Lang = 'es' | 'en';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Lang, Record<string, string>> = { es, en };

const I18nContext = createContext<I18nContextValue | null>(null);

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem('acgen_lang');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed === 'es' || parsed === 'en') return parsed;
    }
  } catch { /* corrupt */ }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalStorage<Lang>('acgen_lang', detectLang());

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? translations['es'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLang must be used inside I18nProvider');
  return { lang: ctx.lang, setLang: ctx.setLang };
}
```

### Step 4: Wrap App in I18nProvider (App.tsx)

Import and wrap:
```typescript
import { I18nProvider } from './i18n/I18nContext';
```

Wrap the return JSX: `return ( <I18nProvider> <div className="page"> ... </div> </I18nProvider> );`

### Step 5: Add language toggle to Header.tsx

Import: `import { useLang } from '../i18n/I18nContext';`
Add: `const { lang, setLang } = useLang();`
Add button next to theme toggle:
```tsx
<button type="button" className="btn-ghost" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
  style={{ fontSize: 12, padding: '2px 8px' }} title="Idioma / Language">
  {lang === 'es' ? 'EN' : 'ES'}
</button>
```

### Step 6: Refactor GenerateButton — remove label/loadingLabel props

Change props to:
```typescript
interface GenerateButtonProps { onClick: () => void; disabled?: boolean; loading?: boolean; }
```
Import useT and render: `{loading ? t('common.generating') : t('common.generate')}`

Update all 8 tool callers that pass `label="..." loadingLabel="..."` — remove those props.

### Step 7: Refactor all components

For each of the remaining ~15 components (Sidebar, Landing, Toast, all tools, SprintTracker sub-components, AnonymizerReview, ConfidentialToggle, ChainMenu):
1. Import `{ useT }` from `'../i18n/I18nContext'`
2. Add `const t = useT();`
3. Replace every hardcoded Spanish string with `t('key')`

Key mappings:
- "Modo confidencial" → `t('confidential.toggle')`
- "Cancelar" → `t('common.cancel')`
- "Confirmar y enviar" → `t('confidential.confirmSend')`
- Table headers in TestCase: "Prioridad" → `t('testcase.priority')`, etc.
- SprintTracker: "Nuevo Sprint" → `t('sprint.newSprint')`, etc.
- ErrorBanner messages: use existing t() on the messages passed from parent tools

### Step 8: Type check + tests

```bash
npx tsc -b --noEmit 2>&1    # zero errors
npm test 2>&1                # all 90 tests pass
```

### Step 9: Commit

```bash
git add -A
git commit -m "feat(i18n): full ES/EN translation — ~200 keys, I18nContext, useT() hook, language toggle"
```
