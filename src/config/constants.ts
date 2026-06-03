export const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const PROXY_URL = 'http://localhost:3001/api';

export const HARDCODED_PROMPT = `Based on all the information provided, read it, analyze it, and generate one or more acceptance criteria as you consider necessary. Do not be overly detailed; generate only the most important and general criteria. The criteria can be one or several depending on the scope of the information provided. The criteria must be written from the perspective of an end user going through the process, not from a technical point of view. Describe the steps and conditions as if a regular person were navigating or interacting with the system, using natural and everyday language, avoiding technical or implementation-specific terms.

Always respond using exactly this format and no other:

{panel:title=Criterios aceptación}
{quote}*Dado*
*Cuando*
*Entonces*
*ResultadoQA:* (/)/(x)
*Pais/Entorno:*
*Fecha:*
*Evidencia:*
*Validado por:*
{quote}{panel}

If more than one acceptance criterion is needed, repeat the full block above for each one, separated by a blank line. Do not add any text outside of these blocks.`;

export const REQUIRED_MARKERS = [
  '{panel:title=Criterios aceptación}',
  '{quote}',
  '*Dado*',
  '*Cuando*',
  '*Entonces*',
];

export const TESTCASE_PROMPT = `Eres un ingeniero QA generando casos de prueba para el sitio web de moda ecommerce Bershka ([www.bershka.com](https://www.bershka.com)). Basándote en la instrucción del usuario, genera casos de prueba exhaustivos y realistas que cubran el área o flujo solicitado.

Basa tu respuesta en patrones estándar de ecommerce — NO intentes navegar ni depender de datos del sitio en vivo. Las áreas del sitio incluyen: Home, Footer, Menú/Navegación, Buscador, Parrillas de productos, Filtros, PDP (Detalle de Producto), Cesta y Checkout.

CRÍTICO: Devuelve ÚNICAMENTE un array JSON válido. NO incluyas bloques de código markdown, comillas invertidas, explicaciones ni ningún texto antes o después del JSON. La respuesta debe ser parseable directamente por JSON.parse().

Devuelve un array JSON de objetos. Cada objeto debe tener exactamente estos campos:
{
  "key": "TC-001",
  "summary": "Título descriptivo breve",
  "priority": "Alta",
  "type": "Positivo",
  "preconditions": "Qué debe ser cierto antes de comenzar",
  "testSteps": ["Descripción del paso 1", "Descripción del paso 2"],
  "expectedResult": "Resultado esperado claro desde la perspectiva del usuario"
}

La prioridad debe ser una de: "Alta", "Media", "Baja".
El tipo debe ser uno de: "Positivo", "Negativo".

Genera tantos casos de prueba como el usuario solicite. Si no se especifica, genera 5 casos de prueba. Usa claves secuenciales (TC-001, TC-002, ...). Cubre tanto escenarios positivos como negativos. Los resultados esperados deben ser orientados al usuario sin jerga técnica.

Todo el contenido generado (summary, preconditions, testSteps, expectedResult) DEBE estar en español.`;

export const AVALIABLE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "qwen/qwen3-32b",
];

export const DEFAULT_MODEL = 'openai/gpt-oss-120b';

export const STORAGE_KEYS = {
  API_KEY: 'acgen_api_key',
  MODEL: 'acgen_model',
  JIRA_TOKEN: 'acgen_jira_token',
  JIRA_BASE_URL: 'acgen_jira_base_url',
} as const;

export const TEMPERATURE = 0.2;

export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata';

export const JIRA_URL_REGEX = /https:\/\/(?:[^/]+\/)?(?:jira\/)?browse\/([A-Z]+-\d+)/i;

export const BERSHKA_MARKETS = [
  { code: 'AL', label: 'Albania', currency: 'ALL', locale: 'sq' },
  { code: 'DE', label: 'Alemania', currency: '€', locale: 'de' },
  { code: 'AD', label: 'Andorra', currency: '€', locale: 'ca' },
  { code: 'SA', label: 'Arabia Saudita', currency: 'SAR', locale: 'ar' },
  { code: 'BE', label: 'Bélgica', currency: '€', locale: 'fr' },
  { code: 'CR', label: 'Costa Rica', currency: 'CRC', locale: 'es' },
  { code: 'EG', label: 'Egipto', currency: 'EGP', locale: 'ar' },
  { code: 'AE', label: 'Emiratos Árabes', currency: 'AED', locale: 'ar' },
  { code: 'ES', label: 'España', currency: '€', locale: 'es' },
  { code: 'FR', label: 'Francia', currency: '€', locale: 'fr' },
  { code: 'GR', label: 'Grecia', currency: '€', locale: 'el' },
  { code: 'IE', label: 'Irlanda', currency: '€', locale: 'en' },
  { code: 'IL', label: 'Israel', currency: 'ILS', locale: 'he' },
  { code: 'IT', label: 'Italia', currency: '€', locale: 'it' },
  { code: 'MX', label: 'México', currency: 'MXN', locale: 'es' },
  { code: 'NL', label: 'Países Bajos', currency: '€', locale: 'nl' },
  { code: 'PL', label: 'Polonia', currency: 'PLN', locale: 'pl' },
  { code: 'PT', label: 'Portugal', currency: '€', locale: 'pt' },
  { code: 'UK', label: 'Reino Unido', currency: '£', locale: 'en' },
  { code: 'RO', label: 'Rumanía', currency: 'RON', locale: 'ro' },
  { code: 'TR', label: 'Turquía', currency: 'TRY', locale: 'tr' },
  { code: 'US', label: 'United States', currency: '$', locale: 'en' },
] as const;

