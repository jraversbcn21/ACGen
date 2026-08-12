// Resalte compartido de coincidencias de búsqueda (Regression Tracker).
// El mismo estilo de <mark> en todos los puntos de uso; el amarillo UA
// por defecto no casa con el tema.
export const MARK_STYLE: React.CSSProperties = {
  background: 'var(--accent)', color: 'var(--surface)', borderRadius: 2, padding: '0 1px',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsMatch(text: string, needle: string): boolean {
  const n = needle.trim().toLowerCase();
  return n !== '' && text.toLowerCase().includes(n);
}

export function highlightMatches(text: string, needle: string): React.ReactNode[] {
  const n = needle.trim();
  if (!n) return [text];
  const re = new RegExp(escapeRegExp(n), 'gi');
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<mark key={key++} style={MARK_STYLE}>{m[0]}</mark>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length ? nodes : [text];
}
