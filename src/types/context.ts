export interface ProjectProfile {
  domain: string;
  productType: string;
  markets: string;
  terminology: string;
  tone: string;
  /** Nombre del entorno donde se valida (ej. "Pro", "UAT", "Staging"). */
  environments: string;
  /** Código del mercado principal usado en bug reports (ej. "ES"). */
  mainMarket: string;
  /** Áreas/páginas del producto, separadas por comas, para casos de prueba. */
  siteMap: string;
  /** Idioma en el que el LLM redacta los artefactos. */
  outputLanguage: string;
  /** Convenciones de datos de prueba (tarjetas del PSP, emails QA, passwords...). */
  testDataConventions: string;
}

export const DEFAULT_PROFILE: ProjectProfile = {
  domain: 'Ecommerce de moda multi-mercado',
  productType: 'Web + Apps nativas (Android APK, iOS IPA)',
  markets: 'Europa (ES, PT, FR, IT, DE, UK, etc.)',
  terminology: 'productos, SKUs, tallas, checkout, pasarela de pago, cupones',
  tone: 'Profesional y estructurado',
  environments: 'Pro',
  mainMarket: 'ES',
  siteMap: 'Home, Footer, Menú/Navegación, Buscador, Parrillas de productos, Filtros, PDP (Detalle de Producto), Cesta y Checkout',
  outputLanguage: 'español',
  testDataConventions: `5. Para tarjetas de pago, usa EXCLUSIVAMENTE números de tarjeta de prueba estándar de Adyen (el PSP utilizado):
   - Visa: 4111 1111 1111 1111
   - Mastercard: 5500 0000 0000 0004
   - Amex: 3700 0000 0000 002
   - Usar fecha de expiración futura (03/2030) y CVV genérico (737 para Amex, 123 para el resto)
   - Variar el tipo de tarjeta entre registros
6. Para cupones/códigos promocionales, genera códigos con formato realista (WELCOME10, SUMMER2026, FREESHIP, MODA20, etc.) e indica tipo (porcentaje, monto fijo, envío gratis), valor, y condiciones de uso.
7. Los códigos postales, formatos de teléfono y formatos de dirección DEBEN ser válidos para el país seleccionado.
8. Para datos de tipo "user-registration": los emails DEBEN seguir este formato: un nombre corto y común del país en minúsculas (sin apellidos, sin números, sin puntos, sin guiones) seguido de un dominio de prueba QA. Rota los dominios en este orden: @qa, @qa1, @qa2, @qa.1, @qa.2, @qa.3, @qa.4, etc. Ejemplos: maria@qa, jean@qa1, luca@qa2, anna@qa.1, pedro@qa.2.
9. Para datos de tipo "user-registration": la contraseña SIEMPRE debe ser exactamente "Test1234" para TODOS los registros generados. Sin excepciones ni variaciones.`,
};
