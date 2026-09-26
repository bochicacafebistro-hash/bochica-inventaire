import { describe, expect, it } from "vitest";
import { autoFillCandidates, computePayroll, detectAlerts, effectiveGroup, entryCount, intersectHours, lockAmount, normalizeWindows, payrollPeople, windowsLabel } from "./paie.logic";
import type { PayrollPerson, PayrollWeekDoc } from "./paie.types";

const MON = "2026-09-21";
const DAYS = ["2026-09-21", "2026-09-22"];
const person = (id: string, over: Partial<PayrollPerson> = {}): PayrollPerson => ({ id, name: id, section: "service", shifts: {}, hourlyRate: 20, rateHistory: [], isSalaried: false, fixedWeeklyHours: 0, isManual: false, ...over });
const calc = (people: PayrollPerson[], week: PayrollWeekDoc, dows = [0, 1]) =>
  computePayroll({ people, week, settings: { defaultServiceHours: { "0": { start: "17:00", end: "22:00" }, "1": [{ start: "17:00", end: "22:00" }, { start: "11:00", end: "14:00" }] } }, monday: MON, days: DAYS, dows, targetRatio: 0.32 });

describe("heures de service", () => {
  it("normalise et trie plusieurs plages", () => {
    expect(normalizeWindows([{ start: "17:00", end: "22:00" }, { start: "11:00", end: "14:00" }, { start: "", end: "x" }])).toEqual([
      { start: "11:00", end: "14:00" },
      { start: "17:00", end: "22:00" },
    ]);
    expect(windowsLabel(null)).toBe("—");
    expect(windowsLabel({ start: "17:00", end: "22:00" })).toBe("17:00–22:00");
  });
  it("intersection, y compris après minuit", () => {
    expect(intersectHours({ start: "15:00", end: "20:00" }, { start: "17:00", end: "22:00" })).toBe(3);
    expect(intersectHours({ start: "20:00", end: "02:00" }, { start: "18:00", end: "01:00" })).toBe(5);
    expect(intersectHours({ start: "08:00" }, { start: "07:00", end: "22:00" })).toBe(0);
  });
});

describe("groupe de pourboires", () => {
  it("dérogation > sans pourboire > section", () => {
    expect(effectiveGroup({ id: "a", section: "cuisine" }, {})).toBe("cuisine");
    expect(effectiveGroup({ id: "a", section: "other" }, {})).toBe("service");
    expect(effectiveGroup({ id: "a", section: "cuisine", noTips: true }, {})).toBe("excluded");
    expect(effectiveGroup({ id: "a", noTips: true }, { a: "service" })).toBe("service");
  });
});

describe("computePayroll", () => {
  it("partage les pourboires au prorata des heures de service, jour par jour", () => {
    const week: PayrollWeekDoc = {
      tipsByDay: { [DAYS[0]!]: 100 },
      actualShifts: { k: { [DAYS[0]!]: { start: "16:00", end: "22:00" } }, s1: { [DAYS[0]!]: { start: "17:00", end: "22:00" } }, s2: { [DAYS[0]!]: { start: "20:00", end: "22:00" } } },
    };
    const r = calc([person("k", { section: "cuisine" }), person("s1"), person("s2")], week);
    const tip = (id: string) => r.rows.find((x) => x.emp.id === id)!.tipShare;
    expect(tip("k")).toBeCloseTo(25);
    expect(tip("s1")).toBeCloseTo((5 / 7) * 75);
    expect(tip("s2")).toBeCloseTo((2 / 7) * 75);
    expect(r.rows[0]!.grossWage).toBe(120);
  });
  it("salarié : heures fixes × taux, réparties sur les jours ouverts", () => {
    const r = calc([person("m", { isSalaried: true, fixedWeeklyHours: 40, hourlyRate: 25 })], {});
    expect(r.sums.gross).toBe(1000);
    expect(r.laborByDay[DAYS[0]!]).toBe(500);
    expect(r.estimatedWage).toBe(1000);
  });
  it("bonus négatif ignoré ; montant de verrouillage = salaires + bonus", () => {
    const r = calc([person("a"), person("b")], { bonusByEmp: { a: 50, b: -10 }, actualShifts: { a: { [DAYS[0]!]: { start: "10:00", end: "12:00" } } } });
    expect(r.sums.bonus).toBe(50);
    expect(lockAmount(r)).toBe(90);
  });
  it("ratio et rentabilité", () => {
    const r = calc([person("a")], { netByDay: { [DAYS[0]!]: 500 }, actualShifts: { a: { [DAYS[0]!]: { start: "10:00", end: "18:00" } } } });
    expect(r.salesRatio).toBeCloseTo(160 / 500);
    expect(r.ratioLevel).toBe("good");
    expect(r.dayProfit[0]!.salesNeeded).toBeCloseTo(500);
    expect(r.dayProfit[0]!.pctReached).toBeCloseTo(100);
    expect(r.dayProfit[1]!.hasNet).toBe(false);
  });
});

