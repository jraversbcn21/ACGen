import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, getPrompt } from '../services/apiService';
import type { I18nError } from '../services/apiService';
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
  // El unico nombre traducible: los otros cuatro son nombres propios de formato.
  { id: 'text', labelKey: 'converter.formatText' },
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
  const [copied, setCopied] = useState(false);
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
      const message = err instanceof Error ? t(err.message, (err as I18nError).params) : t('error.unexpected');
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
  }, [showToast, t]);

  // Intercambiar formatos mueve tambien el resultado a la entrada: es el gesto
  // util real (convertir de vuelta, o seguir encadenando desde lo generado).
  const handleSwap = useCallback(() => {
    setInputFormat(outputFormat);
    setOutputFormat(inputFormat);
    if (result) {
      setInput(result);
      setResult('');
    }
  }, [inputFormat, outputFormat, result]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = result;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const ext = outputFormat === 'markdown' ? 'md' : outputFormat === 'gerkin' ? 'feature' : 'txt';
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversion.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, outputFormat]);

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

  const formatLabel = (id: string) => {
    const f = FORMATS.find(x => x.id === id);
    return f?.labelKey ? t(f.labelKey) : f?.label ?? id;
  };
  const shown = isStreaming ? streamText : result;

  return (
    <div className="cv-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('converter.title')}</h1>
          <p className="tool-sub">{t('converter.subtitle')}</p>
        </div>
      </header>

      {/* Barra de conversion: origen -> destino + acciones */}
      <div className="cv-bar">
        <span className="cv-bar-label">{t('converter.convertFrom')}</span>
        <div className="cv-bar-select">
          <div className="input-wrap">
            <select
              aria-label={t('converter.inputFormat')}
              value={inputFormat}
              onChange={(e) => setInputFormat(e.target.value)}
              className="field-select"
            >
              {FORMATS.map(f => <option key={f.id} value={f.id}>{formatLabel(f.id)}</option>)}
            </select>
            <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
          </div>
        </div>

        <button type="button" className="cv-swap" onClick={handleSwap} title={t('converter.swap')} aria-label={t('converter.swap')}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8h13l-3-3" />
            <path d="M20 16H7l3 3" />
          </svg>
        </button>

        <span className="cv-bar-label">{t('converter.convertTo')}</span>
        <div className="cv-bar-select">
          <div className="input-wrap">
            <select
              aria-label={t('converter.outputFormat')}
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value)}
              className="field-select"
            >
              {FORMATS.map(f => <option key={f.id} value={f.id}>{formatLabel(f.id)}</option>)}
            </select>
            <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
          </div>
        </div>

        <span className="cv-bar-spacer" />

        <ConfidentialToggle
          view="converter"
          text={buildEffectiveInput()}
          onReview={() => setConf(anonymize(buildEffectiveInput()))}
        />
        <span className="cv-bar-sep" aria-hidden="true" />
        <button type="button" className="btn-ghost" onClick={handleClear} disabled={!input && !result}>
          {t('common.clear')}
        </button>
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate || isStreaming}
          loading={loading || isStreaming}
        />
      </div>

      {/* Origen | Resultado */}
      <div className="cv-panes">
        <div className="cv-pane">
          <div className="cv-pane-head">
            <span className="cv-pane-title">
              {t('converter.source')}
              <span className="cv-pane-format">{formatLabel(inputFormat)}</span>
            </span>
          </div>
          <div className="cv-pane-body">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('converter.inputPlaceholder')}
              className="field-textarea cv-pane-ta"
            />
          </div>
        </div>

        <div className="cv-pane">
          <div className="cv-pane-head">
            <span className="cv-pane-title">
              {t('converter.result')}
              <span className="cv-pane-format">{formatLabel(outputFormat)}</span>
            </span>
            <div className="cv-pane-actions">
              <button
                type="button"
                className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
                onClick={handleCopy}
                disabled={!result}
              >
                {copied ? t('common.copied') : t('common.copy')}
              </button>
              <button type="button" className="btn-ghost" onClick={handleDownload} disabled={!result}>
                {t('converter.download')}
              </button>
            </div>
          </div>
          <div className="cv-pane-body">
            <textarea
              value={shown}
              readOnly
              className="field-textarea cv-pane-ta"
              placeholder={t('converter.outputPlaceholder')}
            />
          </div>
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
