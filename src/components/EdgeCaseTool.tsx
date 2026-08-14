import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonArray, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import { categoryBadge } from '../utils/categoryBadge';

export function EdgeCaseTool({ apiKey, model, profile, prefill, onSaveArtifact, baseUrl }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string; onSaveArtifact?: (input: string, output: string) => void; baseUrl?: string }) {
  const [requirement, setRequirement] = useState('');
  const [edgeCases, setEdgeCases] = useState<Array<{ categoria: string; escenario: string; resultadoEsperado: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setRequirement(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirement.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setLoading(true);
    setError(null);
    setEdgeCases([]);
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('edgecase'), 'testcase', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => {
        const items = extractJsonArray(fullText);
        if (!items || items.length === 0) {
          throw new Error(t('error.noEdgeCases'));
        }
        setEdgeCases(items as Array<{ categoria: string; escenario: string; resultadoEsperado: string }>);
        onSaveArtifact?.(effectiveInput, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      setError(message);
    } finally {
      setLoading(false);
      setConf(null);
    }
  }, [apiKey, model, profile, stream, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    if (localStorage.getItem('acgen_confidential_edgecase') === 'true') {
      const { text, map } = anonymize(requirement);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(requirement);
  }, [canGenerate, loading, isStreaming, requirement, doGenerate]);

  const handleClear = useCallback(() => {
    const prev = requirement;
    const prevCases = edgeCases;
    setRequirement('');
    setEdgeCases([]);
    setError(null);
    showToast(t('common.cleared'), () => {
      setRequirement(prev);
      setEdgeCases(prevCases);
    });
  }, [requirement, edgeCases, showToast, t]);

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

  return (
    <div>
      <div className="tool-layout">
        <textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          placeholder={t('edgecase.inputPlaceholder')}
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
        <div className="actions-bar">
          <ConfidentialToggle
            view="edgecase"
            text={requirement}
            onReview={() => setConf(anonymize(requirement))}
          />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!requirement && edgeCases.length === 0}>
            {t('common.clear')}
          </button>
        </div>

        {edgeCases.length > 0 && (
          <div className="output-section" style={{ marginTop: 16 }}>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('edgecase.category')}</th>
                    <th>{t('edgecase.scenario')}</th>
                    <th>{t('edgecase.expectedResult')}</th>
                  </tr>
                </thead>
                <tbody>
                  {edgeCases.map((ec, idx) => (
                    <tr key={idx}>
                      <td><span className={`badge ${categoryBadge(ec.categoria)}`}>{ec.categoria}</span></td>
                      <td>{ec.escenario}</td>
                      <td>{ec.resultadoEsperado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
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
