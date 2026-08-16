// src/services/anonymizer.ts

type SubMap = Record<string, string>; // placeholder -> original

const PATTERNS: { regex: RegExp; prefix: string }[] = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, prefix: 'EMAIL' },
  { regex: /https?:\/\/[^\s)]+/g, prefix: 'URL' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, prefix: 'IP' },
  { regex: /\b[A-Z]{2,}-\d{3,}\b/g, prefix: 'TICKET' },
  // 7+ DIGITS (not chars), starting at +/digit and ending on a digit: separator
  // runs like "\n    - " and short ids must not match, and the match must not
  // swallow surrounding whitespace. Bare long numbers stay masked on purpose —
  // in confidential mode, masking an id is cheaper than leaking a phone.
  { regex: /\+?\d(?:[\s()-]*\d){6,}/g, prefix: 'PHONE' },
  { regex: /@[\w.-]+\.(?:local|internal|corp|lan)\b/gi, prefix: 'DOMAIN' },
  { regex: /\b(?:Sr|Sra|Dra?|Ing|Lic|Prof)\.\s+[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+\b/g, prefix: 'NAME' },
];

export function anonymize(text: string): { text: string; map: SubMap } {
  const map: SubMap = {};
  const counters: Record<string, number> = {};
  let result = text;

  for (const { regex, prefix } of PATTERNS) {
    result = result.replace(regex, (match) => {
      if (!counters[prefix]) counters[prefix] = 0;
      counters[prefix]++;
      const placeholder = `[${prefix}_${counters[prefix]}]`;
      map[placeholder] = match;
      return placeholder;
    });
  }

  return { text: result, map };
}

export function deanonymize(text: string, map: SubMap): string {
  let result = text;
  // Orden INVERSO de insercion: un patron posterior (URL) puede haber capturado
  // el placeholder de uno anterior (EMAIL) dentro de su valor original. Restaurar
  // el envoltorio primero reintroduce el placeholder interno, que las iteraciones
  // siguientes (las de los patrones anteriores) si restauran.
  for (const [placeholder, original] of Object.entries(map).reverse()) {
    result = result.split(placeholder).join(original);
  }
  return result;
}

/**
 * Rewrites the placeholders the user renamed in the review modal, keeping the
 * outgoing text and the restore map in sync. A blank rename is ignored — without
 * a placeholder in the text the original value could not be restored.
 */
export function applyPlaceholderEdits(
  text: string,
  map: SubMap,
  edits: Record<string, string>,
): { text: string; map: SubMap } {
  let result = text;
  const nextMap: SubMap = {};

  for (const [placeholder, original] of Object.entries(map)) {
    const edited = edits[placeholder]?.trim();
    const replacement = edited || placeholder;
    if (replacement !== placeholder) {
      result = result.split(placeholder).join(replacement);
    }
    nextMap[replacement] = original;
  }

  return { text: result, map: nextMap };
}

/** A placeholder mid-stream: `[`, then the prefix, then `_`, then the counter. */
const PARTIAL_PLACEHOLDER = /\[[A-Z]*(?:_\d*)?$/;

/**
 * Splits streamed text into the part safe to emit and a tail that may still grow
 * into a placeholder. Without this, a placeholder split across two SSE chunks
 * (`[EMA` + `IL_1]`) would never match the restore map and would reach the user raw.
 *
 * Con `mapKeys` (las claves reales del mapa de restauracion) la retencion se hace
 * contra ellas: los renames del modal de revision son texto libre sin forma
 * `[PREFIX_n]`, y el regex por defecto no los protegia de partirse entre chunks.
 * Las claves por defecto tambien son claves del mapa, asi que el regex solo se
 * usa cuando no hay mapa.
 */
export function splitPendingPlaceholder(text: string, mapKeys?: string[]): [emit: string, pending: string] {
  if (mapKeys?.length) {
    const maxHold = Math.max(...mapKeys.map((k) => k.length));
    // De la cola mas larga a la mas corta: la primera que YA es una clave
    // completa se emite (deanonymize la reemplaza); la primera que es prefijo
    // propio de alguna clave se retiene por si el resto llega en el chunk siguiente.
    for (let i = Math.min(text.length, maxHold); i > 0; i--) {
      const tail = text.slice(-i);
      if (mapKeys.includes(tail)) break;
      if (mapKeys.some((k) => k.startsWith(tail))) {
        return [text.slice(0, text.length - i), tail];
      }
    }
    return [text, ''];
  }
  const match = PARTIAL_PLACEHOLDER.exec(text);
  if (!match) return [text, ''];
  return [text.slice(0, match.index), text.slice(match.index)];
}
