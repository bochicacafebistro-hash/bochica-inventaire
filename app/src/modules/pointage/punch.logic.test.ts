import { describe, expect, it } from "vitest";
import { hasV1, loadV1 } from "@/test/v1";
import { addDays } from "@/core/dates";
import { closesOvernight, openOvernight, payrollWeekId, punchedShift, target } from "./punch.logic";

describe("pointage", () => {
  it("identifiant de semaine de paie", () => {
    expect(payrollWeekId("2026-09-21")).toBe("2026-W39");
    expect(payrollWeekId("2025-12-29")).toBe("2026-W01"); // le jeudi est en 2026
    expect(payrollWeekId("2026-12-28")).toBe("2026-W53");
  });
  it("la veille d'un lundi est dans la semaine précédente", () => {
    expect(target("2026-09-28")).toEqual({ weekId: "2026-W40", weekStart: "2026-09-28", dk: "2026-09-28" });
    expect(target("2026-09-27").weekId).toBe("2026-W39");
  });
  it("quart de nuit", () => {
    const y = { start: "22:00" };
    expect(closesOvernight("sortie", 0, undefined, y, "00:56")).toBe(true);
    expect(closesOvernight("sortie", 10, undefined, y, "10:05")).toBe(false); // trop tard
    expect(closesOvernight("sortie", 1, { start: "00:30" }, y, "01:00")).toBe(false); // entrée aujourd'hui
    expect(closesOvernight("sortie", 9, undefined, { start: "12:00" }, "09:30")).toBe(false); // 21,5 h : quart de jour oublié
    expect(closesOvernight("sortie", 2, undefined, { start: "22:00", end: "23:00" }, "02:00")).toBe(false);
    expect(closesOvernight("sortie", 2, undefined, { start: "22:00", markedAbsent: true }, "02:00")).toBe(false);
    expect(closesOvernight("entree", 2, undefined, y, "02:00")).toBe(false);
    expect(openOvernight(3, undefined, y)).toEqual(y);
    expect(openOvernight(11, undefined, y)).toBeNull();
  });
  it("pointer garde l'autre champ", () => {
    expect(punchedShift("start", "16:02")).toEqual({ start: "16:02" });
    expect(punchedShift("end", "22:10")).toEqual({ end: "22:10" }); // l'entrée déjà enregistrée n'est jamais réécrite
  });
});

describe.skipIf(!hasV1)("parité avec la v1 — semaine de paie", () => {
  it("payrollWeekId identique sur 3 ans", () => {
    const hr = loadV1<{ getISOWeek: (d: Date) => number }>("pages-hr.js", ["getISOWeek"]);
    const v1 = loadV1<{ payrollWeekId: (d: Date) => string }>("pages-payroll.js", ["payrollWeekId"], { getISOWeek: hr.getISOWeek });
    for (let d = "2025-01-06"; d < "2028-01-01"; d = addDays(d, 7)) {
      const [y, m, day] = d.split("-").map(Number);
      expect(payrollWeekId(d)).toBe(v1.payrollWeekId(new Date(y!, m! - 1, day!)));
    }
  });
});
