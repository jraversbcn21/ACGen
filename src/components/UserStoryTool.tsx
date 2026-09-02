import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { ChainMenu } from './ChainMenu';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ViewType } from '../config/constants';
import type { ProjectProfile } from '../types/context';
import { stripMarkdown } from '../utils/stripMarkdown';

interface UserStoryToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

export function UserStoryTool({ apiKey, model, profile, baseUrl, onChain, prefill, onSaveArtifact }: UserStoryToolProps) {
  // 'guided' compone la historia desde rol/accion/beneficio; 'free' usa el texto tal cual.
  const [mode, setMode] = useState<'guided' | 'free'>('guided');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [benefit, setBenefit] = useState('');
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { text: streamText, isStreaming, stream, reset: resetStream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    // Un prefill viene de otra herramienta: es texto ya redactado, no encaja en los tres campos.
    if (prefill) {
      setIdea(prefill);
      setMode('free');
    }
  }, [prefill]);

  const guidedText = [
    role.trim() && `Como ${role.trim()}`,
    action.trim() && `quiero ${action.trim()}`,
    benefit.trim() && `para ${benefit.trim()}`,
  ].filter(Boolean).join(', ');

  const effectiveInput = mode === 'guided' ? guidedText : idea;
  const hasInput = mode === 'guided'
    ? role.trim().length > 0 && action.trim().length > 0
    : idea.trim().length > 0;
  const canGenerate = apiKey.trim().length > 0 && hasInput;

  const doGenerate = useCallback(async (input: string, effectiveMap?: Record<string, string>) => {
    if (loading || isStreaming) return;
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, input, getPrompt('userstory'), 'criteria', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => {
        // Se limpia aqui y no al pintar para que lo que copias, encadenas y se
        // guarda en el historial sea el mismo texto plano que ves.
        const limpio = stripMarkdown(fullText);
        setResult(limpio);
        onSaveArtifact?.(input, limpio);
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      showToast(message);
    } finally {
      setLoading(false);
      setConf(null);
    }
  }, [loading, isStreaming, apiKey, model, profile, baseUrl, stream, onSaveArtifact, showToast, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    if (localStorage.getItem('acgen_confidential_userstory') === 'true') {
      const { text, map } = anonymize(effectiveInput);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(effectiveInput);
  }, [canGenerate, loading, isStreaming, effectiveInput, doGenerate]);

  const handleClear = useCallback(() => {
    resetStream();
    const prev = { role, action, benefit, idea, result };
    setRole('');
    setAction('');
    setBenefit('');
    setIdea('');
    setResult('');
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setRole(prev.role);
      setAction(prev.action);
      setBenefit(prev.benefit);
      setIdea(prev.idea);
      setResult(prev.result);
    });
  }, [role, action, benefit, idea, result, resetStream, showToast, t]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && !loading && !isStreaming) handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGenerate, loading, isStreaming, handleGenerate]);

  const isBusy = loading || isStreaming;
  const hasOutput = result.length > 0;

  return (
    <div className="us-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('userstory.title')}</h1>
          <p className="tool-sub">{t('userstory.subtitle')}</p>
        </div>
      </header>

      <div className="us-grid">
        {/* ---------- IZQUIERDA: formulario ---------- */}
        <div className="us-side">
          <div className="us-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'guided'}
              className={`us-tab ${mode === 'guided' ? 'us-tab-active' : ''}`}
              onClick={() => setMode('guided')}
            >
              {t('userstory.guided')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'free'}
              className={`us-tab ${mode === 'free' ? 'us-tab-active' : ''}`}
              onClick={() => setMode('free')}
            >
              {t('userstory.freeText')}
            </button>
          </div>

          {mode === 'guided' ? (
            <div className="us-fields">
              <div className="us-field">
                <label htmlFor="us-role" className="field-label">
                  {t('userstory.role')} <span className="hint">· {t('userstory.roleHint')}</span>
                </label>
                <input
                  id="us-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('userstory.rolePlaceholder')}
                  className="field-input"
                />
              </div>
              <div className="us-field us-field--grow">
                <label htmlFor="us-action" className="field-label">
                  {t('userstory.action')} <span className="hint">· {t('userstory.actionHint')}</span>
                </label>
                <textarea
                  id="us-action"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder={t('userstory.actionPlaceholder')}
                  className="field-textarea us-field-ta"
                />
              </div>
              <div className="us-field us-field--grow">
                <label htmlFor="us-benefit" className="field-label">
                  {t('userstory.benefit')} <span className="hint">· {t('userstory.benefitHint')}</span>
                </label>
                <textarea
                  id="us-benefit"
                  value={benefit}
                  onChange={(e) => setBenefit(e.target.value)}
                  placeholder={t('userstory.benefitPlaceholder')}
                  className="field-textarea us-field-ta"
                />
              </div>
            </div>
          ) : (
            <div className="us-fields">
              <div className="us-field us-field--grow">
                <textarea
                  id="us-idea"
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  placeholder={t('userstory.inputPlaceholder')}
                  className="field-textarea us-free-ta"
                />
              </div>
              <span className="us-hint">{t('userstory.inputHint')}</span>
            </div>
          )}

          <div className="us-card">
            <ConfidentialToggle
              view="userstory"
              text={effectiveInput}
              onReview={() => setConf(anonymize(effectiveInput))}
            />
            <div className="us-card-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClear}
                disabled={!hasInput && !hasOutput}
              >
                {t('common.clear')}
              </button>
              <GenerateButton
                onClick={handleGenerate}
                disabled={!canGenerate || isStreaming}
                loading={isBusy}
              />
            </div>
          </div>
        </div>

        {/* ---------- DERECHA: historia generada ---------- */}
        <div className="us-panel">
          <div className="us-panel-head">
            <span className="us-panel-title">{t('userstory.generated')}</span>
            <div className="us-panel-actions">
              {hasOutput && (
                <button
                  type="button"
                  className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
                  onClick={handleCopy}
                >
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              )}
              {hasOutput && onChain && (
                <ChainMenu sourceView="userstory" content={result} onChain={onChain} />
              )}
            </div>
          </div>

          <div className="us-panel-body">
            {hasOutput ? (
              <div data-testid="userstory-output" className="us-output">{result}</div>
            ) : isBusy ? (
              <div className="us-output">{stripMarkdown(streamText)}</div>
            ) : (
              <div className="us-empty">
                <span className="us-empty-title">{t('userstory.outputPlaceholder')}</span>
                <span className="us-empty-sub">{t('userstory.inputHint')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <ErrorBanner message={null} onDismiss={() => {}} />
      <Toast toast={toast} />
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
