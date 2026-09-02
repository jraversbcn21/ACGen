import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useLang } from './I18nContext';

function Switcher() {
  const { lang, setLang } = useLang();
  return <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>{lang}</button>;
}

describe('I18nProvider — <html lang>', () => {
  beforeEach(() => { localStorage.clear(); });

  it('mantiene document.documentElement.lang sincronizado con el idioma de la UI', () => {
    localStorage.setItem('acgen_lang', JSON.stringify('en'));
    render(<I18nProvider><Switcher /></I18nProvider>);
    expect(document.documentElement.lang).toBe('en');
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement.lang).toBe('es');
  });
});
