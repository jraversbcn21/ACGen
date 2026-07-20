import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('acgen_lang', JSON.stringify('es'));
  window.location.hash = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('App — hash navigation', () => {
  it('scrolls to top when navigating to a tool', () => {
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<App />);
    scrollSpy.mockClear();
    act(() => {
      window.location.hash = '#/acceptance';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(scrollSpy).toHaveBeenCalledWith(0, 0);
  });
});
