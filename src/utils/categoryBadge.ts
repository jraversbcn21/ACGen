/**
 * Color de la etiqueta de cada categoria de caso limite.
 *
 * Las clases deben existir en App.css: el mapa apuntaba a `badge-warning` y
 * `badge-danger`, que nunca se definieron, asi que Concurrencia y Permisos y
 * roles se renderizaban sin color. `categoryBadge.test.ts` lee App.css para
 * que no pueda repetirse.
 */
export const CATEGORY_BADGES: Record<string, string> = {
  'valores frontera': 'badge-high',
  'estados vacios': 'badge-medium',
  'concurrencia': 'badge-medium',
  'internacionalizacion (i18n)': 'badge-info',
  'internacionalizacion': 'badge-info',
  'permisos y roles': 'badge-high',
  'red y conectividad': 'badge-medium',
};

export const FALLBACK_BADGE = 'badge-medium';

/**
 * El modelo devuelve la categoria como texto libre, asi que llega con tildes,
 * caja y espaciado variables ("Estados vacíos" frente a la clave sin tilde).
 * Normalizamos ambos lados en vez de confiar en una coincidencia exacta.
 */
function normalizar(categoria: string): string {
  return categoria
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

export function categoryBadge(categoria: string): string {
  return CATEGORY_BADGES[normalizar(categoria)] ?? FALLBACK_BADGE;
}
