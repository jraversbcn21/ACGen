import { renderHook, act } from '@testing-library/react';
import { vi } from 'vitest';
import { useLocalStorage } from './useLocalStorage';
import { DEFAULT_MODEL, AVAILABLE_MODELS } from '../config/constants';

describe('useLocalStorage', () => {
  it('returns initialValue when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 'default'));
    expect(result.current[0]).toBe('default');
  });

  it('returns stored value when localStorage has a valid entry', () => {
    localStorage.setItem('test_key', JSON.stringify('stored value'));
    const { result } = renderHook(() => useLocalStorage('test_key', 'default'));
    expect(result.current[0]).toBe('stored value');
  });

  it('sets a new value and persists it to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test_key', 'default'));
    act(() => { result.current[1]('new value'); });

    expect(result.current[0]).toBe('new value');
    expect(JSON.parse(localStorage.getItem('test_key') || '')).toBe('new value');
  });

  it('supports functional updater form', () => {
    localStorage.setItem('test_count', JSON.stringify(5));
    const { result } = renderHook(() => useLocalStorage('test_count', 0));
    act(() => { result.current[1]((prev) => prev + 1); });

    expect(result.current[0]).toBe(6);
  });

  it('returns initialValue when localStorage contains invalid JSON', () => {
    localStorage.setItem('test_key', 'not-valid-json{{');
    const { result } = renderHook(() => useLocalStorage('test_key', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('discards stale acgen_model and returns DEFAULT_MODEL', () => {
    localStorage.setItem('acgen_model', JSON.stringify('old-deprecated-model'));
    const { result } = renderHook(() => useLocalStorage('acgen_model', DEFAULT_MODEL));

    expect(result.current[0]).toBe(DEFAULT_MODEL);
    expect(localStorage.getItem('acgen_model')).toBeNull();
  });

  it('keeps valid acgen_model that exists in AVAILABLE_MODELS', () => {
    const validModel = AVAILABLE_MODELS[0];
    localStorage.setItem('acgen_model', JSON.stringify(validModel));
    const { result } = renderHook(() => useLocalStorage('acgen_model', DEFAULT_MODEL));

    expect(result.current[0]).toBe(validModel);
  });

  it('does NOT discard unknown keys even if value looks like a model string', () => {
    localStorage.setItem('other_key', JSON.stringify('old-deprecated-model'));
    const { result } = renderHook(() => useLocalStorage('other_key', 'default'));

    expect(result.current[0]).toBe('old-deprecated-model');
  });

  it('works correctly with object values', () => {
    const { result } = renderHook(() => useLocalStorage('test_obj', { count: 0 }));
    act(() => { result.current[1]({ count: 42 }); });

    expect(result.current[0]).toEqual({ count: 42 });
    expect(JSON.parse(localStorage.getItem('test_obj') || '{}')).toEqual({ count: 42 });
  });

  it('syncs two instances with the same key in the same tab', () => {
    const { result } = renderHook(() => ({
      a: useLocalStorage('shared_key', 'default'),
      b: useLocalStorage('shared_key', 'default'),
    }));

    act(() => { result.current.a[1]('updated by a'); });

    expect(result.current.a[0]).toBe('updated by a');
    expect(result.current.b[0]).toBe('updated by a');
  });

  it('updates when a native storage event fires for its key (cross-tab sync)', () => {
    const { result } = renderHook(() => useLocalStorage('cross_tab_key', 'default'));

    act(() => {
      localStorage.setItem('cross_tab_key', JSON.stringify('from another tab'));
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'cross_tab_key',
        newValue: JSON.stringify('from another tab'),
      }));
    });

    expect(result.current[0]).toBe('from another tab');
  });

  it('ignores storage events for other keys', () => {
    const { result } = renderHook(() => useLocalStorage('my_key', 'default'));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'other_key',
        newValue: JSON.stringify('should not apply'),
      }));
    });

    expect(result.current[0]).toBe('default');
  });

  it('resets to initialValue when a storage event clears its key', () => {
    localStorage.setItem('clearable_key', JSON.stringify('initial from storage'));
    const { result } = renderHook(() => useLocalStorage('clearable_key', 'fallback'));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'clearable_key',
        newValue: null,
      }));
    });

    expect(result.current[0]).toBe('fallback');
  });

  it('keeps the in-memory value updated even when localStorage.setItem throws (quota exceeded)', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('quota_key', 'default'));

    expect(() => {
      act(() => { result.current[1]('new value'); });
    }).not.toThrow();

    expect(result.current[0]).toBe('new value');

    setItemSpy.mockRestore();
  });
});
