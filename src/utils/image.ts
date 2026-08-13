export const MAX_EDGE = 1568;
export const MAX_BASE64_BYTES = 4 * 1024 * 1024;

export function targetDimensions(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) return { width, height };
  const scale = maxEdge / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function assertDataUrlWithinLimit(dataUrl: string): void {
  if (dataUrl.length > MAX_BASE64_BYTES) {
    throw new Error('error.imageTooLarge');
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('error.notAnImage'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('error.notAnImage'));
    img.src = dataUrl;
  });
}

/**
 * Lee un File de imagen, lo reescala si su lado largo supera MAX_EDGE
 * (re-encode JPEG 0.85) y garantiza que el data URL final cabe en el
 * límite de payload de los proveedores de visión.
 */
export async function fileToProcessedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('error.notAnImage');
  }
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = targetDimensions(img.naturalWidth, img.naturalHeight, MAX_EDGE);

  if (width === img.naturalWidth && height === img.naturalHeight) {
    assertDataUrlWithinLimit(dataUrl);
    return dataUrl;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Sin canvas 2D (entorno raro): mejor la imagen original que nada.
    assertDataUrlWithinLimit(dataUrl);
    return dataUrl;
  }
  ctx.drawImage(img, 0, 0, width, height);
  const scaled = canvas.toDataURL('image/jpeg', 0.85);
  assertDataUrlWithinLimit(scaled);
  return scaled;
}
