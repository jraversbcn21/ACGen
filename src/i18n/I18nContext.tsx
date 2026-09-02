import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import es from './es.json';
import en from './en.json';

type Lang = 'es' | 'en';

export interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const translations: Record<Lang, Record<string, string>> = { es, en };

export const I18nContext = createContext<I18nContextValue | null>(null);

function detectLang(): Lang {
  try {
    const stored = localStorage.getItem('acgen_lang');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed === 'es' || parsed === 'en') return parsed;
    }
  } catch { /* corrupt */ }
  if (typeof navigator !== 'undefined' && navigator.language?.startsWith('en')) {
    return 'en';
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLocalStorage<Lang>('acgen_lang', detectLang());

  // index.html arranca con lang="es"; los lectores de pantalla leen la UI en
  // ingles con voz española si no se actualiza al cambiar de idioma.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? translations['es'][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside I18nProvider');
  return ctx.t;
}

export function useLang() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLang must be used inside I18nProvider');
  return { lang: ctx.lang, setLang: ctx.setLang };
}
