// src/services/anonymizer.ts

type SubMap = Record<string, string>; // placeholder -> original

const PATTERNS: { regex: RegExp; prefix: string }[] = [
  { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, prefix: 'EMAIL' },
  { regex: /https?:\/\/[^\s)]+/g, prefix: 'URL' },
  { regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, prefix: 'IP' },
  { regex: /\b[A-Z]{2,}-\d{3,}\b/g, prefix: 'TICKET' },
  { regex: /\+?[\d\s()-]{7,}/g, prefix: 'PHONE' },
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
