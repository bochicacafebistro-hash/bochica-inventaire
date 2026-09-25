import { fmtPct } from "@/ui/format";
import styles from "../Rapports.module.css";

/** Écart en % avec flèche. `upIsGood=false` pour les coûts. */
export function Delta({ value, upIsGood = true }: { value: number | null; upIsGood?: boolean }) {
  if (value == null) return <span className={`${styles.delta} ${styles.na}`}>—</span>;
  const flat = Math.abs(value) < 0.5;
  const good = flat ? null : value > 0 === upIsGood;
  const cls = flat ? styles.flat : good ? styles.up : styles.down;
  const arrow = flat ? "=" : value > 0 ? "▲" : "▼";
  const sr = flat ? "stable" : value > 0 ? "hausse" : "baisse";
  return (
    <span className={`${styles.delta} ${cls}`}>
      <span aria-hidden>{arrow}</span> {fmtPct(value)}
      <span className="visually-hidden"> ({sr})</span>
    </span>
  );
}
