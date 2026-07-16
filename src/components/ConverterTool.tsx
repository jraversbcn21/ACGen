import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq } from '../services/apiService';
import { CONVERTER_PROMPT } from '../config/constants';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
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
}

export function ConverterTool({ apiKey, model, profile }: ConverterToolProps) {
  const [input, setInput] = useState('');
  const [inputFormat, setInputFormat] = useState('text');
  const [outputFormat, setOutputFormat] = useState('markdown');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();

  const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, CONVERTER_PROMPT, 'criteria', profile, effectiveMap);
      await stream(gen, (fullText) => { setResult(fullText); });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      showToast(message);
    } finally {
      setLoading(false);
      setConfMap(null);
    }
  }, [apiKey, model, profile, stream, showToast]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    const effectiveInput = `Formato de entrada: ${inputFormat}\nFormato de salida: ${outputFormat}\n\nTexto a convertir:\n${input}`;
    const confKey = `acgen_confidential_converter`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(effectiveInput);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(effectiveInput);
    } else {
      await doGenerate(effectiveInput);
    }
  }, [canGenerate, loading, isStreaming, input, inputFormat, outputFormat, doGenerate]);

  const handleClear = useCallback(() => {
    setInput('');
    setResult('');
    showToast('Campos limpiados');
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
                <label className="field-label">Formato origen</label>
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
              placeholder="Pega el texto a convertir..."
              className="field-textarea"
              style={{ minHeight: 300 }}
            />
          </div>
          <div>
            <div className="br-compact-row" style={{ marginBottom: 8 }}>
              <div className="br-compact-field">
                <label className="field-label">Formato destino</label>
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
              placeholder="El resultado aparecera aqui..."
            />
          </div>
        </div>
        <div className="actions-bar">
          <ConfidentialToggle
            view="converter"
            substitutionCount={0}
            onReview={() => {
              const effectiveInput = `Formato de entrada: ${inputFormat}\nFormato de salida: ${outputFormat}\n\nTexto a convertir:\n${input}`;
              const { map } = anonymize(effectiveInput);
              setConfMap(map);
            }}
          />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
            label="Convertir"
            loadingLabel="Convirtiendo..."
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!input && !result}>
            Limpiar
          </button>
        </div>
      </div>
      <ErrorBanner message={null} onDismiss={() => {}} />
      <Toast toast={toast} />
      {confMap && (
        <AnonymizerReview
          map={confMap}
          onCancel={() => setConfMap(null)}
          onConfirm={(editedMap) => {
            const effectiveInput = `Formato de entrada: ${inputFormat}\nFormato de salida: ${outputFormat}\n\nTexto a convertir:\n${input}`;
            doGenerate(effectiveInput, editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
