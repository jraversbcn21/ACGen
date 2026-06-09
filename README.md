# ACGen — Suite de herramientas de QA automatizadas con IA

![ACGen landing](public/screenshot.png)

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)

ACGen es una aplicación web (SPA) que integra cuatro herramientas impulsadas por IA para agilizar el trabajo diario de equipos QA en ecommerce. Utiliza la API de Groq (LLM) para generar contenido estructurado y se conecta opcionalmente con Jira para enriquecer las generaciones con contexto de tickets reales.

Desarrollada para el contexto de **Bershka / Inditex** — ecommerce multi-mercado europeo con pruebas en web (https://localhost:3443/) y apps nativas (Android APK, iOS IPA).

## Características

- **Criterios de Aceptación** — Genera criterios Dado/Cuando/Entonces desde tickets de Jira o requisitos. Validación automática de formato. Historial persistente de las últimas 10 generaciones.
- **Test Case Generator** — Genera casos de prueba QA estructurados (JSON) con prioridad, tipo, pasos y resultado esperado. Exporta como tabla Jira o PDF.
- **Bug Report Generator** — Genera bug reports en formato Jira wiki con paneles estructurados, selección de plataforma (web/App Android/App iOS), campos dinámicos y contexto de tickets Jira. Historial persistente de las últimas 10 generaciones.
- **Datos de Prueba** — Genera datos realistas (direcciones, facturación, registros, tarjetas, cupones) adaptados a 22 mercados europeos. Exporta como TSV o CSV.
- **Tema oscuro** — Alterna entre modo claro y oscuro. Persistencia en localStorage.
- **Integración Jira** — Conexión opcional mediante proxy local para leer tickets y enriquecer generaciones.


---

## Herramientas

### Criterios de Aceptación
### Test Case Generator
### Bug Report Generator
### Datos de Prueba
Genera datos de prueba realistas y con formato válido para cada mercado europeo. Cinco tipos de dato: direcciones de envío, datos de facturación, registros de usuario, tarjetas de pago (con números de prueba de Adyen) y códigos promocionales. La salida se muestra en una tabla HTML con cabeceras en español, y permite copiar filas individuales, copiar la tabla completa en formato TSV, o descargar CSV compatible con Excel.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 18, TypeScript, Vite 5 |
| LLM API | Groq (endpoint compatible con OpenAI) |
| Proxy Jira | Express.js (bypass CORS) |
| PDF | jsPDF + jspdf-autotable |
| Estilos | CSS personalizado (sin framework) |

---

## Requisitos

- **Node.js 18+**
- **npm**
- **Clave de API de Groq** — regístrate en [https://console.groq.com](https://console.groq.com) y obtén una API key gratuita
- **Personal Access Token de Jira** (opcional) — necesario solo para la integración con tickets

---

## Instalación

```bash
git clone https://github.com/jraversbcn21/ACGen.git
cd ACGen/acgen
npm install
```

## Uso

### Desarrollo (con servidor proxy de Jira)

```bash
npm run dev:all
```

Esto inicia simultáneamente:
- **Vite dev server** en `http://localhost:5173`
- **Express proxy** en `http://localhost:3002`

### Solo Vite (sin integración Jira)

```bash
npm run dev
```

### Compilar para producción

```bash
npm run build
```

### Lint

```bash
npm run lint
```

> **Primer uso:** Al abrir la app por primera vez, introduce tu API key de Groq en el campo superior. La configuración de Jira es opcional y se almacena únicamente en el localStorage del navegador.

---

## Integración con Jira

ACGen puede leer tickets de Jira para aportar contexto a las generaciones:

1. Inicia el servidor proxy con `npm run dev:all` o `npm run server`
2. En la herramienta deseada, configura la **URL base de Jira** y un **Personal Access Token** (PAT)
3. Introduce la URL del ticket (ej: `https://jira.tuempresa.com/browse/PROJECT-123`)
4. La app obtendrá los datos del ticket (resumen, descripción, prioridad, etiquetas, criterios de aceptación existentes) y los usará como contexto para la generación

> El proxy se ejecuta localmente en el puerto 3002. Las credenciales nunca se envían a servidores externos — solo viajan desde tu navegador al proxy local y de ahí a tu instancia de Jira.

---

## Estructura del Proyecto

```
acgen/
├── server/                 # Proxy Express para API de Jira
│   ├── index.js
│   └── jiraRoutes.js
├── src/
│   ├── components/         # Componentes React (uno por herramienta + compartidos)
│   ├── config/             # Constantes, prompts, configuración de modelos
│   ├── hooks/              # Hooks personalizados (useLocalStorage)
│   ├── services/           # Servicio API (Groq) + servicio Jira
│   ├── types/              # Interfaces TypeScript
│   ├── App.tsx             # Componente principal con ruteo por vista
│   ├── App.css             # Todos los estilos
│   └── main.tsx            # Punto de entrada
├── AGENTS.md               # Guía técnica detallada para desarrolladores
├── README.md
├── package.json
└── vite.config.ts
```

---

## Modelos Disponibles

Los modelos se ejecutan a través de la API de Groq:

| Modelo | Notas |
|---|---|
| `openai/gpt-oss-120b` | **Recomendado** — mejor razonamiento |
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
