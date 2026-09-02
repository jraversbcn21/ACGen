import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import { Header } from './components/Header';
import { UpdateBanner } from './components/UpdateBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LandingScreen } from './components/LandingScreen';
import { AcceptanceCriteriaTool } from './components/AcceptanceCriteriaTool';
import { TestCaseTool } from './components/TestCaseTool';
import { BugReportTool } from './components/BugReportTool';
import { TestDataTool } from './components/TestDataTool';
import { SprintTracker } from './components/SprintTracker';
import { RegressionTracker } from './components/RegressionTracker';
import { Sidebar } from './components/Sidebar';
import { UserStoryTool } from './components/UserStoryTool';
import { RefinerTool } from './components/RefinerTool';
import { EdgeCaseTool } from './components/EdgeCaseTool';
import { ConverterTool } from './components/ConverterTool';
import { DesignValidatorTool } from './components/DesignValidatorTool';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useWorkspace } from './hooks/useWorkspace';
import { STORAGE_KEYS, DEFAULT_MODEL } from './config/constants';
import { DEFAULT_PROVIDER, PROVIDERS, sanitizeModel } from './config/providers';
import { useProfile } from './components/ContextProfile';
import { downloadJson, toFilename } from './utils/download';
import { I18nProvider } from './i18n/I18nContext';
import { requestPersistentStorage } from './services/persistence';
import { useAppUpdate } from './hooks/useAppUpdate';
import { DocLibrary } from './components/DocLibrary';
import { StorageQuotaAlert } from './components/StorageQuotaAlert';
import type { ViewType } from './config/constants';

const VALID_VIEWS: ViewType[] = ['landing', 'acceptance', 'testcase', 'bugreport', 'testdata', 'sprinttracker', 'regressiontracker', 'userstory', 'refiner', 'edgecase', 'converter', 'designvalidator', 'doclibrary'];

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
  const [storedModel, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [provider, setProvider] = useLocalStorage('acgen_provider', DEFAULT_PROVIDER);
  const model = useMemo(() => sanitizeModel(provider, storedModel), [provider, storedModel]);
  const [openrouterKey, setOpenrouterKey] = useLocalStorage('acgen_key_openrouter', '');
  const [customKey, setCustomKey] = useLocalStorage('acgen_key_custom', '');
  const [customBaseUrl, setCustomBaseUrl] = useLocalStorage('acgen_custom_base_url', '');
  const [profile] = useProfile();
  const [view, setView] = useState<ViewType>(getViewFromHash);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(STORAGE_KEYS.THEME, 'light');
  const workspace = useWorkspace();
  const { needRefresh, reload } = useAppUpdate();

  // La key legada se lee en el inicializador de arriba; una vez persistida
  // bajo la clave nueva, la copia en claro vieja sobra (y borrarla desde la
  // UI no la tocaba).
  useEffect(() => {
    if (localStorage.getItem('acgen_api_key') === null) return;
    setApiKey(apiKey);
    localStorage.removeItem('acgen_api_key');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [prefill, setPrefill] = useState<{ view: ViewType; text: string } | null>(null);

  const currentApiKey = useMemo(() => {
    if (provider === 'groq') return apiKey;
    if (provider === 'openrouter') return openrouterKey;
    return customKey;
  }, [provider, apiKey, openrouterKey, customKey]);

  const currentBaseUrl = useMemo(() => {
    // Pass the custom URL through even when empty: streamWithGroq validates a
    // DEFINED baseUrl and throws error.baseUrlMissing/Invalid, instead of the
    // empty string silently falling back to Groq's endpoint downstream.
    if (provider === 'custom') return customBaseUrl;
    return PROVIDERS[provider]?.baseUrl;
  }, [provider, customBaseUrl]);

  const exportWorkspaceToFile = useCallback((id: string) => {
    const json = workspace.exportWorkspace(id);
    if (!json) return;
    const name = workspace.workspaces.find((w) => w.id === id)?.name ?? 'workspace';
    downloadJson(toFilename(name, 'json'), json);
  }, [workspace]);

  const saveArtifact = useCallback((artifact: { tool: ViewType; input: string; output: string }) => {
    workspace.saveArtifact(artifact, 'Sin nombre');
  }, [workspace]);

  useEffect(() => {
    const onHashChange = () => setView(getViewFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Entrar en una herramienta desde el final del landing conservaba el scroll
  // y dejaba el título fuera de pantalla.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const navigate = useCallback((v: ViewType, opts?: { prefill?: string }) => {
    if (opts?.prefill) {
      setPrefill({ view: v, text: opts.prefill });
    }
    window.location.hash = `#/${v}`;
  }, []);

  // El prefill es one-shot: la vista destino lo consume en su efecto de mount
  // (que corre antes que este, hijos primero) y aqui se limpia. Sin esto, cada
  // remonte posterior de esa vista reinyectaria el texto encadenado viejo
  // durante el resto de la sesion, incluso tras un Limpiar explicito.
  useEffect(() => {
    if (prefill && view === prefill.view) setPrefill(null);
  }, [view, prefill]);

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
    <StorageQuotaAlert />
    <div className="page">
      <UpdateBanner visible={needRefresh} onReload={reload} />
      <Header
        provider={provider}
        model={model}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        workspaces={workspace.workspaces}
        activeWorkspaceId={workspace.activeId}
        onSelectWorkspace={workspace.setActiveId}
        onCreateWorkspace={workspace.createWorkspace}
        onRenameWorkspace={workspace.renameWorkspace}
        onDeleteWorkspace={workspace.deleteWorkspace}
        onExportWorkspace={exportWorkspaceToFile}
        onImportWorkspace={workspace.importWorkspace}
        onImportLegacyWorkspace={workspace.importWorkspace}
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

          {view === 'regressiontracker' && (
            <RegressionTracker />
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

          {view === 'designvalidator' && (
            <DesignValidatorTool apiKey={currentApiKey} model={model} provider={provider} profile={profile} baseUrl={currentBaseUrl}
              prefill={prefill?.view === 'designvalidator' ? prefill.text : undefined}
              onSwitchToVisionModel={() => { setProvider('openrouter'); setModel('google/gemini-2.5-flash'); }}
              onSaveArtifact={(input, output) => saveArtifact({ tool: 'designvalidator', input, output })} />
          )}

          {view === 'doclibrary' && <DocLibrary />}
        </ErrorBoundary>
      </main>
      </div>
    </div>
    </I18nProvider>
  );
}
