import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The manifest declares these icons as 192x192 and 512x512. Chrome validates the
 * real pixel size against that declaration, so a placeholder silently breaks
 * installability. Read the PNG header and assert the real dimensions.
 */
function pngSize(relativePath: string): { width: number; height: number } {
  const buf = readFileSync(resolve(__dirname, '../../', relativePath));

  const signature = buf.subarray(0, 8).toString('hex');
  expect(signature, `${relativePath} is not a PNG`).toBe('89504e470d0a1a0a');
  expect(buf.subarray(12, 16).toString('ascii'), `${relativePath} has no IHDR`).toBe('IHDR');

  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('PWA icons', () => {
  it('icon-192.png is really 192x192', () => {
    expect(pngSize('public/icon-192.png')).toEqual({ width: 192, height: 192 });
  });

  it('icon-512.png is really 512x512', () => {
    expect(pngSize('public/icon-512.png')).toEqual({ width: 512, height: 512 });
  });

  it('index.html declares a favicon link (without one, browsers request /favicon.ico and 404)', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf-8');
    expect(html).toMatch(/<link rel="icon"[^>]*href="\/icon-192\.png"/);
  });
});
