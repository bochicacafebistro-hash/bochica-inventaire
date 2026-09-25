import { useId, type SelectHTMLAttributes } from "react";
import styles from "./Field.module.css";

export function SelectField({
  label,
  error,
  options,
  className,
  ...rest
}: { label: string; error?: string | null; options: { value: string; label: string }[] } & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select id={id} className={[styles.input, error && styles.invalid, className].filter(Boolean).join(" ")} aria-invalid={!!error} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
