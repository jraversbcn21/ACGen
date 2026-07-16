import { useT } from '../i18n/I18nContext';

interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
}

export function GenerateButton({ onClick, disabled, loading }: GenerateButtonProps) {
  const t = useT();

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
          {t('common.generating')}
        </>
      ) : (
        t('common.generate')
      )}
    </button>
  );
}
