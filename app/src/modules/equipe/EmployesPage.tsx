import { useCallback, useMemo, useState } from "react";
import { deleteField } from "firebase/firestore";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EyeOff,
  Mail,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { addDays, isoToDate, todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { useDocument } from "@/core/data/useDocument";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { CoverageHeatmap } from "./components/CoverageHeatmap";
import { EmployeeModal, type EmployeeSave } from "./components/EmployeeModal";
import { LeaveCellModal } from "./components/LeaveCellModal";
import { OpenDaysModal } from "./components/OpenDaysModal";
import { ShiftModal, type ShiftSave } from "./components/ShiftModal";
import { TimeOffModal, type TimeOffSave } from "./components/TimeOffModal";
import { hasShift, isoWeek, leaveMeta, openDayIndexes, partialFor, timeOffFor, visibleEmployees, weekDays, weekStart } from "./equipe.logic";
import type { Employee, EmployeeComp, LeaveRequest, PaidEmployee, ScheduleSettings } from "./equipe.types";
import { copyWeekPlan, effectiveRate, fmtHours, mergeComp, moveInOrder, nextEmpSortOrder, nextRateHistory, normalizeRateHistory, predictedSales, weekRows } from "./horaire.logic";
import { SECTION_COLOR, sectionKey } from "./sections";
import { useScheduleWrites } from "./useScheduleWrites";
import { useUndo } from "./useUndo";
import styles from "./Horaire.module.css";

type ModalState =
  | { kind: "shift"; emp: Employee | null; dk: string }
  | { kind: "timeoff"; emp: Employee | null; dk: string }
  | { kind: "leave"; emp: Employee; dk: string }
  | { kind: "days" }
  | { kind: "employee"; emp: PaidEmployee | null }
  | null;

const RATIOS = Array.from({ length: 16 }, (_, i) => 25 + i);
const SEC_LABEL = { cuisine: "Cuisine", service: "Service", other: "Autre" } as const;
const h = (n: number) => (n ? `${fmtHours(n)} h` : "—");

/** Admin : Employés & Horaires (grille de la semaine, congés, fiches). */
export default function EmployesPage() {
  const user = useSessionUser();
  const today = todayISO();
  const empQ = useCollection<Employee>("employees");
  const compQ = useCollection<EmployeeComp>("employeesComp");
  const leaveQ = useCollection<LeaveRequest>("leaveRequests");
  const setQ = useDocument<ScheduleSettings>("settings", "schedule");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const onUndo = useCallback((msg: string, ok: boolean) => toast(msg, ok ? "success" : "error"), [toast]);
  const undo = useUndo(onUndo);
  const w = useScheduleWrites(undo.push);
  const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState<ModalState>(null);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  const settings = setQ.data ?? {};
  const ratio = Number(settings.salesRatio) || 0.32;
  const monday = weekStart(today, offset);
  const allDays = weekDays(monday);
  const days = openDayIndexes(settings).map((i) => allDays[i]!);
  const weekNum = isoWeek(allDays[3]!);
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => isoToDate(iso)!.toLocaleDateString("fr-CA", o);
  const weekLabel = `${fmt(allDays[0]!, { day: "numeric", month: "short" })} – ${fmt(allDays[6]!, { day: "numeric", month: "short", year: "numeric" })}`;

  const paid = useMemo(() => mergeComp(empQ.data, compQ.data, today), [empQ.data, compQ.data, today]);
  const active = useMemo(() => paid.filter((e) => !e.archived), [paid]);
  const visible = useMemo(() => visibleEmployees(paid, days, settings, monday), [paid, days.join(), settings, monday]); // eslint-disable-line react-hooks/exhaustive-deps
  const week = useMemo(() => weekRows(visible, days), [visible, days.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const hiddenIds = settings.weekHidden?.[monday] ?? [];
  const onLeave = (empId: string, dk: string) => {
    const e = paid.find((x) => x.id === empId);
    return !!e && !!timeOffFor(e, dk, leaveQ.data);
  };

  // ── Quarts ──
  async function saveShift(s: ShiftSave) {
    const emp = paid.find((e) => e.id === s.empId)!;
    const prev = emp.shifts?.[s.fromDk];
    try {
      if (s.toDk !== s.fromDk) {
        await w.setShifts(emp, { [s.fromDk]: null, [s.toDk]: s.shift }, "Déplacement d'un quart");
        toast(`Quart déplacé : ${emp.name} ${s.shift.start}–${s.shift.end}`, "success");
      } else {
        await w.setShifts(emp, { [s.toDk]: s.shift }, hasShift(prev) ? "Modification d'un quart" : "Ajout d'un quart");
        toast(onLeave(emp.id, s.toDk) ? "Heures ajoutées — le jour reste marqué congé." : "Quart enregistré.", "success");
      }
      setModal(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }
  async function deleteShift(emp: Employee, dk: string) {
    try {
      await w.setShifts(emp, { [dk]: null }, "Suppression d'un quart");
      toast("Quart supprimé.", "success");
      setModal(null);
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  // ── Congés manuels ──
  async function saveTimeOff(s: TimeOffSave) {
    try {
      const removed = await w.addTimeOff(s.emp, s.days, { type: s.type, note: s.note, createdAt: Date.now() });
      await w.log("—", "Congé ajouté", `${s.emp.name} · ${s.days.length} jour(s) · ${leaveMeta(s.type).label}`);
      toast(`Congé enregistré · ${s.days.length} jour(s)${removed ? ` · ${removed} quart(s) retiré(s)` : ""}`, "success");
      setModal(null);
    } catch (err) {
      fail("Enregistrement du congé")(err);
    }
  }

  // ── Semaine ──
  async function hide(emp: Employee) {
    try {
      await w.setSchedule({ weekHidden: { [monday]: [...hiddenIds, emp.id] } }, { weekHidden: { [monday]: hiddenIds } }, `Retrait de ${emp.name} (cette semaine)`);
      toast(`${emp.name} retiré de cette semaine (réversible).`, "success");
    } catch (err) {
      fail("Retrait")(err);
    }
  }
  async function unhide(id: string) {
    try {
      await w.setSchedule({ weekHidden: { [monday]: hiddenIds.filter((x) => x !== id) } }, { weekHidden: { [monday]: hiddenIds } }, "Réaffichage");
    } catch (err) {
      fail("Réaffichage")(err);
    }
  }
  async function move(emp: Employee, delta: -1 | 1) {
    const ids = visible.map((e) => e.id);
    const next = moveInOrder(ids, emp.id, delta);
    if (next === ids) return;
    try {
      await w.setSchedule({ weekOrder: { [monday]: next } }, { weekOrder: { [monday]: settings.weekOrder?.[monday] ?? [] } }, "Réordonnancement");
    } catch (err) {
      fail("Réordonnancement")(err);
    }
  }
  async function setRatio(pct: number) {
    try {
      await w.setSchedule({ salesRatio: pct / 100 }, { salesRatio: ratio }, "Changement de ratio");
    } catch (err) {
      fail("Ratio")(err);
    }
  }
  async function toggleDay(day: number, on: boolean) {
    const cur = openDayIndexes(settings);
    const next = on ? [...new Set([...cur, day])].sort() : cur.filter((d) => d !== day);
    if (!next.length) return toast("Au moins un jour doit rester ouvert.", "error");
    try {
      await w.setSchedule({ openDays: next }, { openDays: cur }, "Jours d'ouverture");
    } catch (err) {
      fail("Jours d'ouverture")(err);
    }
  }

  async function copyWeek() {
    const nextDays = allDays.map((d) => addDays(d, 7));
    const src = active.filter((e) => allDays.some((d) => hasShift(e.shifts?.[d])));
    if (!src.length) return toast("La semaine est vide : remplis au moins un quart avant de copier.", "error");
    const targetHasData = active.some((e) => nextDays.some((d) => hasShift(e.shifts?.[d])));
    if (targetHasData) {
      const ok = await confirm({ title: `Écraser la semaine ${weekNum + 1} ?`, message: `La semaine ${weekNum + 1} contient déjà des quarts. Ils seront remplacés par ceux de la semaine ${weekNum}.`, danger: true, confirmLabel: "Écraser" });
      if (!ok) return;
    }
    try {
      const plan = copyWeekPlan(active, allDays, nextDays, leaveQ.data);
      for (const p of plan) {
        const emp = active.find((e) => e.id === p.empId)!;
        const data: Record<string, unknown> = {};
        for (const [dk, s] of Object.entries(p.changes)) data[`shifts.${dk}`] = s ?? deleteField();
        await actions.update("employees", emp.id, data);
      }
      await actions.setFixed("settings", "schedule", { weekOrder: { [addDays(monday, 7)]: visible.map((e) => e.id) } });
      await actions.log("—", "Horaire copié", `Semaine ${weekNum} → Semaine ${weekNum + 1}`);
      toast(`Semaine ${weekNum} copiée vers la semaine ${weekNum + 1}.`, "success");
      setOffset((o) => o + 1);
    } catch (err) {
      fail("Copie")(err);
    }
  }

  async function png(kind: "team" | "admin") {
    try {
      const mod = await import("./schedulePng");
      const input = { weekNum, weekLabel, monday, days, rows: week.rows, dayHours: week.dayHours, dayCost: week.dayCost, totalHours: week.totalHours, totalCost: week.totalCost, ratio };
      const name = kind === "team" ? await mod.exportTeamPng(input) : await mod.exportAdminPng(input);
      if (!name) toast("Aucun employé n'a de quart cette semaine — rien à exporter.", "error");
      else toast(kind === "team" ? "Image téléchargée — prête à partager avec l'équipe." : "Rapport admin téléchargé — usage interne seulement.", "success");
    } catch (err) {
      fail("Export PNG")(err);
    }
  }

  // ── Fiches ──
  async function saveEmployee(s: EmployeeSave) {
    const target = modal?.kind === "employee" ? modal.emp : null;
    try {
      let id = target?.id;
      if (target) await actions.update("employees", target.id, s.pub);
      else id = await actions.create("employees", { ...s.pub, shifts: {}, sortOrder: nextEmpSortOrder(empQ.data) });
      const comp = compQ.data.find((c) => c.id === id);
      const hist = nextRateHistory(comp, !target, s.rate, s.rateFrom);
      await actions.setFixed("employeesComp", id!, {
        hourlyRate: effectiveRate({ rateHistory: hist }, today),
        rateHistory: hist,
        isSalaried: s.isSalaried,
        fixedWeeklyHours: s.fixedWeeklyHours,
        updatedAt: Date.now(),
      });
      await actions.log(s.pub.name, target ? "Employé modifié" : "Employé ajouté");
      toast(target ? "Fiche enregistrée." : `${s.pub.name} ajouté(e) à l'équipe.`, "success");
      setModal(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }
  async function removeRate(emp: PaidEmployee, from: string) {
    const hist = normalizeRateHistory(emp.rateHistory).filter((x) => x.from !== from);
    try {
      await actions.setFixed("employeesComp", emp.id, { rateHistory: hist, hourlyRate: effectiveRate({ rateHistory: hist, hourlyRate: emp.hourlyRate }, today), updatedAt: Date.now() });
      toast("Palier de taux retiré.", "success");
      setModal(null);
    } catch (err) {
      fail("Retrait du palier")(err);
    }
  }
  async function duplicate(emp: PaidEmployee) {
    try {
      const { id: _id, shifts: _s, timeOff: _t, pin: _p, hourlyRate, rateHistory, isSalaried, fixedWeeklyHours, ...rest } = emp;
      const id = await actions.create("employees", { ...rest, name: `${emp.name} (copie)`, pin: "", shifts: {}, archived: false, sortOrder: nextEmpSortOrder(empQ.data) });
      await actions.setFixed("employeesComp", id, { hourlyRate, rateHistory, isSalaried, fixedWeeklyHours, updatedAt: Date.now() });
      toast("Employé dupliqué (sans quarts ni NIP).", "success");
    } catch (err) {
      fail("Duplication")(err);
    }
  }
  async function archive(emp: Employee, restore = false) {
    if (!restore) {
      const ok = await confirm({
        title: "Retirer l'employé de l'équipe ?",
        message: `« ${emp.name} » sera archivé. Son historique reste visible dans les horaires et paies passés ; tu pourras le restaurer.`,
        danger: true,
        confirmLabel: "Archiver",
      });
      if (!ok) return;
    }
    try {
      await actions.update("employees", emp.id, restore ? { archived: false, archivedAt: deleteField() } : { archived: true, archivedAt: Date.now() });
      await actions.log(emp.name ?? "", restore ? "Employé restauré" : "Employé archivé");
      if (!restore) undo.push({ label: `Archivage de ${emp.name}`, restore: () => actions.update("employees", emp.id, { archived: false, archivedAt: deleteField() }) });
      toast(restore ? "Employé restauré." : `${emp.name} archivé.`, "success");
    } catch (err) {
      fail("Archivage")(err);
    }
  }

  const loading = empQ.loading || setQ.loading;
  const error = empQ.error || setQ.error;
  const archived = paid.filter((e) => e.archived);
  const team = [...active].sort((a, b) => ({ cuisine: 0, service: 1, other: 2 })[sectionKey(a)] - ({ cuisine: 0, service: 1, other: 2 })[sectionKey(b)] || (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div className="page">
      <PageHeader
        eyebrow="RH & Horaires"
        title="Employés & Horaires"
        actions={
          <Button onClick={() => setModal({ kind: "employee", emp: null })}>
            <UserPlus size={16} aria-hidden /> Employé
          </Button>
        }
      />
      {error ? (
        <EmptyState icon={Users} title="Impossible de charger les employés">
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : paid.length === 0 ? (
        <EmptyState icon={Users} title="Aucun employé encore">
          Ajoute ton équipe : le taux horaire et la section servent aux horaires, aux salaires et au partage des pourboires.
        </EmptyState>
      ) : (
        <>
          {compQ.error && <p className={styles.errBox}>La rémunération n'est pas lisible ({compQ.error.message}) : les coûts sont à 0.</p>}
          <div className={styles.toolbar}>
            <div className={styles.weekNav}>
              <button className={styles.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Semaine précédente">
                <ChevronLeft size={16} />
              </button>
              <div className={styles.weekLabel} aria-live="polite">
                <div className={styles.weekNum}>Semaine {weekNum}</div>
                <div className={styles.weekDates}>{weekLabel}</div>
              </div>
              <button className={styles.navBtn} onClick={() => setOffset((o) => o + 1)} aria-label="Semaine suivante">
                <ChevronRight size={16} />
              </button>
              {offset !== 0 ? (
                <button className={styles.pillBtn} onClick={() => setOffset(0)}>
                  Cette semaine
                </button>
              ) : (
                <span className={styles.todayTag}>Cette semaine</span>
              )}
            </div>
            <span className={styles.spacer} />
            <Button variant="secondary" onClick={() => void undo.undo()} disabled={!undo.count} title={undo.last() ? `Annuler : ${undo.last()} (Ctrl/Cmd+Z)` : "Rien à annuler"}>
              <Undo2 size={16} aria-hidden /> Annuler{undo.count ? ` (${undo.count})` : ""}
            </Button>
            <Button variant="secondary" onClick={() => setModal({ kind: "timeoff", emp: null, dk: today })}>
              <Sun size={16} aria-hidden /> Congé
            </Button>
            <ActionMenu
              label="Plus d'actions sur l'horaire"
              items={[
                { label: `Copier vers la semaine ${weekNum + 1}`, icon: <Copy size={16} />, onSelect: () => void copyWeek() },
                { label: "Jours d'ouverture", icon: <CalendarDays size={16} />, onSelect: () => setModal({ kind: "days" }) },
                { label: "Image pour l'équipe (sans $)", icon: <Download size={16} />, onSelect: () => void png("team") },
                ...(user.role === "global_admin" ? [{ label: "Image admin (interne)", icon: <Download size={16} />, onSelect: () => void png("admin") }] : []),
              ]}
            />
          </div>

          {hiddenIds.length > 0 && (
            <div className={styles.hiddenBar}>
              <EyeOff size={14} aria-hidden /> Retiré(s) de cette semaine :
              {hiddenIds.map((id) => {
                const e = paid.find((x) => x.id === id);
                return e ? (
                  <button key={id} className={styles.chip} onClick={() => void unhide(id)} title="Réafficher cette semaine">
                    {e.name} <Plus size={12} aria-hidden />
                  </button>
                ) : null;
              })}
            </div>
          )}

          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.nameCol} scope="col">
                    Employé
                  </th>
                  {days.map((dk, k) => (
                    <th key={dk} scope="col" className={dk === today ? styles.todayCol : undefined}>
                      <div className={styles.dayName}>{fmt(dk, { weekday: "short" }).replace(".", "")}</div>
                      <div>{fmt(dk, { day: "numeric", month: "short" }).replace(".", "")}</div>
                      <div className={styles.dayMeta}>
                        {week.rows.filter((r) => hasShift(r.daily[k]!.shift)).length} pers. · {h(week.dayHours[k]!)}
                      </div>
                    </th>
                  ))}
                  <th scope="col" className={styles.totalCol}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {week.rows.map((row, idx) => {
                  const e = row.emp;
                  const k = sectionKey(e);
                  return (
                    <tr key={e.id}>
                      <th scope="row" className={styles.nameCol} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties}>
                        <div className={styles.nameRow}>
                          <span className={styles.name}>{e.name}</span>
                          <ActionMenu
                            label={`Actions pour ${e.name}`}
                            items={[
                              ...(idx > 0 ? [{ label: "Monter", icon: <ArrowUp size={16} />, onSelect: () => void move(e, -1) }] : []),
                              ...(idx < week.rows.length - 1 ? [{ label: "Descendre", icon: <ArrowDown size={16} />, onSelect: () => void move(e, 1) }] : []),
                              { label: "Congé…", icon: <Sun size={16} />, onSelect: () => setModal({ kind: "timeoff", emp: e, dk: days[0] ?? today }) },
                              { label: "Modifier la fiche", icon: <Pencil size={16} />, onSelect: () => setModal({ kind: "employee", emp: e }) },
                              { label: "Retirer de cette semaine", icon: <EyeOff size={16} />, onSelect: () => void hide(e) },
                            ]}
                          />
                        </div>
                        <div className={styles.meta}>
                          <span className={styles.dot} style={{ background: SECTION_COLOR[k] }} aria-hidden /> {SEC_LABEL[k]}
                          {row.rate > 0 && (
                            <span>
                              · {fmtMoney(row.rate)}/h{e.isSalaried ? " · fixe" : ""}
                            </span>
                          )}
                          {e.archived && <span className={styles.archivedTag}>archivé</span>}
                        </div>
                      </th>
                      {row.daily.map((d) => {
                        const off = timeOffFor(e, d.dk, leaveQ.data);
                        const p = partialFor(e.id, d.dk, leaveQ.data);
                        const cls = d.dk === today ? styles.todayCol : undefined;
                        if (off && !hasShift(d.shift)) {
                          const meta = leaveMeta(off.type);
                          return (
                            <td key={d.dk} className={cls}>
                              <button className={styles.leaveCard} style={{ "--leave": meta.color } as React.CSSProperties} onClick={() => setModal({ kind: "leave", emp: e, dk: d.dk })}>
                                <Sun size={11} aria-hidden /> {off.fromRequest ? "Congé approuvé" : "Congé"}
                                <span>{meta.label}</span>
                              </button>
                            </td>
                          );
                        }
                        if (!hasShift(d.shift)) {
                          return (
                            <td key={d.dk} className={cls}>
                              <button className={styles.emptyCell} onClick={() => setModal({ kind: "shift", emp: e, dk: d.dk })} aria-label={`Ajouter un quart à ${e.name}, ${fmt(d.dk, { weekday: "long", day: "numeric" })}`}>
                                <Plus size={14} aria-hidden />
                              </button>
                              {p && <span className={styles.partial}>{p.mode === "late" ? `entre à ${p.time}` : `finit à ${p.time}`}</span>}
                            </td>
                          );
                        }
                        return (
                          <td key={d.dk} className={cls}>
                            <button className={styles.shiftCard} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties} onClick={() => setModal({ kind: "shift", emp: e, dk: d.dk })}>
                              <span className={styles.shiftTime}>
                                {d.shift!.start}–{d.shift!.end}
                              </span>
                              <span className={styles.shiftMeta}>
                                {h(d.hours)} · {fmtMoney(d.cost)}
                              </span>
                              {off && <span className={styles.partial}>☀ congé</span>}
                              {p && <span className={styles.partial}>{p.mode === "late" ? `entre à ${p.time}` : `finit à ${p.time}`}</span>}
                            </button>
                          </td>
                        );
                      })}
                      <td className={styles.totalCol}>
                        <div className={styles.strong}>{h(row.totalHours)}</div>
                        <div className={styles.hint}>{row.totalPay ? fmtMoney(row.totalPay) : ""}</div>
                      </td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={days.length + 2} className={styles.addRow}>
                    <button className={styles.pillBtn} onClick={() => setModal({ kind: "shift", emp: null, dk: days.includes(today) ? today : days[0]! })}>
                      <Plus size={14} aria-hidden /> Ajouter un quart
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className={styles.nameCol}>
                    Heures
                  </th>
                  {week.dayHours.map((x, i) => (
                    <td key={i}>{h(x)}</td>
                  ))}
                  <td className={`${styles.totalCol} ${styles.strong}`}>{h(week.totalHours)}</td>
                </tr>
                <tr>
                  <th scope="row" className={styles.nameCol}>
                    Coût
                  </th>
                  {week.dayCost.map((x, i) => (
                    <td key={i}>{x ? fmtMoney(x) : "—"}</td>
                  ))}
                  <td className={`${styles.totalCol} ${styles.strong}`}>{fmtMoney(week.totalCost)}</td>
                </tr>
                <tr className={styles.predicted}>
                  <th scope="row" className={styles.nameCol}>
                    Ventes prévues
                    <select className={styles.ratioSelect} value={Math.round(ratio * 100)} onChange={(e) => void setRatio(Number(e.target.value))} aria-label="Ratio salaires sur ventes">
                      {[...new Set([...RATIOS, Math.round(ratio * 100)])]
                        .sort((a, b) => a - b)
                        .map((p) => (
                          <option key={p} value={p}>
                            ratio {p} %
                          </option>
                        ))}
                    </select>
                  </th>
                  {week.dayCost.map((x, i) => (
                    <td key={i}>{x ? fmtMoney(predictedSales(x, ratio)) : "—"}</td>
                  ))}
                  <td className={`${styles.totalCol} ${styles.strong}`}>{fmtMoney(predictedSales(week.totalCost, ratio))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={styles.hint} style={{ marginTop: 6 }}>
            Ventes prévues = ventes nécessaires pour que les salaires représentent le ratio choisi. Clic sur une case pour ajouter, modifier ou déplacer un quart.
          </p>

          <CoverageHeatmap emps={visible} days={days} />

          <h2 className={styles.sectionTitle}>
            Équipe <span className={styles.count}>{team.length}</span>
          </h2>
          <div className={styles.team}>
            {team.map((e) => {
              const k = sectionKey(e);
              return (
                <article key={e.id} className={styles.teamCard} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties}>
                  <div className={styles.teamHead}>
                    <div>
                      <div className={styles.name}>{e.name}</div>
                      <div className={styles.meta}>
                        {SEC_LABEL[k]}
                        {e.role ? ` · ${e.role}` : ""}
                        {e.noTips && <span className={styles.archivedTag}>sans pourboire</span>}
                      </div>
                    </div>
                    <ActionMenu
                      label={`Actions pour ${e.name}`}
                      items={[
                        { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setModal({ kind: "employee", emp: e }) },
                        { label: "Dupliquer", icon: <Copy size={16} />, onSelect: () => void duplicate(e) },
                        { label: "Archiver", icon: <Trash2 size={16} />, danger: true, onSelect: () => void archive(e) },
                      ]}
                    />
                  </div>
                  <div className={styles.teamBody}>
                    {e.hourlyRate > 0 && (
                      <span>
                        {fmtMoney(e.hourlyRate)}/h{e.isSalaried ? ` · fixe ${e.fixedWeeklyHours} h` : ""}
                      </span>
                    )}
                    {e.phone && (
                      <a href={`tel:${e.phone.replace(/[^\d+]/g, "")}`}>
                        <Phone size={12} aria-hidden /> {e.phone}
                      </a>
                    )}
                    {e.email && (
                      <a href={`mailto:${e.email}`}>
                        <Mail size={12} aria-hidden /> {e.email}
                      </a>
                    )}
                    <span className={styles.hint}>{e.pin ? `NIP : ${e.pin}` : "Pas de NIP (ne peut pas pointer)"}</span>
                  </div>
                </article>
              );
            })}
          </div>
          {archived.length > 0 && (
            <div className={styles.hiddenBar}>
              {archived.length} archivé(s) :
              {archived.map((e) => (
                <button key={e.id} className={styles.chip} onClick={() => void archive(e, true)} title="Restaurer dans l'équipe">
                  {e.name} <RotateCcw size={12} aria-hidden />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {modal?.kind === "shift" && (
        <ShiftModal
          emp={modal.emp}
          dk={modal.dk}
          days={days}
          candidates={active.filter((e) => !hasShift(e.shifts?.[modal.dk]))}
          onLeave={onLeave}
          onClose={() => setModal(null)}
          onSave={saveShift}
          onDelete={deleteShift}
          onMarkLeave={(e, dk) => setModal({ kind: "timeoff", emp: e, dk })}
        />
      )}
      {modal?.kind === "timeoff" && <TimeOffModal emp={modal.emp} dk={modal.dk} employees={active} onClose={() => setModal(null)} onSave={saveTimeOff} />}
      {modal?.kind === "leave" && (
        <LeaveCellModal
          emp={modal.emp}
          dk={modal.dk}
          leave={timeOffFor(modal.emp, modal.dk, leaveQ.data) ?? {}}
          onClose={() => setModal(null)}
          onUpdate={async (type, note) => {
            try {
              const prev = modal.emp.timeOff?.[modal.dk] as { createdAt?: number } | undefined;
              await w.setTimeOff(modal.emp, modal.dk, { type, note, createdAt: prev?.createdAt ?? Date.now() }, "Modification d'un congé");
              toast("Congé mis à jour.", "success");
              setModal(null);
            } catch (err) {
              fail("Modification")(err);
            }
          }}
          onRemove={async () => {
            try {
              await w.setTimeOff(modal.emp, modal.dk, null, "Retrait d'un congé");
              toast("Congé retiré.", "success");
              setModal(null);
            } catch (err) {
              fail("Retrait")(err);
            }
          }}
          onAddHours={() => setModal({ kind: "shift", emp: modal.emp, dk: modal.dk })}
        />
      )}
      {modal?.kind === "days" && <OpenDaysModal open={openDayIndexes(settings)} onClose={() => setModal(null)} onToggle={(d, on) => void toggleDay(d, on)} />}
      {modal?.kind === "employee" && <EmployeeModal emp={modal.emp} all={empQ.data} onClose={() => setModal(null)} onSave={saveEmployee} onRemoveRate={removeRate} />}
    </div>
  );
}
