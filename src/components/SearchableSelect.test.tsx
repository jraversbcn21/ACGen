import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { SearchableSelect } from './SearchableSelect';

const options = [{ value: 'es', label: 'España' }];

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('SearchableSelect i18n', () => {
  afterEach(() => localStorage.clear());

  it('search input placeholder defaults to the translated common.search', () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('shows the translated empty state', () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'zzz' } });
    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('trigger placeholder defaults to the translated common.select', () => {
    renderEn(<SearchableSelect options={options} value="" onChange={() => {}} />);
    expect(screen.getByText('Select...')).toBeInTheDocument();
  });
});
