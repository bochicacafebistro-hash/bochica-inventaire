import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useCommon } from "@/core/i18n/i18n";
import styles from "./Modal.module.css";

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

/** Fenêtre modale accessible (<dialog> natif : Échap, focus, arrière-plan inerte). */
export function Modal({ open, title, onClose, children, footer, width = 480 }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const c = useCommon();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      style={{ maxWidth: width }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // clic sur l'arrière-plan
      }}
      aria-labelledby="modal-title"
    >
      {open && (
        <div className={styles.inner}>
          <header className={styles.header}>
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
            <button className={styles.close} onClick={onClose} aria-label={c.close}>
              <X size={18} />
            </button>
          </header>
          <div className={styles.body}>{children}</div>
          {footer && <footer className={styles.footer}>{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
