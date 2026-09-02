import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';

interface ModalProps {
  /** Nombre accesible del dialogo (el mismo texto que su titulo). */
  label: string;
  onClose: () => void;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Overlay + dialogo compartido por todos los modales: role/aria-modal, foco al
 * abrir y Escape para cerrar. El onKeyDown corta la propagacion a proposito:
 * los tools escuchan Ctrl+Enter en window y la portada Ctrl+K, y sin esto un
 * atajo tecleado dentro del modal disparaba la herramienta de fondo.
 *
 * ponytail: sin trampa de foco (Tab puede salir al fondo). <dialog>.showModal()
 * la daria gratis, pero jsdom no lo implementa y la suite renderiza los modales.
 */
export function Modal({ label, onClose, style, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={ref}
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') onClose();
        }}
        style={style}
      >
        {children}
      </div>
    </div>
  );
}
