import { useState, useCallback, useRef } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { generateBugReport } from '../services/apiService';
import { BERSHKA_MARKETS, PLATFORMS, STORAGE_KEYS, IOS_DEVICES, ANDROID_DEVICES } from '../config/constants';
import { extractIssueKey, fetchJiraTicket, formatTicketAsText } from '../services/jiraService';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
  jiraTicketUrl: '',
};

export function BugReportTool({ apiKey, model }: BugReportToolProps) {
  const [formData, setFormData] = useState<BugReportFormData>(DEFAULT_FORM);
  const [output, setOutput] = useState('');
  const [reasoning, setReasoning] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [jiraToken, setJiraToken] = useLocalStorage(STORAGE_KEYS.JIRA_TOKEN, '');
  const [jiraBaseUrl, setJiraBaseUrl] = useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL, '');
  const [jiraConfigExpanded, setJiraConfigExpanded] = useState(false);

  const isWeb = formData.platform === 'web-desktop' || formData.platform === 'web-mobile';
  const isApp = !isWeb;
  const jiraConfigured = jiraToken.trim().length > 0 && jiraBaseUrl.trim().length > 0;
  const canGenerate = apiKey.trim().length > 0 && formData.description.trim().length > 0;

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
      let jiraContext: string | undefined;

      if (formData.jiraTicketUrl && jiraToken.trim() && jiraBaseUrl.trim()) {
        const issueKey = extractIssueKey(formData.jiraTicketUrl);
        if (issueKey) {
          setLoadingStatus('Obteniendo contexto del ticket...');
          const ticket = await fetchJiraTicket(issueKey, jiraToken.trim(), jiraBaseUrl.trim());
          jiraContext = formatTicketAsText(ticket);
        }
      } else if (formData.jiraTicketUrl && (!jiraToken.trim() || !jiraBaseUrl.trim())) {
        throw new Error('Configura la URL base y el token de Jira para obtener contexto del ticket.');
      }

      setLoadingStatus('Generando bug report...');
      const result = await generateBugReport(apiKey, model, formData, jiraContext);
      setOutput(result.content);
      setReasoning(result.reasoning);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [apiKey, model, formData, canGenerate, jiraToken, jiraBaseUrl]);

  const handleClear = useCallback(() => {
    if (!window.confirm('¿Seguro que quieres limpiar los campos?')) return;
    setFormData(DEFAULT_FORM);
    setOutput('');
    setReasoning(undefined);
    setError(null);
    setCopied(false);
  }, []);

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
    setFormData(prev => {
      const browsers = getAvailableBrowsers(p);
      let device = '';
      if (p === 'app-ios') device = IOS_DEVICES[0].label;
      else if (p === 'app-android') device = ANDROID_DEVICES[0].label;
      return {
        ...prev,
        platform: p,
        browser: browsers.includes(prev.browser || '') ? prev.browser : browsers[0],
        appVersion: '',
        device,
        osVersion: '',
        url: p.startsWith('web-') ? 'https://localhost:3443/' : prev.url,
      };
    });
  }, []);

  const browserOptions = getAvailableBrowsers(formData.platform);

  return (
    <div>
      {/* Jira config section */}
      {jiraConfigured && !jiraConfigExpanded ? (
        <div className="jira-indicator">
          <span className="jira-indicator-text">Jira configurado ✓</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setJiraConfigExpanded(true)}
          >
            Editar
          </button>
        </div>
      ) : (
        <div className="jira-config">
          <span className="jira-config-title">Jira (opcional)</span>
          <div className="jira-fields">
            <div>
              <label htmlFor="br-jira-base-url" className="field-label">URL base de Jira</label>
              <input
                id="br-jira-base-url"
                type="text"
                value={jiraBaseUrl}
                onChange={(e) => setJiraBaseUrl(e.target.value)}
                placeholder="https://jira.tuempresa.com/jira"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="br-jira-token" className="field-label">Token PAT de Jira</label>
              <input
                id="br-jira-token"
                type="password"
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
                placeholder="Tu Personal Access Token"
                className="field-input"
              />
            </div>
          </div>
          {jiraConfigured && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setJiraConfigExpanded(false)}
              style={{ alignSelf: 'flex-end', marginTop: '4px' }}
            >
              Ocultar
            </button>
          )}
        </div>
      )}

      {/* Form grid */}
      <div className="br-form-grid">
        {/* Row 1: Platform + Market */}
        <div className="br-form-row">
          <div className="br-form-field">
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
          <div className="br-form-field">
            <label htmlFor="br-market" className="field-label">Mercado</label>
            <div className="input-wrap">
              <select
                id="br-market"
                value={formData.market}
                onChange={(e) => updateForm('market', e.target.value)}
                className="field-select"
              >
                {BERSHKA_MARKETS.map(m => (
                  <option key={m.code} value={m.code}>{m.label} ({m.code})</option>
                ))}
              </select>
              <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
            </div>
          </div>
        </div>

        {/* Row 2: Dynamic fields */}
        <div className="br-form-row">
          {isWeb ? (
            <>
              <div className="br-form-field">
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
              <div className="br-form-field">
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
              <div className="br-form-field">
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
              <div className="br-form-field">
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
            </>
          )}
        </div>

        {/* Row 3: OS version (app only) */}
        {isApp && (
          <div className="br-form-row-single">
            <div className="br-form-field">
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
          </div>
        )}

        {/* Row 4: Related Jira ticket */}
        <div className="br-form-row-single">
          <div className="br-form-field">
            <label htmlFor="br-jira-ticket" className="field-label">Ticket relacionado (opcional)</label>
            <input
              id="br-jira-ticket"
              type="text"
              value={formData.jiraTicketUrl || ''}
              onChange={(e) => updateForm('jiraTicketUrl', e.target.value)}
              placeholder="URL del ticket de Jira relacionado (opcional)"
              className="field-input"
            />
          </div>
        </div>

        {/* Row 5: Bug description */}
        <div className="br-form-row-single">
          <div className="br-form-field">
            <label htmlFor="br-description" className="field-label">Descripción del bug</label>
            <textarea
              id="br-description"
              value={formData.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder='Describe el bug de forma informal, ej: "Al añadir talla M al carrito desde mobile, el precio se muestra como 0€ en la minicesta"'
              className="field-textarea"
              style={{ minHeight: 120 }}
            />
          </div>
        </div>
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
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopy}
            >
              {copied ? '¡Copiado!' : 'Copiar al portapapeles'}
            </button>
          </div>
        )}
        {reasoning && (
          <details ref={reasoningRef} className="reasoning" onToggle={handleReasoningToggle}>
            <summary>Razonamiento del modelo</summary>
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
          onClick={handleClear}
          disabled={!formData.description && !output}
        >
          Limpiar
        </button>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
