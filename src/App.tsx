import { useState, useEffect } from 'react';
import './App.css';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingScreen } from './components/LandingScreen';
import { AcceptanceCriteriaTool } from './components/AcceptanceCriteriaTool';
import { TestCaseTool } from './components/TestCaseTool';
import { BugReportTool } from './components/BugReportTool';
import { TestDataTool } from './components/TestDataTool';
import { SprintTracker } from './components/SprintTracker';
import { useLocalStorage } from './hooks/useLocalStorage';
import { STORAGE_KEYS, DEFAULT_MODEL } from './config/constants';
import type { ViewType } from './config/constants';

const toolNames: Record<string, string> = {
  acceptance: 'Criterios de aceptación',
  testcase: 'Test Case Generator',
  bugreport: 'Bug Report',
  testdata: 'Datos de Prueba',
  sprinttracker: 'Sprint Tracker',
};

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage(STORAGE_KEYS.API_KEY, '');
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [jiraBaseUrl] = useLocalStorage(STORAGE_KEYS.JIRA_BASE_URL, '');
  const [view, setView] = useState<ViewType>('landing');
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (typeof document !== 'undefined') {
    let initial: unknown = theme;
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THEME);
      if (stored) initial = JSON.parse(stored);
    } catch {
      // corrupt value — fall back to theme state
    }
    if (initial === 'dark' || initial === 'light') {
      document.documentElement.setAttribute('data-theme', initial);
    }
  }

  return (
    <div className="page">
      <Header
        onBack={view !== 'landing' ? () => setView('landing') : undefined}
        subtitle={view !== 'landing' ? toolNames[view] : undefined}
        model={model}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <main className="container">
        <ErrorBoundary key={view}>
          {view === 'landing' && (
            <LandingScreen
              onSelect={setView}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              model={model}
              onModelChange={setModel}
            />
          )}

          {view === 'acceptance' && (
            <AcceptanceCriteriaTool apiKey={apiKey} model={model} />
          )}

          {view === 'testcase' && (
            <TestCaseTool apiKey={apiKey} model={model} />
          )}

          {view === 'bugreport' && (
            <BugReportTool apiKey={apiKey} model={model} />
          )}

          {view === 'testdata' && (
            <TestDataTool apiKey={apiKey} model={model} />
          )}

          {view === 'sprinttracker' && (
            <SprintTracker jiraBaseUrl={jiraBaseUrl} />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
