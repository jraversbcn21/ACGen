import { useState, useCallback, useEffect, useMemo } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { extractJsonArray, validateEdgeCases } from '../services/apiService';
import type { EdgeCase } from '../types';
import { useGenerator } from '../hooks/useGenerator';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import { categoryBadge } from '../utils/categoryBadge';
import { generateShortcutLabel } from '../utils/shortcut';
import { copyText } from '../utils/clipboard';

/**
 * 10b: la entrada es una tarjeta compacta arriba con la botonera a su derecha y
 * la tabla ocupa todo el ancho y toda la altura restante. Antes el textarea y
 * la caja de resultado se repartian el alto a ciegas y dejaban un hueco vacio.
 */
function formatAsTSV(rows: EdgeCase[], header: [string, string, string]): string {
  const body = rows.map((r) =>
    [r.categoria, r.escenario, r.resultadoEsperado]
      .map((v) => (v || '').replace(/\t/g, ' ').replace(/\n/g, ' '))
      .join('\t'),
  );
  return [header.join('\t'), ...body].join('\n');
}

export function EdgeCaseTool({ apiKey, model, profile, prefill, onSaveArtifact, baseUrl }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string; onSaveArtifact?: (input: string, output: string) => void; baseUrl?: string }) {
  const [requirement, setRequirement] = useState('');
  const [edgeCases, setEdgeCases] = useState<EdgeCase[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setRequirement(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirement.trim().length > 0;
  const hasOutput = edgeCases.length > 0;

  /** Recuento por categoria para la cabecera del panel de resultados. */
  const categories = useMemo(() => {
    const acc = new Map<string, number>();
    edgeCases.forEach((ec) => acc.set(ec.categoria, (acc.get(ec.categoria) ?? 0) + 1));
    return Array.from(acc, ([label, count]) => ({ label, count, badge: categoryBadge(label) }));
  }, [edgeCases]);

  const gen = useGenerator<EdgeCase[]>({
    view: 'edgecase',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => requirement,
    parse: (fullText) => {
      const items = extractJsonArray(fullText);
      if (!items || items.length === 0) throw new Error('error.noEdgeCases');
      return validateEdgeCases(items);
    },
    onResult: (cases, { input: sent, fullText, model: usedModel }) => {
      setEdgeCases(cases);
      setGeneratedModel(usedModel);
      onSaveArtifact?.(sent as string, fullText);
    },
  });

  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prev = requirement;
    const prevCases = edgeCases;
    setRequirement('');
    setEdgeCases([]);
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setRequirement(prev);
      setEdgeCases(prevCases);
    });
  }, [requirement, edgeCases, gen, showToast, t]);

  const handleCopy = useCallback(async () => {
    await copyText(formatAsTSV(edgeCases, [t('edgecase.category'), t('edgecase.scenario'), t('edgecase.expectedResult')]));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [edgeCases, t]);

  return (
    <div className="ec-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('edgecase.title')}</h1>
          <p className="tool-sub">{t('edgecase.subtitle')}</p>
        </div>
        {generatedModel && (
          <div className="tool-head-aside">
            <span className="model-badge-new">{t('header.model')}: {generatedModel}</span>
          </div>
        )}
      </header>

      {/* ---------- entrada compacta + botonera ---------- */}
      <div className="ec-input-row">
        <div className="ec-pane ec-input-pane">
          <div className="ec-pane-head">
            <span className="ec-pane-title">{t('edgecase.functionality')}</span>
            <span className="ec-pane-hint">{t('edgecase.chars', { n: String(requirement.length) })} · {generateShortcutLabel()}</span>
          </div>
          <div className="ec-input-body">
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder={t('edgecase.inputPlaceholder')}
              className="field-textarea ec-input-ta"
              aria-label={t('edgecase.functionality')}
            />
          </div>
        </div>

        <div className="ec-actions">
          <ConfidentialToggle
            view="edgecase"
            text={requirement}
            onReview={gen.openReview}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!requirement && !hasOutput}>
            {t('common.clear')}
          </button>
          <GenerateButton
            onClick={gen.handleGenerate}
            disabled={!canGenerate || gen.isStreaming}
            loading={gen.status === 'loading'}
          />
        </div>
      </div>

      {/* ---------- tabla a todo el ancho ---------- */}
      <div className="ec-panel">
        <div className="ec-panel-head">
          <span className="ec-panel-title">
            {t('edgecase.generated')}
            {hasOutput && <span className="history-count">{edgeCases.length}</span>}
            {hasOutput && (
              <span className="ec-cats">
                {categories.map((c) => (
                  <span className={`badge ${c.badge} ec-cat`} key={c.label}>
                    {c.label}
                    <span className="ec-cat-count">{c.count}</span>
                  </span>
                ))}
              </span>
            )}
          </span>
          <div className="ec-panel-actions">
            <button
              type="button"
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopy}
              disabled={!hasOutput}
            >
              {copied ? t('common.copied') : t('edgecase.copyAll')}
            </button>
          </div>
        </div>

        <div className="ec-panel-body">
          {!hasOutput ? (
            <div className="ec-empty">
              <span className="ec-empty-title">{t('edgecase.outputPlaceholder')}</span>
              <span className="ec-empty-sub">{t('edgecase.emptyHint')}</span>
            </div>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="ec-cat-col">{t('edgecase.category')}</th>
                    <th>{t('edgecase.scenario')}</th>
                    <th>{t('edgecase.expectedResult')}</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeCases.map((ec, idx) => (
                    <tr key={idx}>
                      <td className="ec-cat-col"><span className={`badge ${categoryBadge(ec.categoria)}`}>{ec.categoria}</span></td>
                      <td>{ec.escenario}</td>
                      <td>{ec.resultadoEsperado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
      <Toast toast={toast} />
      {gen.review && (
        <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
      )}
    </div>
  );
}
