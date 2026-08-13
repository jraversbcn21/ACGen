import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { LandingScreen } from './LandingScreen';

function renderLanding() {
  return render(
    <I18nProvider>
      <LandingScreen
        onSelect={vi.fn()}
        provider="groq"
        onProviderChange={() => {}}
        apiKey=""
        onApiKeyChange={() => {}}
        model="llama-3.3-70b-versatile"
        onModelChange={() => {}}
        customBaseUrl=""
        onCustomBaseUrlChange={() => {}}
      />
    </I18nProvider>
  );
}

describe('LandingScreen layout', () => {
  afterEach(() => localStorage.clear());

  it('renders the 11 tool buttons', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelectorAll('.tool-row')).toHaveLength(11);
  });

  it('wraps everything in a centered .landing container', () => {
    renderLanding();
    const landing = document.querySelector('.landing');
    expect(landing).not.toBeNull();
    expect(landing?.querySelector('.hero')).not.toBeNull();
    expect(landing?.querySelector('.config-strip')).not.toBeNull();
    expect(landing?.querySelector('.tool-list')).not.toBeNull();
  });

  it('renders exactly the 11 tool cells with no placeholder slot', () => {
    renderLanding();
    const list = document.querySelector('.tool-list');
    expect(list?.querySelector('.add-slot')).toBeNull();
    expect(list?.children).toHaveLength(11);
  });

  it('still fires onSelect when a tool is clicked', () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <LandingScreen
          onSelect={onSelect}
          provider="groq"
          onProviderChange={() => {}}
          apiKey=""
          onApiKeyChange={() => {}}
          model="llama-3.3-70b-versatile"
          onModelChange={() => {}}
          customBaseUrl=""
          onCustomBaseUrlChange={() => {}}
        />
      </I18nProvider>
    );
    screen.getAllByRole('button').find((b) => b.className.includes('tool-row'))?.click();
    expect(onSelect).toHaveBeenCalledWith('acceptance');
  });
});
