import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppUpdate } from './useAppUpdate';
import { reloadPage } from '../utils/reloadPage';

vi.mock('../utils/reloadPage', () => ({ reloadPage: vi.fn() }));

function installFakeServiceWorkerContainer(): EventTarget {
  const container = new EventTarget();
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: container,
    configurable: true,
  });
  return container;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  Reflect.deleteProperty(window.navigator, 'serviceWorker');
  vi.useRealTimers();
});

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

  it('reload reloads the page immediately when the Service Worker API is absent', () => {
    const { result } = renderHook(() => useAppUpdate());
    result.current.reload();
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('reload waits for controllerchange and then reloads exactly once', () => {
    vi.useFakeTimers();
    const container = installFakeServiceWorkerContainer();
    const { result } = renderHook(() => useAppUpdate());

    result.current.reload();
    expect(reloadPage).not.toHaveBeenCalled();

    container.dispatchEvent(new Event('controllerchange'));
    expect(reloadPage).toHaveBeenCalledTimes(1);

    // el temporizador de respaldo no debe provocar una segunda recarga
    vi.advanceTimersByTime(10_000);
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });

  it('reload falls back to reloading after the timeout when controllerchange never fires', () => {
    vi.useFakeTimers();
    installFakeServiceWorkerContainer();
    const { result } = renderHook(() => useAppUpdate());

    result.current.reload();
    expect(reloadPage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2_000);
    expect(reloadPage).toHaveBeenCalledTimes(1);
  });
});
