interface ExportBarProps {
  formats: string[];
  onExport: (format: string) => void;
  copied?: boolean;
}

const FORMAT_LABELS: Record<string, string> = {
  copy: 'Copiar',
  markdown: 'Markdown',
  jirawiki: 'Jira Wiki',
  pdf: 'Descargar PDF',
  csv: 'Descargar CSV',
  tsv: 'Copiar TSV',
};

export function ExportBar({ formats, onExport, copied }: ExportBarProps) {
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
          {fmt === 'copy' && copied ? 'Copiado!' : FORMAT_LABELS[fmt] || fmt}
        </button>
      ))}
    </div>
  );
}
