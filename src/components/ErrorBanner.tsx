interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="error-banner">
      <span className="error-icon">!</span>
      <span className="error-text">{message}</span>
      <button
        type="button"
        className="btn btn-icon btn-dismiss"
        onClick={onDismiss}
        title="Cerrar"
      >
        ✕
      </button>
    </div>
  );
}
