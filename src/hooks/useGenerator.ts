import { useState, useCallback, useEffect, useRef } from 'react';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { useStreamingResponse } from './useStreamingResponse';
import { useT } from '../i18n/I18nContext';
import type { ContentPart, GenerationStatus } from '../types';
import type { ProjectProfile } from '../types/context';

export interface GeneratorConfig<T> {
  /** Clave del prompt (`getPrompt(view)`) y del flag `acgen_confidential_<view>`. */
  view: string;
  /** Parametros de reasoning de streamWithGroq. */
  toolType: 'criteria' | 'testcase';
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  canGenerate: boolean;
  /** Texto (o partes multimodales) que se envia. Lo que el tool necesite "al arrancar" lo captura aqui. */
  buildInput: () => string | ContentPart[];
  /** Del texto completo al resultado tipado. Puede lanzar Error(i18nKey) con `params`. */
  parse: (fullText: string) => T;
  /** El tool guarda SU estado, su artefacto, su historial y su modelo. */
  onResult: (result: T, ctx: { input: string | ContentPart[]; fullText: string; model: string }) => void;
  /** Si esta, el error va aqui (toast) y `error` queda null; si no, al banner. */
  onError?: (message: string) => void;
  /** false solo en el Validador. */
  confidential?: boolean;
}

export interface Generator {
  status: GenerationStatus;
  isStreaming: boolean;
  streamText: string;
  error: string | null;
  dismissError: () => void;
  handleGenerate: () => Promise<void>;
  review: { text: string; map: Record<string, string> } | null;
  openReview: () => void;
  confirmReview: (edits: Record<string, string>) => void;
  cancelReview: () => void;
  clearGeneration: () => void;
}

/**
 * Nucleo de generacion compartido por los nueve tools. La config vive en un
 * ref que se reasigna en cada render y se lee en el momento de usarla: ningun
 * callback del tool entra en deps, asi que "se me olvido onSaveArtifact en las
 * deps" (auditoria 2026-09-02, H1) deja de ser posible por construccion.
 */
export function useGenerator<T>(config: GeneratorConfig<T>): Generator {
  const configRef = useRef(config);
  configRef.current = config;
  const t = useT();
  const { text: streamText, isStreaming, stream, reset } = useStreamingResponse();
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<Generator['review']>(null);
  // Guard en ref, no en closure: confirmReview entra sin pasar por handleGenerate
  // y el status de su closure puede ser viejo. runId evita que el finally de una
  // generacion descartada libere el guard de la siguiente.
  const busyRef = useRef(false);
  const runIdRef = useRef(0);

  const run = useCallback(async (input: string | ContentPart[], map?: Record<string, string>) => {
    if (busyRef.current) return;
    const id = ++runIdRef.current;
    busyRef.current = true;
    const c = configRef.current;
    setStatus('loading');
    setError(null);
    try {
      const gen = streamWithGroq(c.apiKey, c.model, input, getPrompt(c.view), c.toolType, c.profile, map, c.baseUrl);
      await stream(gen, (fullText) => {
        const cfg = configRef.current;
        const result = cfg.parse(fullText);
        cfg.onResult(result, { input, fullText, model: cfg.model });
        setStatus('success');
      });
    } catch (err) {
      if (runIdRef.current !== id) return; // descartada por clearGeneration
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      const onError = configRef.current.onError;
      if (onError) onError(message); else setError(message);
      setStatus('error');
    } finally {
      if (runIdRef.current === id) {
        busyRef.current = false;
        setReview(null);
      }
    }
  }, [stream, t]);

  const handleGenerate = useCallback(async () => {
    const c = configRef.current;
    if (!c.canGenerate || busyRef.current) return;
    const input = c.buildInput();
    if (c.confidential !== false && typeof input === 'string' && localStorage.getItem(`acgen_confidential_${c.view}`) === 'true') {
      const { text, map } = anonymize(input);
      if (Object.keys(map).length > 0) {
        setReview({ text, map });
        return;
      }
    }
    await run(input);
  }, [run]);

  // Sin argumento a proposito: el badge "N sustituciones — Revisar" entra por
  // aqui sin pasar por handleGenerate, y buildInput es donde el tool captura
  // lo que necesita "al arrancar" (historial, texto del artefacto). Si el
  // texto se construyera fuera, ese ref se quedaria sin escribir en este camino.
  const openReview = useCallback(() => {
    const input = configRef.current.buildInput();
    if (typeof input !== 'string') return;
    setReview(anonymize(input));
  }, []);
  const cancelReview = useCallback(() => setReview(null), []);
  const confirmReview = useCallback((edits: Record<string, string>) => {
    if (!review) return;
    const { text, map } = applyPlaceholderEdits(review.text, review.map, edits);
    setReview(null);
    void run(text, map);
  }, [review, run]);

  const clearGeneration = useCallback(() => {
    reset();
    runIdRef.current++;
    busyRef.current = false;
    setStatus('idle');
    setError(null);
    setReview(null);
  }, [reset]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleGenerate]);

  return {
    status, isStreaming, streamText, error,
    dismissError: () => setError(null),
    handleGenerate, review, openReview, confirmReview, cancelReview, clearGeneration,
  };
}
