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
import { copyText } from '../utils/clipboard';
import { generateShortcutLabel } from '../utils/shortcut';

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
  const { isStreaming, stream, reset: resetStream } = useStreamingResponse();
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
    resetStream();
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
  }, [criteria, image, report, resetStream, showToast, t]);

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

  const copySuggestion = useCallback(async (s: DesignReport['sugerencias'][number]) => {
    await copyText(`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`);
    showToast(t('common.copied'));
  }, [showToast, t]);

  return (
    <div className="dv-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('designvalidator.title')}</h1>
          <p className="tool-sub">{t('designvalidator.subtitle')}</p>
        </div>
        {vision === 'yes' && (
          <div className="tool-head-aside">
            <span className="dv-vision-chip">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              {t('designvalidator.visionReady')}
            </span>
          </div>
        )}
      </header>

      <div className="dv-grid">
        {/* ---------- IZQUIERDA: criterios + imagen + acciones ---------- */}
        <div className="dv-side">
          <div className="dv-field dv-field--crit">
            <label htmlFor="dv-criteria" className="dv-label">
              {t('designvalidator.criteriaLabel')}
              <span className="hint">{generateShortcutLabel()}</span>
            </label>
            <textarea
              id="dv-criteria"
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder={t('designvalidator.criteriaPlaceholder')}
              className="field-textarea dv-criteria-ta"
            />
          </div>

          <div className="dv-field dv-field--img">
            <span className="dv-label">{t('designvalidator.imageLabel')}</span>
            <ImageDropzone
              imageName={image?.name ?? null}
              imageUrl={image?.dataUrl ?? null}
              onImage={(dataUrl, name) => setImage({ dataUrl, name })}
              onRemove={() => setImage(null)}
              disabled={loading || isStreaming}
            />
            <p className="dv-note">{t('designvalidator.privacyNote')}</p>
          </div>

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
            <p className="dv-note">{t('designvalidator.unknownVision')}</p>
          )}
          {image && vision !== 'no' && !apiKey.trim() && (
            <p className="dv-note">{t('designvalidator.missingKey')}</p>
          )}

          <div className="dv-card">
            <button type="button" className="btn-ghost" onClick={handleClear} disabled={!criteria && !image && !report}>
              {t('common.clear')}
            </button>
            <GenerateButton
              onClick={handleGenerate}
              disabled={!canGenerate || isStreaming}
              loading={loading || isStreaming}
            />
          </div>
        </div>

        {/* ---------- DERECHA: informe ---------- */}
        <div className="dv-panel">
          <div className="dv-panel-head">
            <span className="dv-panel-title">{t('designvalidator.report')}</span>
            {report && (
              <div className="dv-counts">
                <span className="dv-count dv-count-gaps">{report.carencias.length} · {t('designvalidator.gaps')}</span>
                <span className="dv-count dv-count-contra">{report.contradicciones.length} · {t('designvalidator.contradictions')}</span>
                <span className="dv-count dv-count-sug">{report.sugerencias.length} · {t('designvalidator.suggestions')}</span>
              </div>
            )}
          </div>

          <div className="dv-panel-body">
            {!report ? (
              <div className="dv-empty">
                <span className="dv-empty-title">{t('designvalidator.outputPlaceholder')}</span>
                <span className="dv-empty-sub">{t('designvalidator.emptyHint')}</span>
              </div>
            ) : (
              <div className="dv-report">
                <section className="dv-section">
                  <h3 className="dv-section-title">{t('designvalidator.gaps')} ({report.carencias.length})</h3>
                  {report.carencias.length === 0 ? <p className="dv-none">{t('designvalidator.noFindings')}</p> : (
                    report.carencias.map((c, i) => (
                      <div className="dv-row" key={i}>
                        <span className="dv-row-key">{c.flujo}</span>
                        <span className="dv-row-body">{c.descripcion}</span>
                      </div>
                    ))
                  )}
                </section>

                <section className="dv-section">
                  <h3 className="dv-section-title">{t('designvalidator.contradictions')} ({report.contradicciones.length})</h3>
                  {report.contradicciones.length === 0 ? <p className="dv-none">{t('designvalidator.noFindings')}</p> : (
                    report.contradicciones.map((c, i) => (
                      <div className="dv-row" key={i}>
                        <span className="dv-row-key">{c.criterio}</span>
                        <span className="dv-row-body">
                          {c.descripcion}
                          <span className="dv-row-evidence">{t('designvalidator.colEvidence')}: {c.evidenciaDiseno}</span>
                        </span>
                      </div>
                    ))
                  )}
                </section>

                <section className="dv-section">
                  <h3 className="dv-section-title">{t('designvalidator.suggestions')} ({report.sugerencias.length})</h3>
                  {report.sugerencias.length === 0 ? <p className="dv-none">{t('designvalidator.noFindings')}</p> : (
                    report.sugerencias.map((s, i) => (
                      <div className="dv-suggestion" key={i}>
                        <div className="dv-suggestion-head">
                          <span className="dv-suggestion-title">{s.titulo}</span>
                          <button type="button" className="btn-ghost" onClick={() => copySuggestion(s)}>
                            {t('common.copy')}
                          </button>
                        </div>
                        <p className="dv-suggestion-body">
                          {`Dado ${s.dado}\nCuando ${s.cuando}\nEntonces ${s.entonces}`}
                        </p>
                      </div>
                    ))
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <Toast toast={toast} />
    </div>
  );
}
