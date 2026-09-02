import { useState } from 'react';
import { useT } from '../i18n/I18nContext';

interface UpdateBannerProps {
  visible: boolean;
  onReload: () => void;
}

export function UpdateBanner({ visible, onReload }: UpdateBannerProps) {
  const t = useT();
  // "Mas tarde" solo oculta el aviso en esta sesion: la actualizacion se
  // aplicara igual en la siguiente carga. Antes la unica salida era recargar,
  // que tira lo que hubiera a medio generar.
  const [dismissed, setDismissed] = useState(false);
  if (!visible || dismissed) return null;

  return (
    <div className="update-banner" role="status">
      <span>{t('update.available')}</span>
      <button type="button" className="update-banner-reload" onClick={onReload}>
        {t('update.reload')}
      </button>
      <button type="button" className="update-banner-reload update-banner-later" onClick={() => setDismissed(true)}>
        {t('update.later')}
      </button>
    </div>
  );
}
