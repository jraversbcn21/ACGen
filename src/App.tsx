import { useState } from 'react';
import './App.css';
import { Header } from './components/Header';
import { ApiKeyConfig } from './components/ApiKeyConfig';
import { ModelSelector } from './components/ModelSelector';
import { LandingScreen } from './components/LandingScreen';
import { AcceptanceCriteriaTool } from './components/AcceptanceCriteriaTool';
import { TestCaseTool } from './components/TestCaseTool';
import { BugReportTool } from './components/BugReportTool';
import { TestDataTool } from './components/TestDataTool';
import { useLocalStorage } from './hooks/useLocalStorage';
import { STORAGE_KEYS, DEFAULT_MODEL } from './config/constants';
import type { ViewType } from './config/constants';

export default function App() {
  const [apiKey, setApiKey] = useLocalStorage(STORAGE_KEYS.API_KEY, '');
  const [model, setModel] = useLocalStorage(STORAGE_KEYS.MODEL, DEFAULT_MODEL);
  const [view, setView] = useState<ViewType>('landing');

  const headerProps = view === 'landing'
    ? {}
    : {
        onBack: () => setView('landing'),
        subtitle: view === 'acceptance'
          ? 'Criterios de aceptación'
          : view === 'testcase'
          ? 'Test Case Generator'
          : view === 'bugreport'
          ? 'Bug Report'
          : 'Datos de Prueba',
      };

  return (
    <div className="app">
      <Header {...headerProps} />
      <main className="main">
        <ApiKeyConfig apiKey={apiKey} onChange={setApiKey} />
        <ModelSelector model={model} onChange={setModel} />

        {view === 'landing' && (
          <LandingScreen onSelect={setView} />
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
      </main>
    </div>
  );
}
