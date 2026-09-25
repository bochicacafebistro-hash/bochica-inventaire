import { Search, X } from "lucide-react";
import { useCommon } from "@/core/i18n/i18n";
import styles from "./SearchInput.module.css";

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const c = useCommon();
  placeholder ??= c.search;
  label ??= c.search.replace("…", "");
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
        <button className={styles.clear} onClick={() => onChange("")} aria-label={c.clearSearch}>
          <X size={14} />
        </button>
      )}
    </div>
  );
}
