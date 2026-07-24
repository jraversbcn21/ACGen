import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { UserStoryTool } from './UserStoryTool';

function renderTool(lang: 'es' | 'en' = 'es') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <UserStoryTool apiKey="" model="llama-3.3-70b-versatile" />
    </I18nProvider>
  );
}

describe('UserStoryTool input guidance', () => {
  afterEach(() => localStorage.clear());

  it('shows the Como/Quiero/Para skeleton placeholder (es)', () => {
    renderTool('es');
    const textarea = screen.getByPlaceholderText(/Como usuario/);
    expect(textarea).toHaveAttribute('placeholder', 'Como usuario...\nQuiero [funcionalidad]...\nPara [beneficio]...');
  });

  it('shows the equivalent skeleton placeholder (en)', () => {
    renderTool('en');
    const textarea = screen.getByPlaceholderText(/As a user/);
    expect(textarea).toHaveAttribute('placeholder', 'As a user...\nI want [functionality]...\nSo that [benefit]...');
  });

  it('renders a persistent hint below the field that survives typing (es)', () => {
    renderTool('es');
    expect(screen.getByText(/También puedes describirlo en texto libre/)).toBeInTheDocument();
  });

  it('renders the persistent hint translated (en)', () => {
    renderTool('en');
    expect(screen.getByText(/You can also describe it in free text/)).toBeInTheDocument();
  });
});
