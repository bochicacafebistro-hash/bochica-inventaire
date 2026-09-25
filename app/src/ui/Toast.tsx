import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { useCommon } from "@/core/i18n/i18n";
import styles from "./Toast.module.css";

type Kind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}
type ToastFn = (message: string, kind?: Kind, durationMs?: number) => void;

const ToastContext = createContext<ToastFn>(() => {});
let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const c = useCommon();
  const [items, setItems] = useState<ToastItem[]>([]);
  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastFn>(
    (message, kind = "info", durationMs = kind === "error" ? 6000 : 3000) => {
      const id = ++counter;
      setItems((l) => [...l, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), durationMs);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={styles.stack} role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`${styles.toast} ${styles[t.kind]}`}>
            {t.kind === "success" ? <CircleCheck size={16} /> : t.kind === "error" ? <CircleAlert size={16} /> : <Info size={16} />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label={c.close}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  return useContext(ToastContext);
}
