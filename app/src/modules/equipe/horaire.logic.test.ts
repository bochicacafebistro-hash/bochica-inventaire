import { describe, expect, it } from "vitest";
import { copyWeekPlan, coverageAt, dayRange, effectiveRate, hoursFromShift, mergeComp, moveInOrder, nextRateHistory, normalizeRateHistory, pinError, predictedSales, weekRows } from "./horaire.logic";
import type { PaidEmployee } from "./equipe.types";

const paid = (p: Partial<PaidEmployee> & { id: string }): PaidEmployee => ({ hourlyRate: 0, rateHistory: [], isSalaried: false, fixedWeeklyHours: 0, ...p });

describe("heures", () => {
  it("quart simple, demi-heure, passage minuit", () => {
    expect(hoursFromShift({ start: "10:00", end: "16:30" })).toBe(6.5);
    expect(hoursFromShift({ start: "20:00", end: "02:00" })).toBe(6);
    expect(hoursFromShift({ start: "10:00" })).toBe(0);
  });
});

describe("taux datés", () => {
  const hist = [
    { rate: 17, from: "2000-01-01" },
    { rate: 18, from: "2026-06-23" },
  ];
  it("taux selon la date", () => {
    expect(effectiveRate({ rateHistory: hist }, "2026-06-22")).toBe(17);
    expect(effectiveRate({ rateHistory: hist }, "2026-06-23")).toBe(18);
    expect(effectiveRate({ rateHistory: [{ rate: 20, from: "2026-10-01" }] }, "2026-09-01")).toBe(20); // avant le 1er palier
    expect(effectiveRate({ hourlyRate: 16 }, "2026-01-01")).toBe(16);
  });
  it("normalisation", () => {
    expect(normalizeRateHistory([{ rate: 18, from: "2026-02-01" }, { rate: 17, from: "2026-01-01" }, { rate: 17, from: "2026-01-15" }, { rate: 19, from: "2026-02-01" }, { from: "" }])).toEqual([
      { rate: 17, from: "2026-01-01" },
      { rate: 19, from: "2026-02-01" },
    ]);
  });
  it("nouveau taux : l'ancien est scellé", () => {
    expect(nextRateHistory({ hourlyRate: 16 }, false, 18, "2026-10-01")).toEqual([
      { rate: 16, from: "2000-01-01" },
      { rate: 18, from: "2026-10-01" },
    ]);
    expect(nextRateHistory(undefined, true, 18, "2026-09-25")).toEqual([{ rate: 18, from: "2026-09-25" }]);
    // même taux → pas de palier en double
    expect(nextRateHistory({ rateHistory: [{ rate: 18, from: "2026-01-01" }] }, false, 18, "2026-09-25")).toEqual([{ rate: 18, from: "2026-01-01" }]);
  });
  it("fusion de la rémunération", () => {
    const m = mergeComp([{ id: "a" }, { id: "b" }], [{ id: "a", rateHistory: hist, isSalaried: true, fixedWeeklyHours: 35 }], "2026-09-25");
    expect(m[0]).toMatchObject({ hourlyRate: 18, isSalaried: true, fixedWeeklyHours: 35 });
    expect(m[1]).toMatchObject({ hourlyRate: 0, isSalaried: false });
  });
});

describe("coûts de la semaine", () => {
  const days = ["2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"];
  it("horaire × taux du jour, salarié réparti sur les jours ouverts", () => {
    const h = paid({ id: "h", rateHistory: [{ rate: 17, from: "2000-01-01" }, { rate: 18, from: "2026-09-25" }], shifts: { "2026-09-24": { start: "10:00", end: "16:00" }, "2026-09-25": { start: "10:00", end: "16:00" } } });
    const s = paid({ id: "s", hourlyRate: 23, isSalaried: true, fixedWeeklyHours: 35, shifts: { "2026-09-23": { start: "10:00", end: "12:00" } } });
    const w = weekRows([h, s], days);
    expect(w.rows[0]!.totalPay).toBe(6 * 17 + 6 * 18);
    expect(w.rows[0]!.totalHours).toBe(12);
    expect(w.rows[1]!.totalPay).toBe(805);
    expect(w.rows[1]!.daily[4]!.cost).toBe(161); // coût fixe même sans quart
    expect(w.dayCost[1]).toBe(102 + 161);
    expect(w.totalCost).toBeCloseTo(210 + 805);
    expect(predictedSales(320, 0.32)).toBe(1000);
  });
});

describe("couverture", () => {
  it("présence par heure", () => {
    const e = [
      { id: "a", section: "cuisine", shifts: { d: { start: "10:00", end: "15:00" } } },
      { id: "b", shifts: { d: { start: "14:30", end: "01:00" } } },
    ];
    expect(coverageAt(e, "d", 14, "all")).toBe(1);
    expect(coverageAt(e, "d", 15, "all")).toBe(1);
    expect(coverageAt(e, "d", 14, "cuisine")).toBe(1);
    expect(coverageAt(e, "d", 0, "service")).toBe(1); // après minuit
  });
});

describe("copie de semaine", () => {
  it("copie, efface la cible vide, respecte les congés", () => {
    const e = [
      {
        id: "a",
        shifts: { s1: { start: "10:00", end: "16:00" }, t2: { start: "09:00", end: "12:00" }, t3: { start: "1", end: "2" } },
        timeOff: { t3: { type: "vacances" } },
      },
    ];
    const plan = copyWeekPlan(e, ["s1", "s2", "s3"], ["t1", "t2", "t3"], []);
    expect(plan).toEqual([{ empId: "a", changes: { t1: { start: "10:00", end: "16:00" }, t2: null, t3: null } }]);
  });
});

describe("divers", () => {
  it("plage de dates", () => {
    expect(dayRange("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(dayRange("2026-10-02", "2026-09-29")).toEqual([]);
  });
  it("NIP", () => {
    const l = [{ id: "a", name: "Ana", pin: "1234" }];
    expect(pinError("12a4", l)).toMatch(/4 chiffres/);
    expect(pinError("1234", l, "b")).toMatch(/Ana/);
    expect(pinError("1234", l, "a")).toBeNull();
    expect(pinError("", l)).toBeNull();
  });
  it("monter / descendre", () => {
    expect(moveInOrder(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveInOrder(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
  });
});
