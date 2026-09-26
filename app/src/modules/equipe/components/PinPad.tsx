import { useEffect, useState } from "react";
import { Check, Delete, Sun, type LucideIcon } from "lucide-react";
import { useMessages } from "@/core/i18n/i18n";
import { EQUIPE_MESSAGES } from "../equipe.messages";
import styles from "../Equipe.module.css";

/** Clavier NIP à 4 chiffres (tactile + clavier physique). Valide tout seul au 4e chiffre. */
export function PinPad({ title, subtitle, hint, onSubmit, icon: Icon = Sun, errorText }: { title: string; subtitle: string; hint: string; onSubmit: (pin: string) => boolean; icon?: LucideIcon; errorText?: string }) {
  const m = useMessages(EQUIPE_MESSAGES);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const submit = (p: string) => {
    if (p.length !== 4) return;
    if (!onSubmit(p)) {
      setError(true);
      setPin("");
    }
  };
  const press = (d: string) => {
    setError(false);
    setPin((p) => {
      if (p.length >= 4) return p;
      const next = p + d;
      if (next.length === 4) setTimeout(() => submit(next), 120);
      return next;
    });
  };
  const erase = () => setPin((p) => p.slice(0, -1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") erase();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={styles.pinScreen}>
      <h1 className={styles.pinTitle}>
        <Icon size={30} aria-hidden /> {title}
      </h1>
      <p className={styles.pinSub}>{subtitle}</p>
      <div className={`${styles.dots} ${error ? styles.shake : ""}`} aria-label={`${pin.length}/4`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`${styles.dotPin} ${pin.length > i ? styles.dotFilled : ""}`} />
        ))}
      </div>
      <div className={styles.pinError} role="alert">
        {error ? (errorText ?? m.pinUnknown) : ""}
      </div>
      <div className={styles.keypad} role="group" aria-label={m.pinPad}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} className={styles.key} onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <button className={styles.key} onClick={erase} aria-label={m.erase} disabled={!pin}>
          <Delete size={26} />
        </button>
        <button className={styles.key} onClick={() => press("0")}>
          0
        </button>
        <button className={`${styles.key} ${styles.keyOk}`} onClick={() => submit(pin)} aria-label={m.validate} disabled={pin.length !== 4}>
          <Check size={28} />
        </button>
      </div>
      <p className={styles.pinSub}>{hint}</p>
    </div>
  );
}
