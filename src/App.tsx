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
import { Sidebar } from './components/Sidebar';
import { UserStoryTool } from './components/UserStoryTool';
import { RefinerTool } from './components/RefinerTool';
import { EdgeCaseTool } from './components/EdgeCaseTool';
import { ConverterTool } from './components/ConverterTool';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useWorkspace } from './hooks/useWorkspace';
import { STORAGE_KEYS, DEFAULT_MODEL } from './config/constants';
import { DEFAULT_PROVIDER, PROVIDERS } from './config/providers';
import { useProfile } from './components/ContextProfile';
import { I18nProvider } from './i18n/I18nContext';
import type { ViewType } from './config/constants';

const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker', 'userstory', 'refiner', 'edgecase', 'converter'];

function getViewFromHash(): ViewType {
  const hash = window.location.hash.replace('#/', '') || 'landing';
  return VALID_VIEWS.includes(hash as ViewType) ? (hash as ViewType) : 'landing';
}

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage<string>('acgen_key_groq', (() => {
    try {
      const oldKey = localStorage.getItem('acgen_api_key');
      if (oldKey) {
        const parsed = JSON.parse(oldKey);
        if (typeof parsed === 'string' && parsed) return parsed;
      }
    } catch { /* migration parse error */ }
    return '';
  })());
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [provider, setProvider] = useLocalStorage('acgen_provider', DEFAULT_PROVIDER);
  const [openrouterKey, setOpenrouterKey] = useLocalStorage('acgen_key_openrouter', '');
  const [customKey, setCustomKey] = useLocalStorage('acgen_key_custom', '');
  const [customBaseUrl, setCustomBaseUrl] = useLocalStorage('acgen_custom_base_url', '');
  const [profile] = useProfile();
  const [view, setView] = useState<ViewType>(getViewFromHash);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');
  const workspace = useWorkspace();

  const [prefill, setPrefill] = useState<{ view: ViewType; text: string } | null>(null);

  const currentApiKey = useMemo(() => {
    if (provider === 'groq') return apiKey;
    if (provider === 'openrouter') return openrouterKey;
    return customKey;
  }, [provider, apiKey, openrouterKey, customKey]);

  const currentBaseUrl = useMemo(() => {
    if (provider === 'custom') return customBaseUrl || undefined;
    return PROVIDERS[provider]?.baseUrl;
  }, [provider, customBaseUrl]);

  const saveArtifact = useCallback((artifact: { tool: ViewType; input: string; output: string }) => {
    let targetId = workspace.activeId;
    if (!targetId) {
      targetId = workspace.createWorkspace('Sin nombre').id;
    }
    workspace.addArtifact(targetId, artifact);
  }, [workspace]);

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
    <I18nProvider>
    <div className="page">
      <Header
        provider={provider}
        model={model}
        apiKey={currentApiKey}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        workspaces={workspace.workspaces}
        activeWorkspaceId={workspace.activeId}
        onSelectWorkspace={workspace.setActiveId}
        onCreateWorkspace={workspace.createWorkspace}
        onRenameWorkspace={workspace.renameWorkspace}
        onDeleteWorkspace={workspace.deleteWorkspace}
        onExportWorkspace={workspace.exportWorkspace}
        onImportWorkspace={workspace.importWorkspace}
      />
      <div className="app-layout">
        {view !== 'landing' && (
          <Sidebar activeView={view} onNavigate={(v) => navigate(v)}
            activeWorkspaceName={workspace.workspaces.find(w => w.id === workspace.activeId)?.name ?? ''} />
        )}
        <main className="container">
        <ErrorBoundary key={view}>
          {view === 'landing' && (
            <LandingScreen
              onSelect={navigate}
              provider={provider}
              onProviderChange={setProvider}
              apiKey={currentApiKey}
              onApiKeyChange={(key) => {
                if (provider === 'groq') setApiKey(key);
                else if (provider === 'openrouter') setOpenrouterKey(key);
                else setCustomKey(key);
              }}
              model={model}
              onModelChange={setModel}
              customBaseUrl={customBaseUrl}
              onCustomBaseUrlChange={setCustomBaseUrl}
            />
          )}

          {view === 'acceptance' && (
            <AcceptanceCriteriaTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'acceptance' ? prefill.text : undefined}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'acceptance', input, output })} />
          )}

          {view === 'testcase' && (
            <TestCaseTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              prefill={prefill?.view === 'testcase' ? prefill.text : undefined}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'testcase', input, output })} />
          )}

          {view === 'bugreport' && (
            <BugReportTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'bugreport', input, output })} />
          )}

          {view === 'testdata' && (
            <TestDataTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'testdata', input, output })} />
          )}

          {view === 'sprinttracker' && (
            <SprintTracker />
          )}

          {view === 'userstory' && (
            <UserStoryTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'userstory' ? prefill.text : undefined}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'userstory', input, output })} />
          )}

          {view === 'refiner' && (
            <RefinerTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onChain={(v, text) => navigate(v, { prefill: text })}
              prefill={prefill?.view === 'refiner' ? prefill.text : undefined}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'refiner', input, output })} />
          )}

          {view === 'edgecase' && (
            <EdgeCaseTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              prefill={prefill?.view === 'edgecase' ? prefill.text : undefined}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'edgecase', input, output })} />
          )}

          {view === 'converter' && (
            <ConverterTool apiKey={currentApiKey} model={model} profile={profile} baseUrl={currentBaseUrl}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'converter', input, output })} />
          )}
        </ErrorBoundary>
      </main>
      </div>
    </div>
    </I18nProvider>
  );
}