export const PLATFORMS = [
  { id: 'web-desktop', label: 'Web Desktop' },
  { id: 'web-mobile', label: 'Web Mobile' },
  { id: 'app-android', label: 'App Android' },
  { id: 'app-ios', label: 'App iOS' },
] as const;

export const IOS_DEVICES = [
  { id: 'iphone-xr', label: 'iPhone XR' },
  { id: 'iphone-11', label: 'iPhone 11' },
] as const;

export const ANDROID_DEVICES = [
  { id: 'redmi-note-11-pro', label: 'Redmi Note 11 Pro' },
  { id: 'moto-g35-5g', label: 'Moto g35 5G' },
] as const;

export const DATA_TYPES = [
  { id: 'shipping-address', label: 'Dirección de envío' },
  { id: 'billing-data', label: 'Datos de facturación' },
  { id: 'user-registration', label: 'Datos de registro de usuario' },
  { id: 'payment-cards', label: 'Tarjetas de pago de prueba' },
  { id: 'promo-codes', label: 'Cupones y códigos promocionales' },
] as const;

export const TEST_DATA_PROMPT = `Eres un QA Engineer senior especializado en ecommerce de moda (Bershka, grupo Inditex). Tu tarea es generar datos de prueba realistas y válidos para testing manual.

CONTEXTO:
- Ecommerce: Bershka (www.bershka.com), multi-mercado europeo
- Los datos se usan para testing manual en entornos de prueba
- Los datos deben ser FICTICIOS pero con formato VÁLIDO para cada país/mercado
- Cada mercado tiene formatos específicos: direcciones, códigos postales, teléfonos, documentos de identidad, divisas

REGLAS:
1. Todo el contenido DEBE estar en el IDIOMA del mercado solicitado (nombres, ciudades, calles), excepto las etiquetas de los campos que van en ESPAÑOL.
2. RESPONDE ÚNICAMENTE con un JSON array. Sin explicaciones, sin markdown, sin backticks.
3. Cada objeto del array representa un registro de datos completo.
4. Los datos deben ser realistas: nombres comunes del país, ciudades reales, formatos de código postal correctos, prefijos telefónicos del país, etc.
5. Para tarjetas de pago, usa EXCLUSIVAMENTE números de tarjeta de prueba estándar de Adyen (el PSP utilizado):
   - Visa: 4111 1111 1111 1111
   - Mastercard: 5500 0000 0000 0004
   - Amex: 3700 0000 0000 002
   - Usar fecha de expiración futura (03/2030) y CVV genérico (737 para Amex, 123 para el resto)
   - Variar el tipo de tarjeta entre registros
6. Para cupones/códigos promocionales, genera códigos con formato realista (WELCOME10, SUMMER2026, FREESHIP, BERSHKA20, etc.) e indica tipo (porcentaje, monto fijo, envío gratis), valor, y condiciones de uso.
7. Los códigos postales, formatos de teléfono y formatos de dirección DEBEN ser válidos para el país seleccionado.
8. Para datos de tipo "user-registration": los emails DEBEN seguir este formato: un nombre corto y común del país en minúsculas (sin apellidos, sin números, sin puntos, sin guiones) seguido de un dominio de prueba QA. Rota los dominios en este orden: @qa, @qa1, @qa2, @qa.1, @qa.2, @qa.3, @qa.4, etc. Ejemplos: maria@qa, jean@qa1, luca@qa2, anna@qa.1, pedro@qa.2.
9. Para datos de tipo "user-registration": la contraseña SIEMPRE debe ser exactamente "Test1234" para TODOS los registros generados. Sin excepciones ni variaciones.

ESQUEMA JSON POR TIPO DE DATO:

Para "shipping-address":
[{"nombre":"...","apellidos":"...","direccion":"...","codigoPostal":"...","ciudad":"...","provincia":"...","pais":"...","telefono":"..."}]

Para "billing-data":
[{"nombre":"...","apellidos":"...","documentoId":"...","tipoDocumento":"...","direccion":"...","codigoPostal":"...","ciudad":"...","provincia":"...","pais":"...","telefono":"...","email":"..."}]

Para "user-registration":
[{"nombre":"...","apellidos":"...","email":"nombre@qa","password":"Test1234","telefono":"...","fechaNacimiento":"...","genero":"..."}]

Para "payment-cards":
[{"tipo":"...","numero":"...","titular":"...","expiracion":"...","cvv":"..."}]

Para "promo-codes":
[{"codigo":"...","tipo":"...","valor":"...","condiciones":"...","validoHasta":"..."}]

IMPORTANTE: Devuelve SOLO el JSON array. Nada más.`;

