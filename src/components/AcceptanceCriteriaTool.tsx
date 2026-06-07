import { useState, useCallback, useRef } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { generateCriteria } from '../services/apiService';
import { HARDCODED_PROMPT, STORAGE_KEYS } from '../config/constants';
import { extractIssueKey, fetchJiraTicket, formatTicketAsText } from '../services/jiraService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { GenerationStatus } from '../types';

interface AcceptanceCriteriaToolProps {
  apiKey: string;
  model: string;
}

export function AcceptanceCriteriaTool({ apiKey, model }: AcceptanceCriteriaToolProps) {
  const [requirements, setRequirements] = useState('');
  const [criteria, setCriteria] = useState('');
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [jiraToken, setJiraToken] = useLocalStorage(STORAGE_KEYS.JIRA_TOKEN, '');
  const [jiraBaseUrl, setJiraBaseUrl] = useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL, '');

  const canGenerate = apiKey.trim().length > 0 && requirements.trim().length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setStatus('loading');
    setError(null);
    setCriteria('');
    setReasoning(undefined);

    try {
      let inputText = requirements;
      const issueKey = extractIssueKey(requirements);

      if (issueKey) {
        if (!jiraToken.trim() || !jiraBaseUrl.trim()) {
          throw new Error('Configura la URL base y el token de Jira para poder leer tickets.');
        }
        setLoadingStatus('Obteniendo datos del ticket...');
        const ticket = await fetchJiraTicket(issueKey, jiraToken.trim(), jiraBaseUrl.trim());
        inputText = formatTicketAsText(ticket);
      }

      setLoadingStatus('Generando criterios...');
      const result = await generateCriteria(apiKey, model, inputText, HARDCODED_PROMPT);
      setCriteria(result.content);
      setReasoning(result.reasoning);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
      setStatus('error');
    } finally {
      setLoadingStatus('');
    }
  }, [apiKey, model, requirements, canGenerate, jiraToken, jiraBaseUrl]);

  const handleClear = useCallback(() => {
    if (!window.confirm('¿Seguro que quieres limpiar los campos?')) return;
    setRequirements('');
    setCriteria('');
    setReasoning(undefined);
    setError(null);
    setStatus('idle');
    setCopied(false);
  }, []);

  const reasoningRef = useRef<HTMLDetailsElement>(null);

  const handleReasoningToggle = useCallback(() => {
    const el = reasoningRef.current;
    if (!el || !el.open) return;
    requestAnimationFrame(() => {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'center' });
    });
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(criteria);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.getElementById('criteria-output') as HTMLTextAreaElement;
      if (textarea) {
        textarea.select();
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    }
  }, [criteria]);

  return (
    <div>
      <div className="jira-config">
        <span className="jira-config-title">Jira (opcional)</span>
        <div className="jira-fields">
          <div>
            <label htmlFor="jira-base-url" className="field-label">URL base de Jira</label>
            <input
              id="jira-base-url"
              type="text"
              value={jiraBaseUrl}
              onChange={(e) => setJiraBaseUrl(e.target.value)}
              placeholder="https://jira.tuempresa.com/jira"
              className="field-input"
            />
          </div>
          <div>
            <label htmlFor="jira-token" className="field-label">Token PAT de Jira</label>
            <input
              id="jira-token"
              type="password"
              value={jiraToken}
              onChange={(e) => setJiraToken(e.target.value)}
              placeholder="Tu Personal Access Token"
              className="field-input"
            />
          </div>
        </div>
      </div>

      <div className="criteria-grid">
        <div className="criteria-left">
          <textarea
            id="requirements"
            value={requirements}
            onChange={(e) => setRequirements(e.target.value)}
            placeholder="Pega la URL del ticket de Jira o escribe los requisitos..."
            className="field-textarea criteria-input-ta"
          />
          <textarea
            id="criteria-output"
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            className="field-textarea criteria-output-ta"
            readOnly={false}
            placeholder={!criteria ? 'Los criterios generados aparecerán aquí...' : ''}
          />
          {criteria && (
            <div className="copy-row">
              <button
                type="button"
                className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
                onClick={handleCopy}
              >
                {copied ? '¡Copiado!' : 'Copiar al portapapeles'}
              </button>
            </div>
          )}
        </div>
        <div className="criteria-right">
          {reasoning && (
            <details ref={reasoningRef} className="reasoning" onToggle={handleReasoningToggle}>
              <summary>Razonamiento del modelo</summary>
              <div className="reasoning-body">{reasoning}</div>
            </details>
          )}
        </div>
      </div>

      <div className="actions-bar">
        <GenerateButton onClick={handleGenerate} disabled={!canGenerate} loading={status === 'loading'} />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={!requirements && !criteria}
        >
          Limpiar
        </button>
      </div>
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
