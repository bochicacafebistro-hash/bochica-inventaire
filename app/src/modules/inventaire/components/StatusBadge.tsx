import { CircleAlert, CircleCheck, Clock } from "lucide-react";
import { useMessages } from "@/core/i18n/i18n";
import { INV_MESSAGES } from "../inventaire.messages";
import type { StockStatus } from "../inventaire.types";
import styles from "../Inventaire.module.css";

/** Statut : icône + texte (jamais la couleur seule). */
export function StatusBadge({ status }: { status: StockStatus }) {
  const m = useMessages(INV_MESSAGES);
  const label = status === "red" ? m.statusRed : status === "yellow" ? m.statusYellow : m.statusGreen;
  const Icon = status === "red" ? CircleAlert : status === "yellow" ? Clock : CircleCheck;
  return (
    <span className={`${styles.badge} ${styles[`badge_${status}`]}`}>
      <Icon size={13} aria-hidden /> {label}
    </span>
  );
}