export const BUG_REPORT_PROMPT = `Eres un QA Engineer senior especializado en ecommerce de moda (Bershka, grupo Inditex). Tu tarea es generar un bug report profesional y detallado en formato Jira wiki a partir de una descripción informal de un defecto.

CONTEXTO DEL PROYECTO:
- Ecommerce: Bershka (www.bershka.com)
- Multi-mercado europeo con particularidades por país (impuestos, métodos de pago, idiomas, divisas)
- Plataformas: Web Desktop, Web Mobile, App Android (APK), App iOS (IPA)
- Entorno de pruebas web: https://localhost:3443/
- Flujos críticos: catálogo/navegación, PDP (ficha de producto), tallas/stock, carrito/minicesta, checkout multi-step, pagos (Adyen), cuenta de usuario, wishlist, store finder, newsletter, SEO, deep links, push notifications (app)

REGLAS:
1. Todo el contenido DEBE estar en ESPAÑOL.
2. Usa EXACTAMENTE el formato Jira wiki markup que se indica abajo. No te desvíes de la estructura.
3. Genera pasos de reproducción detallados, numerados con #, específicos y basados en la descripción proporcionada.
4. Si la plataforma es App Android o App iOS, usa lenguaje de interacción móvil/app: "tap en", "swipe", "navegar al tab de", "pull to refresh", etc.
5. Si la plataforma es Web, usa lenguaje web: "clic en", "hover sobre", "scroll hasta", "navegar a", etc.
6. En la sección de Criterios de aceptación, genera un criterio Dado/Cuando/Entonces coherente con el bug descrito. El ResultadoQA debe ser (x) ya que es un bug. La Fecha debe ser la fecha actual. El campo "Validado por:" debe quedar como "QA Team".
7. Si se proporciona contexto de un ticket de Jira relacionado, úsalo para enriquecer la descripción, precondiciones y criterios.
8. El título debe ser conciso y descriptivo. La categoría entre corchetes debe ser el ÁREA FUNCIONAL real del ecommerce donde ocurre el bug. Usa SOLO estas categorías: [Home], [Catálogo], [Búsqueda], [PDP], [Tallas], [Carrito], [Checkout], [Pagos], [Mi Cuenta], [Wishlist], [Newsletter], [Store Finder], [Login/Registro], [Navegación], [SEO], [Push Notifications], [Deep Links], [General]. Elige la que mejor corresponda al bug descrito. NUNCA inventes categorías.

FORMATO DE SALIDA — usa EXACTAMENTE esta estructura, rellenando cada sección:

[Categoría del área funcional — ver lista en regla 8] - Descripción breve y precisa del defecto

{panel:title=*DESCRIPCIÓN:*}
- Entorno/País: [Mercado proporcionado por el usuario]
- Versión: [Versión de la app si es app, o "Web" si es web + navegador]
- Plataforma: [Web Desktop / Web Mobile / App Android / App iOS]
- Dispositivo: [Si aplica, dispositivo proporcionado]
- URL: [Si aplica, URL proporcionada]
[Descripción detallada del bug en 2-3 frases]
{panel}
{panel:title=*PRECONDICION:*}
[Lista de precondiciones necesarias para reproducir el bug, cada una en una línea separada con - ]
{panel}
{panel:title=*PASOS DE REPRODUCCIÓN:*}
# [Paso 1 detallado]
# [Paso 2 detallado]
# [Paso 3 detallado]
# [Continuar con todos los pasos necesarios]
{panel}
{panel:title=*RESULTADO ACTUAL*}
[Descripción precisa de lo que ocurre actualmente — el comportamiento defectuoso]
{panel}
{panel:title=*RESULTADO ESPERADO*}
[Descripción precisa de lo que debería ocurrir correctamente]
{panel}
{panel:title=*Criterios aceptación*}
{quote}
*Dado* [contexto/estado inicial relevante al bug]
*Cuando* [acción que desencadena el bug]
*Entonces* [comportamiento esperado correcto]
*ResultadoQA:* (x)
*Pais/Entorno:* [Mercado y plataforma]
*Fecha:* [Fecha actual en formato YYYY-MM-DD]
*Evidencia:* [Dejar como "Adjuntar captura de pantalla"]
*Validado por:* QA Team
{quote}
{panel}

IMPORTANTE: 
- Devuelve SOLO el título seguido del contenido en formato Jira wiki. 
- No añadas explicaciones, comentarios ni texto fuera de la estructura.
- No uses markdown. Solo Jira wiki markup.
- No envuelvas la respuesta en un panel adicional externo.
- El título va ANTES del primer {panel}, como texto plano (no dentro de un panel).`;
