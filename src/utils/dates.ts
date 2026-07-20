const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const LOCALES: Record<'es' | 'en', string> = { es: 'es-ES', en: 'en-US' };

/**
 * Formats an 'YYYY-MM-DD' date for display in the app's current language.
 * Parses the parts as a LOCAL date — new Date('YYYY-MM-DD') would parse UTC
 * midnight and show the previous day in negative-offset timezones.
 */
export function formatDate(isoDate: string | null, lang: 'es' | 'en'): string {
  if (!isoDate) return '—';
  const m = isoDate.match(ISO_DATE_PATTERN);
  if (!m) return '—';
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return date.toLocaleDateString(LOCALES[lang], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Today's LOCAL calendar day as 'YYYY-MM-DD'. toISOString() would give the
 * UTC day, which in negative-offset timezones is already tomorrow at night.
 */
export function localTodayISO(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
