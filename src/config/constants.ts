export const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const PROXY_URL = '/api';

export const HARDCODED_PROMPT = `Based on all the information provided, read it, analyze it, and generate one or more acceptance criteria as you consider necessary. Do not be overly detailed; generate only the most important and general criteria. The criteria can be one or several depending on the scope of the information provided. The criteria must be written from the perspective of an end user going through the process, not from a technical point of view. Describe the steps and conditions as if a regular person were navigating or interacting with the system, using natural and everyday language, avoiding technical or implementation-specific terms.

Always respond using exactly this format and no other:

{panel:title=Criterios aceptación}
{quote}*Dado*
*Cuando*
*Entonces*
*ResultadoQA:* (/)/(x)
*Pais/Entorno:* [País]/Pro
*Fecha:* [Fecha proporcionada en formato DD/MM/YYYY]
*Evidencia:*
*Validado por:* Jorge-QA
{quote}{panel}

REGLAS ADICIONALES:
- En el campo *Pais/Entorno:*, el entorno siempre debe ser "Pro". Formato: [País del contexto]/Pro. Ejemplo: España/Pro, México/Pro, Francia/Pro.
- En el campo *Fecha:*, usa EXACTAMENTE la fecha proporcionada en el mensaje del usuario. No inventes ni generes otra fecha.
- En el campo *Validado por:*, siempre debe ser exactamente "Jorge-QA". Sin excepciones.
- En el campo *ResultadoQA:*, siempre debe aparecer exactamente "(/)/(x)". Sin excepciones ni variaciones.

If more than one acceptance criterion is needed, repeat the full block above for each one, separated by a blank line. Do not add any text outside of these blocks.`;

export const REQUIRED_MARKERS = [
  '{panel:title=Criterios aceptación}',
  '{quote}',
  '*Dado*',
  '*Cuando*',
  '*Entonces*',
];

