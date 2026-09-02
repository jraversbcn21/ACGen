import { useEffect, useRef } from 'react';
import { useT } from '../i18n/I18nContext';
import { STORAGE_ERROR_EVENT } from '../services/persistence';

/**
 * Avisa (una vez por sesion) cuando el navegador rechaza una escritura a
 * localStorage: hasta ahora la UI seguia mostrando un estado que nunca se
 * guardo. Un alert nativo basta — es una emergencia, no una notificacion.
 */
export function StorageQuotaAlert() {
  const t = useT();
  const warned = useRef(false);

  useEffect(() => {
    const onError = () => {
      if (warned.current) return;
      warned.current = true;
      alert(t('storage.quotaError'));
    };
    window.addEventListener(STORAGE_ERROR_EVENT, onError);
    return () => window.removeEventListener(STORAGE_ERROR_EVENT, onError);
  }, [t]);

  return null;
}
