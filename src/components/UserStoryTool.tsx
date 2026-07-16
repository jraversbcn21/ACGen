import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { ChainMenu } from './ChainMenu';
import { anonymize, applyPlaceholderEdits } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ViewType } from '../config/constants';
import type { ProjectProfile } from '../types/context';

interface UserStoryToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  baseUrl?: string;
  onChain?: (view: ViewType, text: string) => void;
  prefill?: string;
  onSaveArtifact?: (input: string, output: string) => void;
}

export function UserStoryTool({ apiKey, model, profile, baseUrl, onChain, prefill, onSaveArtifact }: UserStoryToolProps) {
  const [idea, setIdea] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [conf, setConf] = useState<{ text: string; map: Record<string, string> } | null>(null);
  const { text: streamText, isStreaming, stream } = useStreamingResponse();
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setIdea(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && idea.trim().length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setLoading(true);
    setResult('');
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, getPrompt('userstory'), 'criteria', profile, effectiveMap, baseUrl);
      await stream(gen, (fullText) => {
        setResult(fullText);
        onSaveArtifact?.(effectiveInput, fullText);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error.unexpected');
      showToast(message);
    } finally {
      setLoading(false);
      setConf(null);
    }
  }, [apiKey, model, profile, stream, showToast, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || loading || isStreaming) return;
    if (localStorage.getItem('acgen_confidential_userstory') === 'true') {
      const { text, map } = anonymize(idea);
      if (Object.keys(map).length > 0) {
        setConf({ text, map });
        return;
      }
    }
    await doGenerate(idea);
  }, [canGenerate, loading, isStreaming, idea, doGenerate]);

  const handleClear = useCallback(() => {
    const prev = idea;
    const prevResult = result;
    setIdea('');
    setResult('');
    showToast(t('common.cleared'), () => {
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
          placeholder={t('userstory.inputPlaceholder')}
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
        <div className="actions-bar">
          <ConfidentialToggle
            view="userstory"
            substitutionCount={0}
            onReview={() => {
              setConf(anonymize(idea));
            }}
          />
          <GenerateButton
            onClick={handleGenerate}
            disabled={!canGenerate || isStreaming}
            loading={loading || isStreaming}
          />
          <button type="button" className="btn-ghost" onClick={handleClear} disabled={!idea && !result}>
            {t('common.clear')}
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
