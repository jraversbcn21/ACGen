import { renderHook, act } from '@testing-library/react';
import { useHistory } from './useHistory';

const KEY = 'test_history';

describe('useHistory', () => {
  it('initializes with empty array when localStorage is empty', () => {
    const { result } = renderHook(() => useHistory(KEY));
    expect(result.current.history).toEqual([]);
  });

  it('adds an entry with correct shape', () => {
    const { result } = renderHook(() => useHistory(KEY));
    act(() => { result.current.addEntry('my input text', 'my output text'); });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      id: 'test-uuid-1',
      inputPreview: 'my input text',
      output: 'my output text',
    });
    expect(result.current.history[0].timestamp).toBeGreaterThan(0);
  });

  it('truncates inputPreview to 60 characters', () => {
    const { result } = renderHook(() => useHistory(KEY));
    const longInput = 'a'.repeat(80);
    act(() => { result.current.addEntry(longInput, 'output'); });

    expect(result.current.history[0].inputPreview).toHaveLength(60);
    expect(result.current.history[0].inputPreview).toBe('a'.repeat(60));
  });

  it('trims whitespace from inputPreview before slicing', () => {
    const { result } = renderHook(() => useHistory(KEY));
    act(() => { result.current.addEntry('  hello world  ', 'output'); });

    expect(result.current.history[0].inputPreview).toBe('hello world');
  });

  it('prepends new entries (newest first)', () => {
    const { result } = renderHook(() => useHistory(KEY));
    act(() => { result.current.addEntry('first', 'output 1'); });
    act(() => { result.current.addEntry('second', 'output 2'); });

    expect(result.current.history[0].inputPreview).toBe('second');
    expect(result.current.history[1].inputPreview).toBe('first');
  });

  it('keeps only the last 10 entries when limit is exceeded', () => {
    const { result } = renderHook(() => useHistory(KEY));
    for (let i = 1; i <= 11; i++) {
      act(() => { result.current.addEntry(`input ${i}`, `output ${i}`); });
    }

    expect(result.current.history).toHaveLength(10);
    expect(result.current.history[0].inputPreview).toBe('input 11');
    expect(result.current.history[9].inputPreview).toBe('input 2');
  });

  it('persists entries to localStorage', () => {
    const { result } = renderHook(() => useHistory(KEY));
    act(() => { result.current.addEntry('input', 'output'); });

    const stored = JSON.parse(localStorage.getItem(KEY) || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].inputPreview).toBe('input');
  });

  it('loads existing entries from localStorage on mount', () => {
    const existing = [{
      id: 'existing-id',
      timestamp: 1000,
      inputPreview: 'existing input',
      output: 'existing output',
    }];
    localStorage.setItem(KEY, JSON.stringify(existing));

    const { result } = renderHook(() => useHistory(KEY));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].inputPreview).toBe('existing input');
  });

  it('clears history and removes from localStorage', () => {
    const { result } = renderHook(() => useHistory(KEY));
    act(() => { result.current.addEntry('input', 'output'); });
    act(() => { result.current.clearHistory(); });

    expect(result.current.history).toEqual([]);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('returns empty array when localStorage contains invalid JSON', () => {
    localStorage.setItem(KEY, 'not-valid-json{{');
    const { result } = renderHook(() => useHistory(KEY));
    expect(result.current.history).toEqual([]);
  });
});
