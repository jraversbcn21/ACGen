import { useState, useCallback, useRef, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { generateCriteria } from '../services/apiService';
import { HARDCODED_PROMPT, STORAGE_KEYS } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useHistory } from '../hooks/useHistory';
import type { GenerationStatus } from '../types';

interface AcceptanceCriteriaToolProps {
  apiKey: string;
  model: string;
}

export function AcceptanceCriteriaTool({ apiKey, model }: AcceptanceCriteriaToolProps) {
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

  const canGenerate = apiKey.trim().length > 0 && requirements.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setStatus('loading');
    setError(null);
    setCriteria('');
    setReasoning(undefined);

    try {
      let inputText = requirements;
      if (additionalContext.trim()) {
        inputText = `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`;
      }

      setLoadingStatus('Generando criterios...');
      const result = await generateCriteria(apiKey, model, inputText, HARDCODED_PROMPT);
      setCriteria(result.content);
      setReasoning(result.reasoning);
      addEntry(requirements, result.content);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
      setStatus('error');
    } finally {
      setLoadingStatus('');
    }
  }, [apiKey, model, requirements, canGenerate, additionalContext, addEntry]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Seguro que quieres limpiar los campos?')) return;
    stopSpeech();
    setRequirements('');
    setCriteria('');
    setReasoning(undefined);
    setError(null);
    setStatus('idle');
    setCopied(false);
    setAdditionalContext('');
  }, []);

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
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            className="field-textarea criteria-output-ta"
            readOnly={false}
            placeholder={!criteria ? 'Los criterios generados aparecerán aquí...' : ''}
          />
          {criteria && (
            <div className="copy-row">
              <button
                type="button"
                className="btn-ghost btn-copy"
                onClick={handleCopy}
              >
                {copied ? '¡Copiado!' : 'Copiar Criterio'}
              </button>
            </div>
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
        <GenerateButton onClick={handleGenerate} disabled={!canGenerate} loading={status === 'loading'} />
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
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setCriteria(output)}
          onClearAll={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
