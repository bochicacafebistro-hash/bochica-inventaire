/**
 * Salaires & Pourboires — calculs purs, identiques à la v1
 * (renderSalaires / _computePayrollWeekData de js/pages-payroll.js).
 * Couverts par paie.logic.test.ts et paie.parity.test.ts (v1 ↔ v2).
 *
 * Règles :
 *  • Heures payées = heures réellement pointées (ou saisies par l'admin).
 *  • Salarié : heures fixes × taux du lundi ; sinon Σ heures du jour × taux du jour.
 *  • Pourboires : chaque jour, pool Cuisine (25 %) et pool Service + Autre (75 %),
 *    partagés au prorata des heures faites PENDANT les heures de service.
 *    Section de la semaine (dérogation) > « sans pourboire » de la fiche > section.
 */
import { hasShift } from "@/modules/equipe/equipe.logic";
import { effectiveRate, hoursFromShift, mergeComp } from "@/modules/equipe/horaire.logic";
import type { Employee, EmployeeComp, ScheduleSettings } from "@/modules/equipe/equipe.types";
import type { ActualShift } from "@/modules/pointage/punch.logic";
import type { ManualEmployee, PayrollPerson, PayrollSettings, PayrollWeekDoc, ServiceWindow } from "./paie.types";

const num = (v: unknown) => Number(v) || 0;
export const DEFAULT_SHARES = { cuisine: 0.25, service: 0.75 };

// ── Heures de service ─────────────────────────────────

