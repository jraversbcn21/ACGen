import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { streamWithGroq, extractJsonArray, validateTestCases } from '../services/apiService';
import { TESTCASE_PROMPT } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
import { useStreamingResponse } from '../hooks/useStreamingResponse';
import { anonymize } from '../services/anonymizer';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import type { ProjectProfile } from '../types/context';
import type { GenerationStatus, TestCaseData } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const INPUT_PLACEHOLDER = 'Describe el área o flujo que quieres cubrir (ej: Home, Búsqueda, PDP, Carrito, Checkout...)';

function priorityClass(p: string): string {
  if (p === 'Alta' || p === 'High') return 'badge-high';
  if (p === 'Media' || p === 'Medium') return 'badge-medium';
  return 'badge-low';
}

function typeClass(t: string): string {
  return (t === 'Positivo' || t === 'Positive') ? 'badge-positive' : 'badge-negative';
}

function generateJiraTable(testCases: TestCaseData[]): string {
  const escapeCell = (val: string) => val.replace(/\|/g, '&#124;').replace(/\n/g, '\\\\');
  const header = '||Clave||Resumen||Prioridad||Tipo||Precondiciones||Pasos||Resultado Esperado||';
  const rows = testCases.map(tc => {
    const steps = tc.testSteps.map(escapeCell).join('\\\\');
    return `|${escapeCell(tc.key)}|${escapeCell(tc.summary)}|${escapeCell(tc.priority)}|${escapeCell(tc.type)}|${escapeCell(tc.preconditions)}|${steps}|${escapeCell(tc.expectedResult)}|`;
  });
  return [header, ...rows].join('\n');
}

export function TestCaseTool({ apiKey, model, profile, prefill, onSaveArtifact }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string; onSaveArtifact?: (input: string, output: string) => void }) {
  const [input, setInput] = useState('');
  const [testCases, setTestCases] = useState<TestCaseData[]>([]);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [confMap, setConfMap] = useState<Record<string, string> | null>(null);
  const { toast, showToast } = useToast();
  const { isStreaming, stream } = useStreamingResponse();

  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;
  const hasOutput = testCases.length > 0;

  const doGenerate = useCallback(async (effectiveInput: string, effectiveMap?: Record<string, string>) => {
    setStatus('loading');
    setError(null);
    setTestCases([]);
    setGeneratedModel(undefined);
    try {
      const gen = streamWithGroq(apiKey, model, effectiveInput, TESTCASE_PROMPT, 'testcase', profile, effectiveMap);
      await stream(gen, (fullText) => {
        const items = extractJsonArray(fullText);
        if (items.length === 0) {
          throw new Error('No se generaron casos de prueba. Intenta con una descripcion mas detallada.');
        }
        const validated = validateTestCases(items);
        setTestCases(validated);
        onSaveArtifact?.(effectiveInput, fullText);
        setGeneratedModel(model);
        setStatus('success');
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
      setStatus('error');
      setTestCases([]);
    } finally {
      setConfMap(null);
    }
  }, [apiKey, model, profile, stream]);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || status === 'loading' || isStreaming) return;
    const confKey = `acgen_confidential_testcase`;
    const confEnabled = localStorage.getItem(confKey) === 'true';
    if (confEnabled) {
      const { map } = anonymize(input);
      if (Object.keys(map).length > 0) {
        setConfMap(map);
        return;
      }
      await doGenerate(input);
    } else {
      await doGenerate(input);
    }
  }, [canGenerate, status, isStreaming, input, doGenerate]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canGenerate && status !== 'loading') handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canGenerate, status, handleGenerate]);

  const handleClear = useCallback(() => {
    const prevInput = input;
    const prevTestCases = testCases;
    const prevModel = generatedModel;
    setInput('');
    setTestCases([]);
    setError(null);
    setStatus('idle');
    setGeneratedModel(undefined);
    setCopied(false);
    showToast('Campos limpiados', () => {
      setInput(prevInput);
      setTestCases(prevTestCases);
      setGeneratedModel(prevModel);
    });
  }, [input, testCases, generatedModel, showToast]);

  const handleLoadDemo = useCallback(() => {
    const demo = DEMO_DATA.testcase;
    setInput(demo.input);
    setTestCases(JSON.parse(demo.output));
    setStatus('success');
  }, []);

  const handleCopyJira = useCallback(async () => {
    const table = generateJiraTable(testCases);
    try {
      await navigator.clipboard.writeText(table);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = table;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [testCases]);

  const handleDownloadPdf = useCallback(() => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text('Casos de prueba', 14, 15);

    const rows = testCases.map(tc => [
      tc.key,
      tc.summary,
      tc.priority,
      tc.type,
      tc.preconditions,
      tc.testSteps.join('\n'),
      tc.expectedResult,
    ]);

    autoTable(doc, {
      head: [['Clave', 'Resumen', 'Prioridad', 'Tipo', 'Precondiciones', 'Pasos', 'Resultado Esperado']],
      body: rows,
      startY: 25,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [0, 82, 204] },
      columnStyles: {
        0: { cellWidth: 14 },
        1: { cellWidth: 50 },
        2: { cellWidth: 14 },
        3: { cellWidth: 16 },
        4: { cellWidth: 45 },
        5: { cellWidth: 55 },
        6: { cellWidth: 55 },
      },
    });

    doc.save('casos-de-prueba.pdf');
  }, [testCases]);

  return (
    <div>
      <div>
        <label htmlFor="testcase-input" className="field-label">
          Instrucciones para casos de prueba
        </label>
        <textarea
          id="testcase-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={INPUT_PLACEHOLDER}
          className="field-textarea"
          style={{ minHeight: 200 }}
        />
      </div>

      <div className="actions-bar">
        <ConfidentialToggle
          view="testcase"
          substitutionCount={0}
          onReview={() => {
            const { map } = anonymize(input);
            setConfMap(map);
          }}
        />
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate || isStreaming}
          loading={status === 'loading'}
          label="Generar casos de prueba"
          loadingLabel="Generando..."
        />
        <button type="button" className="btn-ghost" onClick={handleLoadDemo}>Ver ejemplo</button>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleClear}
          disabled={!input && !hasOutput}
        >
          Limpiar
        </button>
      </div>

      {hasOutput && (
        <div className="output-section">
          <div className="output-header">
            <span className="field-label">Casos de prueba generados</span>
            {generatedModel && (
              <span className="model-badge-new">Modelo: {generatedModel}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopyJira}
            >
              {copied ? '¡Copiado!' : 'Copiar como tabla Jira'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleDownloadPdf}
            >
              Descargar PDF
            </button>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Summary</th>
                  <th>Priority</th>
                  <th>Type</th>
                  <th>Preconditions</th>
                  <th>Test Steps</th>
                  <th>Expected Result</th>
                </tr>
              </thead>
              <tbody>
                {testCases.map((tc, idx) => (
                  <tr key={tc.key || idx}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{tc.key}</td>
                    <td>{tc.summary}</td>
                    <td><span className={`badge ${priorityClass(tc.priority)}`}>{tc.priority}</span></td>
                    <td><span className={`badge ${typeClass(tc.type)}`}>{tc.type}</span></td>
                    <td>{tc.preconditions}</td>
                    <td>
                      <ol className="steps-list">
                        {tc.testSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </td>
                    <td>{tc.expectedResult}</td>
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
            doGenerate(input, editedMap);
            setConfMap(null);
          }}
        />
      )}
    </div>
  );
}