describe("liste des employés de la semaine", () => {
  const emps = [
    { id: "s", section: "service" },
    { id: "k", section: "cuisine" },
    { id: "old", archived: true },
    { id: "old2", archived: true },
    { id: "h" },
  ];
  it("retire masqués et archivés sans heures, ajoute les extras, ordre partagé", () => {
    const week: PayrollWeekDoc = { hiddenEmps: ["h"], actualShifts: { old2: { [DAYS[0]!]: { start: "10:00" } } }, manualEmployees: [{ id: "x", name: "Extra", hourlyRate: 18 }] };
    expect(payrollPeople(emps, [], week, {}, MON, MON).map((p) => p.id)).toEqual(["k", "s", "old2", "x"]);
    expect(payrollPeople(emps, [], week, { weekOrder: { [MON]: ["x", "s"] } }, MON, MON).map((p) => p.id)).toEqual(["x", "s", "k", "old2"]);
    expect(payrollPeople(emps, [], { ...week, empOrder: ["old2"] }, {}, MON, MON)[0]!.id).toBe("old2");
  });
});

describe("alertes et remplissage automatique", () => {
  const none = () => false;
  const week: PayrollWeekDoc = {
    actualShifts: {
      a: { [DAYS[0]!]: { start: "10:00" }, [DAYS[1]!]: { start: "06:00", end: "22:00" } },
      b: { [DAYS[0]!]: { start: "10:00", end: "18:00", autoFilled: true } },
    },
  };
  const people = [person("a", { shifts: { [DAYS[0]!]: { start: "10:00", end: "16:00" } } }), person("b"), person("c", { shifts: { [DAYS[0]!]: { start: "22:00", end: "02:00" }, [DAYS[1]!]: { start: "09:00", end: "12:00" } } })];
  const r = calc(people, week);
  it("détecte les 4 types", () => {
    const types = detectAlerts(r.rows, false, "2026-09-23", none).map((a) => `${a.empId}:${a.type}`);
    expect(types).toEqual(["a:missing-exit", "a:long-shift", "b:auto-filled", "c:not-punched", "c:not-punched"]);
    expect(detectAlerts(r.rows, true, "2026-09-23", none)).toEqual([]);
    expect(detectAlerts(r.rows, false, "2026-09-23", (e) => e === "c").map((a) => a.empId)).not.toContain("c");
  });
  it("remplit 1 h après la fin prévue (quart de nuit = lendemain)", () => {
    const at = (s: string) => new Date(s).getTime();
    expect(autoFillCandidates(r.rows, false, at("2026-09-21T16:59:00"), none)).toEqual([]);
    expect(autoFillCandidates(r.rows, false, at("2026-09-21T17:00:00"), none)).toEqual([{ empId: "a", dk: DAYS[0], start: "10:00", end: "16:00", noStart: false }]);
    const later = autoFillCandidates(r.rows, false, at("2026-09-22T13:00:00"), none);
    expect(later.map((c) => `${c.empId}:${c.dk}:${c.noStart}`)).toEqual(["a:2026-09-21:false", "c:2026-09-21:true", "c:2026-09-22:true"]);
    expect(autoFillCandidates(r.rows, false, at("2026-09-22T02:59:00"), none).map((c) => c.empId)).toEqual(["a"]);
  });
  it("compte les saisies à effacer", () => {
    expect(entryCount({ ...week, tipsByDay: { x: 1 } })).toEqual({ shifts: 3, tips: 1, net: 0 });
  });
});
