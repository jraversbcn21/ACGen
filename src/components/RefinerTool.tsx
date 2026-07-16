import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq } from '../services/apiService';
import { REFINER_PROMPT } from '../config/constants';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import type { ProjectProfile } from '../types/context';

interface RefinerToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
}

export function RefinerTool({ apiKey, model, profile }: RefinerToolProps) {
  const [requirement, setRequirement] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();

  const canGenerate = apiKey.trim().length > 0 && requirement.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, requirement, REFINER_PROMPT, 'criteria', profile);
      await stream(gen, (fullText) => {
        setResult(fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      showToast(message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, model, requirement, canGenerate, loading, isStreaming, profile, stream, showToast]);

  const handleClear = useCallback(() => {
    const prev = requirement;
    const prevResult = result;
    setRequirement('');
    setResult('');
    showToast('Campos limpiados', () => {
      setRequirement(prev);
      setResult(prevResult);
    });
  }, [requirement, result, showToast]);

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
          placeholder="Pega el requisito o historia de usuario a analizar..."
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
        <div className="actions-bar">
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
            label="Analizar requisito"
            loadingLabel="Analizando..."
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!requirement && !result}>
            Limpiar
          </button>
        </div>
        {result && (
          <div className="output-section" style={{ marginTop: 16 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, padding: '16px 0' }}>{result}</div>
          </div>
        )}
        {(isStreaming || loading) && !result && (
          <div style={{ marginTop: 16, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{streamText}</div>
        )}
      </div>
      <ErrorBanner message={null} onDismiss={() => {}} />
      <Toast toast={toast} />
    </div>
  );
}
