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
  for (const [placeholder, original] of Object.entries(map)) {
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
 */
export function splitPendingPlaceholder(text: string): [emit: string, pending: string] {
  const match = PARTIAL_PLACEHOLDER.exec(text);
  if (!match) return [text, ''];
  return [text.slice(0, match.index), text.slice(match.index)];
}
