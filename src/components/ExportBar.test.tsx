import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../i18n/I18nContext';
import { ExportBar } from './ExportBar';

function renderEn(ui: React.ReactElement) {
  localStorage.setItem('acgen_lang', '"en"');
  return render(<I18nProvider>{ui}</I18nProvider>);
}

describe('ExportBar i18n', () => {
  afterEach(() => localStorage.clear());

  it('renders English labels', () => {
    renderEn(<ExportBar formats={['copy', 'pdf', 'csv', 'tsv']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download CSV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy TSV' })).toBeInTheDocument();
  });

  it('keeps proper nouns literal', () => {
    renderEn(<ExportBar formats={['markdown', 'jirawiki']} onExport={() => {}} />);
    expect(screen.getByRole('button', { name: 'Markdown' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jira Wiki' })).toBeInTheDocument();
  });

  it('shows the copied state translated', () => {
    renderEn(<ExportBar formats={['copy']} onExport={() => {}} copied />);
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });
});
