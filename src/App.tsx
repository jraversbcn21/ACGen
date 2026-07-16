import { useState, useEffect, useCallback } from 'react';
import './App.css';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingScreen } from './components/LandingScreen';
import { AcceptanceCriteriaTool } from './components/AcceptanceCriteriaTool';
import { TestCaseTool } from './components/TestCaseTool';
import { BugReportTool } from './components/BugReportTool';
import { TestDataTool } from './components/TestDataTool';
import { SprintTracker } from './components/SprintTracker';
import { Sidebar } from './components/Sidebar';
import { UserStoryTool } from './components/UserStoryTool';
import { RefinerTool } from './components/RefinerTool';
import { EdgeCaseTool } from './components/EdgeCaseTool';
import { useLocalStorage } from './hooks/useLocalStorage';
import { STORAGE_KEYS, DEFAULT_MODEL } from './config/constants';
import { useProfile } from './components/ContextProfile';
import type { ViewType } from './config/constants';

const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker', 'userstory', 'refiner', 'edgecase'];

function getViewFromHash(): ViewType {
  const hash = window.location.hash.replace('#/', '') || 'landing';
  return VALID_VIEWS.includes(hash as ViewType) ? (hash as ViewType) : 'landing';
}

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage(STORAGE_KEYS.API_KEY, '');
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [profile] = useProfile();
  const [view, setView] = useState<ViewType>(getViewFromHash);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');

  const [prefill, setPrefill] = useState<{ view: ViewType; text: string } | null>(null);

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((v: ViewType, opts?: { prefill?: string }) => {
    if (opts?.prefill) {
      setPrefill({ view: v, text: opts.prefill });
    }
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

  return (
    <div className="page">
      <Header
        model={model}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <div className="app-layout">
        {view !== 'landing' && (
          <Sidebar activeView={view} onNavigate={(v) => navigate(v)} />
        )}
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
            <AcceptanceCriteriaTool apiKey={apiKey} model={model} profile={profile}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'acceptance' ? prefill.text : undefined} />
          )}

          {view === 'testcase' && (
            <TestCaseTool apiKey={apiKey} model={model} profile={profile}
              prefill={prefill?.view === 'testcase' ? prefill.text : undefined} />
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

          {view === 'userstory' && (
            <UserStoryTool apiKey={apiKey} model={model} profile={profile}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'userstory' ? prefill.text : undefined} />
          )}

          {view === 'refiner' && (
            <RefinerTool apiKey={apiKey} model={model} profile={profile}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'refiner' ? prefill.text : undefined} />
          )}

          {view === 'edgecase' && (
            <EdgeCaseTool apiKey={apiKey} model={model} profile={profile}
              prefill={prefill?.view === 'edgecase' ? prefill.text : undefined} />
          )}
        </ErrorBoundary>
      </main>
      </div>
    </div>
  );
}
