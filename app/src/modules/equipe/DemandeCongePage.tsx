import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CircleAlert, CircleCheck, Clock, ClipboardList, LogIn, LogOut, Sun, X } from "lucide-react";
import { isoToDate } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { fill, localeOf, useLang, useMessages } from "@/core/i18n/i18n";
import { normalizeTime } from "@/core/time";
import { useToday } from "@/core/useToday";
import { Button } from "@/ui/Button";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { LeaveCalendar } from "./components/LeaveCalendar";
import { PinPad } from "./components/PinPad";
import { autoApproves, byRequestedDesc, findByPin, isPast, LEAVE_TYPES, leaveMeta, leaveRequestDoc, type LeaveDraft } from "./equipe.logic";
import { EQUIPE_MESSAGES } from "./equipe.messages";
import type { Employee, LeaveRequest } from "./equipe.types";
import styles from "./Equipe.module.css";

const IDLE_MS = 120_000; // tablette partagée : retour au clavier après 2 min sans activité

const emptyDraft = (): LeaveDraft => ({ type: "vacances", kind: "full", days: [], partialMode: "late", partialTime: "", reason: "" });

/** Employé : demande de congé identifiée par NIP (compte partagé de la tablette). */
export default function DemandeCongePage() {
  const m = useMessages(EQUIPE_MESSAGES);
  const lang = useLang();
  const locale = localeOf(lang);
  const today = useToday();
  const empQ = useCollection<Employee>("employees");
  const reqQ = useCollection<LeaveRequest>("leaveRequests");
  const actions = useDataActions();
  const toast = useToast();
  const [emp, setEmp] = useState<Employee | null>(null);
  const [d, setD] = useState<LeaveDraft>(emptyDraft);
  const [timeRaw, setTimeRaw] = useState("");
  const [sending, setSending] = useState(false);
  const idle = useRef<number | undefined>(undefined);

  const logout = () => {
    setEmp(null);
    setD(emptyDraft());
    setTimeRaw("");
  };

  // Déconnexion automatique après inactivité
  useEffect(() => {
    if (!emp) return;
    const reset = () => {
      window.clearTimeout(idle.current);
      idle.current = window.setTimeout(logout, IDLE_MS);
    };
    reset();
    const evts = ["pointerdown", "keydown"] as const;
    evts.forEach((e) => window.addEventListener(e, reset));
    return () => {
      window.clearTimeout(idle.current);
      evts.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [emp]);

  const short = (dk: string) => isoToDate(dk)!.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
  const mine = useMemo(() => (emp ? reqQ.data.filter((r) => r.empId === emp.id).sort(byRequestedDesc) : []), [reqQ.data, emp]);

  if (empQ.loading) return <Spinner />;
  if (!emp) {
    return (
      <div className="page">
        <PinPad
          title={m.leaveTitle}
          subtitle={m.pinPrompt}
          hint={m.pinHint}
          onSubmit={(pin) => {
            const found = findByPin(empQ.data, pin);
            if (found) setEmp(found);
            return !!found;
          }}
        />
      </div>
    );
  }

  const partial = d.kind === "partial";
  const set = (p: Partial<LeaveDraft>) => setD((x) => ({ ...x, ...p }));
  const toggleDay = (dk: string) =>
    setD((x) => (x.kind === "partial" ? { ...x, days: x.days[0] === dk ? [] : [dk] } : { ...x, days: x.days.includes(dk) ? x.days.filter((y) => y !== dk) : [...x.days, dk] }));
  const auto = d.days.length > 0 && autoApproves(partial ? d.days.slice(0, 1) : d.days, today);
  const timeNorm = normalizeTime(timeRaw);
  const timeError = partial && timeRaw && !timeNorm ? m.timeInvalid : null;
  const canSend = d.days.length > 0 && !d.days.some((x) => isPast(x, today)) && (!partial || !!timeNorm) && !sending;

  async function send() {
    if (!emp || !canSend) return;
    setSending(true);
    try {
      const doc = leaveRequestDoc(emp, { ...d, partialTime: timeNorm || "" }, today);
      await actions.create("leaveRequests", doc);
      toast(doc.autoApproved ? m.sentAuto : m.sentPending, doc.autoApproved ? "success" : "info", 6000);
      setD((x) => ({ ...emptyDraft(), type: x.type, kind: x.kind }));
      setTimeRaw("");
    } catch (err) {
      toast(fill(m.sendError, { msg: (err as Error).message }), "error");
    } finally {
      setSending(false);
    }
  }

  const datesLabel = (r: LeaveRequest) => {
    if (r.kind === "partial" && r.partial) return `${short(r.partial.dk)} · ${r.partial.mode === "late" ? m.enters : m.leaves} ${r.partial.time}`;
    const ds = [...(r.dates ?? [])].sort();
    return ds.length === 1 ? short(ds[0]!) : fill(m.nDays, { n: ds.length, list: ds.map(short).join(" · ") });
  };
  const status = (r: LeaveRequest) =>
    r.status === "approved" ? (
      <span className={`${styles.status} ${styles.st_approved}`}>
        <CircleCheck size={12} aria-hidden /> {r.autoApproved ? m.approvedAuto : m.approved}
      </span>
    ) : r.status === "rejected" ? (
      <span className={`${styles.status} ${styles.st_rejected}`}>
        <X size={12} aria-hidden /> {m.rejected}
      </span>
    ) : (
      <span className={`${styles.status} ${styles.st_pending}`}>
        <Clock size={12} aria-hidden /> {m.pending}
      </span>
    );

  const sorted = [...d.days].sort();

  return (
    <div className="page">
      <div className={styles.formHead}>
        <div>
          <div className={styles.helloName}>{fill(m.hello, { name: emp.name ?? "" })}</div>
          <div className={styles.pinSub}>{m.helloSub}</div>
        </div>
        <Button variant="secondary" onClick={logout}>
          <ArrowLeft size={16} aria-hidden /> {m.notMe}
        </Button>
      </div>

      <section className={styles.leaveCard}>
        <div className={styles.pills} role="group">
          <button type="button" className={styles.pill} aria-pressed={!partial} onClick={() => set({ kind: "full" })}>
            <Sun size={15} aria-hidden /> {m.fullDays}
          </button>
          <button type="button" className={styles.pill} aria-pressed={partial} onClick={() => set({ kind: "partial", days: d.days.slice(0, 1) })}>
            <Clock size={15} aria-hidden /> {m.partial}
          </button>
        </div>

        <div className={styles.fieldLabel}>{m.leaveType}</div>
        <div className={styles.pills} role="group" aria-label={m.leaveType}>
          {LEAVE_TYPES.map((t) => (
            <button key={t.id} type="button" className={styles.pill} aria-pressed={d.type === t.id} style={{ "--pill-color": t.color } as React.CSSProperties} onClick={() => set({ type: t.id })}>
              {lang === "es" ? t.labelEs : t.label}
            </button>
          ))}
        </div>

        {partial && (
          <div className={styles.partialBox}>
            <div className={styles.pills} role="group">
              <button type="button" className={styles.pill} aria-pressed={d.partialMode === "late"} onClick={() => set({ partialMode: "late" })}>
                <LogIn size={15} aria-hidden /> {m.lateMode}
              </button>
              <button type="button" className={styles.pill} aria-pressed={d.partialMode === "early"} onClick={() => set({ partialMode: "early" })}>
                <LogOut size={15} aria-hidden /> {m.earlyMode}
              </button>
            </div>
            <label className={styles.timeLabel}>
              {d.partialMode === "late" ? m.arrival : m.departure}
              <input
                className={styles.timeInput}
                inputMode="numeric"
                value={timeRaw}
                onChange={(e) => setTimeRaw(e.target.value)}
                onBlur={() => timeNorm && setTimeRaw(timeNorm)}
                placeholder="18:00"
                aria-invalid={!!timeError}
              />
              {timeError && <span className={styles.warn}>{timeError}</span>}
            </label>
          </div>
        )}

        <div className={styles.fieldLabel}>{partial ? m.dayLabel : m.daysLabel}</div>
        <LeaveCalendar today={today} selected={d.days} onToggle={toggleDay} />

        <div className={`${styles.recap} ${sorted.length ? "" : styles.recapEmpty}`} aria-live="polite">
          {sorted.length === 0 ? (partial ? m.pickDay : m.pickDays) : partial ? short(sorted[0]!) : fill(m.nDays, { n: sorted.length, list: sorted.map(short).join(" · ") })}
        </div>
        {sorted.length > 0 && (
          <div className={`${styles.banner} ${auto ? styles.bannerAuto : styles.bannerSoon}`} role="status">
            {auto ? <CircleCheck size={16} aria-hidden /> : <CircleAlert size={16} aria-hidden />}
            <span>{auto ? m.autoBanner : m.soonBanner}</span>
          </div>
        )}

        <label className={styles.timeLabel}>
          {m.reason}
          <textarea className={styles.reason} value={d.reason} onChange={(e) => set({ reason: e.target.value })} placeholder={m.reasonPh} rows={2} />
        </label>

        <div>
          <Button onClick={() => void send()} disabled={!canSend}>
            <CircleCheck size={16} aria-hidden /> {sending ? m.sending : m.send}
          </Button>
        </div>
      </section>

      <section className={styles.leaveCard} aria-label={m.mine}>
        <h2 className={styles.blockTitle}>
          <ClipboardList size={18} aria-hidden /> {m.mine}
        </h2>
        {mine.length === 0 ? (
          <p className={styles.emptyLine}>{m.noneYet}</p>
        ) : (
          <div className={styles.mineList}>
            {mine.map((r) => {
              const meta = leaveMeta(r.type);
              return (
                <div key={r.id} className={styles.mineItem} style={{ "--leave-color": meta.color } as React.CSSProperties}>
                  <div>
                    <span className={styles.mineType}>{lang === "es" ? meta.labelEs : meta.label}</span>
                    <span className={styles.mineDates}>{datesLabel(r)}</span>
                  </div>
                  {status(r)}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
