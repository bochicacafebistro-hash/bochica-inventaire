import { describe, expect, it } from "vitest";
import { autoApproves, findByPin, isoWeek, leaveRequestDoc, partialFor, timeOffFor, visibleEmployees, weekDays, weekStart } from "./equipe.logic";
import type { Employee, LeaveRequest } from "./equipe.types";

const T = "2026-09-25"; // vendredi

describe("semaines", () => {
  it("lundi de la semaine", () => {
    expect(weekStart(T)).toBe("2026-09-21");
    expect(weekStart("2026-09-27")).toBe("2026-09-21"); // dimanche
    expect(weekStart(T, 1)).toBe("2026-09-28");
    expect(weekStart(T, -1)).toBe("2026-09-14");
  });
  it("numéro ISO", () => {
    expect(isoWeek("2026-09-24")).toBe(39);
    expect(isoWeek("2027-01-01")).toBe(53);
  });
  it("employés visibles et ordre", () => {
    const days = weekDays("2026-09-21");
    const list: Employee[] = [
      { id: "a", name: "Ana", section: "service" },
      { id: "b", name: "Beto", section: "cuisine" },
      { id: "c", name: "Caro", archived: true },
      { id: "d", name: "Dani", archived: true, shifts: { "2026-09-22": { start: "10:00", end: "15:00" } } },
      { id: "e", name: "Eva", section: "service" },
    ];
    const r = visibleEmployees(list, days, { weekOrder: { "2026-09-21": ["e"] }, weekHidden: { "2026-09-21": ["a"] } });
    expect(r.map((e) => e.id)).toEqual(["e", "b", "d"]);
  });
});

describe("congés", () => {
  it("règle des 2 semaines", () => {
    expect(autoApproves(["2026-10-10"], T)).toBe(true); // 15 jours
    expect(autoApproves(["2026-10-09"], T)).toBe(false); // 14 jours
    expect(autoApproves(["2026-12-01", "2026-10-01"], T)).toBe(false);
    expect(autoApproves([], T)).toBe(false);
  });
  it("document créé", () => {
    const doc = leaveRequestDoc({ id: "e1", name: "Ana" }, { type: "vacances", kind: "full", days: ["2026-12-02", "2026-12-01"], partialMode: "late", partialTime: "", reason: " voyage " }, T, 1000);
    expect(doc).toEqual({ empId: "e1", empName: "Ana", type: "vacances", kind: "full", dates: ["2026-12-01", "2026-12-02"], partial: null, status: "approved", autoApproved: true, reason: "voyage", requestedAt: 1000, decidedAt: 1000, decidedBy: "auto" });
    const p = leaveRequestDoc({ id: "e1" }, { type: "personnel", kind: "partial", days: ["2026-09-30"], partialMode: "early", partialTime: "18:00", reason: "" }, T, 5);
    expect(p).toMatchObject({ status: "pending", autoApproved: false, partial: { dk: "2026-09-30", mode: "early", time: "18:00" }, decidedBy: null });
  });
  it("congés approuvés dans l'horaire", () => {
    const reqs: LeaveRequest[] = [
      { id: "1", empId: "e1", status: "approved", kind: "full", dates: ["2026-09-26"], type: "maladie" },
      { id: "2", empId: "e1", status: "pending", kind: "full", dates: ["2026-09-27"] },
      { id: "3", empId: "e1", status: "approved", kind: "partial", partial: { dk: "2026-09-28", mode: "late", time: "12:00" } },
    ];
    const emp: Employee = { id: "e1", timeOff: { "2026-09-29": { type: "vacances" } } };
    expect(timeOffFor(emp, "2026-09-26", reqs)?.type).toBe("maladie");
    expect(timeOffFor(emp, "2026-09-27", reqs)).toBeNull();
    expect(timeOffFor(emp, "2026-09-29", reqs)?.type).toBe("vacances");
    expect(timeOffFor(emp, "2026-09-28", reqs)).toBeNull();
    expect(partialFor("e1", "2026-09-28", reqs)?.time).toBe("12:00");
  });
  it("NIP", () => {
    const l: Employee[] = [{ id: "x", pin: "1234", archived: true }, { id: "y", pin: 1234 }];
    expect(findByPin(l, "1234")?.id).toBe("y");
    expect(findByPin(l, "0000")).toBeNull();
  });
});
