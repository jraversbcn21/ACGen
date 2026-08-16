import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { SearchableSelect } from './SearchableSelect';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { SUPPORTED_MARKETS, PLATFORMS, STORAGE_KEYS, IOS_DEVICES, ANDROID_DEVICES } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useHistory } from '../hooks/useHistory';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import { parseDeviceList } from '../types/context';
import type { BugReportFormData, PlatformId } from '../types';

interface BugReportToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

const DESKTOP_BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'];
const MOBILE_BROWSERS = [...DESKTOP_BROWSERS, 'Samsung Internet'];

function getAvailableBrowsers(platform: PlatformId): string[] {
  if (platform === 'web-mobile') return MOBILE_BROWSERS;
  return DESKTOP_BROWSERS;
}

function buildBugReportMessage(formData: BugReportFormData): string {
  const now = new Date();
  // Con barras, como AcceptanceCriteria: la version con guiones casaba con el
  // regex PHONE del anonimizador y en modo confidencial la fecha inyectada se
  // enmascaraba como telefono en cada generacion.
  const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  let userMessage = `Descripcion del bug: ${formData.description}\n\n`;
  userMessage += `Plataforma: ${formData.platform}\n`;
  userMessage += `Mercado: ${formData.market}\n`;
  userMessage += `Fecha actual: ${today}\n`;
  if (formData.platform === 'web-desktop' || formData.platform === 'web-mobile') {
    if (formData.browser) userMessage += `Navegador: ${formData.browser}\n`;
    if (formData.url) userMessage += `URL: ${formData.url}\n`;
  } else {
    if (formData.appVersion) userMessage += `Version de la app: ${formData.appVersion}\n`;
    if (formData.device) userMessage += `Dispositivo: ${formData.device}\n`;
    if (formData.osVersion) userMessage += `Version del OS: ${formData.osVersion}\n`;
  }
  if (formData.additionalContext?.trim()) {
    userMessage += `\nContexto adicional:\n${formData.additionalContext.trim()}\n`;
  }
  return userMessage;
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

export function BugReportTool({ apiKey, model, profile, baseUrl, onSaveArtifact }: BugReportToolProps) {
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
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { toast, showToast } = useToast();
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const t = useT();

  const isWeb = formData.platform === 'web-desktop' || formData.platform === 'web-mobile';
  const canGenerate = apiKey.trim().length > 0 && formData.description.trim().length > 0;

  const iosDevices = parseDeviceList(profile?.iosDevices ?? '', IOS_DEVICES);
  const androidDevices = parseDeviceList(profile?.androidDevices ?? '', ANDROID_DEVICES);

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

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    setOutput('');
    setReasoning(undefined);
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('bugreport'), 'criteria', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => {
        setOutput(fullText);
        onSaveArtifact?.(effectiveInput, fullText);
        addEntry(formData.description, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      setConf(null);
    }
  }, [apiKey, model, formData.description, profile, stream, addEntry, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || isLoading || isStreaming) return;
    const userMessage = buildBugReportMessage(formData);
    if (localStorage.getItem('acgen_confidential_bugreport') === 'true') {
      const { text, map } = anonymize(userMessage);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(userMessage);
  }, [canGenerate, isLoading, isStreaming, formData, doGenerate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && !isLoading) handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGenerate, isLoading, handleGenerate]);

  const handleClear = useCallback(() => {
    const prevForm = formData;
    const prevOutput = output;
    const prevReasoning = reasoning;
    setFormData(DEFAULT_FORM);
    setOutput('');
    setReasoning(undefined);
    setError(null);
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setFormData(prevForm);
      setOutput(prevOutput);
      setReasoning(prevReasoning);
    });
  }, [formData, output, reasoning, showToast, t]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.bugreport;
    setFormData(prev => ({ ...prev, description: demo.input }));
    setOutput(demo.output);
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
    // Read-aloud is optional: without the API there is nothing to stop.
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
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
      if (p === 'app-ios') device = iosDevices[0];
      else if (p === 'app-android') device = androidDevices[0];
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
  }, [formData.platform, iosDevices, androidDevices]);

  const browserOptions = getAvailableBrowsers(formData.platform);

  return (
    <div>
      {/* Compact fields row */}
      <div className="br-compact-row">
        <div className="br-compact-field">
          <label htmlFor="br-platform" className="field-label">{t('bugreport.platform')}</label>
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
          <label htmlFor="br-market" className="field-label">{t('bugreport.market')}</label>
          <SearchableSelect
            options={marketOptions}
            value={formData.market}
            onChange={(v) => updateForm('market', v)}
            placeholder={t('common.search')}
            searchPlaceholder={t('common.searchMarket')}
          />
        </div>
        {isWeb ? (
          <>
            <div className="br-compact-field">
              <label htmlFor="br-browser" className="field-label">{t('bugreport.browser')}</label>
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
              <label htmlFor="br-url" className="field-label">{t('bugreport.url')}</label>
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
                {formData.platform === 'app-android' ? t('bugreport.apkVersion') : t('bugreport.buildVersion')}
              </label>
              <input
                id="br-app-version"
                type="text"
                value={formData.appVersion || ''}
                onChange={(e) => updateForm('appVersion', e.target.value)}
                placeholder={formData.platform === 'app-android' ? t('bugreport.apkPlaceholder') : t('bugreport.apkPlaceholder')}
                className="field-input"
              />
            </div>
            <div className="br-compact-field">
              <label htmlFor="br-device" className="field-label">{t('bugreport.device')}</label>
              <div className="input-wrap">
                <select
                  id="br-device"
                  value={formData.device || ''}
                  onChange={(e) => updateForm('device', e.target.value)}
                  className="field-select"
                >
                  {(formData.platform === 'app-ios' ? iosDevices : androidDevices).map((label) => (
                    <option key={label} value={label}>{label}</option>
                  ))}
                </select>
                <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
              </div>
            </div>
            <div className="br-compact-field">
              <label htmlFor="br-os-version" className="field-label">
                {formData.platform === 'app-android' ? t('bugreport.androidVersion') : t('bugreport.iosVersion')}
              </label>
              <input
                id="br-os-version"
                type="text"
                value={formData.osVersion || ''}
                onChange={(e) => updateForm('osVersion', e.target.value)}
                placeholder={formData.platform === 'app-android' ? t('bugreport.androidPlaceholder') : t('bugreport.iosPlaceholder')}
                className="field-input"
              />
            </div>
          </>
        )}
        <div className="br-compact-field br-compact-field-wide">
          <label htmlFor="br-context" className="field-label">{t('bugreport.additionalContext')}</label>
          <input
            id="br-context"
            type="text"
            value={formData.additionalContext || ''}
            onChange={(e) => updateForm('additionalContext', e.target.value)}
            placeholder={t('bugreport.notesPlaceholder')}
            className="field-input"
          />
        </div>
      </div>

      {/* Bug description */}
      <div style={{ marginTop: 16 }}>
        <label htmlFor="br-description" className="field-label">{t('bugreport.description')}</label>
        <textarea
          id="br-description"
          value={formData.description}
          onChange={(e) => updateForm('description', e.target.value)}
          placeholder={t('bugreport.descriptionPlaceholder')}
          className="field-textarea"
          style={{ minHeight: 120 }}
        />
      </div>

      {/* Output area */}
      <div className="br-output-section">
        <textarea
          id="br-output"
          value={isStreaming ? streamText : output}
          readOnly
          className="field-textarea br-output-ta"
          placeholder={t('bugreport.outputPlaceholder')}
        />
        {output && (
          <div className="copy-row">
            <button
              type="button"
              className="btn-ghost btn-copy"
              onClick={handleCopy}
            >
              {copied ? t('common.copied') : t('bugreport.copy')}
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
        <ConfidentialToggle
          view="bugreport"
          text={buildBugReportMessage(formData)}
          onReview={() => setConf(anonymize(buildBugReportMessage(formData)))}
        />
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate || isStreaming}
          loading={isLoading || isStreaming}
        />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
        <button type="button" className="btn-ghost" onClick={handleLoadDemo}>{t('common.example')}</button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setShowHistory(true)}
        >
          {t('bugreport.history')} {history.length > 0 && <span className="history-count">{history.length}</span>}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={!formData.description && !output}
        >
          {t('common.clear')}
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Toast toast={toast} />
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setOutput(output)}
          onClearAll={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
      {conf && (
        <AnonymizerReview
          map={conf.map}
          onCancel={() => setConf(null)}
          onConfirm={(edits) => {
            const { text, map } = applyPlaceholderEdits(conf.text, conf.map, edits);
            doGenerate(text, map);
            setConf(null);
          }}
        />
      )}
    </div>
  );
}
