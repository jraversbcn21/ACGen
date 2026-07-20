import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from './Sidebar';
import { I18nProvider } from '../i18n/I18nContext';

function renderSidebar(activeWorkspaceName = 'Jorge QA') {
  render(
    <I18nProvider>
      <Sidebar activeView="acceptance" onNavigate={vi.fn()} activeWorkspaceName={activeWorkspaceName} />
    </I18nProvider>,
  );
}

const collapse = () => fireEvent.click(screen.getByRole('button', { name: /colapsar/i }));

/**
 * The collapsed sidebar is 52px wide; the workspace label can't fit and used
 * to spill out over the content. It must disappear on collapse (like the
 * category labels do) and truncate with a tooltip when expanded.
 */
describe('Sidebar — workspace label', () => {
  beforeEach(() => {
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('shows the active workspace name when expanded', () => {
    renderSidebar();
    expect(screen.getByText('WS: Jorge QA')).toBeInTheDocument();
  });

  it('hides the workspace label when collapsed', () => {
    renderSidebar();
    collapse();
    expect(screen.queryByText(/WS:/)).not.toBeInTheDocument();
  });

  it('exposes the full name as a tooltip for truncated long names', () => {
    renderSidebar('Un nombre de workspace larguisimo');
    expect(screen.getByTitle('Un nombre de workspace larguisimo')).toBeInTheDocument();
  });

  it('renders no label at all without an active workspace', () => {
    renderSidebar('');
    expect(screen.queryByText(/WS:/)).not.toBeInTheDocument();
  });
});
