# ACGen: Suite de herramientas de QA automatizadas con IA

![ACGen landing](public/screenshot.png)

**🔗 Demo en vivo: [acgen.vercel.app](https://acgen.vercel.app)**

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)

ACGen es una aplicación web (SPA) que integra cinco herramientas para agilizar el trabajo diario de equipos QA en ecommerce: cuatro impulsadas por IA mediante la API de Groq (LLM) y un Sprint Tracker offline para seguimiento de tickets. Se conecta opcionalmente con Jira para enriquecer las generaciones con contexto de tickets reales.

Construida a partir de mi experiencia real en QA de ecommerce. Pensada para un contexto de moda multi-mercado europeo, con pruebas en web y apps nativas (Android APK, iOS IPA).

## Características

- **Criterios de Aceptación**: Genera criterios Dado/Cuando/Entonces desde tickets de Jira o requisitos. Validación automática de formato. Historial persistente de las últimas 10 generaciones.
- **Test Case Generator**: Genera casos de prueba QA estructurados (JSON) con prioridad, tipo, pasos y resultado esperado. Exporta como tabla Jira o PDF.
- **Bug Report Generator**: Genera bug reports en formato Jira wiki con paneles estructurados, selección de plataforma (web/App Android/App iOS), campos dinámicos y contexto de tickets Jira. Historial persistente de las últimas 10 generaciones.
- **Datos de Prueba**: Genera datos realistas (direcciones, facturación, registros, tarjetas, cupones) adaptados a 217 mercados. Exporta como TSV o CSV (con protección contra inyección de fórmulas en Excel).
- **Sprint Tracker**: Hoja de cálculo offline por sprint con 4 pestañas (Resueltos, Creados, ReOpen, Prioridad Alta): filas reordenables por drag-and-drop, búsqueda con debounce, columnas redimensionables, enlaces a tickets Jira (Ctrl+click), pegado desde SnapLink y archivado histórico. Sin dependencia de Groq ni Jira API.
- **Tema oscuro**: Alterna entre modo claro y oscuro. Persistencia en localStorage, aplicado antes del primer paint (sin parpadeo).
- **Integración Jira**: Conexión opcional mediante proxy local para leer tickets y enriquecer generaciones. Proxy endurecido: validación de issue keys y URL base, timeouts de 30s.
- **Text-to-speech**: Lectura en voz alta del razonamiento del modelo en Criterios y Bug Report.


---

## Herramientas

### Criterios de Aceptación
Genera criterios Dado/Cuando/Entonces en formato Confluence wiki a partir de requisitos escritos o de un ticket de Jira (URL o clave). El contexto del ticket se añade al texto introducido, sin reemplazarlo. Valida automáticamente que la salida contenga los marcadores requeridos.

### Test Case Generator
Genera casos de prueba estructurados (clave, resumen, prioridad, tipo, precondiciones, pasos, resultado esperado) validados campo a campo. Se renderizan como tabla HTML con badges de prioridad y tipo, exportables como tabla Jira o PDF.

### Bug Report Generator
Genera bug reports en formato Jira wiki con paneles estructurados. Cuatro plataformas (Web Desktop, Web Mobile, App Android, App iOS) con campos dinámicos por plataforma y contexto opcional de tickets Jira.

### Datos de Prueba
Genera datos de prueba realistas y con formato válido para cada mercado. Cinco tipos de dato: direcciones de envío, datos de facturación, registros de usuario, tarjetas de pago (con números de prueba de Adyen) y códigos promocionales. La salida se muestra en una tabla HTML con cabeceras en español, y permite copiar filas individuales, copiar la tabla completa en formato TSV, o descargar CSV compatible con Excel.

### Sprint Tracker
Reemplaza el seguimiento manual en Excel de tickets por sprint. Cada sprint tiene 4 pestañas (Resueltos, Creados, ReOpen, Prioridad Alta) con una hoja de cálculo editable: columnas redimensionables, filas reordenables por drag-and-drop, búsqueda instantánea, navegación con teclado y enlaces directos a Jira (Ctrl+click sobre la clave del ticket). Los sprints se archivan con fecha de cierre y permanecen consultables. Funciona completamente offline. Los datos viven en localStorage.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| LLM API | Groq (endpoint compatible con OpenAI) |
| Proxy Jira | Funciones serverless de Vercel (`api/`) |
| PDF | jsPDF + jspdf-autotable |
| Tests | Vitest + React Testing Library (87 tests) |
| Estilos | CSS personalizado (sin framework) |

---

## Requisitos

