/**
 * Simulation paie — calculs purs, identiques à la v1 (js/pages-simulations.js).
 * Couverts par sim.logic.test.ts et sim.parity.test.ts (v1 ↔ v2).
 *
 * Différence avec la vraie paie : une semaine type (jours 0..6, pas de dates),
 * un total de pourboires pour la semaine (pas jour par jour), taux actuel.
 */
import { addDays } from "@/core/dates";
import type { PaidEmployee } from "@/modules/equipe/equipe.types";
import { hoursFromShift } from "@/modules/equipe/horaire.logic";
import { intersectWindows, normalizeWindows } from "@/modules/paie/paie.logic";
import type { PayrollSimulation, SimEmployee, SimScenario, SimShift } from "./sim.types";

const num = (v: unknown) => Number(v) || 0;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Quarts valides d'un jour (un objet ou un tableau → tableau). */
export function dayShifts(entry: unknown): SimShift[] {
  if (!entry) return [];
  const arr = (Array.isArray(entry) ? entry : [entry]) as Partial<SimShift>[];
  return arr.filter((s) => s && s.start && s.end).map((s) => ({ start: s.start!, end: s.end! }));
}

/** Jours ouverts effectifs : openDays + tout jour qui a des heures de service. */
export function effectiveOpenDays(sc: SimScenario | undefined): number[] {
  const base = Array.isArray(sc?.openDays) && sc!.openDays!.length ? sc!.openDays! : ALL_DAYS;
  const set = new Set(base);
  for (const k of Object.keys(sc?.serviceHours ?? {})) if (normalizeWindows(sc!.serviceHours![k]).length) set.add(Number(k));
  return [...set].sort((a, b) => a - b);
}

export const simGroup = (e: { section?: string }) => ((e.section ?? "service") === "cuisine" ? "cuisine" : "service");

export interface SimDay {
  shifts: SimShift[];
  hours: number;
  tipHrs: number;
  cost: number;
}
export interface SimRow {
  emp: SimEmployee;
  rate: number;
  isSal: boolean;
  fixedHours: number;
  group: "cuisine" | "service";
  daily: (SimDay | null)[]; // null = jour fermé
  totalHours: number;
  tipEligibleHours: number;
  grossWage: number;
  tipShare: number;
  totalPay: number;
}

