import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useAppUpdate } from './useAppUpdate';

describe('useAppUpdate', () => {
  it('starts with needRefresh false and exposes a reload function', () => {
    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.needRefresh).toBe(false);
    expect(typeof result.current.reload).toBe('function');
  });

  it('reload does not throw when called before any update is available', () => {
    const { result } = renderHook(() => useAppUpdate());
    expect(() => result.current.reload()).not.toThrow();
  });
});
