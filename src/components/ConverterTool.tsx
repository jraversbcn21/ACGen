import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';

const FORMATS = [
  { id: 'gerkin', label: 'Gherkin (BDD)' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'jirawiki', label: 'Jira Wiki' },
  { id: 'azdo', label: 'Azure DevOps' },
  { id: 'text', label: 'Texto plano' },
];

interface ConverterToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

export function ConverterTool({ apiKey, model, profile, baseUrl, onSaveArtifact }: ConverterToolProps) {
  const [input, setInput] = useState('');
  const [inputFormat, setInputFormat] = useState('text');
  const [outputFormat, setOutputFormat] = useState('markdown');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('converter'), 'criteria', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => { setResult(fullText); onSaveArtifact?.(effectiveInput, fullText); });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error.unexpected');
      showToast(message);
    } finally {
      setLoading(false);
      setConf(null);
    }
  }, [apiKey, model, profile, stream, showToast, t]);

  const buildEffectiveInput = useCallback(
    () => `Formato de entrada: ${inputFormat}\nFormato de salida: ${outputFormat}\n\nTexto a convertir:\n${input}`,
    [input, inputFormat, outputFormat],
  );

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    const effectiveInput = buildEffectiveInput();
    if (localStorage.getItem('acgen_confidential_converter') === 'true') {
      const { text, map } = anonymize(effectiveInput);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(effectiveInput);
  }, [canGenerate, loading, isStreaming, buildEffectiveInput, doGenerate]);

  const handleClear = useCallback(() => {
    setInput('');
    setResult('');
    showToast(t('common.cleared'));
  }, [showToast]);

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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="br-compact-row" style={{ marginBottom: 8 }}>
              <div className="br-compact-field">
                <label className="field-label">{t('converter.inputFormat')}</label>
                <div className="input-wrap">
                  <select value={inputFormat} onChange={(e) => setInputFormat(e.target.value)} className="field-select">
                    {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
                </div>
              </div>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('converter.inputPlaceholder')}
              className="field-textarea"
              style={{ minHeight: 300 }}
            />
          </div>
          <div>
            <div className="br-compact-row" style={{ marginBottom: 8 }}>
              <div className="br-compact-field">
                <label className="field-label">{t('converter.outputFormat')}</label>
                <div className="input-wrap">
                  <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)} className="field-select">
                    {FORMATS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                  </select>
                  <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
                </div>
              </div>
            </div>
            <textarea
              value={isStreaming ? streamText : result}
              readOnly
              className="field-textarea"
              style={{ minHeight: 300 }}
              placeholder={t('converter.outputPlaceholder')}
            />
          </div>
        </div>
        <div className="actions-bar">
          <ConfidentialToggle
            view="converter"
            substitutionCount={0}
            onReview={() => setConf(anonymize(buildEffectiveInput()))}
          />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!input && !result}>
            {t('common.clear')}
          </button>
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
