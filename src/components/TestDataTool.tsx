import { useState, useCallback, useMemo, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { SearchableSelect } from './SearchableSelect';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonArray, validateTestDataRows } from '../services/apiService';
import { SUPPORTED_MARKETS, DATA_TYPES, TEST_DATA_PROMPT } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import type { TestDataFormData } from '../types';

interface TestDataToolProps {
  apiKey: string;
  model: string;
  profile?: ProjectProfile;
  onSaveArtifact?: (input: string, output: string) => void;
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
      let val = (row[k] || '').replace(/"/g, '""');
      if (val && /^[=+\-@]/.test(val)) {
        val = `'${val}`;
      }
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
    keys.map(k => (row[k] || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t')
  );
  return [header, ...rows].join('\n');
}

function buildTestDataMessage(formData: TestDataFormData): string {
  const dataTypeLabels: Record<string, string> = {
    'shipping-address': 'direcciones de envio',
    'billing-data': 'datos de facturacion',
    'user-registration': 'datos de registro de usuario',
    'payment-cards': 'tarjetas de pago de prueba',
    'promo-codes': 'cupones y codigos promocionales',
  };
  let userMessage = `Genera ${formData.quantity} registro(s) de ${dataTypeLabels[formData.dataType]} para el mercado ${formData.market}.\n`;
  userMessage += `Tipo de dato: ${formData.dataType}\n`;
  if (formData.additionalContext?.trim()) {
    userMessage += `\nContexto adicional (usa esta informacion para hacer los datos mas relevantes al escenario de prueba):\n${formData.additionalContext.trim()}\n`;
  }
  return userMessage;
}

const DEFAULT_FORM: TestDataFormData = {
  dataType: 'shipping-address',
  market: 'ES',
  quantity: 3,
};

export function TestDataTool({ apiKey, model, profile, onSaveArtifact }: TestDataToolProps) {
  const [formData, setFormData] = useState<TestDataFormData>(DEFAULT_FORM);
  const [generatedData, setGeneratedData] = useState<Record<string, string>[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
  const { toast, showToast } = useToast();
  const { isStreaming, stream } = useStreamingResponse();
  const t = useT();

  const canGenerate = apiKey.trim().length > 0;
  const hasOutput = generatedData.length > 0;

  const marketOptions = useMemo(
    () => SUPPORTED_MARKETS.map(m => ({ value: m.code, label: `${m.label} (${m.code})` })),
    [],
  );

  const updateForm = useCallback(<K extends keyof TestDataFormData>(key: K, value: TestDataFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  }, []);

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setIsLoading(true);
    setError(null);
    setGeneratedData([]);
    setGeneratedModel(undefined);
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, TEST_DATA_PROMPT, 'testcase', profile, effectiveMap);
      await stream(gen, (fullText) => {
        const jsonArray = extractJsonArray(fullText);
        if (!jsonArray || jsonArray.length === 0) {
          throw new Error(t('error.noTestData'));
        }
        setGeneratedData(validateTestDataRows(jsonArray));
        onSaveArtifact?.(effectiveInput, fullText);
        setGeneratedModel(model);
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('error.unexpected');
      setError(message);
    } finally {
      setIsLoading(false);
      setLoadingStatus('');
      setConfMap(null);
    }
  }, [apiKey, model, profile, stream, t]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || isLoading || isStreaming) return;
    const userMessage = buildTestDataMessage(formData);
    const confKey = `acgen_confidential_testdata`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(userMessage);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(userMessage);
    } else {
      await doGenerate(userMessage);
    }
  }, [canGenerate, isLoading, isStreaming, formData, doGenerate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && !isLoading) handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGenerate, isLoading, handleGenerate]);

  const handleClear = useCallback(() => {
    const prevData = generatedData;
    const prevModel = generatedModel;
    setFormData(DEFAULT_FORM);
    setGeneratedData([]);
    setGeneratedModel(undefined);
    setError(null);
    setCopied(false);
    setCopiedRowIndex(null);
    showToast(t('common.cleared'), () => {
      setGeneratedData(prevData);
      setGeneratedModel(prevModel);
    });
  }, [generatedData, generatedModel, showToast]);

  const handleLoadDemo = useCallback(() => {
    setGeneratedData(JSON.parse(DEMO_DATA.testdata.output));
    setGeneratedModel('demo');
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
      {/* Form grid */}
      <div className="td-form-grid">
        {/* Row 1: Data type + Market + Quantity */}
        <div className="td-form-row">
          <div className="td-form-field">
            <label htmlFor="td-data-type" className="field-label">{t('testdata.dataType')}</label>
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
            <label htmlFor="td-market" className="field-label">{t('testdata.market')}</label>
            <SearchableSelect
              options={marketOptions}
              value={formData.market}
              onChange={(v) => updateForm('market', v)}
              placeholder="Buscar mercado..."
            />
          </div>
          <div className="td-form-field">
            <label htmlFor="td-quantity" className="field-label">{t('testdata.quantity')}</label>
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

        {/* Row 2: Contexto adicional */}
        <div className="td-form-row-single">
          <div className="td-form-field">
            <label htmlFor="td-context" className="field-label">{t('testdata.additionalContext')} ({t('common.optional')})</label>
            <input
              id="td-context"
              type="text"
              value={formData.additionalContext || ''}
              onChange={(e) => updateForm('additionalContext', e.target.value)}
              placeholder={t('testdata.additionalContextPlaceholder')}
              className="field-input"
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="actions-bar" style={{ marginTop: '24px' }}>
        <ConfidentialToggle
          view="testdata"
          substitutionCount={0}
          onReview={() => {
            const { map } = anonymize(buildTestDataMessage(formData));
            setConfMap(map);
          }}
        />
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate || isStreaming}
          loading={isLoading}
        />
        {loadingStatus && (
          <span className="loading-status">{loadingStatus}</span>
        )}
        <button type="button" className="btn-ghost" onClick={handleLoadDemo}>{t('common.example')}</button>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={formData.dataType === DEFAULT_FORM.dataType && formData.market === DEFAULT_FORM.market && formData.quantity === DEFAULT_FORM.quantity && !hasOutput}
        >
          {t('common.clear')}
        </button>
      </div>

      {/* Output area */}
      {hasOutput && (
        <div className="td-output-section">
          {generatedModel && (
            <div className="output-header" style={{ marginBottom: '12px' }}>
              <span className="field-label">{t('testdata.generatedData')}</span>
              <span className="model-badge-new">{t('header.model')}: {generatedModel}</span>
            </div>
          )}
          <div className="td-actions-bar">
            <button
              type="button"
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopyTable}
            >
              {copied ? t('common.copied') : t('testdata.copyAllTable')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleDownloadCsv}
            >
              {t('testdata.exportCsv')}
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
                        {copiedRowIndex === idx ? '\u2713' : t('common.copy')}
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
      <Toast toast={toast} />
      {confMap && (
        <AnonymizerReview
          map={confMap}
          onCancel={() => setConfMap(null)}
          onConfirm={(editedMap) => {
            doGenerate(buildTestDataMessage(formData), editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
