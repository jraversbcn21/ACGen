import { useEffect, useMemo, useRef, useState } from 'react';
import { ProviderConfig } from './ProviderConfig';
import { Icon } from './Icons';
import { PROVIDERS, DEFAULT_PROVIDER } from '../config/providers';
import { useT } from '../i18n/I18nContext';
import { paletteShortcutLabel } from '../utils/shortcut';
import { ProfileEditor } from './ProfileEditor';
import { PromptEditor } from './PromptEditor';

type ViewId =
  | 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'userstory' | 'refiner'
  | 'edgecase' | 'converter' | 'sprinttracker' | 'regressiontracker' | 'designvalidator';

interface LandingScreenProps {
  onSelect: (view: ViewId) => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  customBaseUrl: string;
  onCustomBaseUrlChange: (url: string) => void;
}

/** Familias usadas por los chips de filtro y por el pill de cada tarjeta. */
type Family = 'qa' | 'data' | 'po' | 'analysis' | 'tracking' | 'util';

const tools: { id: ViewId; icon: (p: { size?: number }) => JSX.Element; titleKey: string; descKey: string; family: Family }[] = [
  { id: 'acceptance', icon: Icon.criterios, titleKey: 'landing.tool.acceptance', descKey: 'landing.tool.acceptanceDesc', family: 'qa' },
  { id: 'testcase', icon: Icon.testcase, titleKey: 'landing.tool.testcase', descKey: 'landing.tool.testcaseDesc', family: 'qa' },
  { id: 'bugreport', icon: Icon.bug, titleKey: 'landing.tool.bugreport', descKey: 'landing.tool.bugreportDesc', family: 'qa' },
  { id: 'testdata', icon: Icon.datos, titleKey: 'landing.tool.testdata', descKey: 'landing.tool.testdataDesc', family: 'data' },
  { id: 'userstory', icon: Icon.userstory, titleKey: 'landing.tool.userstory', descKey: 'landing.tool.userstoryDesc', family: 'po' },
  { id: 'refiner', icon: Icon.refiner, titleKey: 'landing.tool.refiner', descKey: 'landing.tool.refinerDesc', family: 'analysis' },
  { id: 'edgecase', icon: Icon.edgecase, titleKey: 'landing.tool.edgecase', descKey: 'landing.tool.edgecaseDesc', family: 'qa' },
  { id: 'designvalidator', icon: Icon.designvalidator, titleKey: 'landing.tool.designvalidator', descKey: 'landing.tool.designvalidatorDesc', family: 'qa' },
  { id: 'converter', icon: Icon.converter, titleKey: 'landing.tool.converter', descKey: 'landing.tool.converterDesc', family: 'util' },
  { id: 'sprinttracker', icon: Icon.sprint, titleKey: 'landing.tool.sprinttracker', descKey: 'landing.tool.sprinttrackerDesc', family: 'tracking' },
  { id: 'regressiontracker', icon: Icon.regression, titleKey: 'landing.tool.regressiontracker', descKey: 'landing.tool.regressiontrackerDesc', family: 'tracking' },
];

/** Orden de los chips: primero las familias con mas herramientas. */
const FAMILIES: Family[] = ['qa', 'tracking', 'data', 'po', 'analysis', 'util'];

/** Busqueda sin acentos: "limite" tiene que encontrar "Casos Limite". */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function SearchGlyph({ size = 19 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4 4" />
    </svg>
  );
}

