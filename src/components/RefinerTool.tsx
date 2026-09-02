import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { useGenerator } from '../hooks/useGenerator';
import { copyText } from '../utils/clipboard';
import { ChainMenu } from './ChainMenu';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import { stripMarkdown } from '../utils/stripMarkdown';
import type { ViewType } from '../config/constants';
import type { ProjectProfile } from '../types/context';

interface RefinerToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

/** El prompt del refinador ya responde "estructurado por categorias, con
 *  viñetas claras". Esto no le pide nada nuevo: cuenta las viñetas que cuelgan
 *  de cada encabezado para poder resumirlas arriba. Si el modelo se sale del
 *  formato, devuelve [] y la tarjeta de resumen simplemente no aparece. */
function summarizeFindings(text: string): { label: string; count: number }[] {
  const out: { label: string; count: number }[] = [];
  let current: { label: string; count: number } | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Encabezado: **Titulo**, ## Titulo, o "1. Titulo:" — sin viñeta delante.
    const heading = line.match(/^(?:#{1,4}\s*)?(?:\d+[.)]\s*)?\*{0,2}([^*:#][^*:]{2,60})\*{0,2}\s*:?\s*$/);
    const isBullet = /^[-*•]\s+|^\d+[.)]\s+\S/.test(line);
    if (heading && !isBullet) {
      current = { label: heading[1].trim().replace(/\s*:$/, ''), count: 0 };
      out.push(current);
      continue;
    }
    if (current && /^[-*•]\s+/.test(line)) current.count += 1;
  }
  return out.filter((s) => s.count > 0);
}

export function RefinerTool({ apiKey, model, profile, baseUrl, onChain, prefill, onSaveArtifact }: RefinerToolProps) {
  const [requirement, setRequirement] = useState('');
  const [result, setResult] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setRequirement(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirement.trim().length > 0;

  const gen = useGenerator<string>({
    view: 'refiner',
    toolType: 'criteria',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => requirement,
    parse: (fullText) => stripMarkdown(fullText),
    onResult: (limpio, { input: sent }) => {
      setResult(limpio);
      onSaveArtifact?.(sent as string, limpio);
    },
    onError: showToast,
  });

  const handleCopy = useCallback(async () => {
    if (!result) return;
    await copyText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prev = requirement;
    const prevResult = result;
    setRequirement('');
    setResult('');
    showToast(t('common.cleared'), () => {
      setRequirement(prev);
      setResult(prevResult);
    });
  }, [requirement, result, gen, showToast, t]);

  const shown = result || (gen.status === 'loading' ? gen.streamText : '');
  const findings = result ? summarizeFindings(result) : [];

  return (
    <div className="rf-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('refiner.title')}</h1>
          <p className="tool-sub">{t('refiner.subtitle')}</p>
        </div>
        <div className="tool-head-aside rf-head-actions">
          <ConfidentialToggle
            view="refiner"
            text={requirement}
            onReview={gen.openReview}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!requirement && !result}>
            {t('common.clear')}
          </button>
          <GenerateButton
            onClick={gen.handleGenerate}
            disabled={!canGenerate || gen.isStreaming}
            loading={gen.status === 'loading'}
          />
        </div>
      </header>

      <div className="rf-panes">
        {/* ---------- ANTES: el requisito tal cual ---------- */}
        <div className="rf-pane">
          <div className="rf-pane-head">
            <span className="rf-pane-title">
              {t('refiner.before')}
              <span className="rf-pane-hint">{t('refiner.beforeHint')}</span>
            </span>
            <span className="rf-pane-count">{t('refiner.chars', { n: String(requirement.length) })}</span>
          </div>
          <div className="rf-pane-body">
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder={t('refiner.inputPlaceholder')}
              className="field-textarea rf-pane-ta"
              aria-label={t('refiner.before')}
            />
          </div>
        </div>

        {/* ---------- DESPUÉS: el análisis ---------- */}
        <div className="rf-col">
          <div className="rf-pane">
            <div className="rf-pane-head">
              <span className="rf-pane-title">
                {t('refiner.after')}
                <span className="rf-pane-hint">{t('refiner.afterHint')}</span>
              </span>
              <div className="rf-pane-actions">
                {result && (
                  <button type="button" className={`btn-ghost ${copied ? 'btn-copied' : ''}`} onClick={handleCopy}>
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                )}
                {result && onChain && <ChainMenu sourceView="refiner" content={result} onChain={onChain} />}
              </div>
            </div>
            <div className="rf-pane-scroll">
              {shown ? (
                <p className="rf-output">{shown}</p>
              ) : (
                <div className="rf-empty">
                  <span className="rf-empty-title">{t('refiner.outputPlaceholder')}</span>
                  <span className="rf-empty-sub">{t('refiner.emptyHint')}</span>
                </div>
              )}
            </div>
          </div>

          {findings.length > 0 && (
            <div className="rf-findings">
              <span className="rf-findings-title">{t('refiner.findings')}</span>
              <div className="rf-findings-list">
                {findings.map((f) => (
                  <span className="rf-finding" key={f.label}>
                    {f.label}
                    <span className="rf-finding-count">{f.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ErrorBanner message={null} onDismiss={() => {}} />
      <Toast toast={toast} />
      {gen.review && (
        <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
      )}
    </div>
  );
}
