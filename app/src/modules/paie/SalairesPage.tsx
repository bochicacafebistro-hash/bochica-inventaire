import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  EyeOff,
  FileText,
  Info,
  Lock,
  LogOut,
  Percent,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Unlock,
  UserPlus,
  UserX,
} from "lucide-react";
import { addDays, isoToDate, todayISO } from "@/core/dates";
import { payrollWeekId } from "@/modules/pointage/punch.logic";
import { useCollection } from "@/core/data/useCollection";
import { useDocument } from "@/core/data/useDocument";
import { hasShift, isoWeek, leaveMeta, openDayIndexes, partialFor, timeOffFor, weekDays, weekStart } from "@/modules/equipe/equipe.logic";
import type { Employee, EmployeeComp, LeaveRequest, ScheduleSettings } from "@/modules/equipe/equipe.types";
import { fmtHours, moveInOrder } from "@/modules/equipe/horaire.logic";
import { SECTION_COLOR, sectionKey } from "@/modules/equipe/sections";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { ChartCard } from "@/ui/charts/ChartCard";
import { ColumnsChart } from "@/ui/charts/ColumnsChart";
import { useChartTheme } from "@/ui/chartTheme";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtDec1, fmtMoney, fmtMoney0 } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import h from "@/modules/equipe/Horaire.module.css";
import { PayShiftModal, type PayShiftSave } from "./components/PayShiftModal";
import { ExtraModal, ResetWeekModal, ServiceHoursModal, TipSharesModal } from "./components/SettingsModals";
import { autoFillCandidates, computePayroll, detectAlerts, entryCount, lockAmount, payrollPeople, windowsLabel, type PayAlert, type PayRow } from "./paie.logic";
import type { PayrollPerson, PayrollSettings, PayrollWeekDoc } from "./paie.types";
import { usePayrollWrites } from "./usePayrollWrites";
import styles from "./Paie.module.css";

type ModalState = { kind: "shift"; row: PayRow; dk: string } | { kind: "service" } | { kind: "shares" } | { kind: "extra" } | { kind: "reset" } | null;

const GROUP_LABEL = { cuisine: "Cuisine", service: "Service", excluded: "Exclu" } as const;
const SEC_LABEL = { cuisine: "Cuisine", service: "Service", other: "Autre" } as const;
const LEVEL_COLOR = { good: "var(--status-green, #3f8f3a)", warn: "#b45309", bad: "var(--status-red, #c0392b)", empty: "var(--border-strong)" } as const;
const hrs = (n: number) => (n ? `${fmtHours(n)} h` : "—");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Montant saisi : enregistré en quittant le champ (ou Entrée), seulement s'il a changé. */
function AmountInput({ value, onCommit, disabled, label, placeholder }: { value: number | undefined; onCommit: (raw: string) => void; disabled?: boolean; label: string; placeholder?: string }) {
  const shown = value ? String(value) : "";
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const raw = text.trim().replace(",", ".");
    if (raw === shown) return;
    onCommit(raw);
  };
  return (
    <span className={styles.amount}>
      <input
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? "—"}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      />
      <span aria-hidden>$</span>
    </span>
  );
}