- **Node.js 18+**
- **npm**
- **Clave de API de Groq**: regístrate en [https://console.groq.com](https://console.groq.com) y obtén una API key gratuita
- **Personal Access Token de Jira** (opcional): necesario solo para la integración con tickets

---

## Instalación

```bash
git clone https://github.com/jraversbcn21/ACGen.git
cd ACGen/acgen
npm install
```

## Uso

### Desarrollo (con integración Jira)

```bash
npm run dev:all
```

Ejecuta `vercel dev`, que sirve el frontend y las funciones serverless de `/api` juntos en el mismo origen (por defecto `http://localhost:3000`). Requiere el [Vercel CLI](https://vercel.com/docs/cli) instalado y, la primera vez, ejecutar `vercel link` para vincular el proyecto.

### Solo Vite (sin integración Jira)

```bash
npm run dev
```

### Compilar para producción

```bash
npm run build
```

### Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

> **Primer uso:** Al abrir la app por primera vez, introduce tu API key de Groq en el campo superior. La configuración de Jira es opcional y se almacena únicamente en el localStorage del navegador.

---

## Integración con Jira

ACGen puede leer tickets de Jira para aportar contexto a las generaciones:

1. Configura la variable de entorno **`JIRA_ALLOWED_HOSTS`** en el proyecto de Vercel (host o lista separada por comas, ej. `jira.tuempresa.com`). Es obligatoria: sin ella, las funciones rechazan cualquier petición. `vercel env add JIRA_ALLOWED_HOSTS development` (y `preview`/`production`), luego `vercel env pull .env.local` para tenerla en local
2. Inicia el entorno con `npm run dev:all` (`vercel dev`), que levanta las funciones de `/api`
3. En la herramienta deseada, configura la **URL base de Jira** y un **Personal Access Token** (PAT)
4. Introduce la URL del ticket (ej: `https://jira.tuempresa.com/browse/PROJECT-123`)
5. La app obtendrá los datos del ticket (resumen, descripción, prioridad, etiquetas, criterios de aceptación existentes) y los usará como contexto para la generación

> Las funciones de `/api` se ejecutan en el mismo origen que la app (local vía `vercel dev`, o en Vercel en producción). Las credenciales viajan desde tu navegador a la función y de ahí a tu instancia de Jira; nunca a terceros. `JIRA_ALLOWED_HOSTS` restringe a qué hosts pueden apuntar esas peticiones. Sin esta lista, cualquiera en internet podría usar la función para sondear otros hosts.

> **Limitación conocida:** si tu Jira solo es accesible desde tu red corporativa (IP privada), la integración con Jira **no funcionará en el despliegue público**: las funciones de Vercel corren en la nube pública y no pueden alcanzar direcciones internas. Para ese caso, usa `npm run dev:all` en tu red corporativa; el resto de herramientas (Criterios, Test Cases, Bug Report, Datos de Prueba, Sprint Tracker) funcionan igual en público, ya que no dependen de Jira.

---

## Estructura del Proyecto

```
acgen/
├── api/                    # Funciones serverless de Vercel (proxy Jira)
│   ├── _lib/               # Validación compartida (issue keys, URL base)
│   └── jira/               # Endpoints /issue/[issueKey] y /search
├── src/
│   ├── components/         # Componentes React (uno por herramienta + compartidos)
│   ├── config/             # Constantes, prompts, configuración de modelos
│   ├── hooks/              # useLocalStorage, useHistory, useSprints
│   ├── services/           # Servicio API (Groq) + servicio Jira
│   ├── types/              # Interfaces TypeScript
│   ├── App.tsx             # Componente principal con ruteo por vista + ErrorBoundary
│   ├── App.css             # Todos los estilos
│   └── main.tsx            # Punto de entrada
├── AGENTS.md               # Guía técnica detallada para desarrolladores
├── README.md
├── package.json
└── vite.config.ts

Tests unitarios co-localizados con el código (*.test.ts / *.test.tsx / *.test.js).
```

---

## Modelos Disponibles

Los modelos se ejecutan a través de la API de Groq:

| Modelo | Notas |
|---|---|
| `openai/gpt-oss-120b` | **Recomendado**: mejor razonamiento |
| `openai/gpt-oss-20b` | Alternativa más rápida |
| `llama-3.3-70b-versatile` | Buen equilibrio velocidad/calidad |
| `llama-3.1-8b-instant` | Máxima velocidad |
| `qwen/qwen3-32b` | Soporta reasoning format (visible/oculto) |

---

## Contribuir

Consulta [`AGENTS.md`](./AGENTS.md) para conocer la arquitectura completa del proyecto, los detalles de implementación de cada herramienta, y las guías para modificar prompts, formatos de salida o modelos.

---

## Licencia

MIT
