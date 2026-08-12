import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { highlightMatches, containsMatch } from './highlight';

function renderNodes(nodes: React.ReactNode[]) {
  return render(<span>{nodes}</span>);
}

describe('highlightMatches', () => {
  it('returns the plain text when needle is empty or blank', () => {
    expect(highlightMatches('hola', '')).toEqual(['hola']);
    expect(highlightMatches('hola', '   ')).toEqual(['hola']);
  });

  it('renders no <mark> when there is no match', () => {
    const { container } = renderNodes(highlightMatches('hola mundo', 'zzz'));
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('hola mundo');
  });

  it('wraps a single match in <mark> and the full text survives', () => {
    const { container } = renderNodes(highlightMatches('BSKWEB-1475', '1475'));
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe('1475');
    expect(container.textContent).toBe('BSKWEB-1475');
  });

  it('marks all occurrences case-insensitively preserving original casing', () => {
    const { container } = renderNodes(highlightMatches('Abc abc ABC', 'abc'));
    const marks = container.querySelectorAll('mark');
    expect(marks).toHaveLength(3);
    expect([...marks].map((m) => m.textContent)).toEqual(['Abc', 'abc', 'ABC']);
  });

  it('escapes regex metacharacters in the needle', () => {
    const { container } = renderNodes(highlightMatches('bug (crítico) [DESK]', '(crítico)'));
    expect(container.querySelectorAll('mark')).toHaveLength(1);
    expect(container.querySelector('mark')!.textContent).toBe('(crítico)');
  });
});

describe('containsMatch', () => {
  it('is case-insensitive and trims the needle', () => {
    expect(containsMatch('BSKWEB-1475', ' 1475 ')).toBe(true);
    expect(containsMatch('hola', 'HOLA')).toBe(true);
    expect(containsMatch('hola', 'zzz')).toBe(false);
    expect(containsMatch('hola', '   ')).toBe(false);
  });
});
