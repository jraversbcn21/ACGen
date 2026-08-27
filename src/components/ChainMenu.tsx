import { useT } from '../i18n/I18nContext';
import type { ViewType } from '../config/constants';

interface ChainOption {
  view: ViewType;
  label: string;
}

const CHAIN_RULES: Record<string, ChainOption[]> = {
  acceptance: [
    { view: 'testcase', label: 'chain.generateTestCases' },
    { view: 'edgecase', label: 'chain.generateEdgeCases' },
    { view: 'designvalidator', label: 'chain.validateDesign' },
  ],
  userstory: [
    { view: 'acceptance', label: 'chain.generateCriteria' },
    { view: 'refiner', label: 'chain.refineStory' },
    { view: 'testcase', label: 'chain.generateTestCases' },
  ],
  testcase: [
    { view: 'edgecase', label: 'chain.generateEdgeCases' },
  ],
  refiner: [
    { view: 'userstory', label: 'chain.generateStory' },
  ],
};

interface ChainMenuProps {
  sourceView: ViewType;
  content: string;
  onChain: (view: ViewType, prefill: string) => void;
}

export function ChainMenu({ sourceView, content, onChain }: ChainMenuProps) {
  const options = CHAIN_RULES[sourceView];
  const t = useT();
  if (!options || options.length === 0) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>{t('chain.sendTo')}</span>
      {options.map((opt) => (
        <button
          key={opt.view}
          type="button"
          className="btn-ghost"
          style={{ fontSize: '0.8rem' }}
          onClick={() => onChain(opt.view, content)}
          title={t(opt.label)}
        >
          {t(opt.label)} →
        </button>
      ))}
    </div>
  );
}
