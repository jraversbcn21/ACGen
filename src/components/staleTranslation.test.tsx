import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useLang } from '../i18n/I18nContext';
import { TestCaseTool } from './TestCaseTool';
import { RefinerTool } from './RefinerTool';
import { UserStoryTool } from './UserStoryTool';

vi.mock('../services/apiService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/apiService')>();
  return { ...actual, streamWithGroq: vi.fn() };
});

function LangSwitcher() {
  const { setLang } = useLang();
  return <button onClick={() => setLang('en')}>switch-to-en</button>;
}

/**
 * Handlers that call t() but leave it out of their useCallback deps keep the
 * closure from the language that was active when they were memoized. The user
 * switches to English and the next toast still comes out in Spanish.
 */
const TOOLS = [
  { name: 'TestCaseTool', Tool: TestCaseTool },
  { name: 'RefinerTool', Tool: RefinerTool },
  { name: 'UserStoryTool', Tool: UserStoryTool },
];

describe.each(TOOLS)('$name — language switching', ({ Tool }) => {
  beforeEach(() => {
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: vi.fn(), getVoices: () => [] });
    localStorage.setItem('acgen_lang', JSON.stringify('es'));
  });

  it('shows the clear toast in the language active at click time', () => {
    render(
      <I18nProvider>
        <LangSwitcher />
        <Tool apiKey="test-key" model="test-model" />
      </I18nProvider>,
    );

    // Type something so the Clear button becomes enabled, while still in Spanish.
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'algo' } });
    expect(screen.getByRole('button', { name: /limpiar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'switch-to-en' }));
    fireEvent.click(screen.getByRole('button', { name: /clear/i }));

    expect(screen.getByText('Fields cleared')).toBeInTheDocument();
    expect(screen.queryByText('Campos limpiados')).not.toBeInTheDocument();
  });
});
