import { describe, expect, it } from "vitest";
import { addFictional, compareRows, computeScenario, deleteShift, effectiveOpenDays, gap, moveEmp, moveShift, setShift, shiftsByDow, snapshotEmployees, toggleDay, withServiceHours } from "./sim.logic";
import type { SimScenario } from "./sim.types";

const sc: SimScenario = {
  employees: [
    { id: "k", section: "cuisine", hourlyRate: 20, shifts: { 0: { start: "16:00", end: "22:00" } } },
    { id: "s", section: "service", hourlyRate: 16, shifts: { 0: [{ start: "11:00", end: "14:00" }, { start: "17:00", end: "22:00" }] } },
    { id: "m", section: "other", hourlyRate: 25, isSalaried: true, fixedWeeklyHours: 40, shifts: {} },
  ],
  serviceHours: { 0: [{ start: "11:30", end: "14:00" }, { start: "17:00", end: "22:00" }] },
  totalTips: 400,
  openDays: [0, 1, 2, 3],
};

describe("computeScenario", () => {
  it("salaires, quart coupé, pourboires et salarié réparti sur les jours ouverts", () => {
    const r = computeScenario(sc);
    const row = (id: string) => r.rows.find((x) => x.emp.id === id)!;
    expect(row("k").grossWage).toBe(120);
    expect(row("s").totalHours).toBe(8);
    expect(row("s").tipEligibleHours).toBe(7.5);
    expect(row("k").tipShare).toBe(100); // pool cuisine 25 %, seul en cuisine
    expect(row("s").tipShare).toBe(300);
    expect(row("m").grossWage).toBe(1000);
    expect(r.dayCost[0]).toBe(120 + 128 + 250);
    expect(r.rows[0]!.daily[5]).toBeNull();
  });
  it("jours ouverts = cochés + jours avec heures de service", () => {
    expect(effectiveOpenDays({ openDays: [1], serviceHours: { 5: { start: "17:00", end: "22:00" } } })).toEqual([1, 5]);
    expect(effectiveOpenDays({})).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
  it("écart", () => {
    expect(gap(110, 100)).toEqual({ diff: 10, pct: 10 });
    expect(gap(5, 0).pct).toBe(100);
  });
});

describe("modifications", () => {
  it("ajouter, modifier, supprimer, déplacer un quart", () => {
    let s = setShift(sc, "k", 1, -1, { start: "10:00", end: "14:00" });
    expect(s.employees![0]!.shifts![1]).toEqual([{ start: "10:00", end: "14:00" }]);
    s = setShift(s, "s", 0, 1, { start: "18:00", end: "22:00" });
    expect(s.employees![1]!.shifts![0]).toEqual([{ start: "11:00", end: "14:00" }, { start: "18:00", end: "22:00" }]);
    s = moveShift(s, "s", 0, 0, 2, { start: "11:00", end: "14:00" });
    expect(s.employees![1]!.shifts![0]).toEqual([{ start: "18:00", end: "22:00" }]);
    expect(s.employees![1]!.shifts![2]).toEqual([{ start: "11:00", end: "14:00" }]);
    s = deleteShift(s, "k", 1, 0);
    expect(s.employees![0]!.shifts![1]).toBeUndefined();
    expect(sc.employees![0]!.shifts![1]).toBeUndefined(); // original intact
  });
  it("employés : ordre, fictif, comparaison", () => {
    const s = addFictional(moveEmp(sc, "s", -1), { name: "Nouvelle", section: "service", hourlyRate: 17 }, "sim_1");
    expect(s.employees!.map((e) => e.id)).toEqual(["s", "k", "m", "sim_1"]);
    const cmp = compareRows(computeScenario(sc).rows, computeScenario({ ...s, employees: s.employees!.filter((e) => e.id !== "m") }).rows);
    expect(cmp.map((c) => [c.id, !!c.base, !!c.sim])).toEqual([["s", true, true], ["k", true, true], ["sim_1", false, true], ["m", true, false]]);
  });
  it("jours et heures de service", () => {
    expect(toggleDay({ openDays: [0] }, 0, false)).toBeNull();
    const t = toggleDay(sc, 0, false)!;
    expect(t.openDays).toEqual([1, 2, 3]);
    expect(t.serviceHours![0]).toBeUndefined();
    const w = withServiceHours({ openDays: [0] }, { 4: [{ start: "17:00", end: "22:00" }], 5: [] });
    expect(w).toEqual({ openDays: [0, 4], serviceHours: { 4: { start: "17:00", end: "22:00" } } });
  });
  it("photo de la semaine", () => {
    expect(shiftsByDow({ "2026-09-22": { start: "10:00", end: "16:00" }, "2026-09-30": { start: "1", end: "2" } }, "2026-09-21")).toEqual({ 1: { start: "10:00", end: "16:00" } });
    const snap = snapshotEmployees([{ id: "a", name: "A", hourlyRate: 17, rateHistory: [], isSalaried: false, fixedWeeklyHours: 0 }, { id: "b", archived: true, hourlyRate: 1, rateHistory: [], isSalaried: false, fixedWeeklyHours: 0 }], "2026-09-21");
    expect(snap).toEqual([{ id: "a", name: "A", section: "service", hourlyRate: 17, isSalaried: false, fixedWeeklyHours: 0, role: "", isFictional: false, shifts: {} }]);
  });
});
