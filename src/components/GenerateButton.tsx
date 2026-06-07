interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  label?: string;
  loadingLabel?: string;
}

export function GenerateButton({ onClick, disabled, loading, label, loadingLabel }: GenerateButtonProps) {
  return (
    <button
      type="button"
      className={`btn-primary ${loading ? 'btn-loading' : ''}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <>
          <span className="spinner-new" />
          {loadingLabel || 'Generando...'}
        </>
      ) : (
        label || 'Generar criterios de aceptación'
      )}
    </button>
  );
}
