import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nProvider } from '../i18n/I18nContext';
import { RegressionTracker } from './RegressionTracker';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
});

describe('RegressionTracker (stub temporal)', () => {
  it('renders the title', () => {
    render(
      <I18nProvider>
        <RegressionTracker />
      </I18nProvider>
    );
    expect(screen.getByText('Regression Tracker')).toBeInTheDocument();
  });
});
