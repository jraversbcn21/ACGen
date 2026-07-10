import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

function Bomb(): React.ReactElement {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(<ErrorBoundary><div>content</div></ErrorBoundary>);
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders a fallback message instead of crashing when a child throws during render', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ErrorBoundary><Bomb /></ErrorBoundary>);

    expect(screen.getByText(/ha ocurrido un error/i)).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
    spy.mockRestore();
  });

  it('recovers and renders children again after clicking the reset button', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function MaybeBomb() {
      if (shouldThrow) throw new Error('boom');
      return <div>recovered</div>;
    }

    const { rerender } = render(<ErrorBoundary><MaybeBomb /></ErrorBoundary>);
    expect(screen.getByText(/ha ocurrido un error/i)).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    rerender(<ErrorBoundary><MaybeBomb /></ErrorBoundary>);

    expect(screen.getByText('recovered')).toBeInTheDocument();
    spy.mockRestore();
  });
});
