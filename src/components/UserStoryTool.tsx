import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq } from '../services/apiService';
import { USER_STORY_PROMPT } from '../config/constants';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { ChainMenu } from './ChainMenu';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import type { ViewType } from '../config/constants';
import type { ProjectProfile } from '../types/context';

interface UserStoryToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
}

export function UserStoryTool({ apiKey, model, profile, onChain, prefill }: UserStoryToolProps) {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();

  useEffect(() => {
    if (prefill) setIdea(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && idea.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, USER_STORY_PROMPT, 'criteria', profile, effectiveMap);
      await stream(gen, (fullText) => {
        setResult(fullText);
      });
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
    const confKey = `acgen_confidential_userstory`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(idea);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(idea);
    } else {
      await doGenerate(idea);
    }
  }, [canGenerate, loading, isStreaming, idea, doGenerate]);

  const handleClear = useCallback(() => {
    const prev = idea;
    const prevResult = result;
    setIdea('');
    setResult('');
    showToast('Campos limpiados', () => {
      setIdea(prev);
      setResult(prevResult);
    });
  }, [idea, result, showToast]);

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
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Describe la necesidad o idea de funcionalidad..."
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
        <div className="actions-bar">
          <ConfidentialToggle
            view="userstory"
            substitutionCount={0}
            onReview={() => {
              const { map } = anonymize(idea);
              setConfMap(map);
            }}
          />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
            label="Generar historia"
            loadingLabel="Generando..."
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!idea && !result}>
            Limpiar
          </button>
        </div>
        {result && (
          <div className="output-section" style={{ marginTop: 16 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, padding: '16px 0' }}>{result}</div>
            {onChain && <ChainMenu sourceView="userstory" content={result} onChain={onChain} />}
          </div>
        )}
        {(isStreaming || loading) && !result && (
          <div style={{ marginTop: 16, whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{streamText}</div>
        )}
      </div>
      <ErrorBanner message={null} onDismiss={() => {}} />
      <Toast toast={toast} />
      {confMap && (
        <AnonymizerReview
          map={confMap}
          onCancel={() => setConfMap(null)}
          onConfirm={(editedMap) => {
            doGenerate(idea, editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
