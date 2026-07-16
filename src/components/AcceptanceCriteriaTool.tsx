import { useState, useCallback, useRef, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { useToast, Toast } from './Toast';
import { streamWithGroq } from '../services/apiService';
import { HARDCODED_PROMPT, STORAGE_KEYS } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import type { ViewType } from '../config/constants';
import { useHistory } from '../hooks/useHistory';
import type { ProjectProfile } from '../types/context';
import type { GenerationStatus } from '../types';

import { ChainMenu } from './ChainMenu';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';

interface AcceptanceCriteriaToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

export function AcceptanceCriteriaTool({ apiKey, model, profile, onChain, prefill, onSaveArtifact }: AcceptanceCriteriaToolProps) {
  const [requirements, setRequirements] = useState('');
  const [criteria, setCriteria] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | undefined>();
  const [ttsLang, setTtsLang] = useState<'es-ES' | 'en-US'>('en-US');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useHistory(STORAGE_KEYS.CRITERIA_HISTORY);
  const { toast, showToast } = useToast();
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
  const { text: streamText, isStreaming, stream, reset: resetStream } = useStreamingResponse();

  useEffect(() => {
    if (prefill) {
      setRequirements(prefill);
    }
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirements.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setStatus('loading');
    setError(null);
    setCriteria('');
    setReasoning(undefined);
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, HARDCODED_PROMPT, 'criteria', profile, effectiveMap);
      await stream(gen, (fullText) => {
        setCriteria(fullText);
        setReasoning(undefined);
        onSaveArtifact?.(effectiveInput, fullText);
        addEntry(requirements, fullText);
        setStatus('success');
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
      setStatus('error');
    } finally {
      setLoadingStatus('');
      setConfMap(null);
    }
  }, [apiKey, model, requirements, profile, stream, addEntry]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || status === 'loading' || isStreaming) return;
    let inputText = requirements;
    if (additionalContext.trim()) {
      inputText = `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`;
    }
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const effectiveInput = `${inputText}\n\nFecha actual: ${today}`;
    const confKey = `acgen_confidential_acceptance`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(effectiveInput);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(effectiveInput);
    } else {
      await doGenerate(effectiveInput);
    }
  }, [canGenerate, status, isStreaming, requirements, additionalContext, doGenerate]);

  const handleClear = useCallback(() => {
    stopSpeech();
    resetStream();
    const prevRequirements = requirements;
    const prevCriteria = criteria;
    const prevReasoning = reasoning;
    const prevContext = additionalContext;
    setRequirements('');
    setCriteria('');
    setReasoning(undefined);
    setError(null);
    setStatus('idle');
    setCopied(false);
    setAdditionalContext('');
    showToast('Campos limpiados', () => {
      setRequirements(prevRequirements);
      setCriteria(prevCriteria);
      setReasoning(prevReasoning);
      setAdditionalContext(prevContext);
    });
  }, [requirements, criteria, reasoning, additionalContext, showToast]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.acceptance;
    setRequirements(demo.input);
    setCriteria(demo.output);
    setError(null);
    setStatus('success');
  }, []);

  const reasoningRef = useRef<HTMLDetailsElement>(null);

  const handleReasoningToggle = useCallback(() => {
    const el = reasoningRef.current;
    if (!el || !el.open) return;
    requestAnimationFrame(() => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
    });
  }, []);

  const startSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = ttsLang;
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = ttsLang.split('-')[0];
    const match = voices
      .filter(v => v.lang.startsWith(langPrefix))
      .sort((a, b) => {
        const quality = (v: SpeechSynthesisVoice): number => {
          const n = v.name.toLowerCase();
          if (n.includes('natural')) return 4;
          if (n.includes('neural'))  return 3;
          if (n.includes('online'))  return 2;
          if (!v.localService)       return 1;
          return 0;
        };
        return quality(b) - quality(a);
      })[0];
    if (match) utter.voice = match;
    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.speak(utter);
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);

  useEffect(() => {
    if (isSpeaking) stopSpeech();
  }, [reasoning]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && status !== 'loading') handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGenerate, status, handleGenerate]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(criteria);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.getElementById('criteria-output') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [criteria]);

  return (
    <div>
      <div className="criteria-grid">
        <div className="criteria-left">
          <textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Escribe los requisitos o pega la descripcion del ticket..."
            className="field-textarea criteria-input-ta"
          />
          <textarea
            id="additional-context"
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Contexto adicional (opcional — pega aqui la descripcion del ticket, notas, etc.)"
            className="field-textarea"
            style={{ minHeight: 60, marginTop: 8 }}
          />
          <textarea
            id="criteria-output"
            value={isStreaming ? streamText : criteria}
            onChange={(e) => setCriteria(e.target.value)}
            className="field-textarea criteria-output-ta"
            readOnly={isStreaming}
            placeholder={!criteria ? 'Los criterios generados apareceran aqui...' : ''}
          />
          {criteria && (
            <div className="copy-row">
              <button
                type="button"
                className="btn-ghost btn-copy"
                onClick={handleCopy}
              >
                {copied ? 'Copiado!' : 'Copiar Criterio'}
              </button>
            </div>
          )}
          {criteria && onChain && (
            <ChainMenu sourceView="acceptance" content={criteria} onChain={onChain} />
          )}
        </div>
        <div className="criteria-right">
          {reasoning && (
            <details ref={reasoningRef} className="reasoning" onToggle={handleReasoningToggle}>
              <summary>
                <span className="reasoning-label">Razonamiento del modelo</span>
                <span className="reasoning-tts" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`tts-lang-btn ${ttsLang === 'es-ES' ? 'active' : ''}`}
                    onClick={() => { stopSpeech(); setTtsLang('es-ES'); }}
                    title="Leer en español"
                  >ES</button>
                  <button
                    type="button"
                    className={`tts-lang-btn ${ttsLang === 'en-US' ? 'active' : ''}`}
                    onClick={() => { stopSpeech(); setTtsLang('en-US'); }}
                    title="Read in English"
                  >EN</button>
                  {!isSpeaking ? (
                    <button
                      type="button"
                      className="tts-play-btn"
                      onClick={() => startSpeech(reasoning ?? '')}
                      title="Leer en voz alta"
                      disabled={!reasoning}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="tts-stop-btn"
                      onClick={stopSpeech}
                      title="Detener lectura"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                        <rect x="4" y="4" width="16" height="16" rx="2" />
                      </svg>
                    </button>
                  )}
                </span>
              </summary>
              <div className="reasoning-body">{reasoning}</div>
            </details>
          )}
        </div>
      </div>

      <div className="actions-bar">
        <ConfidentialToggle
          view="acceptance"
          substitutionCount={0}
          onReview={() => {
            let inputText = requirements;
            if (additionalContext.trim()) {
              inputText = `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`;
            }
            const now = new Date();
            const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const effectiveInput = `${inputText}\n\nFecha actual: ${today}`;
            const { map } = anonymize(effectiveInput);
            setConfMap(map);
          }}
        />
        <GenerateButton onClick={handleGenerate} disabled={!canGenerate || isStreaming} loading={status === 'loading' && !isStreaming} />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
        <button type="button" className="btn-ghost" onClick={handleLoadDemo}>Ver ejemplo</button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowHistory(true)}
        >
          Historial {history.length > 0 && <span className="history-count">{history.length}</span>}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={!requirements && !criteria}
        >
          Limpiar
        </button>
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Toast toast={toast} />
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setCriteria(output)}
          onClearAll={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
      {confMap && (
        <AnonymizerReview
          map={confMap}
          onCancel={() => setConfMap(null)}
          onConfirm={(editedMap) => {
            let inputText = requirements;
            if (additionalContext.trim()) {
              inputText = `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`;
            }
            const now = new Date();
            const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
            const effectiveInput = `${inputText}\n\nFecha actual: ${today}`;
            doGenerate(effectiveInput, editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
