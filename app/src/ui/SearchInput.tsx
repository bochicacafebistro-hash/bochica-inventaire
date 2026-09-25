import { Search, X } from "lucide-react";
import styles from "./SearchInput.module.css";

export function SearchInput({
  value,
  onChange,
  placeholder = "Rechercher…",
  label = "Rechercher",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <div className={styles.wrap}>
      <Search size={16} className={styles.icon} aria-hidden />
      <input
        type="search"
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value && (
        <button className={styles.clear} onClick={() => onChange("")} aria-label="Effacer la recherche">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
