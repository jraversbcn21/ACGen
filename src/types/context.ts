export interface ProjectProfile {
  domain: string;
  productType: string;
  markets: string;
  terminology: string;
  tone: string;
}

export const DEFAULT_PROFILE: ProjectProfile = {
  domain: 'Ecommerce de moda multi-mercado',
  productType: 'Web + Apps nativas (Android APK, iOS IPA)',
  markets: 'Europa (ES, PT, FR, IT, DE, UK, etc.)',
  terminology: 'productos, SKUs, tallas, checkout, pasarela de pago, cupones',
  tone: 'Profesional y estructurado',
};
