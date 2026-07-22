import { useT } from '../i18n/I18nContext';

interface UpdateBannerProps {
  visible: boolean;
  onReload: () => void;
}

export function UpdateBanner({ visible, onReload }: UpdateBannerProps) {
  const t = useT();
  if (!visible) return null;

  return (
    <div className="update-banner">
      <span>{t('update.available')}</span>
      <button type="button" className="update-banner-reload" onClick={onReload}>
        {t('update.reload')}
      </button>
    </div>
  );
}
