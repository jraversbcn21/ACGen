import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonArray } from '../services/apiService';
import { EDGE_CASE_PROMPT } from '../config/constants';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
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

export function EdgeCaseTool({ apiKey, model, profile, prefill }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string }) {
  const [requirement, setRequirement] = useState('');
  const [edgeCases, setEdgeCases] = useState<Array<{ categoria: string; escenario: string; resultadoEsperado: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (prefill) setRequirement(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && requirement.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    setLoading(true);
    setError(null);
    setEdgeCases([]);
    try {
      const gen = streamWithGroq(apiKey, model, requirement, EDGE_CASE_PROMPT, 'testcase', profile);
      await stream(gen, (fullText) => {
        const items = extractJsonArray(fullText);
        if (!items || items.length === 0) {
          throw new Error('No se generaron casos limite. Intenta con una descripcion mas detallada.');
        }
        setEdgeCases(items as Array<{ categoria: string; escenario: string; resultadoEsperado: string }>);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, model, requirement, canGenerate, loading, isStreaming, profile, stream]);

  const handleClear = useCallback(() => {
    const prev = requirement;
    const prevCases = edgeCases;
    setRequirement('');
    setEdgeCases([]);
    setError(null);
    showToast('Campos limpiados', () => {
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
          placeholder="Describe el requisito o funcionalidad para detectar casos limite..."
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
        <div className="actions-bar">
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
            label="Generar casos limite"
            loadingLabel="Generando..."
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!requirement && edgeCases.length === 0}>
            Limpiar
          </button>
        </div>

        {edgeCases.length > 0 && (
          <div className="output-section" style={{ marginTop: 16 }}>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Categoria</th>
                    <th>Escenario</th>
                    <th>Resultado esperado</th>
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
    </div>
  );
}
