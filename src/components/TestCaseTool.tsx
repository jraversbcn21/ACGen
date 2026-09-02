import { useState, useCallback, useEffect } from 'react';
import { GenerateButton } from './GenerateButton';
import { ErrorBanner } from './ErrorBanner';
import { useToast, Toast } from './Toast';
import { extractJsonArray, validateTestCases } from '../services/apiService';
import { DEMO_DATA } from '../config/demoData';
import { useGenerator } from '../hooks/useGenerator';
import { copyText } from '../utils/clipboard';
import { ConfidentialToggle } from './ConfidentialToggle';
import { AnonymizerReview } from './AnonymizerReview';
import { useT } from '../i18n/I18nContext';
import type { ProjectProfile } from '../types/context';
import type { TestCaseData } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { generateShortcutLabel } from '../utils/shortcut';

function priorityClass(p: string): string {
  if (p === 'Alta' || p === 'High') return 'badge-high';
  if (p === 'Media' || p === 'Medium') return 'badge-medium';
  return 'badge-low';
}

function typeClass(t: string): string {
  return (t === 'Positivo' || t === 'Positive') ? 'badge-positive' : 'badge-negative';
}

function generateJiraTable(testCases: TestCaseData[], t: (key: string) => string): string {
  const escapeCell = (val: string) => val.replace(/\|/g, '&#124;').replace(/\n/g, '\\\\');
  const header = `||${t('testcase.key')}||${t('testcase.summary')}||${t('testcase.priority')}||${t('testcase.type')}||${t('testcase.preconditions')}||${t('testcase.testSteps')}||${t('testcase.expectedResult')}||`;
  const rows = testCases.map(tc => {
    const steps = tc.testSteps.map(escapeCell).join('\\\\');
    return `|${escapeCell(tc.key)}|${escapeCell(tc.summary)}|${escapeCell(tc.priority)}|${escapeCell(tc.type)}|${escapeCell(tc.preconditions)}|${steps}|${escapeCell(tc.expectedResult)}|`;
  });
  return [header, ...rows].join('\n');
}

