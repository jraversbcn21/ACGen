import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function useAppUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const reloadRef = useRef(() => {});

  useEffect(() => {
    const updateServiceWorker = registerSW({
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

    reloadRef.current = () => void updateServiceWorker(true);
  }, []);

  return {
    needRefresh,
    reload: () => reloadRef.current(),
  };
}
