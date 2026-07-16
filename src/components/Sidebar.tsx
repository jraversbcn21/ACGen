import { useState } from 'react';
import { Icon } from './Icons';
import type { ViewType } from '../config/constants';

const TOOLS = [
  { view: 'acceptance' as ViewType, icon: Icon.criterios, label: 'Criterios', category: 'Generar' },
  { view: 'testcase' as ViewType, icon: Icon.testcase, label: 'Test Cases', category: 'Generar' },
  { view: 'bugreport' as ViewType, icon: Icon.bug, label: 'Bug Report', category: 'Generar' },
  { view: 'testdata' as ViewType, icon: Icon.datos, label: 'Datos', category: 'Generar' },
  { view: 'userstory' as ViewType, icon: Icon.userstory, label: 'Historias', category: 'Generar' },
  { view: 'refiner' as ViewType, icon: Icon.refiner, label: 'Refinador', category: 'Refinar' },
  { view: 'edgecase' as ViewType, icon: Icon.edgecase, label: 'Casos Limite', category: 'Refinar' },
  { view: 'sprinttracker' as ViewType, icon: Icon.sprint, label: 'Sprint', category: 'Seguimiento' },
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
}

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const grouped = groupBy(TOOLS, 'category');

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button type="button" className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Expandir' : 'Colapsar'}>
        <Icon.chevron style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
      </button>
      <nav className="sidebar-nav">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="sidebar-group">
            {!collapsed && <span className="sidebar-category">{category}</span>}
            {items.map((tool) => (
              <button
                key={tool.view}
                type="button"
                className={`sidebar-item ${activeView === tool.view ? 'active' : ''}`}
                onClick={() => onNavigate(tool.view)}
                title={tool.label}
              >
                <tool.icon size={18} />
                {!collapsed && <span>{tool.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {!collapsed && (
          <button type="button" className="sidebar-item" onClick={() => onNavigate('landing')}>
            <Icon.back size={18} />
            <span>Inicio</span>
          </button>
        )}
      </div>
    </aside>
  );
}
