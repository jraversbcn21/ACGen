import { useState } from 'react';
import { Icon } from './Icons';
import { useT } from '../i18n/I18nContext';
import { PromptEditor } from './PromptEditor';
import { ProfileEditor } from './ProfileEditor';
import type { ViewType } from '../config/constants';

const TOOLS = [
  { view: 'acceptance' as ViewType, icon: Icon.criterios, labelKey: 'sidebar.criterios', categoryKey: 'sidebar.generar' },
  { view: 'testcase' as ViewType, icon: Icon.testcase, labelKey: 'sidebar.testcase', categoryKey: 'sidebar.generar' },
  { view: 'bugreport' as ViewType, icon: Icon.bug, labelKey: 'sidebar.bugreport', categoryKey: 'sidebar.generar' },
  { view: 'testdata' as ViewType, icon: Icon.datos, labelKey: 'sidebar.testdata', categoryKey: 'sidebar.generar' },
  { view: 'userstory' as ViewType, icon: Icon.userstory, labelKey: 'sidebar.userstory', categoryKey: 'sidebar.generar' },
  { view: 'refiner' as ViewType, icon: Icon.refiner, labelKey: 'sidebar.refiner', categoryKey: 'sidebar.refinar' },
  { view: 'edgecase' as ViewType, icon: Icon.edgecase, labelKey: 'sidebar.edgecase', categoryKey: 'sidebar.refinar' },
  { view: 'designvalidator' as ViewType, icon: Icon.designvalidator, labelKey: 'sidebar.designvalidator', categoryKey: 'sidebar.refinar' },
  { view: 'converter' as ViewType, icon: Icon.converter, labelKey: 'sidebar.converter', categoryKey: 'sidebar.convertir' },
  { view: 'sprinttracker' as ViewType, icon: Icon.sprint, labelKey: 'sidebar.sprint', categoryKey: 'sidebar.seguimiento' },
  { view: 'regressiontracker' as ViewType, icon: Icon.regression, labelKey: 'sidebar.regression', categoryKey: 'sidebar.seguimiento' },
];

function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const k = String(item[key]);
    (acc[k] = acc[k] || []).push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (v: ViewType) => void;
  activeWorkspaceName: string;
}

export function Sidebar({ activeView, onNavigate, activeWorkspaceName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const t = useT();
  const grouped = groupBy(TOOLS, 'categoryKey');

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir' : 'Colapsar'}>
        <Icon.chevron style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      {activeWorkspaceName && !collapsed && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: 8 }}>
          <span
            title={activeWorkspaceName}
            style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            WS: {activeWorkspaceName}
          </span>
        </div>
      )}
      <nav className="sidebar-nav">
        {Object.entries(grouped).map(([categoryKey, items]) => (
          <div key={categoryKey} className="sidebar-group">
            {!collapsed && <span className="sidebar-category">{t(categoryKey)}</span>}
            {items.map((tool) => (
              <button
                key={tool.view}
                type="button"
                className={`sidebar-item ${activeView === tool.view ? 'active' : ''}`}
                onClick={() => onNavigate(tool.view)}
                title={t(tool.labelKey)}
              >
                <tool.icon size={18} />
                {!collapsed && <span>{t(tool.labelKey)}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!collapsed && (
          <>
            <button type="button" className="sidebar-item" onClick={() => onNavigate('landing')}>
              <Icon.back size={18} />
              <span>{t('sidebar.inicio')}</span>
            </button>
            <button type="button" className="sidebar-item" onClick={() => setShowProfileEditor(true)}>
              <Icon.profile size={18} />
              <span>{t('sidebar.profile')}</span>
            </button>
            <button type="button" className="sidebar-item" onClick={() => setShowPromptEditor(true)}>
              <Icon.spark size={18} />
              <span>{t('sidebar.prompts')}</span>
            </button>
          </>
        )}
      </div>
      {showPromptEditor && <PromptEditor onClose={() => setShowPromptEditor(false)} />}
      {showProfileEditor && <ProfileEditor onClose={() => setShowProfileEditor(false)} />}
    </aside>
  );
}
