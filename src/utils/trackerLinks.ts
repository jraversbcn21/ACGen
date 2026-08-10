// Celda-enlace en modo url: "https://..." o "Nombre - https://...".
// Compartido por TrackerGrid (Sprint/Regression) y la tabla de tickets.
export const URL_CELL_PATTERN = /^(?:(.+?)\s*-\s*)?(https?:\/\/\S+)$/;

export interface UrlCellParts {
  name: string | null;
  url: string;
}

export function parseUrlCell(value: string): UrlCellParts | null {
  const m = value.match(URL_CELL_PATTERN);
  if (!m) return null;
  return { name: m[1] ?? null, url: m[2] };
}
