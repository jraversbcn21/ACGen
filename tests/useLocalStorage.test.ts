import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../src/hooks/useLocalStorage';
import { DEFAULT_MODEL, AVAILABLE_MODELS } from '../src/config/constants';

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
});