/** computeSimScenario v1 : pourboires de la semaine au prorata des heures de service. */
export function computeScenario(sc: SimScenario | undefined) {
  const empty = { rows: [] as SimRow[], totals: { hours: 0, gross: 0, tips: 0, total: 0 }, pools: { cuisine: 0, service: 0 }, totalsHours: { cuisine: 0, service: 0 }, dayHours: new Array(7).fill(0) as number[], dayCost: new Array(7).fill(0) as number[] };
  if (!sc || !Array.isArray(sc.employees)) return empty;
  const open = effectiveOpenDays(sc);
  const sh = sc.serviceHours ?? {};
  const shares = sc.tipShares ?? { cuisine: 0.25, service: 0.75 };
  const totalTips = num(sc.totalTips);
  const nOpen = open.length || 1;
  let hrsK = 0;
  let hrsS = 0;
  const dayHours = new Array(7).fill(0) as number[];
  const dayCost = new Array(7).fill(0) as number[];
  const calc = sc.employees.map((emp) => {
    const rate = num(emp.hourlyRate);
    const isSal = !!emp.isSalaried;
    const fixedHours = num(emp.fixedWeeklyHours);
    const weekly = isSal ? fixedHours * rate : 0;
    const dailyFixed = weekly / nOpen;
    const group = simGroup(emp);
    let totalHours = 0;
    let tipEligibleHours = 0;
    const daily: (SimDay | null)[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if (!open.includes(dow)) {
        daily.push(null);
        continue;
      }
      const shifts = dayShifts(emp.shifts?.[dow]);
      const wins = normalizeWindows(sh[dow]);
      let hours = 0;
      let tipHrs = 0;
      for (const s of shifts) {
        hours += hoursFromShift(s);
        tipHrs += intersectWindows(s, wins);
      }
      const cost = isSal ? dailyFixed : hours * rate;
      totalHours += hours;
      tipEligibleHours += tipHrs;
      dayHours[dow]! += hours;
      dayCost[dow]! += cost;
      daily.push({ shifts, hours, tipHrs, cost });
    }
    if (group === "cuisine") hrsK += tipEligibleHours;
    else hrsS += tipEligibleHours;
    return { emp, rate, isSal, fixedHours, group, daily, totalHours, tipEligibleHours, grossWage: isSal ? weekly : totalHours * rate } as const;
  });
  const poolK = totalTips * num(shares.cuisine);
  const poolS = totalTips * num(shares.service);
  const rows: SimRow[] = calc.map((r) => {
    const pool = r.group === "cuisine" ? poolK : poolS;
    const tot = r.group === "cuisine" ? hrsK : hrsS;
    const tipShare = tot > 0 && r.tipEligibleHours > 0 ? (r.tipEligibleHours / tot) * pool : 0;
    return { ...r, tipShare, totalPay: r.grossWage + tipShare };
  });
  const sum = (f: (r: SimRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  return {
    rows,
    totals: { hours: sum((r) => r.totalHours), gross: sum((r) => r.grossWage), tips: sum((r) => r.tipShare), total: sum((r) => r.totalPay) },
    pools: { cuisine: poolK, service: poolS },
    totalsHours: { cuisine: hrsK, service: hrsS },
    dayHours,
    dayCost,
  };
}
export type SimResult = ReturnType<typeof computeScenario>;

/** Écart simulation − réel, en valeur et en % (simGap v1). */
export function gap(sim: number, base: number) {
  const diff = num(sim) - num(base);
  const pct = base > 0 ? (diff / base) * 100 : sim > 0 ? 100 : 0;
  return { diff, pct };
}

/** Comparaison employé par employé : ordre de la simulation, puis les retirés. */
export function compareRows(base: SimRow[], sim: SimRow[]) {
  const b = new Map(base.map((r) => [r.emp.id, r]));
  const s = new Map(sim.map((r) => [r.emp.id, r]));
  const ids = [...sim.map((r) => r.emp.id), ...base.map((r) => r.emp.id).filter((id) => !s.has(id))];
  return ids.map((id) => ({ id, base: b.get(id) ?? null, sim: s.get(id) ?? null, name: s.get(id)?.emp.name || b.get(id)?.emp.name || "—" }));
}

/** Employés présents à l'heure H un jour de semaine (quarts coupés : compté une fois). */
export function simCoverageAt(emps: SimEmployee[], dow: number, hour: number, section: "all" | "cuisine" | "service" | "other") {
  let n = 0;
  for (const e of emps) {
    if (section !== "all" && (e.section ?? "service") !== section) continue;
    const present = dayShifts(e.shifts?.[dow]).some((s) => {
      const [a, am] = s.start.split(":").map(Number);
      const [b, bm] = s.end.split(":").map(Number);
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      const start = a! + (Number(am) || 0) / 60;
      let end = b! + (Number(bm) || 0) / 60;
      if (end <= start) end += 24;
      return (hour >= start && hour < end) || (hour + 24 >= start && hour + 24 < end);
    });
    if (present) n++;
  }
  return n;
}

export function simCoverageRange(emps: SimEmployee[], days: number[]): [number, number] {
  let min = 24;
  let max = 0;
  for (const e of emps)
    for (const d of days)
      for (const s of dayShifts(e.shifts?.[d])) {
        const a = Number(s.start.split(":")[0]);
        const [bh, bm] = s.end.split(":").map(Number);
        let b = bh! + (Number(bm) || 0) / 60;
        if (Number.isNaN(a) || Number.isNaN(b)) continue;
        if (b <= a) b += 24;
        min = Math.min(min, a);
        max = Math.max(max, Math.ceil(b));
      }
  return min >= max ? [6, 23] : [min, Math.min(max, 30)];
}

// ── Création et modifications (renvoient une nouvelle copie) ─────

/** Quarts datés de la semaine → quarts par jour 0..6 (shiftsByDateToByDow v1). */
export function shiftsByDow(shifts: Record<string, { start?: string; end?: string }> | undefined, monday: string) {
  const out: Record<string, SimShift> = {};
  for (let i = 0; i < 7; i++) {
    const s = shifts?.[addDays(monday, i)];
    if (s && (s.start || s.end)) out[i] = { start: s.start || "", end: s.end || "" };
  }
  return out;
}

/** Photo des employés actifs (taux d'aujourd'hui) pour une semaine. */
export function snapshotEmployees(emps: PaidEmployee[], monday: string): SimEmployee[] {
  return emps
    .filter((e) => !e.archived)
    .map((e) => ({ id: e.id, name: e.name || "", section: e.section || "service", hourlyRate: num(e.hourlyRate), isSalaried: !!e.isSalaried, fixedWeeklyHours: num(e.fixedWeeklyHours), role: e.role || "", isFictional: false, shifts: shiftsByDow(e.shifts, monday) }));
}

/** Heures de service copiées du réglage de paie (1 plage → objet, plusieurs → tableau). */
export function snapshotServiceHours(def: Record<string, unknown> | undefined) {
  const out: SimScenario["serviceHours"] = {};
  for (const k of Object.keys(def ?? {})) {
    const w = normalizeWindows(def![k]);
    if (w.length) out[Number(k)] = w.length === 1 ? w[0]! : w;
  }
  return out;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x ?? {})) as T;

const withEmp = (sc: SimScenario, id: string, fn: (e: SimEmployee) => SimEmployee): SimScenario => ({ ...sc, employees: (sc.employees ?? []).map((e) => (e.id === id ? fn(e) : e)) });

/** Écrit la liste des quarts d'un jour (jour vide → clé retirée), comme _writeSimEmpShifts. */
function writeDay(e: SimEmployee, dow: number, list: SimShift[]): SimEmployee {
  const shifts: Record<string, SimShift[]> = {};
  for (const k of Object.keys(e.shifts ?? {})) {
    const arr = dayShifts(e.shifts![k]);
    if (arr.length) shifts[k] = arr;
  }
  if (list.length) shifts[dow] = list;
  else delete shifts[dow];
  return { ...e, shifts };
}

export const setShift = (sc: SimScenario, empId: string, dow: number, idx: number, s: SimShift) =>
  withEmp(sc, empId, (e) => {
    const arr = dayShifts(e.shifts?.[dow]);
    if (idx >= 0 && idx < arr.length) arr[idx] = s;
    else arr.push(s);
    return writeDay(e, dow, arr);
  });

export const deleteShift = (sc: SimScenario, empId: string, dow: number, idx: number) =>
  withEmp(sc, empId, (e) => {
    const arr = dayShifts(e.shifts?.[dow]);
    arr.splice(idx, 1);
    return writeDay(e, dow, arr);
  });

/** Déplace un quart vers un autre jour du même employé (s'ajoute aux quarts du jour cible). */
export const moveShift = (sc: SimScenario, empId: string, from: number, idx: number, to: number, s: SimShift) => {
  if (from === to) return setShift(sc, empId, from, idx, s);
  return withEmp(sc, empId, (e) => {
    const src = dayShifts(e.shifts?.[from]);
    src.splice(idx, 1);
    const e2 = writeDay(e, from, src);
    return writeDay(e2, to, [...dayShifts(e2.shifts?.[to]), s]);
  });
};

export const updateEmp = (sc: SimScenario, empId: string, patch: Partial<SimEmployee>) => withEmp(sc, empId, (e) => ({ ...e, ...patch }));

export const moveEmp = (sc: SimScenario, empId: string, dir: -1 | 1): SimScenario => {
  const emps = [...(sc.employees ?? [])];
  const i = emps.findIndex((e) => e.id === empId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= emps.length) return sc;
  [emps[i], emps[j]] = [emps[j]!, emps[i]!];
  return { ...sc, employees: emps };
};

export const removeEmp = (sc: SimScenario, empId: string): SimScenario => ({ ...sc, employees: (sc.employees ?? []).filter((e) => e.id !== empId) });

export const addFictional = (sc: SimScenario, e: { name: string; section: string; hourlyRate: number }, id: string): SimScenario => ({
  ...sc,
  employees: [...(sc.employees ?? []), { id, name: e.name, section: e.section, hourlyRate: e.hourlyRate, isSalaried: false, fixedWeeklyHours: 0, role: "", isFictional: true, shifts: {} }],
});

/** Ouvre / ferme un jour ; fermer retire aussi ses heures de service. Null si c'était le dernier jour ouvert. */
export function toggleDay(sc: SimScenario, day: number, on: boolean): SimScenario | null {
  const cur = effectiveOpenDays(sc);
  if (on === cur.includes(day)) return sc;
  const next = on ? [...cur, day].sort((a, b) => a - b) : cur.filter((d) => d !== day);
  if (!next.length) return null;
  const out: SimScenario = { ...sc, openDays: next };
  if (!on && sc.serviceHours?.[day]) {
    const sh = { ...sc.serviceHours };
    delete sh[day];
    out.serviceHours = sh;
  }
  return out;
}

/** Nouvelles heures de service : un jour avec au moins une plage devient ouvert. */
export function withServiceHours(sc: SimScenario, draft: Record<number, { start: string; end: string }[]>): SimScenario {
  const sh: NonNullable<SimScenario["serviceHours"]> = {};
  const open = new Set(Array.isArray(sc.openDays) ? sc.openDays : ALL_DAYS);
  for (let d = 0; d < 7; d++) {
    const w = normalizeWindows(draft[d]);
    if (!w.length) continue;
    sh[d] = w.length === 1 ? w[0]! : w;
    open.add(d);
  }
  return { ...sc, serviceHours: sh, openDays: [...open].sort((a, b) => a - b) };
}

export const resetToBaseline = (sim: PayrollSimulation): SimScenario => clone(sim.baseline ?? {});
export const newScenarioCopy = clone;

const ts = (v: PayrollSimulation["updatedAt"]) => (typeof v === "number" ? v / 1000 : (v?.seconds ?? 0));
/** Plus récentes d'abord (modifiée, sinon créée). */
export const sortSims = (list: PayrollSimulation[]) => [...list].sort((a, b) => (ts(b.updatedAt) || ts(b.createdAt as PayrollSimulation["updatedAt"])) - (ts(a.updatedAt) || ts(a.createdAt as PayrollSimulation["updatedAt"])));
