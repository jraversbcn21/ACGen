// Regla unica de "esto es un ticket y esta es su URL". Vivia dentro de
// TrackerGrid; se extrae porque el panel de actividad del Sprint la necesita
// igual y duplicarla dejaria dos definiciones de que cuenta como ticket.
export const TICKET_KEY_PATTERN = /^([A-Z]+-\d+)\b/;
export const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

export function jiraTicketUrl(baseUrl: string, value: string): string | null {
  if (!ABSOLUTE_HTTP_URL.test(baseUrl)) return null;
  const m = value.match(TICKET_KEY_PATTERN);
  return m ? `${baseUrl}/browse/${m[1]}` : null;
}

/**
 * Las fechas del grid las teclea el usuario, asi que no hay un formato
 * garantizado: se aceptan DD/MM/YYYY, DD-MM-YYYY y YYYY-MM-DD. Lo que no
 * parsea devuelve null y el llamante lo ordena al final en vez de inventarse
 * una fecha (un NaN silencioso colaria filas viejas como recientes).
 */
export function parseCellDate(value: string): number | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  return null;
}
