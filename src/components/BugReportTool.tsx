import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { SearchableSelect } from './SearchableSelect';
import { generateBugReport } from '../services/apiService';
import { SUPPORTED_MARKETS, PLATFORMS, STORAGE_KEYS, IOS_DEVICES, ANDROID_DEVICES } from '../config/constants';
import { useHistory } from '../hooks/useHistory';
import type { BugReportFormData, PlatformId } from '../types';

interface BugReportToolProps {
  apiKey: string;
  model: string;
}

const DESKTOP_BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const MOBILE_BROWSERS = [...DESKTOP_BROWSERS, 'Samsung Internet'];

function getAvailableBrowsers(platform: PlatformId): string[] {
  if (platform === 'web-mobile') return MOBILE_BROWSERS;
  return DESKTOP_BROWSERS;
}

const DEFAULT_FORM: BugReportFormData = {
  description: '',
  platform: 'web-desktop',
  market: 'ES',
  browser: 'Chrome',
  url: 'https://localhost:3443/',
  appVersion: '',
  device: '',
  osVersion: '',
  additionalContext: '',
};

export function BugReportTool({ apiKey, model }: BugReportToolProps) {
  const [formData, setFormData] = useState<BugReportFormData>(DEFAULT_FORM);
  const [output, setOutput] = useState('');
  const [reasoning, setReasoning] = useState<string | undefined>();
  const [ttsLang, setTtsLang] = useState<'es-ES' | 'en-US'>('en-US');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useHistory(STORAGE_KEYS.BUG_HISTORY);

  const isWeb = formData.platform === 'web-desktop' || formData.platform === 'web-mobile';
  const canGenerate = apiKey.trim().length > 0 && formData.description.trim().length > 0;

  const marketOptions = useMemo(
    () => SUPPORTED_MARKETS.map(m => ({ value: m.code, label: `${m.label} (${m.code})` })),
    [],
  );

  const updateForm = useCallback(<K extends keyof BugReportFormData>(key: K, value: BugReportFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
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

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsLoading(true);
    setError(null);
    setOutput('');
    setReasoning(undefined);

    try {
      setLoadingStatus('Generando bug report...');
      const result = await generateBugReport(apiKey, model, formData);
      setOutput(result.content);
      setReasoning(result.reasoning);
      addEntry(formData.description, result.content);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [apiKey, model, formData, canGenerate, addEntry]);

  const handleClear = useCallback(() => {
    if (!window.confirm('¿Seguro que quieres limpiar los campos?')) return;
    setFormData(DEFAULT_FORM);
    setOutput('');
    setReasoning(undefined);
    setError(null);
    setCopied(false);
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
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.getElementById('br-output') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [output]);

  const handlePlatformChange = useCallback((platform: string) => {
    const p = platform as PlatformId;
    const wasWeb = formData.platform.startsWith('web-');
    const nowWeb = p.startsWith('web-');
    setFormData(prev => {
      const browsers = getAvailableBrowsers(p);
      let device = '';
      if (p === 'app-ios') device = IOS_DEVICES[0].label;
      else if (p === 'app-android') device = ANDROID_DEVICES[0].label;
      const keepUrl = (!wasWeb && nowWeb) || prev.url === '' || prev.url === 'https://localhost:3443/';
      return {
        ...prev,
        platform: p,
        browser: browsers.includes(prev.browser || '') ? prev.browser : browsers[0],
        appVersion: '',
        device,
        osVersion: '',
        url: nowWeb ? (keepUrl ? 'https://localhost:3443/' : prev.url) : prev.url,
      };
    });
  }, [formData.platform]);

  const browserOptions = getAvailableBrowsers(formData.platform);

  return (
    <div>
      {/* Compact fields row */}
      <div className="br-compact-row">
        <div className="br-compact-field">
          <label htmlFor="br-platform" className="field-label">Plataforma</label>
          <div className="input-wrap">
            <select
              id="br-platform"
              value={formData.platform}
              onChange={(e) => handlePlatformChange(e.target.value)}
              className="field-select"
            >
              {PLATFORMS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
          </div>
        </div>
        <div className="br-compact-field">
          <label htmlFor="br-market" className="field-label">Mercado</label>
          <SearchableSelect
            options={marketOptions}
            value={formData.market}
            onChange={(v) => updateForm('market', v)}
            placeholder="Buscar..."
          />
        </div>
        {isWeb ? (
          <>
            <div className="br-compact-field">
              <label htmlFor="br-browser" className="field-label">Navegador</label>
              <div className="input-wrap">
                <select
                  id="br-browser"
                  value={formData.browser}
                  onChange={(e) => updateForm('browser', e.target.value)}
                  className="field-select"
                >
                  {browserOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
              </div>
            </div>
            <div className="br-compact-field br-compact-field-wide">
              <label htmlFor="br-url" className="field-label">URL</label>
              <input
                id="br-url"
                type="text"
                value={formData.url || ''}
                onChange={(e) => updateForm('url', e.target.value)}
                placeholder="https://localhost:3443/"
                className="field-input"
              />
            </div>
          </>
        ) : (
          <>
            <div className="br-compact-field">
              <label htmlFor="br-app-version" className="field-label">
                {formData.platform === 'app-android' ? 'Versión APK' : 'Versión Build'}
              </label>
              <input
                id="br-app-version"
                type="text"
                value={formData.appVersion || ''}
                onChange={(e) => updateForm('appVersion', e.target.value)}
                placeholder={formData.platform === 'app-android' ? 'ej: v2024.12.1' : 'ej: v2024.12.1'}
                className="field-input"
              />
            </div>
            <div className="br-compact-field">
              <label htmlFor="br-device" className="field-label">Dispositivo</label>
              <div className="input-wrap">
                <select
                  id="br-device"
                  value={formData.device || ''}
                  onChange={(e) => updateForm('device', e.target.value)}
                  className="field-select"
                >
                  {formData.platform === 'app-ios'
                    ? IOS_DEVICES.map(d => (
                        <option key={d.id} value={d.label}>{d.label}</option>
                      ))
                    : ANDROID_DEVICES.map(d => (
                        <option key={d.id} value={d.label}>{d.label}</option>
                      ))
                  }
                </select>
                <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
              </div>
            </div>
            <div className="br-compact-field">
              <label htmlFor="br-os-version" className="field-label">
                {formData.platform === 'app-android' ? 'Versión Android' : 'Versión iOS'}
              </label>
              <input
                id="br-os-version"
                type="text"
                value={formData.osVersion || ''}
                onChange={(e) => updateForm('osVersion', e.target.value)}
                placeholder={formData.platform === 'app-android' ? 'ej: Android 14' : 'ej: iOS 18'}
                className="field-input"
              />
            </div>
          </>
        )}
        <div className="br-compact-field br-compact-field-wide">
          <label htmlFor="br-context" className="field-label">Contexto adicional</label>
          <input
            id="br-context"
            type="text"
            value={formData.additionalContext || ''}
            onChange={(e) => updateForm('additionalContext', e.target.value)}
            placeholder="Notas, contexto, etc."
            className="field-input"
          />
        </div>
      </div>

      {/* Bug description */}
      <div style={{ marginTop: 16 }}>
        <label htmlFor="br-description" className="field-label">Descripcion del bug</label>
        <textarea
          id="br-description"
          value={formData.description}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder='Describe el bug de forma informal, ej: "Al anadir talla M al carrito desde mobile, el precio se muestra como 0C en la minicesta"'
          className="field-textarea"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Output area */}
      <div className="br-output-section">
        <textarea
          id="br-output"
          value={output}
          readOnly
          className="field-textarea br-output-ta"
          placeholder="El bug report generado aparecerá aquí..."
        />
        {output && (
          <div className="copy-row">
            <button
              type="button"
              className="btn-ghost btn-copy"
              onClick={handleCopy}
            >
              {copied ? '¡Copiado!' : 'Copiar bug report'}
            </button>
          </div>
        )}
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

      {/* Action buttons */}
      <div className="actions-bar">
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={isLoading}
          label="Generar bug report"
          loadingLabel="Generando..."
        />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
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
          disabled={!formData.description && !output}
        >
          Limpiar
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setOutput(output)}
          onClearAll={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
}
