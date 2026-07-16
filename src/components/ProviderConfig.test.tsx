import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { ProviderConfig } from './ProviderConfig';

function renderConfig(props: Partial<Parameters<typeof ProviderConfig>[0]> = {}, lang: 'es' | 'en' = 'en') {
  localStorage.setItem('acgen_lang', JSON.stringify(lang));
  return render(
    <I18nProvider>
      <ProviderConfig
        provider="custom"
        onProviderChange={() => {}}
        apiKey=""
        onApiKeyChange={() => {}}
        model="gpt-4o"
        onModelChange={() => {}}
        baseUrl=""
        onBaseUrlChange={() => {}}
        {...props}
      />
    </I18nProvider>
  );
}

describe('ProviderConfig base URL hint', () => {
  afterEach(() => localStorage.clear());

  it('shows the missing-URL hint when the custom base URL is empty', () => {
    renderConfig({ baseUrl: '' });
    expect(screen.getByText('Set the custom provider base URL before generating.')).toBeInTheDocument();
    expect(screen.getByLabelText('API URL')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows the invalid-URL hint when the custom base URL does not parse', () => {
    renderConfig({ baseUrl: 'not a url' });
    expect(screen.getByText('The custom provider base URL is not a valid URL.')).toBeInTheDocument();
    expect(screen.getByLabelText('API URL')).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows no hint for a valid custom base URL', () => {
    renderConfig({ baseUrl: 'https://api.example.com/v1/chat/completions' });
    expect(screen.queryByText('Set the custom provider base URL before generating.')).not.toBeInTheDocument();
    expect(screen.queryByText('The custom provider base URL is not a valid URL.')).not.toBeInTheDocument();
    expect(screen.getByLabelText('API URL')).toHaveAttribute('aria-invalid', 'false');
  });

  it('renders no base URL field at all for providers that do not need one', () => {
    renderConfig({ provider: 'groq', model: 'llama-3.3-70b-versatile' });
    expect(screen.queryByLabelText('API URL')).not.toBeInTheDocument();
  });

  it('renders the provider and base URL labels translated', () => {
    renderConfig({ baseUrl: 'https://api.example.com/v1' });
    expect(screen.getByText('Provider')).toBeInTheDocument();
    expect(screen.getByText('API URL')).toBeInTheDocument();
  });
});
