import { ExportBar } from './ExportBar';

interface ResultPanelProps {
  content: React.ReactNode;
  sourceFormats?: string[];
  onExport?: (format: string) => void;
  copied?: boolean;
  children?: React.ReactNode;
}

export function ResultPanel({ content, sourceFormats, onExport, copied, children }: ResultPanelProps) {
  return (
    <div className="output-section" style={{ marginTop: 16 }}>
      {content}
      {children}
      {sourceFormats && onExport && (
        <ExportBar formats={sourceFormats} onExport={onExport} copied={copied} />
      )}
    </div>
  );
}
