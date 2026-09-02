import { useState, useCallback, useEffect, useRef } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { HistoryModal } from './HistoryModal';
import { useToast, Toast } from './Toast';
import { STORAGE_KEYS } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useGenerator } from '../hooks/useGenerator';
import type { ViewType } from '../config/constants';
import { useHistory } from '../hooks/useHistory';
import type { ProjectProfile } from '../types/context';
import { useT } from '../i18n/I18nContext';
import { copyText } from '../utils/clipboard';

import { ChainMenu } from './ChainMenu';
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
  const [additionalContext, setAdditionalContext] = useState('');
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { history, addEntry, clearHistory } = useHistory(STORAGE_KEYS.CRITERIA_HISTORY);
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) {
      setRequirements(prefill);
    }
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirements.trim().length > 0;

  const buildEffectiveInput = useCallback(() => {
    const inputText = additionalContext.trim()
      ? `${requirements}\n\n--- Contexto adicional ---\n${additionalContext.trim()}`
      : requirements;
    const now = new Date();
    const today = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    return `${inputText}\n\nFecha actual: ${today}`;
  }, [requirements, additionalContext]);

  const historyInputRef = useRef('');
  const gen = useGenerator<string>({
    view: 'acceptance',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => {
      historyInputRef.current = requirements; // el historial guarda el texto de cuando se pulso Generar
      return buildEffectiveInput();
    },
    onStart: () => setCriteria(''),
    parse: (fullText) => fullText,
    onResult: (fullText, { input: sent }) => {
      setCriteria(fullText);
      onSaveArtifact?.(sent as string, fullText);
      addEntry(historyInputRef.current, fullText);
    },
  });

  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prevRequirements = requirements;
    const prevCriteria = criteria;
    const prevContext = additionalContext;
    setRequirements('');
    setCriteria('');
    setCopied(false);
    setAdditionalContext('');
    showToast(t('common.cleared'), () => {
      setRequirements(prevRequirements);
      setCriteria(prevCriteria);
      setAdditionalContext(prevContext);
    });
  }, [requirements, criteria, additionalContext, gen, showToast, t]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.acceptance;
    setRequirements(demo.input);
    setCriteria(demo.output);
    gen.clearGeneration();
  }, [gen]);

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
              onReview={gen.openReview}
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
            <GenerateButton onClick={gen.handleGenerate} disabled={!canGenerate || gen.isStreaming} loading={gen.status === 'loading' && !gen.isStreaming} />
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
              value={gen.isStreaming ? gen.streamText : criteria}
              onChange={(e) => setCriteria(e.target.value)}
              className="field-textarea criteria-output-ta"
              readOnly={gen.isStreaming}
              placeholder={!criteria ? t('acceptance.outputPlaceholder') : ''}
            />
          </div>
        </div>
      </div>

      <ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
      <Toast toast={toast} />
      {showHistory && (
        <HistoryModal
          entries={history}
          onLoad={(output) => setCriteria(output)}
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
