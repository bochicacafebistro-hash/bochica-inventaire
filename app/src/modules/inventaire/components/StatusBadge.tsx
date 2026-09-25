import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { STATUS_LABEL } from "../inventaire.logic";
import type { StockStatus } from "../inventaire.types";
import styles from "../Inventaire.module.css";

/** Statut : icône + texte (jamais la couleur seule). */
export function StatusBadge({ status }: { status: StockStatus }) {
  const Icon = status === "red" ? CircleAlert : status === "yellow" ? Clock : CircleCheck;
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      <Icon size={13} aria-hidden /> {STATUS_LABEL[status]}
    </span>
  );
}
