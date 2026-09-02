import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { useToast, Toast } from './Toast';
import { useGenerator } from '../hooks/useGenerator';
import { copyText } from '../utils/clipboard';
import { ChainMenu } from './ChainMenu';
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

  const gen = useGenerator<string>({
    view: 'userstory',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => effectiveInput,
    onStart: () => setResult(''),
    parse: (fullText) => stripMarkdown(fullText),
    onResult: (limpio, { input: sent }) => {
      setResult(limpio);
      onSaveArtifact?.(sent as string, limpio);
    },
    onError: showToast,
  });
  const isBusy = gen.status === 'loading';

  const handleClear = useCallback(() => {
    gen.clearGeneration();
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
  }, [role, action, benefit, idea, result, gen, showToast, t]);

  const handleCopy = useCallback(async () => {
    await copyText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

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
              onReview={gen.openReview}
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
                onClick={gen.handleGenerate}
                disabled={!canGenerate || gen.isStreaming}
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
              <div className="us-output">{stripMarkdown(gen.streamText)}</div>
            ) : (
              <div className="us-empty">
                <span className="us-empty-title">{t('userstory.outputPlaceholder')}</span>
                <span className="us-empty-sub">{t('userstory.inputHint')}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <Toast toast={toast} />
      {gen.review && (
        <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
      )}
    </div>
  );
}
