/**
 * Horaire admin (Employés & Horaires) — fonctions pures, mêmes règles que la
 * v1 (js/pages-hr.js). Couvertes par horaire.logic.test.ts.
 */
import { addDays, isoToDate, toISO } from "@/core/dates";
import { hasShift, timeOffFor } from "./equipe.logic";
import type { Employee, EmployeeComp, LeaveRequest, PaidEmployee, RateStep, Shift } from "./equipe.types";

const num = (v: unknown) => Number(v) || 0;

/** Heures d'un quart (décimal). Un quart qui passe minuit est compté correctement. */
export function hoursFromShift(s?: Shift): number {
  if (!s || !s.start || !s.end) return 0;
  const [sh, sm] = String(s.start).split(":").map(Number);
  const [eh, em] = String(s.end).split(":").map(Number);
  if (Number.isNaN(sh) || Number.isNaN(eh)) return 0;
  let diff = eh! * 60 + (em || 0) - (sh! * 60 + (sm || 0));
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

export const fmtHours = (h: number) => (!h ? "" : Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ","));

// ── Taux horaires datés ───────────────────────────────

/** Tri par date, même date = dernière valeur, paliers redondants (même taux que le précédent) retirés. */
export function normalizeRateHistory(hist: unknown): RateStep[] {
  const byDate: Record<string, RateStep> = {};
  for (const h of Array.isArray(hist) ? (hist as Partial<RateStep>[]) : []) {
    if (!h || !h.from) continue;
    byDate[h.from] = { rate: Math.max(0, num(h.rate)), from: h.from };
  }
  const out: RateStep[] = [];
  for (const h of Object.values(byDate).sort((a, b) => a.from.localeCompare(b.from))) {
    if (out.length && out[out.length - 1]!.rate === h.rate) continue;
    out.push(h);
  }
  return out;
}

/** Taux applicable à une date : dernier palier dont `from` ≤ date ; avant le 1er palier → le plus ancien. */
export function effectiveRate(e: { rateHistory?: RateStep[]; hourlyRate?: number }, dk: string): number {
  const hist = (e.rateHistory ?? []).filter((h) => h && h.from);
  if (!hist.length) return num(e.hourlyRate);
  let best: RateStep | null = null;
  let earliest: RateStep | null = null;
  for (const h of hist) {
    if (!earliest || h.from < earliest.from) earliest = h;
    if (h.from <= dk && (!best || h.from > best.from)) best = h;
  }
  return num((best ?? earliest)!.rate);
}

/** Fusionne /employeesComp dans les employés (comme _applyEmployeeComp v1). */
export function mergeComp(emps: Employee[], comps: EmployeeComp[], today: string): PaidEmployee[] {
  const byId = new Map(comps.map((c) => [c.id, c]));
  return emps.map((e) => {
    const c = byId.get(e.id);
    const legacy = e as Employee & { hourlyRate?: number; isSalaried?: boolean; fixedWeeklyHours?: number };
    if (!c) {
      return { ...e, hourlyRate: num(legacy.hourlyRate), rateHistory: [], isSalaried: !!legacy.isSalaried, fixedWeeklyHours: num(legacy.fixedWeeklyHours) };
    }
    const rateHistory = normalizeRateHistory(c.rateHistory);
    return {
      ...e,
      rateHistory,
      isSalaried: !!c.isSalaried,
      fixedWeeklyHours: num(c.fixedWeeklyHours),
      hourlyRate: rateHistory.length ? effectiveRate({ rateHistory }, today) : num(c.hourlyRate),
    };
  });
}

/**
 * Nouvel historique après saisie d'un taux avec date d'effet (saveEmployee v1) :
 * l'ancien taux sans historique est « scellé » au 2000-01-01 pour que les
 * semaines passées le gardent.
 */
export function nextRateHistory(existing: { rateHistory?: RateStep[]; hourlyRate?: number } | undefined, isNew: boolean, newRate: number, from: string): RateStep[] {
  let hist = normalizeRateHistory(existing?.rateHistory);
  if (!hist.length) {
    const prior = Math.max(0, num(existing?.hourlyRate));
    if (!isNew && prior > 0) hist.push({ rate: prior, from: "2000-01-01" });
  }
  return normalizeRateHistory([...hist.filter((h) => h.from !== from), { rate: Math.max(0, newRate), from }]);
}

// ── Coûts de la semaine ───────────────────────────────

export interface DayCell {
  dk: string;
  shift?: Shift;
  hours: number;
  cost: number;
}
export interface WeekRow {
  emp: PaidEmployee;
  rate: number;
  daily: DayCell[];
  totalHours: number;
  totalPay: number;
}

/**
 * Heures et coûts (renderEmployes v1). Salarié : heures fixes × taux (taux au
 * 1er jour ouvert), réparti également sur les jours ouverts — les quarts saisis
 * ne changent pas le coût. Horaire : heures × taux du jour.
 */
