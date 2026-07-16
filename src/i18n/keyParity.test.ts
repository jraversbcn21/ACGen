import es from './es.json';
import en from './en.json';

describe('i18n dictionaries', () => {
  it('es and en have exactly the same keys', () => {
    const esKeys = Object.keys(es).sort();
    const enKeys = Object.keys(en).sort();
    expect(esKeys).toEqual(enKeys);
  });

  it('every {param} placeholder in es exists in en and vice versa', () => {
    const params = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    for (const key of Object.keys(es)) {
      expect(params((en as Record<string, string>)[key] ?? ''), `param mismatch in ${key}`).toEqual(params((es as Record<string, string>)[key]));
    }
  });
});
