import { useState, useEffect, useCallback } from 'react';

interface ToastData {
  message: string;
  undo?: () => void;
}

export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);

  const showToast = useCallback((message: string, undo?: () => void) => {
    setToast({ message, undo });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  return { toast, showToast };
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <span>{toast.message}</span>
      {toast.undo && (
        <button type="button" className="toast-undo" onClick={toast.undo}>Deshacer</button>
      )}
    </div>
  );
}
