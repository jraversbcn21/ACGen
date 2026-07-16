import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadJson, toFilename } from './download';

// jsdom's Blob has no .text(), so read it the FileReader way.
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('downloadJson', () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:fake-url');
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('triggers a download with the given filename and JSON content', async () => {
    downloadJson('mi-workspace.json', '{"name":"Proyecto Alpha"}');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('mi-workspace.json');
    expect(clicked[0].href).toBe('blob:fake-url');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    await expect(readBlob(blob)).resolves.toBe('{"name":"Proyecto Alpha"}');
  });

  it('revokes the object URL so the blob is not leaked', () => {
    downloadJson('x.json', '{}');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('leaves no anchor behind in the document', () => {
    downloadJson('x.json', '{}');
    expect(document.querySelectorAll('a[download]')).toHaveLength(0);
  });
});

describe('toFilename', () => {
  it('slugifies a plain workspace name', () => {
    expect(toFilename('Proyecto Alpha', 'json')).toBe('proyecto-alpha.json');
  });

  it('strips path separators so the name cannot escape the download folder', () => {
    expect(toFilename('../../etc/passwd', 'json')).toBe('etc-passwd.json');
  });

  it('collapses accents and punctuation', () => {
    expect(toFilename('Migración QA (v2)!', 'json')).toBe('migracion-qa-v2.json');
  });

  it('falls back to a default name when nothing usable remains', () => {
    expect(toFilename('///', 'json')).toBe('workspace.json');
    expect(toFilename('', 'json')).toBe('workspace.json');
  });
});
