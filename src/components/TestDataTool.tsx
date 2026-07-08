import { useState, useCallback, useMemo } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { SearchableSelect } from './SearchableSelect';
import { generateTestData } from '../services/apiService';
import { BERSHKA_MARKETS, DATA_TYPES, STORAGE_KEYS } from '../config/constants';
import { extractIssueKey, fetchJiraTicket, formatTicketAsText } from '../services/jiraService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type { TestDataFormData } from '../types';

interface TestDataToolProps {
  apiKey: string;
  model: string;
}

const LABEL_MAP: Record<string, string> = {
  nombre: 'Nombre',
  apellidos: 'Apellidos',
  direccion: 'Dirección',
  codigoPostal: 'Código Postal',
  ciudad: 'Ciudad',
  provincia: 'Provincia',
  pais: 'País',
  telefono: 'Teléfono',
  email: 'Email',
  password: 'Password',
  fechaNacimiento: 'Fecha Nacimiento',
  genero: 'Género',
  documentoId: 'Documento ID',
  tipoDocumento: 'Tipo Documento',
  tipo: 'Tipo',
  numero: 'Número',
  titular: 'Titular',
  expiracion: 'Expiración',
  cvv: 'CVV',
  codigo: 'Código',
  valor: 'Valor',
  condiciones: 'Condiciones',
  validoHasta: 'Válido Hasta',
};

function formatRowAsText(row: Record<string, string>): string {
  return Object.entries(row)
    .map(([key, val]) => `${LABEL_MAP[key] || key}: ${val}`)
    .join('\n');
}

