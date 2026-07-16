import { Component } from 'react';
import type { ErrorInfo, ReactNode, ContextType } from 'react';
import { I18nContext } from '../i18n/I18nContext';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = I18nContext;
  declare context: ContextType<typeof I18nContext>;

  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      // Defensive Spanish fallback: the boundary must never crash while rendering a crash.
      const t = this.context?.t ?? ((key: string) => key === 'error.boundary'
        ? 'Algo salio mal. Por favor, recarga la pagina o intenta de nuevo.'
        : 'Reintentar');
      return (
        <div className="error-boundary-fallback">
          <h2>{t('error.boundary')}</h2>
          <p>{this.state.error.message}</p>
          <button type="button" className="btn" onClick={this.handleReset}>
            {t('common.retry')}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