export function normalizeWindows(entry: unknown): ServiceWindow[] {
  if (!entry) return [];
  const arr = Array.isArray(entry) ? entry : [entry];
  return (arr as Partial<ServiceWindow>[])
    .filter((w) => w && w.start && w.end)
    .map((w) => ({ start: w.start!, end: w.end! }))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export const windowsLabel = (entry: unknown) => {
  const w = normalizeWindows(entry);
  return w.length ? w.map((x) => `${x.start}–${x.end}`).join(" · ") : "—";
};

const toFloat = (s?: string) => {
  if (!s) return null;
  const [h, m] = s.split(":").map(Number);
  return Number.isNaN(h) ? null : h! + (Number(m) || 0) / 60;
};

/** Heures d'un quart qui tombent dans une plage de service (minuit géré). */
export function intersectHours(shift: { start?: string; end?: string } | null | undefined, win: ServiceWindow | null | undefined): number {
  if (!shift?.start || !shift.end || !win?.start || !win.end) return 0;
  const sS = toFloat(shift.start);
  let sE = toFloat(shift.end);
  const wS = toFloat(win.start);
  let wE = toFloat(win.end);
  if (sS == null || sE == null || wS == null || wE == null) return 0;
  if (sE <= sS) sE += 24;
  if (wE <= wS) wE += 24;
  return Math.max(0, Math.min(sE, wE) - Math.max(sS, wS));
}

export const intersectWindows = (shift: { start?: string; end?: string } | null | undefined, wins: ServiceWindow[]) => wins.reduce((s, w) => s + intersectHours(shift, w), 0);

// ── Qui est payé cette semaine ────────────────────────

export type TipGroup = "cuisine" | "service" | "excluded";
export const baseGroup = (e: { section?: string }): "cuisine" | "service" => ((e.section ?? "service") === "cuisine" ? "cuisine" : "service");

export function effectiveGroup(e: { id: string; section?: string; noTips?: boolean }, overrides: PayrollWeekDoc["sectionOverrides"]): TipGroup {
  const ov = overrides?.[e.id];
  if (ov === "excluded" || ov === "cuisine" || ov === "service") return ov;
  if (e.noTips) return "excluded";
  return baseGroup(e);
}

const manualToPerson = (m: ManualEmployee): PayrollPerson => ({
  id: m.id,
  name: m.name,
  section: m.section,
  role: m.role,
  shifts: m.shifts ?? {},
  hourlyRate: num(m.hourlyRate),
  rateHistory: [],
  isSalaried: !!m.isSalaried,
  fixedWeeklyHours: 0,
  isManual: true,
});

const sectionPriority = (e: { section?: string }) => (e.section === "cuisine" ? 0 : (e.section ?? "service") === "service" ? 1 : 2);

/**
 * Employés de la semaine de paie (getAllPayrollEmployees v1) : retirés de la
 * semaine exclus, archivés seulement s'ils ont des heures, extras ajoutés ;
 * ordre = celui de l'horaire (partagé), sinon l'ancien ordre de la paie,
 * sinon Cuisine → Service → Autre.
 */
export function payrollPeople(emps: Employee[], comps: EmployeeComp[], week: PayrollWeekDoc | null, schedule: ScheduleSettings, monday: string, today: string): PayrollPerson[] {
  const hidden = new Set(week?.hiddenEmps ?? []);
  const hasHours = (id: string) => Object.keys(week?.actualShifts?.[id] ?? {}).length > 0;
  const reals = mergeComp(emps, comps, today)
    .filter((e) => !hidden.has(e.id) && (!e.archived || hasHours(e.id)))
    .map((e) => ({ ...e, isManual: false }));
  const all = [...reals, ...(week?.manualEmployees ?? []).filter((m) => !hidden.has(m.id)).map(manualToPerson)];
  const shared = schedule.weekOrder?.[monday] ?? [];
  const order = shared.length ? shared : (week?.empOrder ?? []);
  if (!order.length) return all.sort((a, b) => sectionPriority(a) - sectionPriority(b));
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  return all.sort((a, b) => idx(a.id) - idx(b.id) || sectionPriority(a) - sectionPriority(b));
}

// ── Calcul de la semaine ──────────────────────────────

export interface PayDay {
  dk: string;
  dow: number;
  actual: ActualShift | null;
  planned: { start?: string; end?: string } | null;
  hours: number;
  pHours: number;
  tipHours: number;
  dayTip: number;
  isDifferent: boolean;
}

export interface PayRow {
  emp: PayrollPerson;
  rate: number;
  group: TipGroup;
  override: TipGroup | null;
  daily: PayDay[];
  totalHours: number;
  plannedHours: number;
  gap: number;
  tipEligibleHours: number;
  tipShare: number;
  grossWage: number;
  bonus: number;
  totalPay: number;
}

export interface PayrollInput {
  people: PayrollPerson[];
  week: PayrollWeekDoc | null;
  settings: PayrollSettings | null;
  monday: string;
  days: string[]; // jours ouverts (AAAA-MM-JJ)
  dows: number[]; // leur indice (0 = lundi)
  targetRatio: number; // ratio salaires/ventes visé (settings/schedule.salesRatio)
}

const same = (a?: { start?: string; end?: string } | null, b?: { start?: string; end?: string } | null) => (a?.start ?? "") === (b?.start ?? "") && (a?.end ?? "") === (b?.end ?? "");

export function computePayroll({ people, week, settings, monday, days, dows, targetRatio }: PayrollInput) {
  const shares = settings?.tipShares ?? DEFAULT_SHARES;
  const shareK = num(shares.cuisine);
  const shareS = num(shares.service);
  const tipsByDay = week?.tipsByDay ?? {};
  const netByDay = week?.netByDay ?? {};
  const actual = week?.actualShifts ?? {};
  const overrides = week?.sectionOverrides ?? {};
  const totalTips = days.reduce((s, dk) => s + num(tipsByDay[dk]), 0) || num(week?.totalTips);
  const totalNet = days.reduce((s, dk) => s + num(netByDay[dk]), 0);

  const shiftOf = (id: string, dk: string) => actual[id]?.[dk] ?? null;
  const groups = new Map(people.map((p) => [p.id, effectiveGroup(p, overrides)]));

  const dailyCalc = days.map((dk, k) => {
    const wins = normalizeWindows(settings?.defaultServiceHours?.[dows[k]!]);
    const dayTotal = num(tipsByDay[dk]);
    let kHrs = 0;
    let sHrs = 0;
    for (const p of people) {
      const g = groups.get(p.id)!;
      if (g === "excluded") continue;
      const h = intersectWindows(shiftOf(p.id, dk), wins);
      if (g === "cuisine") kHrs += h;
      else sHrs += h;
    }
    return { dk, wins, dayTotal, poolK: dayTotal * shareK, poolS: dayTotal * shareS, kHrs, sHrs };
  });

  const rows: PayRow[] = people.map((emp) => {
    const rate = effectiveRate(emp, monday);
    const group = groups.get(emp.id)!;
    const ov = overrides[emp.id];
    let totalHours = 0;
    let plannedHours = 0;
    let tipEligibleHours = 0;
    let tipShare = 0;
    let hourlyGross = 0;
    const daily = days.map((dk, k) => {
      const a = shiftOf(emp.id, dk);
      const planned = emp.shifts?.[dk] ?? null;
      const hours = hoursFromShift(a ?? undefined);
      const pHours = hoursFromShift(planned ?? undefined);
      const tipHours = intersectWindows(a, dailyCalc[k]!.wins);
      let dayTip = 0;
      if (group !== "excluded") {
        const pool = group === "cuisine" ? dailyCalc[k]!.poolK : dailyCalc[k]!.poolS;
        const tot = group === "cuisine" ? dailyCalc[k]!.kHrs : dailyCalc[k]!.sHrs;
        dayTip = tot > 0 && tipHours > 0 ? (tipHours / tot) * pool : 0;
      }
      totalHours += hours;
      plannedHours += pHours;
      tipEligibleHours += tipHours;
      tipShare += dayTip;
      hourlyGross += hours * effectiveRate(emp, dk);
      return { dk, dow: dows[k]!, actual: a, planned, hours, pHours, tipHours, dayTip, isDifferent: !!a && !same(a, planned) };
    });
    const grossWage = emp.isSalaried ? emp.fixedWeeklyHours * rate : hourlyGross;
    const b = num(week?.bonusByEmp?.[emp.id]);
    const bonus = b > 0 ? b : 0;
    return {
      emp,
      rate,
      group,
      override: ov === "cuisine" || ov === "service" || ov === "excluded" ? ov : null,
      daily,
      totalHours,
      plannedHours,
      gap: totalHours - plannedHours,
      tipEligibleHours,
      tipShare,
      grossWage,
      bonus,
      totalPay: grossWage + tipShare + bonus,
    };
  });

  const sum = (f: (r: PayRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const sums = {
    gross: sum((r) => r.grossWage),
    tips: sum((r) => r.tipShare),
    bonus: sum((r) => r.bonus),
    total: sum((r) => r.totalPay),
    hours: sum((r) => r.totalHours),
    planned: sum((r) => r.plannedHours),
    kitchenHrs: rows.filter((r) => r.group === "cuisine").reduce((s, r) => s + r.tipEligibleHours, 0),
    serviceHrs: rows.filter((r) => r.group === "service").reduce((s, r) => s + r.tipEligibleHours, 0),
  };

  // Coût réel et estimé (planifié) par jour — salarié : fixe réparti sur les jours ouverts
  const laborByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  const estimatedByDay: Record<string, number> = Object.fromEntries(days.map((d) => [d, 0]));
  let estimatedWage = 0;
  for (const r of rows) {
    if (r.emp.isSalaried) {
      const perDay = days.length ? (r.emp.fixedWeeklyHours * r.rate) / days.length : 0;
      for (const d of days) {
        laborByDay[d]! += perDay;
        estimatedByDay[d]! += perDay;
      }
      estimatedWage += r.emp.fixedWeeklyHours * r.rate;
    } else {
      for (const dd of r.daily) {
        laborByDay[dd.dk]! += dd.hours * effectiveRate(r.emp, dd.dk);
        const est = dd.pHours * effectiveRate(r.emp, dd.dk);
        estimatedByDay[dd.dk]! += est;
        estimatedWage += est;
      }
    }
  }

  const salesNeeded = (labor: number) => (targetRatio > 0 ? labor / targetRatio : 0);
  const pctReached = (net: number, labor: number) => {
    const n = salesNeeded(labor);
    return n > 0 ? (net / n) * 100 : 100;
  };
  const dayProfit = days.map((dk) => {
    const net = num(netByDay[dk]);
    const hasNet = netByDay[dk] !== undefined && netByDay[dk] !== null && (netByDay[dk] as unknown) !== "";
    const labor = laborByDay[dk] ?? 0;
    return { dk, net, hasNet, labor, tips: num(tipsByDay[dk]), salesNeeded: salesNeeded(labor), pctReached: pctReached(net, labor), surplus: net - salesNeeded(labor) };
  });

  const salesRatio = totalNet > 0 ? sums.gross / totalNet : 0;
  return {
    rows,
    dailyCalc,
    sums,
    totalTips,
    totalNet,
    poolK: totalTips * shareK,
    poolS: totalTips * shareS,
    shares: { cuisine: shareK, service: shareS },
    laborByDay,
    estimatedByDay,
    estimatedWage,
    wageDelta: sums.gross - estimatedWage,
    dayProfit,
    week: { salesNeeded: salesNeeded(sums.gross), pctReached: pctReached(totalNet, sums.gross), surplus: totalNet - salesNeeded(sums.gross) },
    salesRatio,
    tipPctSales: totalNet > 0 ? totalTips / totalNet : 0,
    /** Couleur du ratio : vert ≤ cible, orange ≤ cible + 8 pts, rouge au-delà. */
    ratioLevel: (salesRatio === 0 ? "empty" : salesRatio <= targetRatio ? "good" : salesRatio <= targetRatio + 0.08 ? "warn" : "bad") as "empty" | "good" | "warn" | "bad",
    wageLevel: (estimatedWage === 0 && sums.gross === 0 ? "empty" : sums.gross - estimatedWage <= 0 ? "good" : estimatedWage > 0 && (sums.gross - estimatedWage) / estimatedWage > 0.05 ? "bad" : "warn") as "empty" | "good" | "warn" | "bad",
  };
}
export type PayrollResult = ReturnType<typeof computePayroll>;

/** Montant de la dépense « Salaires » créée au verrouillage : salaires bruts + bonus des employés affichés. */
export const lockAmount = (r: PayrollResult) => Math.round((r.sums.gross + r.sums.bonus) * 100) / 100;

// ── Anomalies et remplissage automatique ──────────────

export interface PayAlert {
  type: "missing-exit" | "auto-filled" | "long-shift" | "not-punched";
  severity: "warning" | "info";
  empId: string;
  empName: string;
  dk: string;
  message: string;
  noStart?: boolean;
}

/** detectPayrollAnomalies v1 (rien si la semaine est verrouillée). */
export function detectAlerts(rows: PayRow[], locked: boolean, today: string, onLeave: (empId: string, dk: string) => boolean): PayAlert[] {
  if (locked) return [];
  const out: PayAlert[] = [];
  for (const r of rows)
    for (const d of r.daily) {
      const a = d.actual;
      const base = { empId: r.emp.id, empName: r.emp.name ?? "", dk: d.dk };
      const past = d.dk < today;
      if (past && a?.start && !a.end) out.push({ ...base, type: "missing-exit", severity: "warning", message: `Entrée pointée à ${a.start} mais pas de sortie` });
      if (a?.autoFilled && a.start && a.end)
        out.push({
          ...base,
          type: "auto-filled",
          severity: "warning",
          noStart: !!a.autoFilledNoStart,
          message: a.autoFilledNoStart
            ? `Aucun pointage — quart ${a.start} → ${a.end} rempli depuis l'horaire. Vérifier la présence (ou marquer absent)`
            : `Sortie ${a.end} remplie depuis l'horaire — à valider ou corriger`,
        });
      if (!a?.autoFilled && a?.start && a.end && d.hours > 14) out.push({ ...base, type: "long-shift", severity: "warning", message: `Quart de ${d.hours.toFixed(1).replace(".", ",")} h (${a.start} → ${a.end}) — vérifier` });
      if (past && !onLeave(r.emp.id, d.dk) && !a?.start && !a?.end && !a?.markedAbsent && d.planned?.start && d.planned.end)
        out.push({ ...base, type: "not-punched", severity: "info", message: `Prévu ${d.planned.start} → ${d.planned.end} mais aucun pointage` });
    }
  return out;
}

/**
 * Quarts à remplir depuis l'horaire, 1 h après la fin prévue (autoFillMissingExits v1) :
 * A) entrée sans sortie → sortie prévue ; B) aucun pointage → quart prévu complet (« présence ? »).
 * Jamais : congé, déjà rempli, marqué absent, sortie sans entrée, pas de quart prévu.
 */
export function autoFillCandidates(rows: PayRow[], locked: boolean, nowMs: number, onLeave: (empId: string, dk: string) => boolean) {
  if (locked) return [];
  const out: { empId: string; dk: string; start: string; end: string; noStart: boolean }[] = [];
  for (const r of rows)
    for (const d of r.daily) {
      const a = d.actual;
      const p = d.planned;
      if (!p?.start || !p.end || onLeave(r.emp.id, d.dk) || a?.autoFilled || a?.markedAbsent) continue;
      const hasS = !!a?.start;
      const hasE = !!a?.end;
      if (hasS && hasE) continue;
      if (!hasS && hasE) continue;
      const [y, mo, dd] = d.dk.split("-").map(Number);
      const [eh, em] = p.end.split(":").map(Number);
      const [sh, sm] = p.start.split(":").map(Number);
      if (!Number.isFinite(eh) || !Number.isFinite(em)) continue;
      const end = new Date(y!, mo! - 1, dd!, eh, em, 0, 0);
      if (eh! < sh! || (eh === sh && em! <= sm!)) end.setDate(end.getDate() + 1);
      if (nowMs - end.getTime() < 3_600_000) continue;
      out.push(hasS ? { empId: r.emp.id, dk: d.dk, start: a!.start!, end: p.end, noStart: false } : { empId: r.emp.id, dk: d.dk, start: p.start, end: p.end, noStart: true });
    }
  return out;
}

/** Nombre de saisies effaçables (heures + pourboires + ventes nettes). */
export function entryCount(week: PayrollWeekDoc | null) {
  const shifts = Object.values(week?.actualShifts ?? {}).reduce((s, m) => s + Object.keys(m ?? {}).length, 0);
  return { shifts, tips: Object.keys(week?.tipsByDay ?? {}).length, net: Object.keys(week?.netByDay ?? {}).length };
}

export const isFilled = (a: ActualShift | null | undefined) => !!(a?.start && a.end);
export { hasShift };
