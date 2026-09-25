import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface Common {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({ label, hint, error, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {rest.required && <span className={styles.req} aria-hidden> *</span>}
      </label>
      <input
        id={id}
        className={[styles.input, error && styles.invalid, className].filter(Boolean).join(" ")}
        aria-invalid={!!error}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        {...rest}
      />
      {(error || hint) && (
        <div id={`${id}-msg`} className={error ? styles.error : styles.hint}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

export function TextArea({ label, hint, error, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={[styles.input, styles.textarea, error && styles.invalid, className].filter(Boolean).join(" ")}
        aria-invalid={!!error}
        {...rest}
      />
      {(error || hint) && <div className={error ? styles.error : styles.hint}>{error || hint}</div>}
    </div>
  );
}
