import { useState, useCallback, useMemo, useRef } from 'react';
import { copyText } from '../utils/clipboard';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { SearchableSelect } from './SearchableSelect';
import { useToast, Toast } from './Toast';
import { SUPPORTED_MARKETS, PLATFORMS, STORAGE_KEYS, IOS_DEVICES, ANDROID_DEVICES } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useHistory } from '../hooks/useHistory';
import { useGenerator } from '../hooks/useGenerator';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import { parseDeviceList } from '../types/context';
import type { BugReportFormData, PlatformId } from '../types';
import { generateShortcutLabel } from '../utils/shortcut';

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
  // Vacia a proposito: un valor por defecto entraba en el mensaje, casaba con el
  // regex de URL del anonimizador y abria el modal de revision en CADA generacion.
  url: '',
  appVersion: '',
  device: '',
  osVersion: '',
  additionalContext: '',
};

export function BugReportTool({ apiKey, model, profile, baseUrl, onSaveArtifact }: BugReportToolProps) {
  const [formData, setFormData] = useState<BugReportFormData>(DEFAULT_FORM);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useHistory(STORAGE_KEYS.BUG_HISTORY);
  const { toast, showToast } = useToast();
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

  const historyInputRef = useRef('');
  const gen = useGenerator<string>({
    view: 'bugreport',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => {
      historyInputRef.current = formData.description;
      return buildBugReportMessage(formData);
    },
    parse: (fullText) => fullText,
    onResult: (fullText, { input: sent }) => {
      setOutput(fullText);
      onSaveArtifact?.(sent as string, fullText);
      addEntry(historyInputRef.current, fullText);
    },
  });

  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prevForm = formData;
    const prevOutput = output;
    setFormData(DEFAULT_FORM);
    setOutput('');
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setFormData(prevForm);
      setOutput(prevOutput);
    });
  }, [formData, output, gen, showToast, t]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.bugreport;
    setFormData(prev => ({ ...prev, description: demo.input }));
    setOutput(demo.output);
  }, []);

  const handleCopy = useCallback(async () => {
    await copyText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handlePlatformChange = useCallback((platform: string) => {
    const p = platform as PlatformId;
    setFormData(prev => {
      const browsers = getAvailableBrowsers(p);
      let device = '';
      if (p === 'app-ios') device = iosDevices[0];
      else if (p === 'app-android') device = androidDevices[0];
      // La URL escrita se conserva en todos los cambios de plataforma (el
      // mensaje solo la incluye en web); antes app -> web la machacaba.
      return {
        ...prev,
        platform: p,
        browser: browsers.includes(prev.browser || '') ? prev.browser : browsers[0],
        appVersion: '',
        device,
        osVersion: '',
      };
    });
  }, [iosDevices, androidDevices]);

  const browserOptions = getAvailableBrowsers(formData.platform);

  return (
    <div className="br-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('bugreport.title')}</h1>
          <p className="tool-sub">{t('bugreport.subtitle')}</p>
        </div>
      </header>

      <div className="br-grid">
        {/* ---------- IZQUIERDA: entorno + descripcion + acciones ---------- */}
        <div className="br-side">
          <div className="br-card">
            <span className="br-card-title">{t('bugreport.environment')}</span>
            <div className="br-env-grid">
              <div className="br-env-field">
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
              <div className="br-env-field">
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
                  <div className="br-env-field">
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
                  <div className="br-env-field">
                    <label htmlFor="br-url" className="field-label">{t('bugreport.url')}</label>
                    <input
                      id="br-url"
                      type="text"
                      value={formData.url || ''}
                      onChange={(e) => updateForm('url', e.target.value)}
                      placeholder="https://..."
                      className="field-input"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="br-env-field">
                    <label htmlFor="br-app-version" className="field-label">
                      {formData.platform === 'app-android' ? t('bugreport.apkVersion') : t('bugreport.buildVersion')}
                    </label>
                    <input
                      id="br-app-version"
                      type="text"
                      value={formData.appVersion || ''}
                      onChange={(e) => updateForm('appVersion', e.target.value)}
                      placeholder={t('bugreport.apkPlaceholder')}
                      className="field-input"
                    />
                  </div>
                  <div className="br-env-field">
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
                  <div className="br-env-field br-env-field--full">
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
              <div className="br-env-field br-env-field--full">
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
          </div>

          <div className="br-desc">
            <label htmlFor="br-description" className="br-desc-label">
              {t('bugreport.description')}
              <span className="hint">{generateShortcutLabel()}</span>
            </label>
            <textarea
              id="br-description"
              value={formData.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder={t('bugreport.descriptionPlaceholder')}
              className="field-textarea br-desc-ta"
            />
          </div>

          <div className="br-card">
            <ConfidentialToggle
              view="bugreport"
              text={buildBugReportMessage(formData)}
              onReview={gen.openReview}
            />
            <div className="br-actions-row">
              <button type="button" className="btn-ghost" onClick={handleLoadDemo}>{t('common.example')}</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowHistory(true)}
              >
                {t('bugreport.history')} {history.length > 0 && <span className="history-count">{history.length}</span>}
              </button>
            </div>
            <GenerateButton
              onClick={gen.handleGenerate}
              disabled={!canGenerate || gen.isStreaming}
              loading={gen.status === 'loading'}
            />
          </div>
        </div>

        {/* ---------- DERECHA: reporte generado ---------- */}
        <div className="br-panel">
          <div className="br-panel-head">
            <span className="br-panel-title">{t('bugreport.generated')}</span>
            <div className="br-panel-actions">
              {output && (
                <button
                  type="button"
                  className="btn-ghost btn-copy"
                  onClick={handleCopy}
                >
                  {copied ? t('common.copied') : t('bugreport.copy')}
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClear}
                disabled={!formData.description && !output}
              >
                {t('common.clear')}
              </button>
            </div>
          </div>

          <div className="br-panel-body">
            <textarea
              id="br-output"
              value={gen.isStreaming ? gen.streamText : output}
              readOnly
              className="field-textarea br-panel-ta"
              placeholder={t('bugreport.outputPlaceholder')}
            />
          </div>
        </div>
      </div>

      <ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
      <Toast toast={toast} />
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setOutput(output)}
          onClearAll={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
      {gen.review && (
        <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
      )}
    </div>
  );
}
