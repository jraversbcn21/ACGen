import { describe, it, expect } from 'vitest';
import { generateShortcutLabel } from './shortcut';

const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

describe('generateShortcutLabel', () => {
  it('usa el simbolo de Command en Mac y en iPad', () => {
    expect(generateShortcutLabel(MAC)).toBe('⌘⏎');
    expect(generateShortcutLabel(IPAD)).toBe('⌘⏎');
  });

  it('usa Ctrl+Enter en Windows, que es donde se usa la app', () => {
    expect(generateShortcutLabel(WIN)).toBe('Ctrl+Enter');
  });

  it('cae a Ctrl+Enter en cualquier otra plataforma', () => {
    expect(generateShortcutLabel('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Ctrl+Enter');
  });
});
