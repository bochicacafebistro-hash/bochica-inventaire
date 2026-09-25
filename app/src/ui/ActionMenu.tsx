import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EllipsisVertical } from "lucide-react";
import styles from "./ActionMenu.module.css";

export interface ActionItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

/** Menu « ⋮ » : clavier (flèches, Échap), fermeture au clic extérieur. */
export function ActionMenu({ label, items }: { label: string; items: ActionItem[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    wrap.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onKeyDown(e: React.KeyboardEvent) {
    const els = [...(wrap.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      setOpen(false);
      wrap.current?.querySelector<HTMLButtonElement>("button")?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    }
  }

  return (
    <div className={styles.wrap} ref={wrap} onKeyDown={onKeyDown}>
      <button
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <EllipsisVertical size={18} />
      </button>
      {open && (
        <div className={styles.menu} role="menu" id={id}>
          {items.map((it) => (
            <button
              key={it.label}
              role="menuitem"
              className={`${styles.item} ${it.danger ? styles.danger : ""}`}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