export function weekRows(emps: PaidEmployee[], days: string[]) {
  const n = days.length || 1;
  const dayHours = days.map(() => 0);
  const dayCost = days.map(() => 0);
  const rows: WeekRow[] = emps.map((emp) => {
    const rate = effectiveRate(emp, days[0] ?? "");
    const weeklyFixed = emp.isSalaried ? emp.fixedWeeklyHours * rate : 0;
    const daily = days.map((dk, i) => {
      const shift = emp.shifts?.[dk];
      const hours = hoursFromShift(shift);
      const cost = emp.isSalaried ? weeklyFixed / n : hours * effectiveRate(emp, dk);
      dayHours[i]! += hours;
      dayCost[i]! += cost;
      return { dk, shift, hours, cost };
    });
    const totalHours = daily.reduce((s, d) => s + d.hours, 0);
    const totalPay = emp.isSalaried ? weeklyFixed : daily.reduce((s, d) => s + d.cost, 0);
    return { emp, rate, daily, totalHours, totalPay };
  });
  const totalHours = dayHours.reduce((a, b) => a + b, 0);
  const totalCost = dayCost.reduce((a, b) => a + b, 0);
  return { rows, dayHours, dayCost, totalHours, totalCost };
}

/** Ventes nécessaires pour tenir le ratio salaires/ventes (coût ÷ ratio). */
export const predictedSales = (cost: number, ratio: number) => (ratio > 0 ? cost / ratio : 0);

// ── Couverture (employés présents par heure) ──────────

const toFloat = (hhmm?: string) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isNaN(h) ? null : h! + (Number(m) || 0) / 60;
};

/** Nombre d'employés présents pendant l'heure H (start ≤ H < fin), quarts passant minuit inclus. */
export function coverageAt(emps: Employee[], dk: string, hour: number, section: "all" | "cuisine" | "service" | "other"): number {
  let n = 0;
  for (const e of emps) {
    if (section !== "all") {
      const s = e.section === "cuisine" ? "cuisine" : (e.section ?? "service") === "service" ? "service" : "other";
      if (s !== section) continue;
    }
    const sh = e.shifts?.[dk];
    let start = toFloat(sh?.start);
    let end = toFloat(sh?.end);
    if (start == null || end == null) continue;
    if (end <= start) end += 24;
    if ((hour >= start && hour < end) || (hour + 24 >= start && hour + 24 < end)) n++;
  }
  return n;
}

/** Plage d'heures à afficher : de la 1re entrée à la dernière sortie de la semaine (6 h – 23 h par défaut). */
export function coverageRange(emps: Employee[], days: string[]): [number, number] {
  let min = 24;
  let max = 0;
  for (const e of emps)
    for (const dk of days) {
      const s = e.shifts?.[dk];
      const a = toFloat(s?.start);
      let b = toFloat(s?.end);
      if (a == null || b == null) continue;
      if (b <= a) b += 24;
      min = Math.min(min, Math.floor(a));
      max = Math.max(max, Math.ceil(b));
    }
  return min >= max ? [6, 23] : [min, Math.min(max, 30)];
}

// ── Copie de semaine ──────────────────────────────────

/**
 * Quarts à écrire pour copier la semaine vers la suivante (duplicateScheduleToNextWeek v1) :
 * jour de congé dans la cible → rien (et quart résiduel effacé) ; source vide → cible effacée.
 * Renvoie, par employé, les champs `shifts.<jour>` (null = supprimer).
 */
export function copyWeekPlan(emps: Employee[], from: string[], to: string[], requests: LeaveRequest[]) {
  const plan: { empId: string; changes: Record<string, Shift | null> }[] = [];
  for (const e of emps) {
    const changes: Record<string, Shift | null> = {};
    from.forEach((src, i) => {
      const tgt = to[i]!;
      const cur = e.shifts?.[tgt];
      if (timeOffFor(e, tgt, requests)) {
        if (cur) changes[tgt] = null;
        return;
      }
      const s = e.shifts?.[src];
      if (hasShift(s)) {
        if (!cur || cur.start !== s!.start || cur.end !== s!.end) changes[tgt] = { start: s!.start, end: s!.end };
      } else if (cur) changes[tgt] = null;
    });
    if (Object.keys(changes).length) plan.push({ empId: e.id, changes });
  }
  return plan;
}

// ── Congés saisis par l'admin ─────────────────────────

/** Jours AAAA-MM-JJ entre deux dates incluses (max 366). */
export function dayRange(start: string, end: string): string[] {
  const a = isoToDate(start);
  const b = isoToDate(end);
  if (!a || !b || b < a) return [];
  const out: string[] = [];
  for (let d = toISO(a); d <= end && out.length < 366; d = addDays(d, 1)) out.push(d);
  return out;
}

// ── Fiche employé ─────────────────────────────────────

export function pinError(pin: string, emps: Employee[], selfId?: string): string | null {
  if (!pin) return null;
  if (!/^\d{4}$/.test(pin)) return "Le NIP doit avoir 4 chiffres.";
  const other = emps.find((e) => e.id !== selfId && e.pin != null && String(e.pin).trim() === pin);
  return other ? `Ce NIP est déjà utilisé par ${other.name}.` : null;
}

export const nextEmpSortOrder = (emps: Employee[]) => emps.reduce((m, e) => Math.max(m, e.sortOrder ?? 0), 0) + 1;

/** Nouvel ordre après avoir monté/descendu un employé dans la liste affichée. */
export function moveInOrder(ids: string[], id: string, delta: -1 | 1): string[] {
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return ids;
  const next = [...ids];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
