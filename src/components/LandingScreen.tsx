import { ProviderConfig } from './ProviderConfig';
import { Icon } from './Icons';
import { useT } from '../i18n/I18nContext';

interface LandingScreenProps {
  onSelect: (view: 'acceptance' | 'testcase' | 'bugreport' | 'testdata' | 'userstory' | 'refiner' | 'edgecase' | 'converter' | 'sprinttracker') => void;
  provider: string;
  onProviderChange: (provider: string) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  customBaseUrl: string;
  onCustomBaseUrlChange: (url: string) => void;
}

const tools = [
  {
    id: 'acceptance' as const,
    icon: Icon.criterios,
    titleKey: 'landing.tool.acceptance',
    descKey: 'landing.tool.acceptanceDesc',
    tag: 'QA',
  },
  {
    id: 'testcase' as const,
    icon: Icon.testcase,
    titleKey: 'landing.tool.testcase',
    descKey: 'landing.tool.testcaseDesc',
    tag: 'QA',
  },
  {
    id: 'bugreport' as const,
    icon: Icon.bug,
    titleKey: 'landing.tool.bugreport',
    descKey: 'landing.tool.bugreportDesc',
    tag: 'QA',
  },
  {
    id: 'testdata' as const,
    icon: Icon.datos,
    titleKey: 'landing.tool.testdata',
    descKey: 'landing.tool.testdataDesc',
    tag: 'Datos',
  },
  {
    id: 'userstory' as const,
    icon: Icon.userstory,
    titleKey: 'landing.tool.userstory',
    descKey: 'landing.tool.userstoryDesc',
    tag: 'PO',
  },
  {
    id: 'refiner' as const,
    icon: Icon.refiner,
    titleKey: 'landing.tool.refiner',
    descKey: 'landing.tool.refinerDesc',
    tag: 'Analisis',
  },
  {
    id: 'edgecase' as const,
    icon: Icon.edgecase,
    titleKey: 'landing.tool.edgecase',
    descKey: 'landing.tool.edgecaseDesc',
    tag: 'QA',
  },
  {
    id: 'converter' as const,
    icon: Icon.converter,
    titleKey: 'landing.tool.converter',
    descKey: 'landing.tool.converterDesc',
    tag: 'Util',
  },
  {
    id: 'sprinttracker' as const,
    icon: Icon.sprint,
    titleKey: 'landing.tool.sprinttracker',
    descKey: 'landing.tool.sprinttrackerDesc',
    tag: 'Tracking',
  },
];

export function LandingScreen({ onSelect, provider, onProviderChange, apiKey, onApiKeyChange, model, onModelChange, customBaseUrl, onCustomBaseUrlChange }: LandingScreenProps) {
  const t = useT();

  return (
    <div className="landing">
      <div className="hero">
        <p className="eyebrow">{t('landing.qaSession')} · {t('landing.eyebrow')}</p>
        <h1 className="hero-title">
          <span className="b">AC</span>Gen{' '}
          <span className="greet-serif">{t('landing.greeting')}</span>
        </h1>
      </div>

      <div className="config-strip">
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

      <div className="sec-head">
        <h2 className="sec-title">{t('landing.generators')}</h2>
        <span className="sec-count">05</span>
      </div>

      <div className="tool-list">
        {tools.map((tool, i) => {
          const num = String(i + 1).padStart(2, '0');
          return (
            <button key={tool.id} type="button" className="tool-row" onClick={() => onSelect(tool.id)}>
              <span className="row-num">{num}</span>
              <span className="tool-ico"><tool.icon size={22} /></span>
              <div className="row-body">
                <span className="row-title">{t(tool.titleKey)}</span>
                <span className="row-desc">{t(tool.descKey)}</span>
              </div>
              <span className="row-tag">{tool.tag}</span>
              <span className="row-arrow"><Icon.arrow size={20} /></span>
            </button>
          );
        })}
        <div className="add-slot">
          <span className="add-plus">+</span>
          {t('landing.moreComing')}
        </div>
      </div>
    </div>
  );
}
