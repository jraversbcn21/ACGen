import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonArray, getPrompt } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';

const CATEGORY_BADGES: Record<string, string> = {
  'Valores frontera': 'badge-high',
  'Estados vacios': 'badge-medium',
  'Concurrencia': 'badge-warning',
  'Internacionalizacion (i18n)': 'badge-info',
  'Permisos y roles': 'badge-danger',
  'Red y conectividad': 'badge-medium',
  'Internacionalizacion': 'badge-info',
};

export function EdgeCaseTool({ apiKey, model, profile, prefill, onSaveArtifact }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string; onSaveArtifact?: (input: string, output: string) => void }) {
  const [requirement, setRequirement] = useState('');
  const [edgeCases, setEdgeCases] = useState<Array<{ categoria: string; escenario: string; resultadoEsperado: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
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
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('edgecase'), 'testcase', profile, effectiveMap);
      await stream(gen, (fullText) => {
        const items = extractJsonArray(fullText);
        if (!items || items.length === 0) {
          throw new Error(t('error.noEdgeCases'));
        }
        setEdgeCases(items as Array<{ categoria: string; escenario: string; resultadoEsperado: string }>);
        onSaveArtifact?.(effectiveInput, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error.unexpected');
      setError(message);
    } finally {
      setLoading(false);
      setConfMap(null);
    }
  }, [apiKey, model, profile, stream, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    const confKey = `acgen_confidential_edgecase`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(requirement);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(requirement);
    } else {
      await doGenerate(requirement);
    }
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
  }, [requirement, edgeCases, showToast]);

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
            substitutionCount={0}
            onReview={() => {
              const { map } = anonymize(requirement);
              setConfMap(map);
            }}
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
                      <td><span className={`badge ${CATEGORY_BADGES[ec.categoria] || 'badge-medium'}`}>{ec.categoria}</span></td>
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
      {confMap && (
        <AnonymizerReview
          map={confMap}
          onCancel={() => setConfMap(null)}
          onConfirm={(editedMap) => {
            doGenerate(requirement, editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
