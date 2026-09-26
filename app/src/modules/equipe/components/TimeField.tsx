import { useId } from "react";
import { normalizeTime } from "@/core/time";
import styles from "../Horaire.module.css";

const OPTIONS = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

/** Heure libre (« 17h04 », « 1704 ») + suggestions aux 15 min. Normalisée en quittant le champ. */
export function TimeField({ label, value, onChange, error }: { label: string; value: string; onChange: (v: string) => void; error?: string | null }) {
  const id = useId();
  return (
    <label className={styles.timeField} htmlFor={id}>
      {label}
      <input
        id={id}
        list={`${id}-l`}
        inputMode="numeric"
        value={value}
        placeholder="hh:mm"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          const n = normalizeTime(value);
          if (n) onChange(n);
        }}
        aria-invalid={!!error}
      />
      <datalist id={`${id}-l`}>
        {OPTIONS.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
      {error && <span className={styles.err}>{error}</span>}
    </label>
  );
}