export const TESTCASE_PROMPT = `Eres un ingeniero QA generando casos de prueba para un sitio web de ecommerce de moda. Basándote en la instrucción del usuario, genera casos de prueba exhaustivos y realistas que cubran el área o flujo solicitado.

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

export const AVAILABLE_MODELS = [
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
  THEME: 'acgen_theme',
  CRITERIA_HISTORY: 'acgen_criteria_history',
  BUG_HISTORY: 'acgen_bug_history',
  SPRINT_COL_WIDTHS: 'acgen_sprint_col_widths',
} as const;

export const TEMPERATURE = 0.2;

export type ViewType = 'landing' | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'sprinttracker';

export const JIRA_URL_REGEX = /https?:\/\/(?:[^/]+\/)?(?:jira\/)?browse\/([A-Z]+-\d+)/i;

export const SUPPORTED_MARKETS = [
  { code: 'AL', label: 'Albania', currency: 'ALL', locale: 'sq' },
  { code: 'DZ', label: 'Algérie', currency: 'DZD', locale: 'fr' },
  { code: 'AD', label: 'Andorra', currency: '€', locale: 'ca' },
  { code: 'AM', label: 'Armenia', currency: 'AMD', locale: 'hy' },
  { code: 'AT', label: 'Austria', currency: '€', locale: 'de' },
  { code: 'AZ', label: 'Azerbaijan', currency: 'AZN', locale: 'az' },
  { code: 'BH', label: 'Bahrein', currency: 'BHD', locale: 'ar' },
  { code: 'BY', label: 'Belarus / Беарусь', currency: 'BYN', locale: 'be' },
  { code: 'BE', label: 'Belgium', currency: '€', locale: 'fr' },
  { code: 'BA', label: 'Bosnia and Herzegovina', currency: 'BAM', locale: 'bs' },
  { code: 'BG', label: 'Bulgaria', currency: 'BGN', locale: 'bg' },
  { code: 'TW', label: 'Taiwan, China / 中国台湾', currency: 'TWD', locale: 'zh' },
  { code: 'HK', label: 'Hong Kong SAR / 香港特別行政區', currency: 'HKD', locale: 'zh' },
  { code: 'AS', label: 'American Samoa', currency: 'USD', locale: 'en' },
  { code: 'AO', label: 'Angola', currency: 'AOA', locale: 'pt' },
  { code: 'AI', label: 'Anguilla', currency: 'XCD', locale: 'en' },
  { code: 'AG', label: 'Antigua and Barbuda', currency: 'XCD', locale: 'en' },
  { code: 'AR', label: 'Argentina', currency: 'ARS', locale: 'es' },
  { code: 'AW', label: 'Aruba', currency: 'AWG', locale: 'nl' },
  { code: 'AU', label: 'Australia', currency: 'AUD', locale: 'en' },
  { code: 'BS', label: 'Bahamas', currency: 'BSD', locale: 'en' },
  { code: 'BD', label: 'Bangladesh', currency: 'BDT', locale: 'bn' },
  { code: 'BB', label: 'Barbados', currency: 'BBD', locale: 'en' },
  { code: 'BZ', label: 'Belize', currency: 'BZD', locale: 'en' },
  { code: 'BJ', label: 'Benin', currency: 'XOF', locale: 'fr' },
  { code: 'BM', label: 'Bermuda', currency: 'BMD', locale: 'en' },
  { code: 'BT', label: 'Bhutan', currency: 'BTN', locale: 'dz' },
  { code: 'BO', label: 'Bolivia', currency: 'BOB', locale: 'es' },
  { code: 'BQ', label: 'Bonaire, St. Eustatius y Saba', currency: 'USD', locale: 'nl' },
  { code: 'BW', label: 'Botswana', currency: 'BWP', locale: 'en' },
  { code: 'BR', label: 'Brasil', currency: 'BRL', locale: 'pt' },
  { code: 'BN', label: 'Brunei', currency: 'BND', locale: 'ms' },
  { code: 'BF', label: 'Burkina Faso', currency: 'XOF', locale: 'fr' },
  { code: 'KH', label: 'Cambodia', currency: 'KHR', locale: 'km' },
  { code: 'CM', label: 'Cameroon', currency: 'XAF', locale: 'fr' },
  { code: 'CA', label: 'Canada', currency: 'CAD', locale: 'en' },
  { code: 'CV', label: 'Cape Verde', currency: 'CVE', locale: 'pt' },
  { code: 'KY', label: 'Cayman Islands', currency: 'KYD', locale: 'en' },
  { code: 'TD', label: 'Chad', currency: 'XAF', locale: 'fr' },
  { code: 'CL', label: 'Chile', currency: 'CLP', locale: 'es' },
  { code: 'CX', label: 'Christmas Island', currency: 'AUD', locale: 'en' },
  { code: 'CC', label: 'Cocos Islands', currency: 'AUD', locale: 'en' },
  { code: 'CO', label: 'Colombia', currency: 'COP', locale: 'es' },
  { code: 'KM', label: 'Comoros', currency: 'KMF', locale: 'fr' },
  { code: 'CG', label: 'Congo', currency: 'XAF', locale: 'fr' },
  { code: 'CK', label: 'Cook Islands', currency: 'NZD', locale: 'en' },
  { code: 'CR', label: 'Costa Rica', currency: 'CRC', locale: 'es' },
  { code: 'CI', label: "Cote d'Ivoire", currency: 'XOF', locale: 'fr' },
  { code: 'HR', label: 'Croatia', currency: '€', locale: 'hr' },
  { code: 'CW', label: 'Curacao', currency: 'ANG', locale: 'nl' },
  { code: 'CY', label: 'Cyprus / Κύπρος', currency: '€', locale: 'el' },
  { code: 'CZ', label: 'Czech Republic', currency: 'CZK', locale: 'cs' },
  { code: 'DK', label: 'Denmark', currency: 'DKK', locale: 'da' },
  { code: 'DJ', label: 'Djibouti', currency: 'DJF', locale: 'fr' },
  { code: 'DM', label: 'Dominica', currency: 'XCD', locale: 'en' },
  { code: 'DO', label: 'Dominican Republic', currency: 'DOP', locale: 'es' },
  { code: 'TL', label: 'East Timor', currency: 'USD', locale: 'pt' },
  { code: 'EC', label: 'Ecuador', currency: 'USD', locale: 'es' },
  { code: 'EG', label: 'Egypt', currency: 'EGP', locale: 'ar' },
  { code: 'SV', label: 'El Salvador', currency: 'USD', locale: 'es' },
  { code: 'GQ', label: 'Equatorial Guinea', currency: 'XAF', locale: 'es' },
  { code: 'ER', label: 'Eritrea', currency: 'ERN', locale: 'ti' },
  { code: 'ES', label: 'España', currency: '€', locale: 'es' },
  { code: 'ES-CN', label: 'España - Islas Canarias', currency: '€', locale: 'es' },
  { code: 'EE', label: 'Estonia', currency: '€', locale: 'et' },
  { code: 'ET', label: 'Ethiopia', currency: 'ETB', locale: 'am' },
  { code: 'FO', label: 'Faroe Islands', currency: 'DKK', locale: 'fo' },
  { code: 'FJ', label: 'Fiji', currency: 'FJD', locale: 'en' },
  { code: 'FI', label: 'Finland', currency: '€', locale: 'fi' },
  { code: 'FR', label: 'France', currency: '€', locale: 'fr' },
  { code: 'GF', label: 'French Guiana', currency: '€', locale: 'fr' },
  { code: 'PF', label: 'French Polynesia', currency: 'XPF', locale: 'fr' },
  { code: 'GA', label: 'Gabon', currency: 'XAF', locale: 'fr' },
  { code: 'GM', label: 'Gambia', currency: 'GMD', locale: 'en' },
  { code: 'GE', label: 'Georgia', currency: 'GEL', locale: 'ka' },
  { code: 'DE', label: 'Germany', currency: '€', locale: 'de' },
  { code: 'GH', label: 'Ghana', currency: 'GHS', locale: 'en' },
  { code: 'GR', label: 'Greece', currency: '€', locale: 'el' },
  { code: 'GL', label: 'Greenland', currency: 'DKK', locale: 'kl' },
  { code: 'GD', label: 'Grenada', currency: 'XCD', locale: 'en' },
  { code: 'GP', label: 'Guadeloupe', currency: '€', locale: 'fr' },
  { code: 'GU', label: 'Guam', currency: 'USD', locale: 'en' },
  { code: 'GT', label: 'Guatemala', currency: 'GTQ', locale: 'es' },
  { code: 'GG', label: 'Guernsey', currency: 'GBP', locale: 'en' },
  { code: 'GY', label: 'Guyana', currency: 'GYD', locale: 'en' },
  { code: 'HT', label: 'Haiti', currency: 'HTG', locale: 'fr' },
  { code: 'VA', label: 'Holy See', currency: '€', locale: 'it' },
  { code: 'HN', label: 'Honduras', currency: 'HNL', locale: 'es' },
  { code: 'HU', label: 'Hungary', currency: 'HUF', locale: 'hu' },
  { code: 'IS', label: 'Iceland', currency: 'ISK', locale: 'is' },
  { code: 'IN', label: 'India', currency: 'INR', locale: 'hi' },
  { code: 'ID', label: 'Indonesia', currency: 'IDR', locale: 'id' },
  { code: 'IE', label: 'Ireland', currency: '€', locale: 'en' },
  { code: 'IL', label: 'Israel', currency: 'ILS', locale: 'he' },
  { code: 'IT', label: 'Italy', currency: '€', locale: 'it' },
  { code: 'IQ', label: 'Iraq', currency: 'IQD', locale: 'ar' },
  { code: 'JM', label: 'Jamaica', currency: 'JMD', locale: 'en' },
  { code: 'JP', label: 'Japan', currency: 'JPY', locale: 'ja' },
  { code: 'JE', label: 'Jersey', currency: 'GBP', locale: 'en' },
  { code: 'JO', label: 'Jordan', currency: 'JOD', locale: 'ar' },
  { code: 'KZ', label: 'Казахстан / Kazakhstan', currency: 'KZT', locale: 'kk' },
  { code: 'KE', label: 'Kenya', currency: 'KES', locale: 'sw' },
  { code: 'KI', label: 'Kiribati', currency: 'AUD', locale: 'en' },
  { code: 'XK', label: 'Kosovo', currency: '€', locale: 'sq' },
  { code: 'KW', label: 'Kuwait', currency: 'KWD', locale: 'ar' },
  { code: 'KG', label: 'Kyrgyzstan', currency: 'KGS', locale: 'ky' },
  { code: 'LA', label: 'Laos', currency: 'LAK', locale: 'lo' },
  { code: 'LV', label: 'Latvia', currency: '€', locale: 'lv' },
  { code: 'LB', label: 'Lebanon', currency: 'LBP', locale: 'ar' },
  { code: 'LS', label: 'Lesotho', currency: 'LSL', locale: 'en' },
  { code: 'LR', label: 'Liberia', currency: 'LRD', locale: 'en' },
  { code: 'LT', label: 'Lithuania', currency: '€', locale: 'lt' },
  { code: 'LU', label: 'Luxembourg', currency: '€', locale: 'fr' },
  { code: 'MO', label: 'Macau SAR / 澳門特別行政區', currency: 'MOP', locale: 'zh' },
  { code: 'MK', label: 'Republic of North Macedonia / Република Северна Македонија', currency: 'MKD', locale: 'mk' },
  { code: 'MG', label: 'Madagascar', currency: 'MGA', locale: 'mg' },
  { code: 'MW', label: 'Malawi', currency: 'MWK', locale: 'en' },
  { code: 'MY', label: 'Malaysia', currency: 'MYR', locale: 'ms' },
  { code: 'MV', label: 'Maldives', currency: 'MVR', locale: 'dv' },
  { code: 'ML', label: 'Mali', currency: 'XOF', locale: 'fr' },
  { code: 'MT', label: 'Malta', currency: '€', locale: 'mt' },
  { code: 'MA', label: 'Maroc', currency: 'MAD', locale: 'fr' },
  { code: 'MH', label: 'Marshall Islands', currency: 'USD', locale: 'en' },
  { code: 'MQ', label: 'Martinique', currency: '€', locale: 'fr' },
  { code: 'MR', label: 'Mauritania', currency: 'MRU', locale: 'ar' },
  { code: 'MU', label: 'Mauritius', currency: 'MUR', locale: 'en' },
  { code: 'YT', label: 'Mayotte', currency: '€', locale: 'fr' },
  { code: 'MX', label: 'Mexico', currency: 'MXN', locale: 'es' },
  { code: 'FM', label: 'Micronesia', currency: 'USD', locale: 'en' },
  { code: 'MC', label: 'Monaco', currency: '€', locale: 'fr' },
  { code: 'MN', label: 'Mongolia', currency: 'MNT', locale: 'mn' },
  { code: 'ME', label: 'Montenegro / Crna Gora', currency: '€', locale: 'sr' },
  { code: 'MS', label: 'Montserrat', currency: 'XCD', locale: 'en' },
  { code: 'MZ', label: 'Mozambique', currency: 'MZN', locale: 'pt' },
  { code: 'NA', label: 'Namibia', currency: 'NAD', locale: 'en' },
  { code: 'NR', label: 'Nauru', currency: 'AUD', locale: 'en' },
  { code: 'NP', label: 'Nepal', currency: 'NPR', locale: 'ne' },
  { code: 'NL', label: 'Netherlands', currency: '€', locale: 'nl' },
  { code: 'NC', label: 'New Caledonia', currency: 'XPF', locale: 'fr' },
  { code: 'NZ', label: 'New Zealand', currency: 'NZD', locale: 'en' },
  { code: 'NI', label: 'Nicaragua', currency: 'NIO', locale: 'es' },
  { code: 'NE', label: 'Niger', currency: 'XOF', locale: 'fr' },
  { code: 'NG', label: 'Nigeria', currency: 'NGN', locale: 'en' },
  { code: 'NU', label: 'Niue', currency: 'NZD', locale: 'en' },
  { code: 'NF', label: 'Norfolk Island', currency: 'AUD', locale: 'en' },
  { code: 'MP', label: 'Northern Mariana Islands', currency: 'USD', locale: 'en' },
  { code: 'NO', label: 'Norway', currency: 'NOK', locale: 'no' },
  { code: 'OM', label: 'Oman', currency: 'OMR', locale: 'ar' },
  { code: 'PK', label: 'Pakistan', currency: 'PKR', locale: 'ur' },
  { code: 'PW', label: 'Palau', currency: 'USD', locale: 'en' },
  { code: 'PA', label: 'Panamá', currency: 'PAB', locale: 'es' },
  { code: 'PG', label: 'Papua New Guinea', currency: 'PGK', locale: 'en' },
  { code: 'PY', label: 'Paraguay', currency: 'PYG', locale: 'es' },
  { code: 'PE', label: 'Peru', currency: 'PEN', locale: 'es' },
  { code: 'PH', label: 'Philippines', currency: 'PHP', locale: 'en' },
  { code: 'PL', label: 'Poland', currency: 'PLN', locale: 'pl' },
  { code: 'PT', label: 'Portugal', currency: '€', locale: 'pt' },
  { code: 'PR', label: 'Puerto Rico', currency: 'USD', locale: 'es' },
  { code: 'QA', label: 'Qatar', currency: 'QAR', locale: 'ar' },
  { code: 'RE', label: 'Reunion', currency: '€', locale: 'fr' },
  { code: 'RO', label: 'Romania', currency: 'RON', locale: 'ro' },
  { code: 'RW', label: 'Rwanda', currency: 'RWF', locale: 'rw' },
  { code: 'SH', label: 'Saint Helena', currency: 'SHP', locale: 'en' },
  { code: 'KN', label: 'Saint Kitts and Nevis', currency: 'XCD', locale: 'en' },
  { code: 'LC', label: 'Saint Lucia', currency: 'XCD', locale: 'en' },
  { code: 'MF', label: 'Sint Maarten (French part)', currency: '€', locale: 'fr' },
  { code: 'PM', label: 'Saint Pierre and Miquelon', currency: '€', locale: 'fr' },
  { code: 'VC', label: 'Saint Vincent and the Grenadines', currency: 'XCD', locale: 'en' },
  { code: 'WS', label: 'Samoa', currency: 'WST', locale: 'en' },
  { code: 'SM', label: 'San Marino', currency: '€', locale: 'it' },
  { code: 'ST', label: 'Sao Tome and Principe', currency: 'STN', locale: 'pt' },
  { code: 'SA', label: 'Saudi Arabia', currency: 'SAR', locale: 'ar' },
  { code: 'SN', label: 'Senegal', currency: 'XOF', locale: 'fr' },
  { code: 'RS', label: 'Serbia / Srbija', currency: 'RSD', locale: 'sr' },
  { code: 'SC', label: 'Seychelles', currency: 'SCR', locale: 'en' },
  { code: 'SL', label: 'Sierra Leone', currency: 'SLE', locale: 'en' },
  { code: 'SG', label: 'Singapore', currency: 'SGD', locale: 'en' },
  { code: 'SK', label: 'Slovakia', currency: '€', locale: 'sk' },
  { code: 'SI', label: 'Slovenia', currency: '€', locale: 'sl' },
  { code: 'SB', label: 'Solomon Islands', currency: 'SBD', locale: 'en' },
  { code: 'ZA', label: 'South Africa', currency: 'ZAR', locale: 'en' },
  { code: 'GS', label: 'South Georgia and the South Sandwich Islands', currency: 'GBP', locale: 'en' },
  { code: 'KR', label: 'South Korea', currency: 'KRW', locale: 'ko' },
  { code: 'LK', label: 'Sri Lanka', currency: 'LKR', locale: 'si' },
  { code: 'BL', label: 'St. Barthelemy', currency: '€', locale: 'fr' },
  { code: 'SX', label: 'Sint Maarten (Dutch part)', currency: 'ANG', locale: 'nl' },
  { code: 'SR', label: 'Suriname', currency: 'SRD', locale: 'nl' },
  { code: 'SZ', label: 'Swaziland', currency: 'SZL', locale: 'en' },
  { code: 'SE', label: 'Sweden', currency: 'SEK', locale: 'sv' },
  { code: 'CH', label: 'Switzerland', currency: 'CHF', locale: 'de' },
  { code: 'TZ', label: 'Tanzania', currency: 'TZS', locale: 'sw' },
  { code: 'TH', label: 'Thailand', currency: 'THB', locale: 'th' },
  { code: 'TG', label: 'Togo', currency: 'XOF', locale: 'fr' },
  { code: 'TK', label: 'Tokelau', currency: 'NZD', locale: 'en' },
  { code: 'TO', label: 'Tonga', currency: 'TOP', locale: 'en' },
  { code: 'TT', label: 'Trinidad and Tobago', currency: 'TTD', locale: 'en' },
  { code: 'TN', label: 'Tunisia', currency: 'TND', locale: 'ar' },
  { code: 'TR', label: 'Turkey', currency: 'TRY', locale: 'tr' },
  { code: 'TC', label: 'Turks and Caicos Islands', currency: 'USD', locale: 'en' },
  { code: 'TV', label: 'Tuvalu', currency: 'AUD', locale: 'en' },
  { code: 'UG', label: 'Uganda', currency: 'UGX', locale: 'en' },
  { code: 'UA', label: 'Ukraine', currency: 'UAH', locale: 'uk' },
  { code: 'AE', label: 'United Arab Emirates', currency: 'AED', locale: 'ar' },
  { code: 'GB', label: 'United Kingdom', currency: '£', locale: 'en' },
  { code: 'US', label: 'United States', currency: 'USD', locale: 'en' },
  { code: 'UY', label: 'Uruguay', currency: 'UYU', locale: 'es' },
  { code: 'UZ', label: 'Uzbekistan', currency: 'UZS', locale: 'uz' },
  { code: 'VU', label: 'Vanuatu', currency: 'VUV', locale: 'en' },
  { code: 'VE', label: 'Venezuela', currency: 'VES', locale: 'es' },
  { code: 'VN', label: 'Vietnam', currency: 'VND', locale: 'vi' },
  { code: 'VG', label: 'Virgin Islands, British', currency: 'USD', locale: 'en' },
  { code: 'VI', label: 'Virgin Islands, US', currency: 'USD', locale: 'en' },
  { code: 'WF', label: 'Wallis and Futuna', currency: 'XPF', locale: 'fr' },
  { code: 'ZM', label: 'Zambia', currency: 'ZMW', locale: 'en' },
  { code: 'ZW', label: 'Zimbabwe', currency: 'ZWL', locale: 'en' },
  { code: 'AX', label: 'Åland Islands', currency: '€', locale: 'sv' },
  { code: 'WW', label: 'Worldwide', currency: 'USD', locale: 'en' },
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

export const TEST_DATA_PROMPT = `Eres un QA Engineer senior especializado en ecommerce de moda. Tu tarea es generar datos de prueba realistas y válidos para testing manual.