function downloadCSV(data: Record<string, string>[], dataType: string, market: string) {
  if (data.length === 0) return;
  const keys = Object.keys(data[0]);
  const header = keys.map(k => `"${LABEL_MAP[k] || k}"`).join(',');
  const rows = data.map(row =>
    keys.map(k => {
      const val = (row[k] || '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `datos-prueba-${dataType}-${market}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatTableAsTSV(data: Record<string, string>[]): string {
  if (data.length === 0) return '';
  const keys = Object.keys(data[0]);
  const header = keys.map(k => LABEL_MAP[k] || k).join('\t');
  const rows = data.map(row =>
    keys.map(k => (row[k] || '').replace(/\t/g, ' ')).join('\t')
  );
  return [header, ...rows].join('\n');
}

const DEFAULT_FORM: TestDataFormData = {
  dataType: 'shipping-address',
  market: 'ES',
  quantity: 3,
};

export function TestDataTool({ apiKey, model }: TestDataToolProps) {
  const [formData, setFormData] = useState<TestDataFormData>(DEFAULT_FORM);
  const [generatedData, setGeneratedData] = useState<Record<string, string>[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);
  const [jiraToken, setJiraToken] = useLocalStorage(STORAGE_KEYS.JIRA_TOKEN, '');
  const [jiraBaseUrl, setJiraBaseUrl] = useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL, '');
  const [jiraConfigExpanded, setJiraConfigExpanded] = useState(false);
  const [jiraTicketUrl, setJiraTicketUrl] = useState('');

  const jiraConfigured = jiraToken.trim().length > 0 && jiraBaseUrl.trim().length > 0;
  const canGenerate = apiKey.trim().length > 0;
  const hasOutput = generatedData.length > 0;

  const marketOptions = useMemo(
    () => BERSHKA_MARKETS.map(m => ({ value: m.code, label: `${m.label} (${m.code})` })),
    [],
  );

  const updateForm = useCallback(<K extends keyof TestDataFormData>(key: K, value: TestDataFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setIsLoading(true);
    setError(null);
    setGeneratedData([]);
    setGeneratedModel(undefined);

    try {
      let jiraContext: string | undefined;

      if (jiraTicketUrl && jiraToken.trim() && jiraBaseUrl.trim()) {
        const issueKey = extractIssueKey(jiraTicketUrl);
        if (issueKey) {
          setLoadingStatus('Obteniendo contexto del ticket...');
          const ticket = await fetchJiraTicket(issueKey, jiraToken.trim(), jiraBaseUrl.trim());
          jiraContext = formatTicketAsText(ticket);
        }
      } else if (jiraTicketUrl && (!jiraToken.trim() || !jiraBaseUrl.trim())) {
        throw new Error('Configura la URL base y el token de Jira para obtener contexto del ticket.');
      }

      setLoadingStatus('Generando datos de prueba...');
      const result = await generateTestData(apiKey, model, formData, jiraContext);
      setGeneratedData(result.data);
      setGeneratedModel(result.model);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
    }
  }, [apiKey, model, formData, canGenerate, jiraToken, jiraBaseUrl, jiraTicketUrl]);

  const handleClear = useCallback(() => {
    if (!window.confirm('¿Seguro que quieres limpiar los campos?')) return;
    setFormData(DEFAULT_FORM);
    setGeneratedData([]);
    setGeneratedModel(undefined);
    setError(null);
    setCopied(false);
    setCopiedRowIndex(null);
    setJiraTicketUrl('');
  }, []);

  const handleCopyRow = useCallback(async (row: Record<string, string>, index: number) => {
    const text = formatRowAsText(row);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedRowIndex(index);
      setTimeout(() => setCopiedRowIndex(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedRowIndex(index);
      setTimeout(() => setCopiedRowIndex(null), 2000);
    }
  }, []);

  const handleCopyTable = useCallback(async () => {
    const text = formatTableAsTSV(generatedData);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generatedData]);

  const handleDownloadCsv = useCallback(() => {
    downloadCSV(generatedData, formData.dataType, formData.market);
  }, [generatedData, formData.dataType, formData.market]);

  const columns = hasOutput ? Object.keys(generatedData[0]) : [];

  return (
    <div>
      {/* Jira config section */}
      {jiraConfigured && !jiraConfigExpanded ? (
        <div className="jira-indicator">
          <span className="jira-indicator-text">Jira configurado ✓</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setJiraConfigExpanded(true)}
          >
            Editar
          </button>
        </div>
      ) : (
        <div className="jira-config">
          <span className="jira-config-title">Jira (opcional)</span>
          <div className="jira-fields">
            <div>
              <label htmlFor="td-jira-base-url" className="field-label">URL base de Jira</label>
              <input
                id="td-jira-base-url"
                type="text"
                value={jiraBaseUrl}
                onChange={(e) => setJiraBaseUrl(e.target.value)}
                placeholder="https://jira.tuempresa.com/jira"
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="td-jira-token" className="field-label">Token PAT de Jira</label>
              <input
                id="td-jira-token"
                type="password"
                value={jiraToken}
                onChange={(e) => setJiraToken(e.target.value)}
                placeholder="Tu Personal Access Token"
                className="field-input"
              />
            </div>
          </div>
          {jiraConfigured && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setJiraConfigExpanded(false)}
              style={{ alignSelf: 'flex-end', marginTop: '4px' }}
            >
              Ocultar
            </button>
          )}
        </div>
      )}

      {/* Form grid */}
      <div className="td-form-grid">
        {/* Row 1: Data type + Market + Quantity */}
        <div className="td-form-row">
          <div className="td-form-field">
            <label htmlFor="td-data-type" className="field-label">Tipo de dato</label>
            <div className="input-wrap">
              <select
                id="td-data-type"
                value={formData.dataType}
                onChange={(e) => updateForm('dataType', e.target.value as TestDataFormData['dataType'])}
                className="field-select"
              >
                {DATA_TYPES.map(dt => (
                  <option key={dt.id} value={dt.id}>{dt.label}</option>
                ))}
              </select>
              <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
            </div>
          </div>
          <div className="td-form-field">
            <label htmlFor="td-market" className="field-label">Mercado</label>
            <SearchableSelect
              options={marketOptions}
              value={formData.market}
              onChange={(v) => updateForm('market', v)}
              placeholder="Buscar mercado..."
            />
          </div>
          <div className="td-form-field">
            <label htmlFor="td-quantity" className="field-label">Cantidad</label>
            <div className="input-wrap">
              <select
                id="td-quantity"
                value={formData.quantity}
                onChange={(e) => updateForm('quantity', Number(e.target.value))}
                className="field-select"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <span className="select-chev"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg></span>
            </div>
          </div>
        </div>

        {/* Row 2: Related Jira ticket */}
        <div className="td-form-row-single">
          <div className="td-form-field">
            <label htmlFor="td-jira-ticket" className="field-label">Ticket relacionado (opcional)</label>
            <input
              id="td-jira-ticket"
              type="text"
              value={jiraTicketUrl}
              onChange={(e) => setJiraTicketUrl(e.target.value)}
              placeholder="URL del ticket de Jira para contextualizar los datos (opcional)"
              className="field-input"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actions-bar" style={{ marginTop: '24px' }}>
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate}
          loading={isLoading}
          label="Generar datos de prueba"
          loadingLabel="Generando..."
        />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={!formData.dataType && !hasOutput}
        >
          Limpiar
        </button>
      </div>

      {/* Output area */}
      {hasOutput && (
        <div className="td-output-section">
          {generatedModel && (
            <div className="output-header" style={{ marginBottom: '12px' }}>
              <span className="field-label">Datos generados</span>
              <span className="model-badge-new">Modelo: {generatedModel}</span>
            </div>
          )}
          <div className="td-actions-bar">
            <button
              type="button"
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopyTable}
            >
              {copied ? '¡Copiado!' : 'Copiar todo como tabla'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleDownloadCsv}
            >
              Descargar CSV
            </button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th key={col}>{LABEL_MAP[col] || col}</th>
                  ))}
                  <th className="td-copy-col"></th>
                </tr>
              </thead>
              <tbody>
                {generatedData.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map(col => (
                      <td key={col}>{row[col]}</td>
                    ))}
                    <td className="td-copy-col">
                      <button
                        type="button"
                        className="td-copy-row-btn"
                        onClick={() => handleCopyRow(row, idx)}
                      >
                        {copiedRowIndex === idx ? '✓' : 'Copiar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
    </div>
  );
}