export function LandingScreen({ onSelect, provider, onProviderChange, apiKey, onApiKeyChange, model, onModelChange, customBaseUrl, onCustomBaseUrlChange }: LandingScreenProps) {
  const t = useT();
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState<Family | 'all'>('all');
  const searchRef = useRef<HTMLInputElement>(null);

  /* Ctrl+K / Cmd+K enfoca el buscador; Escape lo limpia. El handler acepta las
     dos teclas y solo la etiqueta depende de la plataforma (Windows aqui). */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: tools.length };
    for (const tool of tools) acc[tool.family] = (acc[tool.family] ?? 0) + 1;
    return acc;
  }, []);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return tools.filter((tool) => {
      if (family !== 'all' && tool.family !== family) return false;
      if (!q) return true;
      return norm(t(tool.titleKey)).includes(q) || norm(t(tool.descKey)).includes(q);
    });
  }, [query, family, t]);

  const providerName = (PROVIDERS[provider] ?? PROVIDERS[DEFAULT_PROVIDER]).name;
  const shortcut = paletteShortcutLabel();

  return (
    <div className="landing">
      <div className="ld-console">
        <div className="ld-hero">
          <h1 className="ld-title">{t('landing.headline')}</h1>
          <span className="ld-hero-tag">{t('landing.qaSession')}</span>
        </div>

        <div className="ld-search">
          <span className="ld-search-ico"><SearchGlyph /></span>
          <input
            ref={searchRef}
            type="search"
            className="ld-search-input"
            value={query}
            placeholder={t('landing.searchPlaceholder')}
            aria-label={t('landing.searchPlaceholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setQuery('');
              /* Enter con un unico resultado abre esa herramienta: el flujo
                 rapido es escribir tres letras y pulsar Enter. */
              if (e.key === 'Enter' && visible.length === 1) onSelect(visible[0].id);
            }}
          />
          <kbd className="ld-kbd">{shortcut}</kbd>
        </div>

        <div className="ld-filters">
          <button type="button" className="ld-chip" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>
            {t('landing.filter.all')}
            <span className="ld-chip-count">{counts.all}</span>
          </button>
          {FAMILIES.map((f) => (
            <button key={f} type="button" className="ld-chip" aria-pressed={family === f} onClick={() => setFamily(family === f ? 'all' : f)}>
              {t(`landing.tag.${f}`)}
              <span className="ld-chip-count">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ld-status">
          <div className="ld-status-items">
            <div className="ld-status-item">
              <span className="ld-status-key">{t('landing.provider')}</span>
              <span className="ld-status-val">{providerName}</span>
            </div>
            <span className="ld-status-sep" aria-hidden="true" />
            <div className="ld-status-item">
              <span className="ld-status-key">{t('landing.model')}</span>
              <span className="ld-status-val mono">{model}</span>
            </div>
            <span className="ld-status-sep" aria-hidden="true" />
            <div className="ld-status-item">
              <span className="ld-status-key">{t('landing.apiKey')}</span>
              <span className={apiKey ? 'ld-status-ok' : 'ld-status-warn'}>
                {t(apiKey ? 'landing.keyConnected' : 'landing.keyMissing')}
              </span>
            </div>
          </div>
          <div className="ld-actions">
            <button type="button" className="btn-ghost" aria-expanded={showConfig} onClick={() => setShowConfig((v) => !v)}>
              {t('landing.editConfig')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowProfileEditor(true)}>
              <Icon.profile size={18} />
              {t('sidebar.profile')}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowPromptEditor(true)}>
              <Icon.spark size={18} />
              {t('sidebar.prompts')}
            </button>
          </div>
        </div>

        {showConfig && (
          <div className="ld-config-panel">
            <ProviderConfig
              provider={provider}
              onProviderChange={onProviderChange}
              apiKey={apiKey}
              onApiKeyChange={onApiKeyChange}
              model={model}
              onModelChange={onModelChange}
              baseUrl={customBaseUrl}
              onBaseUrlChange={onCustomBaseUrlChange}
            />
          </div>
        )}
      </div>

      <div className="sec-head">
        <h2 className="sec-title">{t('landing.generators')}</h2>
        <span className="sec-count">{String(visible.length).padStart(2, '0')}</span>
      </div>

      {visible.length === 0 ? (
        <p className="ld-empty">{t('landing.noResults')}</p>
      ) : (
        <div className="tool-list">
          {visible.map((tool) => {
            /* El numero es la posicion en el catalogo, no en la lista filtrada:
               "07" sigue siendo Casos Limite aunque filtres por QA. */
            const num = String(tools.findIndex((x) => x.id === tool.id) + 1).padStart(2, '0');
            return (
              <button key={tool.id} type="button" className="tool-row" onClick={() => onSelect(tool.id)}>
                <span className="row-num">{num}</span>
                <span className="tool-ico"><tool.icon size={22} /></span>
                <div className="row-body">
                  <span className="row-title">{t(tool.titleKey)}</span>
                  <span className="row-desc">{t(tool.descKey)}</span>
                </div>
                <span className="row-tag">{t(`landing.tag.${tool.family}`)}</span>
                <span className="row-arrow"><Icon.arrow size={20} /></span>
              </button>
            );
          })}
        </div>
      )}

      {showProfileEditor && <ProfileEditor onClose={() => setShowProfileEditor(false)} />}
      {showPromptEditor && <PromptEditor onClose={() => setShowPromptEditor(false)} />}
    </div>
  );
}
