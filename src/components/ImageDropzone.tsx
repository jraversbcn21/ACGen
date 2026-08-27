import { useRef, useState, useCallback, useEffect } from 'react';
import { useT } from '../i18n/I18nContext';
import { fileToProcessedDataUrl } from '../utils/image';

interface ImageDropzoneProps {
  imageName: string | null;
  /** DataUrl de la imagen ya procesada: se usa para la miniatura. */
  imageUrl?: string | null;
  onImage: (dataUrl: string, fileName: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}

export function ImageDropzone({ imageName, imageUrl, onImage, onRemove, disabled }: ImageDropzoneProps) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imageUrl) setDims(null);
  }, [imageUrl]);

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

  // Un onPaste en el div solo dispara si el foco está dentro de él, lo cual
  // casi nunca ocurre en producción (el foco suele estar en el textarea de
  // criterios o en el body), así que no hay listener local: este listener
  // global cubre el Ctrl+V real en cualquier punto de la página sin robarle
  // el pegado de texto al textarea, y sin disparar dos veces si el foco sí
  // estuviera dentro del div. Solo interceptamos cuando el portapapeles trae
  // de verdad un fichero de imagen.
  useEffect(() => {
    if (disabled) return;
    const handler = (e: ClipboardEvent) => {
      const file = firstImageFile(e.clipboardData?.files);
      if (file && file.type.startsWith('image/')) {
        e.preventDefault();
        handleFile(file);
      }
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
  }, [disabled, handleFile]);

  return (
    <div
      data-testid="image-dropzone"
      className="dz"
      style={{ opacity: disabled ? 0.6 : 1 }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); handleFile(firstImageFile(e.dataTransfer?.files)); }}
    >
      {imageName ? (
        <div className="dz-filled">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageName}
              className="dz-thumb"
              onLoad={(e) => setDims({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            />
          ) : (
            <span className="dz-thumb" />
          )}
          <span className="dz-meta">
            <span className="dz-name">{imageName}</span>
            {dims && <span className="dz-dims">{dims.w} × {dims.h}</span>}
          </span>
          <button type="button" className="btn-ghost" onClick={onRemove} disabled={disabled} aria-label={t('designvalidator.removeImage')}>
            {t('designvalidator.removeImage')}
          </button>
        </div>
      ) : (
        <div className="dz-empty">
          <span className="dz-empty-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
              <circle cx="8.5" cy="9.5" r="1.3" />
              <path d="m3.5 16 4.5-4 3.5 3.2" />
              <path d="m13.5 14.5 2 2 4-4" />
            </svg>
          </span>
          <span className="dz-empty-text">
            <label htmlFor="design-image-input" className="dz-empty-label">
              {t('designvalidator.attachImage')}
            </label>
            <span className="dz-hint">{t('designvalidator.dropHint')}</span>
          </span>
          <input
            id="design-image-input"
            ref={inputRef}
            type="file"
            accept="image/*"
            className="dz-file-input"
            disabled={disabled || processing}
            onChange={(e) => { handleFile(e.target.files?.[0]); if (inputRef.current) inputRef.current.value = ''; }}
          />
        </div>
      )}
      {processing && <span className="dz-hint">{t('designvalidator.processing')}</span>}
      {error && <p className="dz-error">{error}</p>}
    </div>
  );
}
