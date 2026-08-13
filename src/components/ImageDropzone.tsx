import { useRef, useState, useCallback } from 'react';
import { useT } from '../i18n/I18nContext';
import { fileToProcessedDataUrl } from '../utils/image';

interface ImageDropzoneProps {
  imageName: string | null;
  onImage: (dataUrl: string, fileName: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageDropzone({ imageName, onImage, onRemove, disabled }: ImageDropzoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleFile = useCallback(async (file: File | null | undefined) => {
    if (!file || disabled) return;
    setError(null);
    setProcessing(true);
    try {
      const dataUrl = await fileToProcessedDataUrl(file);
      onImage(dataUrl, file.name);
    } catch (err) {
      const key = err instanceof Error ? err.message : 'error.notAnImage';
      setError(t(key));
    } finally {
      setProcessing(false);
    }
  }, [disabled, onImage, t]);

  const firstImageFile = (files: FileList | File[] | null | undefined): File | undefined => {
    if (!files) return undefined;
    return Array.from(files).find((f) => f.type.startsWith('image/')) ?? Array.from(files)[0];
  };

  return (
    <div
      data-testid="image-dropzone"
      className="image-dropzone"
      style={{ border: '1px dashed var(--border)', borderRadius: 8, padding: 12, opacity: disabled ? 0.6 : 1 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handleFile(firstImageFile(e.dataTransfer?.files)); }}
      onPaste={(e) => handleFile(firstImageFile(e.clipboardData?.files))}
    >
      {imageName ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{imageName}</span>
          <button type="button" className="btn-ghost" onClick={onRemove} disabled={disabled} aria-label={t('designvalidator.removeImage')}>
            {t('designvalidator.removeImage')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="design-image-input" style={{ fontSize: 13 }}>
            {t('designvalidator.attachImage')}
          </label>
          <input
            id="design-image-input"
            ref={inputRef}
            type="file"
            accept="image/*"
            disabled={disabled || processing}
            onChange={(e) => { handleFile(e.target.files?.[0]); if (inputRef.current) inputRef.current.value = ''; }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('designvalidator.dropHint')}</span>
        </div>
      )}
      {processing && <span style={{ fontSize: 12 }}>{t('designvalidator.processing')}</span>}
      {error && <p style={{ fontSize: 12, color: 'var(--danger, #c00)', marginTop: 6 }}>{error}</p>}
    </div>
  );
}
