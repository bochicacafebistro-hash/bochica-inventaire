import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { calendarGrid, isoToDate } from "@/core/dates";
import { localeOf, useLang, useMessages } from "@/core/i18n/i18n";
import { daysUntil } from "../equipe.logic";
import { EQUIPE_MESSAGES } from "../equipe.messages";
import styles from "../Equipe.module.css";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Calendrier mensuel (lundi → dimanche) : jours passés désactivés, ≤ 14 jours en orange. */
export function LeaveCalendar({ today, selected, onToggle }: { today: string; selected: string[]; onToggle: (dk: string) => void }) {
  const m = useMessages(EQUIPE_MESSAGES);
  const locale = localeOf(useLang());
  const [offset, setOffset] = useState(0);
  const t = isoToDate(today)!;
  const first = new Date(t.getFullYear(), t.getMonth() + offset, 1);
  const monthKey = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}`;
  const grid = calendarGrid(first.getFullYear(), first.getMonth());
  let last = 0;
  grid.forEach((c, i) => c.startsWith(monthKey) && (last = i));
  const cells = grid.slice(0, Math.ceil((last + 1) / 7) * 7); // pas de rangée vide à la fin
  const dows = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: "short" }).replace(".", ""));

  return (
    <div className={styles.cal}>
      <div className={styles.calNav}>
        <button type="button" className={styles.navBtn} onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label={m.prevMonth}>
          <ChevronLeft size={16} />
        </button>
        <div className={styles.calMonth} aria-live="polite">
          {cap(first.toLocaleDateString(locale, { month: "long", year: "numeric" }))}
        </div>
        <button type="button" className={styles.navBtn} onClick={() => setOffset((o) => o + 1)} aria-label={m.nextMonth}>
          <ChevronRight size={16} />
        </button>
      </div>
      <div className={styles.calGrid}>
        {dows.map((d) => (
          <div key={d} className={styles.calDow}>
            {d}
          </div>
        ))}
        {cells.map((dk) => {
          if (!dk.startsWith(monthKey)) return <span key={dk} aria-hidden />;
          const n = daysUntil(dk, today);
          const past = n < 0;
          const soon = !past && n <= 14;
          const sel = selected.includes(dk);
          return (
            <button
              key={dk}
              type="button"
              className={`${styles.calDay} ${soon && !sel ? styles.calSoon : ""} ${dk === today ? styles.calToday : ""}`}
              disabled={past}
              aria-pressed={sel}
              onClick={() => onToggle(dk)}
              title={past ? m.pastDay : soon ? m.soonDay : m.laterDay}
              aria-label={`${isoToDate(dk)!.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}${soon ? ` — ${m.soonDay}` : ""}`}
            >
              {Number(dk.slice(8))}
            </button>
          );
        })}
      </div>
      <div className={styles.calLegend}>
        <span className={styles.calLegendBox} aria-hidden /> {m.legendSoon}
      </div>
    </div>
  );
}
