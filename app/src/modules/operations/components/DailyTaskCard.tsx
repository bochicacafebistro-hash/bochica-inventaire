import { Check, Clock } from "lucide-react";
import { fill, useMessages } from "@/core/i18n/i18n";
import { OPS_MESSAGES } from "../ops.messages";
import { isOnce, type TaskUnit } from "../ops.logic";
import styles from "../Ops.module.css";

/** Carte cochable d'un passage de tâche (accueil employé + page Tâches). */
export function DailyTaskCard({ unit, onToggle, busy }: { unit: TaskUnit; onToggle: (u: TaskUnit) => void; busy?: boolean }) {
  const m = useMessages(OPS_MESSAGES);
  const { task, occ } = unit;
  const note = (task.note ?? "").trim();
  return (
    <button type="button" className={styles.check} aria-pressed={occ.done} onClick={() => onToggle(unit)} disabled={busy} title={occ.done ? m.uncheck : m.markDone}>
      <span className={styles.box} aria-hidden>
        {occ.done && <Check size={16} strokeWidth={3} />}
      </span>
      <span className={styles.label}>
        <span className={styles.labelText}>{task.title || "—"}</span>
        {note && <span className={styles.sub}>{note}</span>}
        {occ.done && occ.by && occ.by !== "true" && <span className={styles.sub}>{fill(m.doneBy, { name: occ.by })}</span>}
      </span>
      <span className={styles.tags}>
        {occ.time && (
          <span className={styles.time}>
            <Clock size={11} aria-hidden /> {occ.time}
          </span>
        )}
        {occ.count > 1 && (
          <span className={styles.tag}>
            {occ.idx + 1}/{occ.count}
          </span>
        )}
        {isOnce(task) && <span className={styles.tag}>{m.once}</span>}
      </span>
    </button>
  );
}
