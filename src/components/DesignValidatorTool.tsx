import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonObject, validateDesignReport, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { supportsVision } from '../config/providers';
import { ImageDropzone } from './ImageDropzone';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import type { ContentPart, DesignReport } from '../types';

interface DesignValidatorToolProps {
  apiKey: string;
  model: string;
  provider: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
  onSwitchToVisionModel?: () => void;
}

export function DesignValidatorTool({ apiKey, model, provider, profile, baseUrl, prefill, onSaveArtifact, onSwitchToVisionModel }: DesignValidatorToolProps) {
  const [criteria, setCriteria] = useState('');
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [report, setReport] = useState<DesignReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setCriteria(prefill);
  }, [prefill]);

  const vision = supportsVision(provider, model);
  const canGenerate = apiKey.trim().length > 0 && criteria.trim().length > 0 && image !== null && vision !== 'no';

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming || !image) return;
    setLoading(true);
    setError(null);
    setReport(null);
    const parts: ContentPart[] = [
      { type: 'text', text: `Criterios de aceptación existentes:\n\n${criteria}` },
      { type: 'image_url', image_url: { url: image.dataUrl } },
    ];
    try {
      const gen = streamWithGroq(apiKey, model, parts, getPrompt('designvalidator'), 'testcase', profile, undefined, baseUrl);
      await stream(gen, (fullText) => {
        const parsed = validateDesignReport(extractJsonObject(fullText));
        setReport(parsed);
        onSaveArtifact?.(`${criteria}\n\n[Imagen adjunta: ${image.name}]`, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canGenerate, loading, isStreaming, image, criteria, apiKey, model, profile, baseUrl, stream, onSaveArtifact, t]);

  const handleClear = useCallback(() => {
    const prevCriteria = criteria;
    const prevImage = image;
    const prevReport = report;
    setCriteria('');
    setImage(null);
    setReport(null);
    setError(null);
    showToast(t('common.cleared'), () => {
      setCriteria(prevCriteria);
      setImage(prevImage);
      setReport(prevReport);
    });
  }, [criteria, image, report, showToast, t]);

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

  const copySuggestion = useCallback((s: DesignReport['sugerencias'][number]) => {
    void navigator.clipboard.writeText(`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`);
    showToast(t('common.copied'));
  }, [showToast, t]);

  return (
    <div>
      <div className="tool-layout">
        <textarea
          value={criteria}
          onChange={(e) => setCriteria(e.target.value)}
          placeholder={t('designvalidator.criteriaPlaceholder')}
          className="field-textarea"
          style={{ minHeight: 160 }}
        />
        <ImageDropzone
          imageName={image?.name ?? null}
          onImage={(dataUrl, name) => setImage({ dataUrl, name })}
          onRemove={() => setImage(null)}
          disabled={loading || isStreaming}
        />
        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '6px 0' }}>{t('designvalidator.privacyNote')}</p>

        {image && vision === 'no' && (
          <div className="error-banner" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>{t('designvalidator.needVision', { model })}</span>
            {onSwitchToVisionModel && (
              <button type="button" className="btn-ghost" onClick={onSwitchToVisionModel}>
                {t('designvalidator.switchToVision')}
              </button>
            )}
          </div>
        )}
        {image && vision === 'unknown' && (
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('designvalidator.unknownVision')}</p>
        )}
        {image && vision !== 'no' && !apiKey.trim() && (
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>{t('designvalidator.missingKey')}</p>
        )}

        <div className="actions-bar">
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!criteria && !image && !report}>
            {t('common.clear')}
          </button>
        </div>

        {report && (
          <div className="output-section" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <section>
              <h3>{t('designvalidator.gaps')} ({report.carencias.length})</h3>
              {report.carencias.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('designvalidator.colFlow')}</th><th>{t('designvalidator.colDescription')}</th></tr></thead>
                    <tbody>
                      {report.carencias.map((c, i) => (
                        <tr key={i}><td>{c.flujo}</td><td>{c.descripcion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h3>{t('designvalidator.contradictions')} ({report.contradicciones.length})</h3>
              {report.contradicciones.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th>{t('designvalidator.colCriterion')}</th><th>{t('designvalidator.colEvidence')}</th><th>{t('designvalidator.colDescription')}</th></tr></thead>
                    <tbody>
                      {report.contradicciones.map((c, i) => (
                        <tr key={i}><td>{c.criterio}</td><td>{c.evidenciaDiseno}</td><td>{c.descripcion}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h3>{t('designvalidator.suggestions')} ({report.sugerencias.length})</h3>
              {report.sugerencias.length === 0 ? <p className="empty-note">{t('designvalidator.noFindings')}</p> : (
                report.sugerencias.map((s, i) => (
                  <div key={i} className="suggestion-card" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <strong>{s.titulo}</strong>
                      <button type="button" className="btn-ghost" style={{ fontSize: 12 }} onClick={() => copySuggestion(s)}>
                        {t('common.copy')}
                      </button>
                    </div>
                    <p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0', fontSize: 13 }}>
                      {`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`}
                    </p>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Toast toast={toast} />
    </div>
  );
}
