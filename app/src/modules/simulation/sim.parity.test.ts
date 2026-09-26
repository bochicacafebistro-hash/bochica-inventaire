/**
 * Parité v1 ↔ v2 : la simulation paie (heures, salaires, pourboires, coûts
 * par jour, jours ouverts, couverture) donne les mêmes résultats que
 * js/pages-simulations.js sur 200 scénarios générés.
 */
import { describe, expect, it } from "vitest";
import { hasV1, loadV1Multi, rng } from "@/test/v1";
import { computeScenario, effectiveOpenDays, simCoverageAt } from "./sim.logic";
import type { SimScenario } from "./sim.types";

const pad = (n: number) => String(n).padStart(2, "0");
const rand = rng(23);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)]!;
const time = () => `${pad(Math.floor(rand() * 24))}:${pick(["00", "15", "30", "45"])}`;

function scenario(): SimScenario {
  const shift = () => ({ start: time(), end: time() });
  return {
    employees: Array.from({ length: 2 + Math.floor(rand() * 7) }, (_, k) => {
      const sal = rand() < 0.15;
      return {
        id: `e${k}`,
        name: `E${k}`,
        section: pick(["cuisine", "service", "other", undefined]),
        hourlyRate: pick([16.1, 17.5, 20, 0]),
        isSalaried: sal,
        fixedWeeklyHours: sal ? pick([35, 40]) : 0,
        shifts: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.55).map((d) => [d, rand() < 0.25 ? [shift(), shift()] : shift()])),
      };
    }),
    serviceHours: Object.fromEntries([0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.6).map((d) => [d, rand() < 0.3 ? [{ start: "11:30", end: "14:00" }, { start: "17:00", end: "22:00" }] : { start: pick(["16:00", "17:00"]), end: pick(["22:00", "01:00"]) }])),
    tipShares: rand() < 0.5 ? undefined : { cuisine: 0.3, service: 0.7 },
    totalTips: rand() < 0.2 ? 0 : Math.round(rand() * 300000) / 100,
    openDays: rand() < 0.2 ? undefined : [0, 1, 2, 3, 4, 5, 6].filter(() => rand() < 0.7),
  };
}

describe.skipIf(!hasV1)("parité avec la v1 — simulation paie", () => {
  const v1 = loadV1Multi<{
    computeSimScenario: (s: unknown) => any;
    simEffectiveOpenDays: (s: unknown) => number[];
    countSimCoverageAtHour: (e: unknown[], d: number, h: number, s: string) => number;
  }>([
    ["pages-hr.js", ["parseTimeToFloat", "hoursFromShift"]],
    ["utils.js", ["normalizeServiceWindows", "intersectShiftWindows"]],
    ["pages-payroll.js", ["intersectShiftHours"]],
    ["pages-simulations.js", ["simTipGroupOf", "simDayShifts", "simEffectiveOpenDays", "computeSimScenario", "countSimCoverageAtHour"]],
  ]);

  it("200 scénarios : mêmes montants, jours et couverture", () => {
    for (let n = 0; n < 200; n++) {
      const sc = scenario();
      const ref = v1.computeSimScenario(sc);
      const res = computeScenario(sc);
      expect(effectiveOpenDays(sc)).toEqual(v1.simEffectiveOpenDays(sc));
      for (const k of ["hours", "gross", "tips", "total"] as const) expect(res.totals[k]).toBeCloseTo(ref.totals[k], 9);
      expect(res.pools.cuisine).toBeCloseTo(ref.pools.cuisine, 9);
      expect(res.totalsHours.service).toBeCloseTo(ref.totalsHours.service, 9);
      res.dayCost.forEach((c, i) => expect(c).toBeCloseTo(ref.dayTotalsCost[i], 9));
      res.dayHours.forEach((c, i) => expect(c).toBeCloseTo(ref.dayTotalsHours[i], 9));
      ref.rows.forEach((r: any, i: number) => {
        const v = res.rows[i]!;
        expect(v.tipShare).toBeCloseTo(r.tipShare, 9);
        expect(v.grossWage).toBeCloseTo(r.grossWage, 9);
        expect(v.daily.map((d) => (d ? d.shifts : null))).toEqual(r.daily.map((d: any) => (d ? d.shifts : null)));
      });
      for (const sec of ["all", "cuisine", "service", "other"] as const)
        for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h += 3) expect(simCoverageAt(sc.employees!, d, h, sec)).toBe(v1.countSimCoverageAtHour(sc.employees!, d, h, sec));
    }
  });
});