export function TestCaseTool({ apiKey, model, profile, prefill, onSaveArtifact, baseUrl }: { apiKey: string; model: string; profile?: ProjectProfile; prefill?: string; onSaveArtifact?: (input: string, output: string) => void; baseUrl?: string }) {
  const [input, setInput] = useState('');
  const [testCases, setTestCases] = useState<TestCaseData[]>([]);
  const [generatedModel, setGeneratedModel] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const { toast, showToast } = useToast();
  const t = useT();

  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);

  const canGenerate = apiKey.trim().length > 0 && input.trim().length > 0;
  const hasOutput = testCases.length > 0;

  const gen = useGenerator<TestCaseData[]>({
    view: 'testcase',
    toolType: 'testcase',
    apiKey, model, profile, baseUrl,
    canGenerate,
    buildInput: () => input,
    parse: (fullText) => {
      const items = extractJsonArray(fullText);
      if (items.length === 0) throw new Error('error.noTestCases');
      return validateTestCases(items);
    },
    onResult: (validated, { input: sent, fullText, model: usedModel }) => {
      setTestCases(validated);
      onSaveArtifact?.(sent as string, fullText);
      setGeneratedModel(usedModel);
    },
  });

  const handleClear = useCallback(() => {
    gen.clearGeneration();
    const prevInput = input;
    const prevTestCases = testCases;
    const prevModel = generatedModel;
    setInput('');
    setTestCases([]);
    setGeneratedModel(undefined);
    setCopied(false);
    showToast(t('common.cleared'), () => {
      setInput(prevInput);
      setTestCases(prevTestCases);
      setGeneratedModel(prevModel);
    });
  }, [input, testCases, generatedModel, gen, showToast, t]);

  const handleLoadDemo = useCallback(() => {
    gen.clearGeneration();
    const demo = DEMO_DATA.testcase;
    setInput(demo.input);
    setTestCases(JSON.parse(demo.output));
  }, [gen]);

  const handleCopyJira = useCallback(async () => {
    const table = generateJiraTable(testCases, t);
    await copyText(table);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [testCases, t]);

  const handleDownloadPdf = useCallback(() => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(t('testcase.title'), 14, 15);

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
      head: [[t('testcase.key'), t('testcase.summary'), t('testcase.priority'), t('testcase.type'), t('testcase.preconditions'), t('testcase.testSteps'), t('testcase.expectedResult')]],
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
  }, [testCases, t]);

  return (
    <div className="tc-root">
      <header className="tool-head">
        <div className="tool-head-main">
          <h1 className="tool-title">{t('testcase.title')}</h1>
          <p className="tool-sub">{t('landing.tool.testcaseDesc')}</p>
        </div>
        {generatedModel && (
          <div className="tool-head-aside">
            <span className="model-badge-new">{t('header.model')}: {generatedModel}</span>
          </div>
        )}
      </header>

      <div className="tc-field">
        <label htmlFor="testcase-input" className="tc-label">
          {t('testcase.instructions')}
          <span className="hint">{generateShortcutLabel()}</span>
        </label>
        <textarea
          id="testcase-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('testcase.inputPlaceholder')}
          className="field-textarea tc-input-ta"
        />
      </div>

      <div className="tc-actions-bar">
        <ConfidentialToggle
          view="testcase"
          text={input}
          onReview={() => gen.openReview(input)}
        />
        <div className="tc-actions-bar-right">
          <button type="button" className="btn-ghost" onClick={handleLoadDemo}>{t('common.example')}</button>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleClear}
            disabled={!input && !hasOutput}
          >
            {t('common.clear')}
          </button>
          <span className="tc-actions-sep" aria-hidden="true" />
          <GenerateButton
            onClick={gen.handleGenerate}
            disabled={!canGenerate || gen.isStreaming}
            loading={gen.status === 'loading'}
          />
        </div>
      </div>

      <div className="tc-panel">
        <div className="tc-panel-head">
          <span className="tc-panel-title">
            {t('testcase.generatedCases')}
            {hasOutput && <span className="history-count">{testCases.length}</span>}
          </span>
          <div className="tc-panel-actions">
            <button
              type="button"
              className={`btn-ghost ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopyJira}
              disabled={!hasOutput}
            >
              {copied ? t('common.copied') : t('testcase.exportJira')}
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleDownloadPdf}
              disabled={!hasOutput}
            >
              {t('testcase.exportPdf')}
            </button>
          </div>
        </div>

        <div className="tc-panel-body">
          {!hasOutput ? (
            <div className="tc-empty">
              <span className="tc-empty-title">{t('testcase.generatedCases')}</span>
              <span className="tc-empty-sub">{t('testcase.emptyHint')}</span>
            </div>
          ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('testcase.key')}</th>
                  <th>{t('testcase.summary')}</th>
                  <th>{t('testcase.priority')}</th>
                  <th>{t('testcase.type')}</th>
                  <th>{t('testcase.preconditions')}</th>
                  <th>{t('testcase.testSteps')}</th>
                  <th>{t('testcase.expectedResult')}</th>
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
                      <ol>
                        {tc.testSteps.map((step, i) => (
                          // El <ol> ya numera; el modelo a veces trae "1. ..." y se veia "1. 1. ...".
                          <li key={i}>{step.replace(/^\d+[.)]\s*/, '')}</li>
                        ))}
                      </ol>
                    </td>
                    <td>{tc.expectedResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>

      <ErrorBanner message={gen.error} onDismiss={gen.dismissError} />
      <Toast toast={toast} />
      {gen.review && (
        <AnonymizerReview map={gen.review.map} onCancel={gen.cancelReview} onConfirm={gen.confirmReview} />
      )}
    </div>
  );
}