/** Admin : Salaires & Pourboires (heures réelles, partage des pourboires, rentabilité, verrouillage). */
export default function SalairesPage() {
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const monday = weekStart(today, offset);
  const w = usePayrollWrites(monday);
  const empQ = useCollection<Employee>("employees");
  const compQ = useCollection<EmployeeComp>("employeesComp");
  const leaveQ = useCollection<LeaveRequest>("leaveRequests");
  const schedQ = useDocument<ScheduleSettings>("settings", "schedule");
  const paySetQ = useDocument<PayrollSettings>("settings", "payroll");
  const weekQ = useDocument<PayrollWeekDoc>("payroll", w.wid);
  const prevMonday = addDays(monday, -7);
  const prevQ = useDocument<PayrollWeekDoc>("payroll", payrollWeekId(prevMonday));
  const confirm = useConfirm();
  const toast = useToast();
  const theme = useChartTheme();
  const fail = (what: string) => (err: unknown) =>
    toast(
      (err as { code?: string }).code === "permission-denied"
        ? `${what} impossible : la semaine est verrouillée (ou les nouvelles règles Firestore ne sont pas publiées). Déverrouille-la pour modifier.`
        : `${what} impossible : ${(err as Error).message}`,
      "error",
    );

  const schedule = schedQ.data ?? {};
  const week = weekQ.data;
  const settings = paySetQ.data;
  const locked = !!week?.locked;
  const targetRatio = Number(schedule.salesRatio) || 0.32;
  const allDays = weekDays(monday);
  const dows = openDayIndexes(schedule);
  const days = dows.map((i) => allDays[i]!);
  const weekNum = isoWeek(allDays[3]!);
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => isoToDate(iso)!.toLocaleDateString("fr-CA", o);
  const weekLabel = `${fmt(allDays[0]!, { day: "numeric", month: "short" })} – ${fmt(allDays[6]!, { day: "numeric", month: "short", year: "numeric" })}`;
  const dayShort = (dk: string) => `${cap(fmt(dk, { weekday: "short" }).replace(".", ""))} ${fmt(dk, { day: "numeric" })}`;

  const people = useMemo(() => payrollPeople(empQ.data, compQ.data, week, schedule, monday, today), [empQ.data, compQ.data, week, schedule, monday, today]);
  const res = useMemo(() => computePayroll({ people, week, settings, monday, days, dows, targetRatio }), [people, week, settings, monday, days.join(), targetRatio]); // eslint-disable-line react-hooks/exhaustive-deps
  const onLeave = (empId: string, dk: string) => {
    const e = empQ.data.find((x) => x.id === empId);
    return !!e && !!timeOffFor(e, dk, leaveQ.data);
  };
  const alerts = useMemo(() => detectAlerts(res.rows, locked, today, onLeave), [res.rows, locked, today, leaveQ.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const sharedOrder = schedule.weekOrder?.[monday] ?? [];
  const hidden = week?.hiddenEmps ?? [];

  // ── Remplir depuis l'horaire (sorties manquantes / aucun pointage), 1 h après la fin prévue ──
  // ⚠ Jamais automatique dans la v2 : seulement sur clic, avec les données de CETTE semaine
  // chargées (incident du 26 sept. 2026 : un remplissage automatique sur des données
  // périmées avait écrasé des heures pointées).
  const ready = !empQ.loading && !compQ.loading && !leaveQ.loading && !weekQ.loading && !schedQ.loading;
  const fillable = ready && !locked ? autoFillCandidates(res.rows, false, Date.now(), onLeave) : [];
  async function fillFromSchedule() {
    const noStart = fillable.filter((c) => c.noStart).length;
    const ok = await confirm({
      title: `Remplir ${fillable.length} quart${fillable.length > 1 ? "s" : ""} depuis l'horaire ?`,
      message: `${fillable.length - noStart ? `${fillable.length - noStart} sortie(s) manquante(s) prendront l'heure de fin prévue. ` : ""}${noStart ? `${noStart} quart(s) sans aucun pointage seront remplis avec l'horaire prévu et marqués « Présence ? » à vérifier. ` : ""}Les heures déjà pointées ne sont jamais modifiées.`,
      confirmLabel: "Remplir",
    });
    if (!ok) return;
    await w.autoFill(fillable).then(() => toast("Quarts remplis depuis l'horaire — à vérifier.", "success"), fail("Remplissage"));
  }

  // ── PDF de paie (même calcul que l'écran) ──
  function pdfWeek(mon: string, result: typeof res) {
    const all = weekDays(mon);
    const f = (iso: string, o: Intl.DateTimeFormatOptions) => isoToDate(iso)!.toLocaleDateString("fr-CA", o);
    const DAY = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
    return {
      weekNum: isoWeek(all[3]!),
      monday: mon,
      startLabel: f(all[0]!, { day: "numeric", month: "short" }),
      endLabel: f(all[6]!, { day: "numeric", month: "short", year: "numeric" }),
      dayLabels: dows.map((i) => `${DAY[i]} ${Number(all[i]!.slice(8))}/${Number(all[i]!.slice(5, 7))}`),
      res: result,
    };
  }
  async function pdf(two: boolean) {
    try {
      const mod = await import("./payrollPdf");
      let name: string | null;
      if (two) {
        const prevDays = dows.map((i) => weekDays(prevMonday)[i]!);
        const prevPeople = payrollPeople(empQ.data, compQ.data, prevQ.data, schedule, prevMonday, today);
        const prevRes = computePayroll({ people: prevPeople, week: prevQ.data, settings, monday: prevMonday, days: prevDays, dows, targetRatio });
        name = mod.exportTwoWeekPdf(pdfWeek(prevMonday, prevRes), pdfWeek(monday, res));
      } else name = mod.exportWeekPdf(pdfWeek(monday, res));
      if (!name) toast(two ? "Aucun employé actif avec des heures et un salaire sur ces 2 semaines." : "Aucun employé actif avec des heures et un salaire à inclure dans le rapport.", "error");
      else toast(`Rapport PDF généré : ${name}`, "success");
    } catch (err) {
      fail("PDF")(err);
    }
  }

  const lockedMsg = () => toast("Semaine verrouillée — déverrouille avant de modifier.", "error");
  const guard = (fn: () => void) => () => (locked ? lockedMsg() : fn());

  // ── Actions ──
  async function saveShift(row: PayRow, dk: string, s: PayShiftSave) {
    try {
      if (s.toDk !== dk) {
        await w.moveShift(row.emp.id, dk, s.toDk, s.start, s.end);
        toast(`Heures déplacées au ${fmt(s.toDk, { weekday: "long", day: "numeric" })}.`, "success");
      } else {
        await w.saveShift(row.emp.id, dk, s.start, s.end);
        toast("Heures enregistrées.", "success");
      }
      setModal(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }
  async function act(fn: () => Promise<unknown>, ok: string, what: string, close = true) {
    try {
      await fn();
      if (ok) toast(ok, "success");
      if (close) setModal(null);
    } catch (err) {
      fail(what)(err);
    }
  }
  async function move(p: PayrollPerson, delta: -1 | 1) {
    const ids = res.rows.map((r) => r.emp.id);
    const next = moveInOrder(ids, p.id, delta);
    if (next !== ids) await act(() => w.setOrder(next), "", "Réordonnancement", false);
  }
  async function hide(p: PayrollPerson) {
    if (locked) return lockedMsg();
    await act(() => w.setHidden([...hidden, p.id]), `${p.name} retiré de cette semaine de paie (réversible).`, "Retrait", false);
  }
  async function removeExtra(p: PayrollPerson) {
    if (locked) return lockedMsg();
    const ok = await confirm({ title: "Retirer cet extra ?", message: `« ${p.name} » et ses heures seront supprimés de cette semaine. Les autres semaines ne changent pas.`, danger: true, confirmLabel: "Retirer" });
    if (ok) await act(() => w.removeExtra(week, p.id, sharedOrder), "Extra retiré.", "Retrait", false);
  }
  async function lock() {
    const amount = lockAmount(res);
    if (amount <= 0) return toast("Aucun salaire à verrouiller (le total est 0 $). Saisis d'abord les heures.", "error");
    const ok = await confirm({
      title: "Verrouiller cette semaine ?",
      message: (
        <>
          Une dépense « <strong>Salaires sem. {weekNum}</strong> » de <strong>{fmtMoney(amount)}</strong> (salaires bruts + bonus) sera créée dans Dépenses & Revenus, et les heures, pourboires et ventes de la semaine seront bloqués. Tu pourras déverrouiller plus tard.
        </>
      ),
      confirmLabel: "Verrouiller",
    });
    if (!ok) return;
    try {
      const desc = await w.lock(amount, weekNum, weekLabel, days[days.length - 1] ?? allDays[6]!);
      await w.log("—", "Paie verrouillée", `Semaine ${weekNum} · ${fmtMoney(amount)}`);
      toast(`Semaine ${weekNum} verrouillée. Dépense « ${desc} » créée.`, "success");
    } catch (err) {
      fail("Verrouillage")(err);
    }
  }
  async function unlock() {
    const ok = await confirm({
      title: "Déverrouiller cette semaine ?",
      message: `La dépense Salaires liée (${fmtMoney(week?.lockedAmount ?? 0)}) sera supprimée de Dépenses & Revenus, et la semaine redeviendra modifiable.`,
      danger: true,
      confirmLabel: "Déverrouiller",
    });
    if (!ok) return;
    try {
      await w.unlock(week?.expenseId);
      await w.log("—", "Paie déverrouillée", `Semaine ${weekNum} · dépense supprimée`);
      toast(`Semaine ${weekNum} déverrouillée.`, "success");
    } catch (err) {
      fail("Déverrouillage")(err);
    }
  }
  function openReset() {
    const c = entryCount(week);
    if (!c.shifts && !c.tips && !c.net) return toast("Aucune saisie à effacer pour cette semaine.", "info");
    if (locked) return lockedMsg();
    setModal({ kind: "reset" });
  }

  const loading = empQ.loading || schedQ.loading || weekQ.loading || prevQ.loading;
  const error = empQ.error || weekQ.error || schedQ.error;
  const warnCount = alerts.filter((a) => a.severity === "warning").length;
  const S = res.sums;
  const dayData = res.dayProfit.map((d, k) => ({
    label: dayShort(d.dk),
    net: d.hasNet ? d.net : 0,
    labor: d.labor,
    planned: res.estimatedByDay[d.dk] ?? 0,
    needed: d.salesNeeded,
    tips: res.dailyCalc[k]!.dayTotal,
  }));
  const C = { labor: theme.series[2]!, planned: theme.muted, net: theme.series[3]! };

  return (
    <div className="page">
      <PageHeader
        eyebrow="RH & Horaires"
        title="Salaires & Pourboires"
        actions={
          locked ? (
            <Button variant="secondary" onClick={() => void unlock()}>
              <Unlock size={16} aria-hidden /> Déverrouiller
            </Button>
          ) : (
            <Button onClick={() => void lock()} disabled={loading}>
              <Lock size={16} aria-hidden /> Verrouiller la semaine
            </Button>
          )
        }
      />
      {error ? (
        <EmptyState icon={DollarSign} title="Impossible de charger la paie">
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          {compQ.error && <p className={h.errBox}>La rémunération n'est pas lisible ({compQ.error.message}) : les salaires sont à 0.</p>}
          <div className={h.toolbar}>
            <div className={h.weekNav}>
              <button className={h.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Semaine précédente">
                <ChevronLeft size={16} />
              </button>
              <div className={h.weekLabel} aria-live="polite">
                <div className={h.weekNum}>Semaine {weekNum}</div>
                <div className={h.weekDates}>{weekLabel}</div>
              </div>
              <button className={h.navBtn} onClick={() => setOffset((o) => o + 1)} aria-label="Semaine suivante">
                <ChevronRight size={16} />
              </button>
              {offset !== 0 ? (
                <button className={h.pillBtn} onClick={() => setOffset(0)}>
                  Cette semaine
                </button>
              ) : (
                <span className={h.todayTag}>Cette semaine</span>
              )}
            </div>
            <span className={h.spacer} />
            <Button variant="secondary" onClick={guard(() => setModal({ kind: "extra" }))} disabled={locked}>
              <UserPlus size={16} aria-hidden /> Extra
            </Button>
            <ActionMenu
              label="Plus d'actions sur la paie"
              items={[
                { label: "PDF de la semaine", icon: <FileText size={16} />, onSelect: () => void pdf(false) },
                { label: `PDF 2 semaines (S${isoWeek(addDays(prevMonday, 3))} + S${weekNum})`, icon: <FileText size={16} />, onSelect: () => void pdf(true) },
                { label: "Heures de service", icon: <Clock size={16} />, onSelect: () => setModal({ kind: "service" }) },
                { label: "Répartition des pourboires", icon: <Percent size={16} />, onSelect: () => setModal({ kind: "shares" }) },
                { label: "Effacer les saisies de la semaine", icon: <Trash2 size={16} />, onSelect: openReset, danger: true },
              ]}
            />
          </div>

          {locked && (
            <div className={styles.lockBar} role="status">
              <Lock size={16} aria-hidden /> <strong>Semaine verrouillée</strong> — dépense de {fmtMoney(week?.lockedAmount ?? 0)} créée dans Dépenses & Revenus. Déverrouille pour modifier.
            </div>
          )}

          {/* ── Indicateurs ── */}
          <div className={styles.kpis}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Total à payer</div>
              <div className={styles.kpiNum}>{fmtMoney(S.total)}</div>
              <div className={styles.kpiSub}>
                Salaires {fmtMoney0(S.gross)} · Pourboires {fmtMoney0(S.tips)}
                {S.bonus ? ` · Bonus ${fmtMoney0(S.bonus)}` : ""}
              </div>
            </div>
            <div className={styles.kpi} style={{ borderLeftColor: LEVEL_COLOR[res.ratioLevel] }}>
              <div className={styles.kpiLabel}>Ratio salaires / ventes</div>
              <div className={styles.kpiNum} style={{ color: res.ratioLevel === "empty" ? undefined : LEVEL_COLOR[res.ratioLevel] }}>
                {res.totalNet > 0 ? `${fmtDec1(res.salesRatio * 100)} %` : "—"}
              </div>
              <div className={styles.kpiSub}>{res.totalNet > 0 ? `Cible ${Math.round(targetRatio * 100)} % ${res.ratioLevel === "good" ? "✓" : "⚠"}` : "Aucune vente saisie"}</div>
            </div>
            <div className={styles.kpi} style={{ borderLeftColor: LEVEL_COLOR[res.wageLevel] }}>
              <div className={styles.kpiLabel}>Payé vs horaire prévu</div>
              <div className={styles.kpiNum}>{fmtMoney0(S.gross)}</div>
              <div className={styles.kpiSub}>
                Prévu {fmtMoney0(res.estimatedWage)} · écart {res.wageDelta > 0 ? "+" : ""}
                {fmtMoney0(res.wageDelta)}
              </div>
            </div>
            <div className={styles.kpi} style={{ borderLeftColor: res.totalNet === 0 ? LEVEL_COLOR.empty : res.week.pctReached >= 100 ? LEVEL_COLOR.good : LEVEL_COLOR.bad }}>
              <div className={styles.kpiLabel}>Rentabilité de la semaine</div>
              <div className={styles.kpiNum}>{res.totalNet > 0 ? `${Math.round(res.week.pctReached)} %` : "—"}</div>
              <div className={styles.kpiSub}>
                {res.totalNet > 0
                  ? res.week.surplus >= 0
                    ? `+${fmtMoney0(res.week.surplus)} au-dessus des ventes nécessaires`
                    : `${fmtMoney0(-res.week.surplus)} de ventes manquantes`
                  : `Ventes nécessaires ${fmtMoney0(res.week.salesNeeded)}`}
              </div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>Heures</div>
              <div className={styles.kpiNum}>{hrs(S.hours)}</div>
              <div className={styles.kpiSub}>Prévu {hrs(S.planned)}</div>
            </div>
          </div>

          {/* ── Saisie par jour : pourboires et ventes nettes ── */}
          <section className={styles.card} aria-labelledby="pay-days">
            <div className={styles.cardHead}>
              <h2 id="pay-days" className={styles.cardTitle}>
                Pourboires et ventes nettes par jour
              </h2>
              <span className={h.hint}>
                {fmtMoney(res.totalTips)} de pourboires{res.totalNet > 0 ? ` · ${fmtDec1(res.tipPctSales * 100)} % des ventes` : ""} · ventes nettes {fmtMoney(res.totalNet)}
              </span>
            </div>
            <div className={styles.days}>
              {res.dayProfit.map((d, k) => {
                const tips = res.dailyCalc[k]!.dayTotal;
                const lvl = !d.hasNet ? "empty" : d.pctReached >= 100 ? "good" : "bad";
                return (
                  <div key={d.dk} className={`${styles.day} ${d.dk === today ? styles.dayToday : ""}`}>
                    <div className={styles.dayHead}>
                      {dayShort(d.dk)}
                      <span className={h.hint} title="Heures de service (pourboires)">
                        {windowsLabel(settings?.defaultServiceHours?.[dows[k]!])}
                      </span>
                    </div>
                    <label className={styles.dayField}>
                      Pourboires
                      <AmountInput value={week?.tipsByDay?.[d.dk]} disabled={locked} label={`Pourboires ${dayShort(d.dk)}`} onCommit={(v) => void w.setTip(d.dk, v).catch(fail("Pourboire"))} />
                    </label>
                    <label className={styles.dayField}>
                      Ventes nettes
                      <AmountInput value={week?.netByDay?.[d.dk]} disabled={locked} label={`Ventes nettes ${dayShort(d.dk)}`} onCommit={(v) => void w.setNet(d.dk, v).catch(fail("Vente nette"))} />
                    </label>
                    <div className={h.hint}>{d.hasNet && d.net > 0 && tips > 0 ? `${fmtDec1((tips / d.net) * 100)} % pourboire` : " "}</div>
                    <div className={styles.profit} style={{ borderColor: LEVEL_COLOR[lvl] }} title={d.hasNet ? `Salaires ${fmtMoney(d.labor)} · ventes nécessaires ${fmtMoney(d.salesNeeded)} (cible ${Math.round(targetRatio * 100)} %)` : "Aucune vente nette saisie ce jour"}>
                      <strong style={{ color: lvl === "empty" ? undefined : LEVEL_COLOR[lvl] }}>{d.hasNet ? `${Math.round(d.pctReached)} %` : "—"}</strong> {d.hasNet ? "atteint" : ""}
                      <div className={h.hint}>{d.hasNet ? (d.surplus >= 0 ? `+${fmtMoney0(d.surplus)}` : `${fmtMoney0(-d.surplus)} manquant`) : ""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {fillable.length > 0 && (
            <div className={styles.fillBar}>
              <span>
                <strong>{fillable.length}</strong> quart{fillable.length > 1 ? "s" : ""} prévu{fillable.length > 1 ? "s" : ""} sans sortie ou sans pointage (terminé depuis plus d'une heure).
              </span>
              <Button variant="secondary" onClick={() => void fillFromSchedule()}>
                <RefreshCw size={16} aria-hidden /> Remplir depuis l'horaire
              </Button>
            </div>
          )}
          {alerts.length > 0 && <Alerts alerts={alerts} warnCount={warnCount} dayShort={dayShort} />}

          {hidden.length > 0 && (
            <div className={h.hiddenBar}>
              <EyeOff size={14} aria-hidden /> Retiré(s) de cette semaine de paie :
              {hidden.map((id) => {
                const e = empQ.data.find((x) => x.id === id) ?? week?.manualEmployees?.find((x) => x.id === id);
                return e ? (
                  <button key={id} className={h.chip} disabled={locked} onClick={() => void act(() => w.setHidden(hidden.filter((x) => x !== id)), "", "Réaffichage", false)} title="Réafficher cette semaine">
                    {e.name} <Plus size={12} aria-hidden />
                  </button>
                ) : null;
              })}
            </div>
          )}

          {/* ── Grille des heures réelles ── */}
          {res.rows.length === 0 ? (
            <EmptyState icon={DollarSign} title="Personne dans cette semaine de paie">
              Ajoute des employés dans Employés & Horaires, ou un extra pour cette semaine.
            </EmptyState>
          ) : (
            <div className={h.gridWrap}>
              <table className={`${h.grid} ${styles.payGrid}`}>
                <thead>
                  <tr>
                    <th className={h.nameCol} scope="col">
                      Employé
                    </th>
                    {days.map((dk) => (
                      <th key={dk} scope="col" className={dk === today ? h.todayCol : undefined}>
                        <div className={h.dayName}>{fmt(dk, { weekday: "short" }).replace(".", "")}</div>
                        <div>{fmt(dk, { day: "numeric", month: "short" }).replace(".", "")}</div>
                      </th>
                    ))}
                    <th scope="col" className={h.totalCol}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {res.rows.map((row, idx) => {
                    const e = row.emp;
                    const k = sectionKey(e);
                    return (
                      <tr key={e.id}>
                        <th scope="row" className={h.nameCol} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties}>
                          <div className={h.nameRow}>
                            <span className={h.name}>{e.name}</span>
                            {!locked && (
                              <ActionMenu
                                label={`Actions pour ${e.name}`}
                                items={[
                                  ...(idx > 0 ? [{ label: "Monter", icon: <ArrowUp size={16} />, onSelect: () => void move(e, -1) }] : []),
                                  ...(idx < res.rows.length - 1 ? [{ label: "Descendre", icon: <ArrowDown size={16} />, onSelect: () => void move(e, 1) }] : []),
                                  e.isManual
                                    ? { label: "Retirer l'extra", icon: <Trash2 size={16} />, onSelect: () => void removeExtra(e), danger: true }
                                    : { label: "Retirer de cette semaine", icon: <EyeOff size={16} />, onSelect: () => void hide(e) },
                                ]}
                              />
                            )}
                          </div>
                          <div className={h.meta}>
                            <span className={h.dot} style={{ background: SECTION_COLOR[k] }} aria-hidden /> {SEC_LABEL[k]}
                            {row.rate > 0 && (
                              <span>
                                · {fmtMoney(row.rate)}/h{e.isSalaried ? ` · fixe ${e.fixedWeeklyHours} h` : ""}
                              </span>
                            )}
                            {e.isManual && <span className={h.archivedTag}>extra</span>}
                            {e.archived && <span className={h.archivedTag}>archivé</span>}
                          </div>
                          <select
                            className={styles.groupSelect}
                            value={row.override ?? "auto"}
                            disabled={locked}
                            onChange={(ev) => void w.setOverride(e.id, ev.target.value).catch(fail("Section"))}
                            aria-label={`Pool de pourboires de ${e.name} cette semaine`}
                            data-group={row.group}
                          >
                            <option value="auto">Pool : auto ({e.noTips ? "exclu" : k === "cuisine" ? "Cuisine" : "Service"})</option>
                            <option value="cuisine">Pool : Cuisine</option>
                            <option value="service">Pool : Service</option>
                            <option value="excluded">Exclu des pourboires</option>
                          </select>
                        </th>
                        {row.daily.map((d) => (
                          <td key={d.dk} className={d.dk === today ? h.todayCol : undefined}>
                            <Cell row={row} d={d} locked={locked} leave={timeOffFor(e, d.dk, leaveQ.data)} partial={partialFor(e.id, d.dk, leaveQ.data)} onOpen={guard(() => setModal({ kind: "shift", row, dk: d.dk }))} />
                          </td>
                        ))}
                        <td className={`${h.totalCol} ${styles.totalCell}`}>
                          <div className={h.strong}>{hrs(row.totalHours)}</div>
                          <div className={h.hint}>
                            {row.plannedHours ? `prévu ${hrs(row.plannedHours)}` : ""}
                            {row.plannedHours && Math.abs(row.gap) >= 0.01 ? ` (${row.gap > 0 ? "+" : ""}${fmtHours(row.gap)})` : ""}
                          </div>
                          <div className={styles.payLine}>
                            <span>Salaire</span> {fmtMoney(row.grossWage)}
                          </div>
                          <div className={styles.payLine}>
                            <span>Pourb.</span> {row.group === "excluded" ? "exclu" : fmtMoney(row.tipShare)}
                          </div>
                          <label className={styles.payLine}>
                            <span>Bonus</span>
                            <AmountInput value={week?.bonusByEmp?.[e.id]} disabled={locked} label={`Bonus de ${e.name}`} onCommit={(v) => void w.setBonus(e.id, v).catch(fail("Bonus"))} />
                          </label>
                          <div className={`${styles.payLine} ${styles.payTotal}`}>
                            <span>Total</span> {fmtMoney(row.totalPay)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" className={h.nameCol}>
                      Heures
                    </th>
                    {days.map((dk, k) => (
                      <td key={dk}>{hrs(res.rows.reduce((s, r) => s + r.daily[k]!.hours, 0))}</td>
                    ))}
                    <td className={`${h.totalCol} ${h.strong}`}>{hrs(S.hours)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className={h.nameCol}>
                      Salaires
                    </th>
                    {days.map((dk) => (
                      <td key={dk}>{res.laborByDay[dk] ? fmtMoney0(res.laborByDay[dk]!) : "—"}</td>
                    ))}
                    <td className={`${h.totalCol} ${h.strong}`}>{fmtMoney(S.gross)}</td>
                  </tr>
                  <tr>
                    <th scope="row" className={h.nameCol}>
                      Pourboires
                    </th>
                    {res.dailyCalc.map((c) => (
                      <td key={c.dk}>{c.dayTotal ? fmtMoney0(c.dayTotal) : "—"}</td>
                    ))}
                    <td className={`${h.totalCol} ${h.strong}`}>{fmtMoney(S.tips)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className={h.hint} style={{ marginTop: 6 }}>
            <Star size={11} aria-hidden /> = heures dans les heures de service (comptent pour les pourboires). Barre ambrée = différent de l'horaire prévu. Clic sur une case pour saisir ou corriger les heures.
          </p>

          {/* ── Récapitulatif des pools ── */}
          <section className={styles.card} aria-labelledby="pay-pools">
            <div className={styles.cardHead}>
              <h2 id="pay-pools" className={styles.cardTitle}>
                Partage des pourboires
              </h2>
              <span className={h.hint}>
                Cuisine {Math.round(res.shares.cuisine * 100)} % · Service + Autre {Math.round(res.shares.service * 100)} % — calculé jour par jour
              </span>
            </div>
            <div className={styles.pools}>
              {(["cuisine", "service"] as const).map((g) => {
                const pool = g === "cuisine" ? res.poolK : res.poolS;
                const hoursG = g === "cuisine" ? S.kitchenHrs : S.serviceHrs;
                const members = res.rows.filter((r) => r.group === g && r.tipShare > 0);
                const given = members.reduce((s, r) => s + r.tipShare, 0);
                return (
                  <div key={g} className={styles.pool}>
                    <div className={styles.poolHead}>
                      <span className={h.dot} style={{ background: SECTION_COLOR[g] }} aria-hidden /> <strong>{GROUP_LABEL[g]}</strong>
                      <span style={{ flex: 1 }} />
                      <strong>{fmtMoney(pool)}</strong>
                    </div>
                    <div className={h.hint}>
                      {hrs(hoursG)} en service{hoursG > 0 ? ` · ≈ ${fmtMoney(pool / hoursG)}/h en moyenne` : ""}
                      {pool - given > 0.005 ? ` · ${fmtMoney(pool - given)} non attribués (personne en service ces jours-là)` : ""}
                    </div>
                    <ul className={styles.poolList}>
                      {members.map((r) => (
                        <li key={r.emp.id}>
                          <span>{r.emp.name}</span>
                          <span className={h.hint}>{hrs(r.tipEligibleHours)}</span>
                          <strong>{fmtMoney(r.tipShare)}</strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
            {res.rows.some((r) => r.group === "excluded") && (
              <p className={h.hint}>
                Exclus cette semaine :{" "}
                {res.rows
                  .filter((r) => r.group === "excluded")
                  .map((r) => r.emp.name)
                  .join(", ")}
              </p>
            )}
          </section>

          {/* ── Graphiques (un seul axe $ chacun) ── */}
          <div className={styles.charts}>
            <ChartCard
              title="Coût salarial par jour"
              subtitle="Payé réellement vs ce que l'horaire prévu aurait coûté"
              legend={[
                { label: "Prévu", color: C.planned },
                { label: "Réel", color: C.labor },
              ]}
              chart={
                <ColumnsChart
                  data={dayData}
                  series={[
                    { key: "planned", label: "Prévu", color: C.planned },
                    { key: "labor", label: "Réel", color: C.labor },
                  ]}
                />
              }
              table={<DayTable rows={dayData} cols={[["planned", "Prévu"], ["labor", "Réel"]]} />}
            />
            <ChartCard
              title="Ventes nettes vs salaires"
              subtitle={`Ventes nécessaires pour respecter la cible de ${Math.round(targetRatio * 100)} % dans l'infobulle`}
              legend={[
                { label: "Ventes nettes", color: C.net },
                { label: "Salaires", color: C.labor },
              ]}
              chart={
                <ColumnsChart
                  data={dayData}
                  series={[
                    { key: "net", label: "Ventes nettes", color: C.net },
                    { key: "labor", label: "Salaires", color: C.labor },
                  ]}
                  extraTooltip={(r) => ({ label: "Ventes nécessaires", value: fmtMoney0(Number(r.needed)) })}
                />
              }
              table={<DayTable rows={dayData} cols={[["net", "Ventes nettes"], ["labor", "Salaires"], ["needed", "Ventes nécessaires"]]} />}
            />
          </div>
        </>
      )}

      {modal?.kind === "shift" && (
        <PayShiftModal
          name={modal.row.emp.name ?? ""}
          dk={modal.dk}
          days={days}
          actual={modal.row.daily.find((d) => d.dk === modal.dk)?.actual ?? null}
          planned={modal.row.emp.shifts?.[modal.dk] ?? null}
          targetHas={(dk) => week?.actualShifts?.[modal.row.emp.id]?.[dk] ?? null}
          onClose={() => setModal(null)}
          onSave={(s) => saveShift(modal.row, modal.dk, s)}
          onClear={() => act(() => w.clearShift(modal.row.emp.id, modal.dk), "Journée réinitialisée.", "Réinitialisation")}
          onAbsent={() => act(() => w.markAbsent(modal.row.emp.id, modal.dk), "Marqué absent — aucune heure comptée ce jour.", "Absence")}
        />
      )}
      {modal?.kind === "service" && (
        <ServiceHoursModal settings={settings} openDays={dows} onClose={() => setModal(null)} onSave={(d) => act(() => w.saveServiceHours(settings, d), "Heures de service enregistrées.", "Enregistrement")} />
      )}
      {modal?.kind === "shares" && <TipSharesModal settings={settings} onClose={() => setModal(null)} onSave={(p) => act(() => w.saveShares(p), "Répartition enregistrée.", "Enregistrement")} />}
      {modal?.kind === "extra" && (
        <ExtraModal
          onClose={() => setModal(null)}
          onSave={(x) => act(() => w.addExtra(week, x, empQ.data.map((e) => e.id), sharedOrder), `Extra « ${x.name} » ajouté pour cette semaine.`, "Ajout de l'extra")}
        />
      )}
      {modal?.kind === "reset" && (
        <ResetWeekModal
          weekNum={weekNum}
          counts={entryCount(week)}
          onClose={() => setModal(null)}
          onConfirm={() =>
            act(async () => {
              await w.resetWeek();
              await w.log("—", "Paie effacée", `Semaine ${weekNum}`);
            }, "Saisies effacées pour la semaine.", "Effacement")
          }
        />
      )}
    </div>
  );
}

/** Une case de la grille : heures réelles (ou absent, congé, prévu non pointé…). */
function Cell({
  row,
  d,
  locked,
  leave,
  partial,
  onOpen,
}: {
  row: PayRow;
  d: PayRow["daily"][number];
  locked: boolean;
  leave: { type?: string; fromRequest?: boolean } | null;
  partial: { mode: string; time: string } | null;
  onOpen: () => void;
}) {
  const a = d.actual;
  const name = row.emp.name ?? "";
  const partialTxt = partial ? <span className={h.partial}>{partial.mode === "late" ? `entre à ${partial.time}` : `finit à ${partial.time}`}</span> : null;
  if (a?.markedAbsent)
    return (
      <button className={`${styles.cell} ${styles.cellAbsent}`} onClick={onOpen} disabled={locked} aria-label={`${name} absent — modifier`}>
        <UserX size={13} aria-hidden /> Absent
      </button>
    );
  if (a?.start && a.end) {
    const cls = [styles.cell, styles.cellFilled, a.autoFilled && styles.cellAuto, d.isDifferent && d.planned && styles.cellDiff].filter(Boolean).join(" ");
    return (
      <button className={cls} onClick={onOpen} disabled={locked} style={{ "--sec": SECTION_COLOR[sectionKey(row.emp)] } as React.CSSProperties} aria-label={`${name} ${a.start} à ${a.end} — modifier`}>
        <span className={h.shiftTime}>
          {a.start}–{a.end}
        </span>
        <span className={h.shiftMeta}>
          {hrs(d.hours)}
          {d.tipHours > 0 && row.group !== "excluded" && (
            <>
              {" "}
              · <Star size={10} aria-hidden /> {fmtHours(d.tipHours)}
            </>
          )}
        </span>
        {a.autoFilled && <span className={styles.autoTag}>{a.autoFilledNoStart ? "Présence ?" : "À valider"}</span>}
        {d.dayTip > 0 && <span className={h.shiftMeta}>{fmtMoney(d.dayTip)}</span>}
        {partialTxt}
      </button>
    );
  }
  if (a?.start || a?.end)
    return (
      <button className={`${styles.cell} ${styles.cellPartial}`} onClick={onOpen} disabled={locked} aria-label={`${name} pointage incomplet — compléter`}>
        <span className={h.shiftTime}>
          {a.start ?? "?"}–{a.end ?? "?"}
        </span>
        <span className={styles.autoTag}>{a.start ? "sortie ?" : "entrée ?"}</span>
      </button>
    );
  if (leave && !hasShift(d.planned ?? undefined)) {
    const meta = leaveMeta(leave.type);
    return (
      <button className={h.leaveCard} style={{ "--leave": meta.color } as React.CSSProperties} onClick={onOpen} disabled={locked}>
        {leave.fromRequest ? "Congé approuvé" : "Congé"}
        <span>{meta.label}</span>
      </button>
    );
  }
  if (d.planned?.start && d.planned.end)
    return (
      <button className={`${styles.cell} ${styles.cellPlanned}`} onClick={onOpen} disabled={locked} aria-label={`${name} prévu ${d.planned.start} à ${d.planned.end}, pas de pointage — saisir`}>
        <span className={styles.plannedTxt}>
          prévu {d.planned.start}–{d.planned.end}
        </span>
        {leave && <span className={h.partial}>congé</span>}
        {partialTxt}
      </button>
    );
  return (
    <button className={h.emptyCell} onClick={onOpen} disabled={locked} aria-label={`Saisir des heures pour ${name}`}>
      <Plus size={14} aria-hidden />
    </button>
  );
}

function Alerts({ alerts, warnCount, dayShort }: { alerts: PayAlert[]; warnCount: number; dayShort: (dk: string) => string }) {
  const groups: { key: string; title: string; icon: React.ReactNode; list: PayAlert[] }[] = [
    { key: "presence", title: "Présence à vérifier — aucun pointage", icon: <AlertTriangle size={14} />, list: alerts.filter((a) => a.type === "auto-filled" && a.noStart) },
    { key: "auto", title: "Sortie remplie automatiquement, à valider", icon: <RefreshCw size={14} />, list: alerts.filter((a) => a.type === "auto-filled" && !a.noStart) },
    { key: "exit", title: "Sortie manquante", icon: <LogOut size={14} />, list: alerts.filter((a) => a.type === "missing-exit") },
    { key: "long", title: "Quart anormalement long", icon: <Clock size={14} />, list: alerts.filter((a) => a.type === "long-shift") },
    { key: "np", title: "Prévu à l'horaire sans pointage", icon: <CalendarClock size={14} />, list: alerts.filter((a) => a.type === "not-punched") },
  ];
  const info = alerts.length - warnCount;
  return (
    <section className={`${styles.alerts} ${warnCount ? styles.alertsWarn : ""}`} aria-labelledby="pay-alerts">
      <div className={styles.alertsHead}>
        {warnCount ? <AlertTriangle size={18} aria-hidden /> : <Info size={18} aria-hidden />}
        <div>
          <h2 id="pay-alerts" className={styles.cardTitle}>
            {alerts.length} {alerts.length > 1 ? "points à vérifier" : "point à vérifier"} cette semaine
          </h2>
          <div className={h.hint}>
            {warnCount ? `${warnCount} à corriger` : ""}
            {warnCount && info ? " · " : ""}
            {info ? `${info} pour information` : ""}
          </div>
        </div>
      </div>
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <div key={g.key} className={styles.alertGroup}>
            <div className={styles.alertGroupHead}>
              {g.icon} {g.title} ({g.list.length})
            </div>
            {g.list.map((a) => (
              <div key={`${a.empId}${a.dk}${a.type}`} className={styles.alert}>
                <span className={styles.alertDay}>{dayShort(a.dk)}</span>
                <strong>{a.empName}</strong>
                <span>{a.message}</span>
              </div>
            ))}
          </div>
        ))}
    </section>
  );
}

function DayTable({ rows, cols }: { rows: Record<string, unknown>[]; cols: [string, string][] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Jour</th>
          {cols.map(([, l]) => (
            <th key={l} scope="col">
              {l}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r.label)}>
            <th scope="row">{String(r.label)}</th>
            {cols.map(([k]) => (
              <td key={k}>{fmtMoney0(Number(r[k]) || 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