CONTEXTO:
- Ecommerce de moda, multi-mercado europeo
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
6. Para cupones/códigos promocionales, genera códigos con formato realista (WELCOME10, SUMMER2026, FREESHIP, MODA20, etc.) e indica tipo (porcentaje, monto fijo, envío gratis), valor, y condiciones de uso.
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

export const BUG_REPORT_PROMPT = `Eres un QA Engineer senior especializado en ecommerce de moda. Tu tarea es generar un bug report profesional y detallado en formato Jira wiki a partir de una descripción informal de un defecto.

CONTEXTO DEL PROYECTO:
- Ecommerce de moda online
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
6. En la sección de Criterios de aceptación, genera un criterio Dado/Cuando/Entonces coherente con el bug descrito. El ResultadoQA debe ser (/)/(x) ya que es un bug. La Fecha debe ser la fecha actual en formato DD-MM-YYYY. El campo "Validado por:" debe quedar como "Jorge-QA".
7. Si se proporciona contexto de un ticket de Jira relacionado, úsalo para enriquecer la descripción, precondiciones y criterios.

FORMATO DE SALIDA — usa EXACTAMENTE esta estructura, rellenando cada sección:

{panel:title=DESCRIPCIÓN:}
- Entorno/País: [Market from form]
- Versión: [App version if app platform, or "Web - Browser" if web platform]
{panel}
{panel:title=PRECONDICION:}
[Preconditions needed to reproduce the bug, each on its own line with - prefix]
{panel}
{panel:title=PASOS DE REPRODUCCIÓN:}
# [Paso 1 detallado]
# [Paso 2 detallado]
# [Paso 3 detallado]
# [Continuar con todos los pasos necesarios]
{panel}
{panel:title=RESULTADO ACTUAL}
[What actually happens — the defective behavior]
{panel}
{panel:title=RESULTADO ESPERADO}
[What should happen correctly]
{panel}
{panel:title=Criterios aceptación}
{quote}
Dado [relevant initial context/state]
Cuando [action that triggers the bug]
Entonces [expected correct behavior]
ResultadoQA: (/)/(x)
Pais/Entorno: [Market and platform]
Fecha: [Current date DD-MM-YYYY]
Evidencia: Adjuntar captura de pantalla
Validado por: Jorge-QA
{quote}
{panel}

IMPORTANTE:
- Output must start directly with {panel:title=DESCRIPCIÓN:}. No title, no text before the first panel.
- Do NOT add any content outside of the panel structure.
- Do NOT add extra fields to the DESCRIPCIÓN panel beyond Entorno/País and Versión.
- Do NOT add a descriptive paragraph inside DESCRIPCIÓN.
- Do NOT use markdown. Only Jira wiki markup.`;
