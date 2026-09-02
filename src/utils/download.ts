export function toFilename(name: string, extension: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip the accents NFD split off
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'workspace'}.${extension}`;
}

/** Descarga `content` como fichero. Unica copia del truco del <a download>. */
export function downloadBlob(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, content: string): void {
  downloadBlob(filename, content, 'application/json');
}
