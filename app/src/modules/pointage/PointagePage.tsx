import { useEffect, useRef, useState } from "react";
import { deleteField } from "firebase/firestore";
import { ArrowLeft, ArrowRight, Check, CircleAlert, LogIn, LogOut, Users, Utensils } from "lucide-react";
import { toISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { useDocument } from "@/core/data/useDocument";
import { fill, useMessages } from "@/core/i18n/i18n";
import { Spinner } from "@/ui/Spinner";
import { PinPad } from "@/modules/equipe/components/PinPad";
import { findByPin, hasShift } from "@/modules/equipe/equipe.logic";
import type { Employee } from "@/modules/equipe/equipe.types";
import { closesOvernight, hhmm, openOvernight, punchedShift, punchMode, target, yesterdayOf, type PayrollWeek } from "./punch.logic";
import { PUNCH_MESSAGES } from "./punch.messages";
import styles from "./Pointage.module.css";

type Screen = { kind: "keypad" } | { kind: "employee"; emp: Employee } | { kind: "done"; emp: Employee; action: "entree" | "sortie"; time: string; note?: string } | { kind: "error"; msg: string };

const CLEAR = { autoFilled: deleteField(), autoFilledAt: deleteField(), autoFilledNoStart: deleteField(), markedAbsent: deleteField(), markedAbsentAt: deleteField() };
const IDLE_MS = 30_000; // tablette partagée : retour au clavier si personne ne touche l'écran

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** Kiosque de pointage par NIP (tablette). Écrit dans payroll/{semaine}.actualShifts. */
export default function PointagePage() {
  const m = useMessages(PUNCH_MESSAGES);
  const now = useNow();
  const today = toISO(now);
  const t = target(today);
  const ty = target(yesterdayOf(today));
  const empQ = useCollection<Employee>("employees");
  const weekQ = useDocument<PayrollWeek>("payroll", t.weekId);
  const prevQ = useDocument<PayrollWeek>("payroll", ty.weekId); // la veille peut être la semaine d'avant (nuit dim → lun)
  const actions = useDataActions();
  const [screen, setScreen] = useState<Screen>({ kind: "keypad" });
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false); // « J'ai oublié de pointer mon entrée »
  const timer = useRef<number | undefined>(undefined);

  const reset = () => {
    window.clearTimeout(timer.current);
    setForgot(false);
    setScreen({ kind: "keypad" });
  };
  const later = (ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(reset, ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Écran employé : retour automatique si personne ne pointe
  useEffect(() => {
    if (screen.kind === "employee") later(IDLE_MS);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Entrée/Échap ferment les écrans de confirmation (clavier physique)
  useEffect(() => {
    if (screen.kind !== "done" && screen.kind !== "error") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const shiftOf = (w: PayrollWeek | null, empId: string, dk: string) => w?.actualShifts?.[empId]?.[dk];

  async function punch(emp: Employee, action: "entree" | "sortie") {
    if (busy) return;
    // La date est recalculée au moment exact du pointage (jamais une date gardée en mémoire).
    const at = new Date();
    const dk = toISO(at);
    const time = hhmm(at);
    const tt = target(dk);
    const ty2 = target(yesterdayOf(dk));
    if (dk !== `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`) {
      setScreen({ kind: "error", msg: m.errDay });
      return later(3000);
    }
    const todayShift = shiftOf(tt.weekId === t.weekId ? weekQ.data : null, emp.id, dk);
    const ySource = ty2.weekId === t.weekId ? weekQ.data : ty2.weekId === ty.weekId ? prevQ.data : null;
    const yShift = shiftOf(ySource, emp.id, ty2.dk);
    setBusy(true);
    try {
      if (closesOvernight(action, at.getHours(), todayShift, yShift, time)) {
        await actions.setFixed("payroll", ty2.weekId, {
          weekId: ty2.weekId,
          weekStart: ty2.weekStart,
          updatedAt: Date.now(),
          actualShifts: { [emp.id]: { [ty2.dk]: { end: time, ...CLEAR } } }, // l'entrée d'hier est conservée par la fusion
        });
        setScreen({ kind: "done", emp, action, time, note: fill(m.overnightClosed, { start: yShift!.start!, end: time }) });
      } else {
        const next = punchedShift(action === "entree" ? "start" : "end", time);
        await actions.setFixed("payroll", tt.weekId, {
          weekId: tt.weekId,
          weekStart: tt.weekStart,
          updatedAt: Date.now(),
          actualShifts: { [emp.id]: { [dk]: { ...next, ...CLEAR } } },
        });
        setScreen({ kind: "done", emp, action, time });
      }
      later(1800);
    } catch (err) {
      // Semaine verrouillée par l'admin : la base refuse toute écriture (règle du 26 sept. 2026)
      setScreen({ kind: "error", msg: (err as { code?: string }).code === "permission-denied" ? m.errLocked : m.errSave });
      later(2500);
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className={styles.clockRow}>
      <div className={styles.clock} aria-hidden>
        {hhmm(now)}
        <span className={styles.sec2}>:{String(now.getSeconds()).padStart(2, "0")}</span>
      </div>
    </div>
  );

  let body: React.ReactNode;
  if (empQ.loading) body = <Spinner label={m.loading} />;
  else if (screen.kind === "keypad") {
    body = (
      <PinPad
        subtitle={m.subtitle}
        subtitleBelow
        errorText={m.pinUnknown}
        onSubmit={(pin) => {
          const emp = findByPin(empQ.data, pin);
          if (emp) setScreen({ kind: "employee", emp });
          return !!emp;
        }}
      />
    );
  } else if (screen.kind === "employee") {
    const emp = screen.emp;
    const cur = shiftOf(weekQ.data, emp.id, today);
    const yShift = shiftOf(ty.weekId === t.weekId ? weekQ.data : prevQ.data, emp.id, ty.dk);
    const night = openOvernight(now.getHours(), cur, yShift);
    const planned = emp.shifts?.[today];
    const sec = emp.section === "cuisine" ? "cuisine" : (emp.section ?? "service") === "service" ? "service" : "other";
    const time = hhmm(now);
    const mode = punchMode(cur, !!night, forgot);
    body = (
      <div className={styles.empScreen}>
        <button className={styles.back} onClick={reset}>
          <ArrowLeft size={18} aria-hidden /> {m.notMe}
        </button>
        <div className={styles.hello}>{m.hello}</div>
        <div className={styles.name}>{emp.name}</div>
        <span className={`${styles.sec} ${styles[`sec_${sec}`]}`}>
          {sec === "cuisine" ? <Utensils size={12} aria-hidden /> : <Users size={12} aria-hidden />} {sec === "cuisine" ? m.kitchen : sec === "service" ? m.service : m.other}
        </span>
        {hasShift(planned) && <div className={styles.planned}>{fill(m.planned, { start: planned!.start!, end: planned!.end! })}</div>}
        {mode === "complete" ? (
          <div className={styles.complete} role="status">
            <Check size={28} aria-hidden />
            <div className={styles.completeLabel}>{m.dayComplete}</div>
            <div className={styles.completeTimes}>
              {cur?.start ?? "—"} – {cur?.end}
            </div>
            {!cur?.start && <div className={styles.sub}>{m.missingEntry}</div>}
          </div>
        ) : (
          <>
            {night ? (
              <div className={`${styles.state} ${styles.stateNight}`} role="status">
                <LogIn size={14} aria-hidden /> {fill(m.overnight, { t: night.start! })}
              </div>
            ) : cur?.start ? (
              <div className={styles.state} role="status">
                <span>
                  <LogIn size={14} aria-hidden /> {m.entry} : <strong>{cur.start}</strong>
                </span>
              </div>
            ) : null}
            <div className={styles.single}>
              {mode === "in" ? (
                <button className={`${styles.big} ${styles.in}`} onClick={() => void punch(emp, "entree")} disabled={busy}>
                  <LogIn size={40} aria-hidden />
                  <span className={styles.bigLabel}>{m.in}</span>
                  <span className={styles.bigTime}>{time}</span>
                </button>
              ) : (
                <button className={`${styles.big} ${styles.out}`} onClick={() => void punch(emp, "sortie")} disabled={busy}>
                  <LogOut size={40} aria-hidden />
                  <span className={styles.bigLabel}>{m.out}</span>
                  <span className={styles.bigTime}>{time}</span>
                </button>
              )}
            </div>
            {mode === "in" && (
              <button className={styles.linkBtn} onClick={() => (setForgot(true), later(IDLE_MS))}>
                {m.forgotEntry}
              </button>
            )}
            {mode === "out" && forgot && !cur?.start && !night && (
              <>
                <p className={styles.sub}>{m.forgotNote}</p>
                <button className={styles.linkBtn} onClick={() => (setForgot(false), later(IDLE_MS))}>
                  {m.forgotCancel}
                </button>
              </>
            )}
          </>
        )}
      </div>
    );
  } else if (screen.kind === "done") {
    const isIn = screen.action === "entree";
    body = (
      <div className={`${styles.done} ${isIn ? styles.doneIn : styles.doneOut}`} role="status">
        <div className={styles.doneCheck}>
          <Check size={88} strokeWidth={3} aria-hidden />
        </div>
        <div className={styles.doneLabel}>{isIn ? m.recordedIn : m.recordedOut}</div>
        <div className={styles.name}>{screen.emp.name}</div>
        <div className={styles.doneTime}>{fill(m.at, { t: screen.time })}</div>
        {screen.note && <div className={styles.sub}>{screen.note}</div>}
        <div className={styles.wish}>{isIn ? m.wishIn : m.wishOut}</div>
        <button className={styles.next} onClick={reset}>
          {m.next} <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    );
  } else {
    body = (
      <div className={styles.done} role="alert">
        <CircleAlert size={88} className={styles.errIcon} aria-hidden />
        <div className={styles.doneLabel}>{screen.msg}</div>
        <button className={styles.next} onClick={reset}>
          {m.next} <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.kiosk}>
      {header}
      {body}
    </div>
  );
}
