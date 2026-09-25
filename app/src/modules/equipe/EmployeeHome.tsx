import { useMemo } from "react";
import { Link } from "react-router";
import { CalendarDays, ClipboardList, Users, Utensils } from "lucide-react";
import { addDays, isoToDate } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { localeOf, useLang, useMessages } from "@/core/i18n/i18n";
import { useChartTheme } from "@/ui/chartTheme";
import { Spinner } from "@/ui/Spinner";
import { DailyTaskCard } from "@/modules/operations/components/DailyTaskCard";
import { OPS_MESSAGES } from "@/modules/operations/ops.messages";
import { useDailyTasks } from "@/modules/operations/useDailyTasks";
import { typeShort, upcoming, type BEvent } from "@/modules/evenements/evenements.logic";
import { TypeIcon, typeColor } from "@/modules/evenements/typeMeta";
import { hasShift } from "./equipe.logic";
import { EQUIPE_MESSAGES, EVENT_SHORT_ES } from "./equipe.messages";
import type { Employee } from "./equipe.types";
import { SECTION_COLOR, sectionKey, type SectionKey } from "./sections";
import styles from "./Equipe.module.css";

/** Accueil de l'équipe : qui travaille aujourd'hui, prochains événements, tâches du jour. Aucun $. */
export function EmployeeHome() {
  const m = useMessages(EQUIPE_MESSAGES);
  const mo = useMessages(OPS_MESSAGES);
  const lang = useLang();
  const locale = localeOf(lang);
  const theme = useChartTheme();
  const empQ = useCollection<Employee>("employees");
  const evQ = useCollection<BEvent>("events");
  const tasks = useDailyTasks();
  const today = tasks.today;
  const date = isoToDate(today)!;

  const working = useMemo(
    () =>
      empQ.data
        .filter((e) => !e.archived && hasShift(e.shifts?.[today]))
        .map((e) => ({ e, s: e.shifts![today]! }))
        .sort((a, b) => (a.s.start ?? "").localeCompare(b.s.start ?? "")),
    [empQ.data, today],
  );
  const groups = (["cuisine", "service", "other"] as SectionKey[]).map((k) => ({ k, list: working.filter((w) => sectionKey(w.e) === k) })).filter((g) => g.list.length);
  const events = useMemo(() => upcoming(evQ.data, 30, today).filter((e) => e.status !== "annule").slice(0, 6), [evQ.data, today]);
  const secLabel = { cuisine: m.kitchen, service: m.service, other: m.other };
  const dayLabel = (dk: string) => {
    if (dk === today) return m.todayShort;
    if (dk === addDays(today, 1)) return m.tomorrow;
    const d = isoToDate(dk)!;
    return `${d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")} ${d.getDate()}`;
  };
  const doneCount = tasks.units.filter((u) => u.occ.done).length;

  return (
    <div className="page">
      <div className={styles.hero}>
        <div>
          <div className={styles.heroDay}>{date.toLocaleDateString(locale, { weekday: "long" })}</div>
          <div className={styles.heroDate}>{date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}</div>
        </div>
        <div className={styles.heroHello}>
          <Utensils size={18} aria-hidden /> {m.welcome}
        </div>
      </div>

      <div className={styles.blocks}>
        <section className={styles.block} aria-label={m.inService}>
          <div className={styles.blockTitle}>
            <Users size={16} aria-hidden /> {m.inService} <span className={styles.blockCount}>{working.length}</span>
          </div>
          {empQ.loading ? (
            <Spinner />
          ) : groups.length === 0 ? (
            <p className={styles.emptyLine}>{m.noShiftToday}</p>
          ) : (
            groups.map((g) => (
              <div key={g.k} style={{ display: "grid", gap: 4 }}>
                <div className={styles.groupHead} style={{ color: SECTION_COLOR[g.k] }}>
                  <span className={styles.dot} style={{ background: SECTION_COLOR[g.k] }} aria-hidden /> {secLabel[g.k]} · {g.list.length}
                </div>
                {g.list.map(({ e, s }) => (
                  <div key={e.id} className={styles.item} style={{ "--item-color": SECTION_COLOR[g.k] } as React.CSSProperties}>
                    <span className={styles.itemName}>{e.name}</span>
                    <span className={styles.itemTime}>
                      {s.start}–{s.end}
                    </span>
                  </div>
                ))}
              </div>
            ))
          )}
          <Link className={styles.link} to="/mon-horaire">
            {m.schedTitle} →
          </Link>
        </section>

        <section className={styles.block} aria-label={m.upcoming}>
          <div className={styles.blockTitle}>
            <CalendarDays size={16} aria-hidden /> {m.upcoming} <span className={styles.blockCount}>{events.length}</span>
          </div>
          {events.length === 0 ? (
            <p className={styles.emptyLine}>{m.noEvents}</p>
          ) : (
            events.map((ev) => {
              const color = typeColor(theme.series, ev.type);
              return (
                <div key={ev.id} className={`${styles.item} ${ev.date === today ? styles.isToday : ""}`} style={{ "--item-color": color } as React.CSSProperties} title={lang === "es" ? EVENT_SHORT_ES[ev.type ?? ""] : typeShort(ev.type)}>
                  <span className={styles.itemDay}>{dayLabel(ev.date!)}</span>
                  <span style={{ color, display: "inline-flex" }}>
                    <TypeIcon type={ev.type} size={14} />
                  </span>
                  <span className={styles.itemName}>{ev.name || m.noName}</span>
                  <span className={styles.itemTime}>{Number(ev.capacity) > 0 ? `${ev.capacity} pers.` : ev.time}</span>
                </div>
              );
            })
          )}
        </section>

        <section className={styles.block} aria-label={mo.dailyTitle}>
          <div className={styles.blockTitle}>
            <ClipboardList size={16} aria-hidden /> {mo.dailyTitle}
            <span className={styles.blockCount}>
              {doneCount}/{tasks.units.length}
            </span>
          </div>
          {tasks.loading ? (
            <Spinner />
          ) : tasks.units.length === 0 ? (
            <p className={styles.emptyLine}>{mo.noTasksToday}</p>
          ) : (
            tasks.units.map((u) => <DailyTaskCard key={`${u.task.id}-${u.occ.idx}`} unit={u} onToggle={(x) => void tasks.toggle(x)} />)
          )}
        </section>
      </div>
    </div>
  );
}
