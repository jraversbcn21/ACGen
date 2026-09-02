import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { STORAGE_KEYS } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import type { ViewType } from '../config/constants';
import { useHistory } from '../hooks/useHistory';
import type { ProjectProfile } from '../types/context';
import type { GenerationStatus } from '../types';
import { useT } from '../i18n/I18nContext';
import { copyText } from '../utils/clipboard';

import { ChainMenu } from './ChainMenu';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';

interface AcceptanceCriteriaToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

export function AcceptanceCriteriaTool({ apiKey, model, profile, baseUrl, onChain, prefill, onSaveArtifact }: AcceptanceCriteriaToolProps) {
  const [requirements, setRequirements] = useState('');
  const [criteria, setCriteria] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useHistory(STORAGE_KEYS.CRITERIA_HISTORY);
  const { toast, showToast } = useToast();
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { text: streamText, isStreaming, stream, reset: resetStream } = useStreamingResponse();
  const t = useT();

  useEffect(() => {
    if (prefill) {
      setRequirements(prefill);
    }
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirements.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    // Tambien entra por el modal confidencial, que no pasa por handleGenerate.
    if (status === 'loading' || isStreaming) return;
    setStatus('loading');
    setError(null);
    setCriteria('');
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('acceptance'), 'criteria', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => {
        setCriteria(fullText);
        onSaveArtifact?.(effectiveInput, fullText);
        addEntry(requirements, fullText);
        setStatus('success');
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      setError(message);
      setStatus('error');
    } finally {
      setConf(null);
    }
  }, [status, isStreaming, apiKey, model, requirements, profile, baseUrl, stream, onSaveArtifact, addEntry, t]);

  const buildEffectiveInput = useCallback(() => {
    const inputText = additionalContext.trim()
      ? `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`
      : requirements;
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    return `${inputText}\n\nFecha actual: ${today}`;
  }, [requirements, additionalContext]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || status === 'loading' || isStreaming) return;
    const effectiveInput = buildEffectiveInput();
    if (localStorage.getItem('acgen_confidential_acceptance') === 'true') {
      const { text, map } = anonymize(effectiveInput);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(effectiveInput);
  }, [canGenerate, status, isStreaming, buildEffectiveInput, doGenerate]);

  const handleClear = useCallback(() => {
    resetStream();
    const prevRequirements = requirements;
    const prevCriteria = criteria;
    const prevContext = additionalContext;
    setRequirements('');
    setCriteria('');
    setError(null);
    setStatus('idle');
    setCopied(false);
    setAdditionalContext('');
    showToast(t('common.cleared'), () => {
      setRequirements(prevRequirements);
      setCriteria(prevCriteria);
      setAdditionalContext(prevContext);
    });
  }, [requirements, criteria, additionalContext, resetStream, showToast, t]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.acceptance;
    setRequirements(demo.input);
    setCriteria(demo.output);
    setError(null);
    setStatus('success');
  }, []);

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
    await copyText(criteria);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [criteria]);

  return (
    <div>
      <h2 className="tool-page-title">{t('landing.tool.acceptance')}</h2>
      <div className="criteria-grid">
        <div className="criteria-left">
          <div className="criteria-field criteria-field--grow">
            <label className="criteria-label" htmlFor="requirements">
              {t('acceptance.inputLabel')}
              <span className="hint">{t('common.required')}</span>
            </label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder={t('acceptance.inputPlaceholder')}
              className="field-textarea criteria-input-ta"
            />
          </div>
          <div className="criteria-field">
            <label className="criteria-label" htmlFor="additional-context">
              {t('acceptance.contextLabel')}
              <span className="hint">{t('common.optional')}</span>
            </label>
            <textarea
              id="additional-context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder={t('acceptance.additionalContextPlaceholder')}
              className="field-textarea criteria-context-ta"
            />
          </div>
          <div className="criteria-actions">
            <ConfidentialToggle
              view="acceptance"
              text={buildEffectiveInput()}
              onReview={() => setConf(anonymize(buildEffectiveInput()))}
            />
            <div className="criteria-actions-row">
              <button type="button" className="btn-ghost" onClick={handleLoadDemo}>{t('common.example')}</button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowHistory(true)}
              >
                {t('acceptance.history')} {history.length > 0 && <span className="history-count">{history.length}</span>}
              </button>
            </div>
            <GenerateButton onClick={handleGenerate} disabled={!canGenerate || isStreaming} loading={status === 'loading' && !isStreaming} />
          </div>
        </div>
        <div className="criteria-right">
          <div className="criteria-panel-head">
            <span className="criteria-panel-title">{t('acceptance.resultTitle')}</span>
            <div className="criteria-panel-actions">
              {criteria && (
                <button
                  type="button"
                  className="btn-ghost btn-copy"
                  onClick={handleCopy}
                >
                  {copied ? t('common.copied') : t('acceptance.copyCriteria')}
                </button>
              )}
              {criteria && onChain && (
                <ChainMenu sourceView="acceptance" content={criteria} onChain={onChain} />
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClear}
                disabled={!requirements && !criteria}
              >
                {t('common.clear')}
              </button>
            </div>
          </div>
          <div className="criteria-panel-body">
            <textarea
              id="criteria-output"
              value={isStreaming ? streamText : criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className="field-textarea criteria-output-ta"
              readOnly={isStreaming}
              placeholder={!criteria ? t('acceptance.outputPlaceholder') : ''}
            />
          </div>
        </div>
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
