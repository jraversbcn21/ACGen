import { useT } from '../i18n/I18nContext';

interface ExportBarProps {
  formats: string[];
  onExport: (format: string) => void;
  copied?: boolean;
}

// Values are i18n keys, except proper nouns, which t() passes through verbatim.
const FORMAT_LABELS: Record<string, string> = {
  copy: 'export.copy',
  markdown: 'Markdown',
  jirawiki: 'Jira Wiki',
  pdf: 'export.pdf',
  csv: 'export.csv',
  tsv: 'export.tsv',
};

export function ExportBar({ formats, onExport, copied }: ExportBarProps) {
  const t = useT();
  if (formats.length === 0) return null;

  return (
    <div className="export-bar" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      {formats.map((fmt) => (
        <button
          key={fmt}
          type="button"
          className={`btn-ghost ${fmt === 'copy' && copied ? 'btn-copied' : ''}`}
          onClick={() => onExport(fmt)}
        >
          {fmt === 'copy' && copied ? t('common.copied') : t(FORMAT_LABELS[fmt] || fmt)}
        </button>
      ))}
    </div>
  );
}
