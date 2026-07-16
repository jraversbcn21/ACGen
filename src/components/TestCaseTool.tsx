import { useState, useCallback } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { generateTestCases } from '../services/apiService';
import { TESTCASE_PROMPT } from '../config/constants';
import { DEMO_DATA } from '../config/demoData';
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

export function TestCaseTool({ apiKey, model }: { apiKey: string; model: string }) {
  const [input, setInput] = useState('');
  const [testCases, setTestCases] = useState<TestCaseData[]>([]);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;
  const hasOutput = testCases.length > 0;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) return;
    setStatus('loading');
    setError(null);
    setTestCases([]);
    try {
      const result = await generateTestCases(apiKey, model, input, TESTCASE_PROMPT);
      setTestCases(result.testCases);
      setGeneratedModel(result.model);
      setStatus('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.';
      setError(message);
      setStatus('error');
    }
  }, [apiKey, model, input, canGenerate]);

  const handleClear = useCallback(() => {
    if (!window.confirm('\u00bfSeguro que quieres limpiar los campos?')) return;
    setInput('');
    setTestCases([]);
    setError(null);
    setStatus('idle');
    setGeneratedModel(undefined);
    setCopied(false);
  }, []);

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
        <GenerateButton
          onClick={handleGenerate}
          disabled={!canGenerate}
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
    </div>
  );
}
