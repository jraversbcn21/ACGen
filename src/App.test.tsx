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

/**
 * `<ProfileEditor>`/`<PromptEditor>` modal state is deliberately duplicated
 * between `Sidebar.tsx` and `LandingScreen.tsx` instead of lifted to `App`,
 * which is only safe because `App.tsx` never renders `<Sidebar>` on the
 * landing view. Pin that premise so a future change can't silently break it.
 */
describe('App — landing view', () => {
  it('renders no sidebar on the landing view', () => {
    render(<App />);
    expect(document.querySelector('aside.sidebar')).toBeNull();
  });
});
