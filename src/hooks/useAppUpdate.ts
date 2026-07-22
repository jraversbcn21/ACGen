import { useCallback, useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { reloadPage } from '../utils/reloadPage';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Si el SW nuevo no toma el control (p.ej. página descontrolada tras un hard
// refresh), recargamos igualmente: el botón debe comportarse siempre como una
// recarga garantizada.
const RELOAD_FALLBACK_MS = 2000;

export function useAppUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const updaterRef = useRef<(reload?: boolean) => unknown>(() => {});

  useEffect(() => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        setInterval(() => {
          void registration.update();
        }, UPDATE_CHECK_INTERVAL_MS);
      },
    });

    updaterRef.current = updateServiceWorker;
  }, []);

  const reload = useCallback(() => {
    void updaterRef.current(true);
    const sw = navigator.serviceWorker;
    if (!sw) {
      reloadPage();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      reloadPage();
    };
    sw.addEventListener('controllerchange', finish, { once: true });
    setTimeout(finish, RELOAD_FALLBACK_MS);
  }, []);

  return { needRefresh, reload };
}
