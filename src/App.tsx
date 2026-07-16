import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useProfile } from './components/ContextProfile';
import type { ViewType } from './config/constants';

const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker'];

function getViewFromHash(): ViewType {
  const hash = window.location.hash.replace('#/', '') || 'landing';
  return VALID_VIEWS.includes(hash as ViewType) ? (hash as ViewType) : 'landing';
}

const toolNames: Record<string, string> = {
  acceptance: 'Criterios de aceptacion',
  testcase: 'Test Case Generator',
  bugreport: 'Bug Report',
  testdata: 'Datos de Prueba',
  sprinttracker: 'Sprint Tracker',
};

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage(STORAGE_KEYS.API_KEY, '');
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [profile] = useProfile();
  const [view, setView] = useState<ViewType>(getViewFromHash);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((v: ViewType) => {
    window.location.hash = `#/${v}`;
  }, []);

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

  const subtitle = useMemo(() => view !== 'landing' ? toolNames[view] : undefined, [view]);

  return (
    <div className="page">
      <Header
        onBack={view !== 'landing' ? () => navigate('landing') : undefined}
        subtitle={subtitle}
        model={model}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <main className="container">
        <ErrorBoundary key={view}>
          {view === 'landing' && (
            <LandingScreen
              onSelect={navigate}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              model={model}
              onModelChange={setModel}
            />
          )}

          {view === 'acceptance' && (
            <AcceptanceCriteriaTool apiKey={apiKey} model={model} profile={profile} />
          )}

          {view === 'testcase' && (
            <TestCaseTool apiKey={apiKey} model={model} profile={profile} />
          )}

          {view === 'bugreport' && (
            <BugReportTool apiKey={apiKey} model={model} profile={profile} />
          )}

          {view === 'testdata' && (
            <TestDataTool apiKey={apiKey} model={model} profile={profile} />
          )}

          {view === 'sprinttracker' && (
            <SprintTracker />
          )}
        </ErrorBoundary>
      </main>
    </div>
  );
}
