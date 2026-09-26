/**
 * Parité v1 ↔ v2 : le calcul de la semaine de paie (heures, salaires,
 * pourboires jour par jour, bonus) donne exactement les mêmes montants que
 * _computePayrollWeekData de l'ancienne app, sur 150 semaines générées.
 * (Cas couverts : service coupé, quarts de nuit, dérogations de section,
 * salariés, hausses de taux en cours de semaine, jours sans pourboire.)
 */
import { describe, expect, it } from "vitest";
import { hasV1, loadV1Multi, rng } from "@/test/v1";
import { computePayroll } from "./paie.logic";
import type { PayrollPerson, PayrollSettings, PayrollWeekDoc } from "./paie.types";

const pad = (n: number) => String(n).padStart(2, "0");
const rand = rng(11);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;
const time = () => `${pad(Math.floor(rand() * 24))}:${pick(["00", "15", "30", "45", "07"])}`;
const MONDAY = "2026-09-21";
const ALL_DAYS = Array.from({ length: 7 }, (_, i) => `2026-09-${pad(21 + i)}`);

function scenario() {
  const openDays = [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.8);
  if (!openDays.length) openDays.push(4);
  const people: PayrollPerson[] = Array.from({ length: 3 + Math.floor(rand() * 6) }, (_, k) => {
    const sal = rand() < 0.15;
    return {
      id: `e${k}`,
      name: `E${k}`,
      section: pick(["cuisine", "service", "other", undefined]),
      shifts: Object.fromEntries(ALL_DAYS.filter(() => rand() < 0.5).map((d) => [d, { start: time(), end: time() }])),
      hourlyRate: pick([16.1, 17, 18.5, 22]),
      rateHistory: rand() < 0.3 ? [{ rate: 19.25, from: pick(ALL_DAYS) }] : [],
      isSalaried: sal,
      fixedWeeklyHours: sal ? pick([35, 40]) : 0,
      isManual: false,
    };
  });
  const actualShifts: PayrollWeekDoc["actualShifts"] = {};
  for (const p of people) actualShifts[p.id] = Object.fromEntries(ALL_DAYS.filter(() => rand() < 0.6).map((d) => [d, rand() < 0.1 ? { start: time() } : { start: time(), end: time() }]));
  const week: PayrollWeekDoc = {
    actualShifts,
    tipsByDay: Object.fromEntries(ALL_DAYS.filter(() => rand() < 0.8).map((d) => [d, Math.round(rand() * 60000) / 100])),
    netByDay: Object.fromEntries(ALL_DAYS.filter(() => rand() < 0.8).map((d) => [d, Math.round(rand() * 400000) / 100])),
    bonusByEmp: Object.fromEntries(people.filter(() => rand() < 0.2).map((p) => [p.id, pick([0, -5, 50, 125.5])])),
    sectionOverrides: Object.fromEntries(people.filter(() => rand() < 0.25).map((p) => [p.id, pick(["cuisine", "service", "excluded"])])),
  };
  const win = () => (rand() < 0.3 ? [{ start: "17:00", end: "22:00" }, { start: "11:30", end: "14:00" }] : { start: pick(["11:00", "16:00", "18:00"]), end: pick(["21:00", "23:30", "01:00"]) });
  const settings: PayrollSettings = {
    tipShares: rand() < 0.5 ? undefined : { cuisine: 0.3, service: 0.7 },
    defaultServiceHours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.85).map((i) => [String(i), win()])),
  };
  return { openDays, people, week, settings };
}

describe.skipIf(!hasV1)("parité avec la v1 — semaine de paie", () => {
  it("150 semaines : mêmes heures, salaires, pourboires et totaux", async () => {
    for (let n = 0; n < 150; n++) {
      const { openDays, people, week, settings } = scenario();
      const [y, m, d] = MONDAY.split("-").map(Number);
      const v1 = loadV1Multi<{ _computePayrollWeekData: (o: number) => Promise<any> }>(
        [
          ["pages-hr.js", ["dayKey", "getISOWeek", "parseTimeToFloat", "hoursFromShift", "normalizeRateHistory", "effectiveHourlyRate"]],
          ["utils.js", ["normalizeServiceWindows", "intersectShiftWindows"]],
          ["pages-payroll.js", ["intersectShiftHours", "getServiceWindows", "tipGroupOf", "_computePayrollWeekData"]],
        ],
        {
          getWeekStart: () => new Date(y!, m! - 1, d!),
          payrollWeekId: () => "W",
          employees: people,
          scheduleSettings: { openDays },
          payrollSettings: settings,
          payrollWeekOffset: 0,
          payrollWeekData: week,
          _payrollSubscribedWid: "W",
          db: null,
          todayKey: () => "2026-09-25",
        },
      );
      const ref = await v1._computePayrollWeekData(0);
      const days = openDays.map((i) => ALL_DAYS[i]!);
      const res = computePayroll({ people, week, settings, monday: MONDAY, days, dows: openDays, targetRatio: 0.32 });

      expect(res.totalTips).toBeCloseTo(ref.totalTips, 9);
      expect(res.totalNet).toBeCloseTo(ref.totalNet, 9);
      expect(res.poolK).toBeCloseTo(ref.poolCuisine, 9);
      expect(res.poolS).toBeCloseTo(ref.poolService, 9);
      for (const k of ["gross", "tips", "bonus", "total", "hours"] as const) expect(res.sums[k]).toBeCloseTo(ref.sums[k], 9);
      expect(res.tipPctSales).toBeCloseTo(ref.tipPctSales, 12);
      expect(res.rows.length).toBe(ref.empRows.length);
      ref.empRows.forEach((r: any, i: number) => {
        const v2 = res.rows[i]!;
        expect(v2.emp.id).toBe(r.emp.id);
        expect(v2.group).toBe(r.group);
        expect(v2.rate).toBe(r.rate);
        expect(v2.totalHours).toBeCloseTo(r.totalHours, 9);
        expect(v2.plannedHours).toBeCloseTo(r.plannedHours, 9);
        expect(v2.tipEligibleHours).toBeCloseTo(r.tipEligibleHours, 9);
        expect(v2.tipShare).toBeCloseTo(r.tipShare, 9);
        expect(v2.grossWage).toBeCloseTo(r.grossWage, 9);
        expect(v2.bonus).toBe(r.bonus);
        r.daily.forEach((dd: any, k: number) => expect(v2.daily[k]!.dayTip).toBeCloseTo(dd.dayTip, 9));
      });
    }
  });
});
