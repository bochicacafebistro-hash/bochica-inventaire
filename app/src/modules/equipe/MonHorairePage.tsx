import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Info, Sun } from "lucide-react";
import { isoToDate } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDocument } from "@/core/data/useDocument";
import { fill, localeOf, useLang, useMessages } from "@/core/i18n/i18n";
import { useToday } from "@/core/useToday";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { hasShift, isoWeek, leaveMeta, openDayIndexes, partialFor, timeOffFor, visibleEmployees, weekDays, weekStart } from "./equipe.logic";
import { EQUIPE_MESSAGES } from "./equipe.messages";
import type { Employee, LeaveRequest, ScheduleSettings } from "./equipe.types";
import { SECTION_COLOR, sectionKey } from "./sections";
import styles from "./Equipe.module.css";

const ME_KEY = "bochica-me";
const readMe = () => {
  try {
    return localStorage.getItem(ME_KEY) ?? "";
  } catch {
    return "";
  }
};

/** Horaire de la semaine, lecture seule, sans aucune donnée salariale. */
export default function MonHorairePage() {
  const m = useMessages(EQUIPE_MESSAGES);
  const lang = useLang();
  const locale = localeOf(lang);
  const today = useToday();
  const empQ = useCollection<Employee>("employees");
  const leaveQ = useCollection<LeaveRequest>("leaveRequests");
  const settingsQ = useDocument<ScheduleSettings>("settings", "schedule");
  const [offset, setOffset] = useState(0);
  const [me, setMeState] = useState(readMe);
  const setMe = (id: string) => {
    setMeState(id);
    try {
      localStorage.setItem(ME_KEY, id);
    } catch {
      /* ignore */
    }
  };

  const monday = weekStart(today, offset);
  const allDays = weekDays(monday);
  const settings = settingsQ.data ?? {};
  const open = openDayIndexes(settings);
  const days = open.map((i) => allDays[i]!);
  const emps = useMemo(() => visibleEmployees(empQ.data, allDays, settings), [empQ.data, allDays.join(), settings]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = useMemo(() => [...empQ.data].filter((e) => !e.archived).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr")), [empQ.data]);
  const meEmp = emps.find((e) => e.id === me) ?? active.find((e) => e.id === me);

  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => isoToDate(iso)!.toLocaleDateString(locale, o);
  const weekLabel = `${fmt(allDays[0]!, { day: "numeric", month: "short" })} – ${fmt(allDays[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  const secLabel = { cuisine: m.kitchen, service: m.service, other: m.other };

  const cell = (emp: Employee, dk: string) => {
    const s = emp.shifts?.[dk];
    const off = timeOffFor(emp, dk, leaveQ.data);
    if (off && !hasShift(s)) {
      const meta = leaveMeta(off.type);
      return (
        <span className={styles.leaveCell} style={{ "--leave-color": meta.color } as React.CSSProperties}>
          <span>
            <Sun size={10} aria-hidden /> {m.leave}
          </span>
          <span>{lang === "es" ? meta.labelEs : meta.label}</span>
        </span>
      );
    }
    if (!hasShift(s)) return <span className={styles.offCell}>{m.off}</span>;
    const p = partialFor(emp.id, dk, leaveQ.data);
    return (
      <>
        <span className={styles.shift} style={{ "--sec-color": SECTION_COLOR[sectionKey(emp)] } as React.CSSProperties}>
          {s!.start}–{s!.end}
        </span>
        {p && <span className={styles.partial}>{fill(p.mode === "late" ? m.lateStart : m.earlyEnd, { time: p.time })}</span>}
      </>
    );
  };

  const loading = empQ.loading || settingsQ.loading;
  const error = empQ.error || settingsQ.error;

  return (
    <div className="page">
      <PageHeader title={m.schedTitle} />
      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <button className={styles.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label={m.prevWeek}>
            <ChevronLeft size={16} />
          </button>
          <div className={styles.weekLabel} aria-live="polite">
            <div className={styles.weekNum}>{fill(m.weekNum, { n: isoWeek(allDays[3]!) })}</div>
            <div className={styles.weekDates}>{weekLabel}</div>
          </div>
          <button className={styles.navBtn} onClick={() => setOffset((o) => o + 1)} aria-label={m.nextWeek}>
            <ChevronRight size={16} />
          </button>
          {offset === 0 ? (
            <span className={styles.todayTag}>{m.thisWeek}</span>
          ) : (
            <button className={styles.todayBtn} onClick={() => setOffset(0)}>
              {m.thisWeek}
            </button>
          )}
        </div>
        <span className={styles.spacer} />
        <select className={styles.whoSelect} value={me} onChange={(e) => setMe(e.target.value)} aria-label={m.pickMe}>
          <option value="">{m.pickMe}</option>
          {active.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <EmptyState icon={CalendarClock} title={m.schedTitle}>
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : emps.length === 0 ? (
        <EmptyState icon={CalendarClock} title={m.schedNone} />
      ) : (
        <>
          {meEmp && (
            <section className={styles.myWeek} aria-label={meEmp.name}>
              <div className={styles.myWeekTitle}>{meEmp.name}</div>
              {days.map((dk) => (
                <div key={dk} className={`${styles.myDay} ${dk === today ? styles.myToday : ""}`}>
                  <span className={styles.myDayName}>{fmt(dk, { weekday: "long", day: "numeric" })}</span>
                  <span>{cell(meEmp, dk)}</span>
                </div>
              ))}
            </section>
          )}
          <div className={styles.wrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.nameCol}>{m.employee}</th>
                  {days.map((dk) => {
                    const n = emps.filter((e) => hasShift(e.shifts?.[dk])).length;
                    return (
                      <th key={dk} className={dk === today ? styles.todayCol : undefined} aria-current={dk === today ? "date" : undefined}>
                        <div className={styles.dayName}>{fmt(dk, { weekday: "short" }).replace(".", "")}</div>
                        <div>{fmt(dk, { day: "numeric", month: "short" }).replace(".", "")}</div>
                        <div className={styles.dayCount}>{fill(m.persons, { n })}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {emps.map((e) => {
                  const k = sectionKey(e);
                  return (
                    <tr key={e.id} className={e.id === me ? styles.mine : undefined}>
                      <th scope="row" className={styles.nameCol}>
                        <div className={styles.name}>{e.name || "—"}</div>
                        <div className={styles.sec}>
                          <span className={styles.dot} style={{ background: SECTION_COLOR[k] }} aria-hidden /> {secLabel[k]}
                        </div>
                      </th>
                      {days.map((dk) => (
                        <td key={dk} className={dk === today ? styles.todayCol : undefined}>
                          {cell(e, dk)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>
            <Info size={14} aria-hidden /> {m.schedNote}
          </p>
        </>
      )}
    </div>
  );
}
