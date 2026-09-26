import { describe, expect, it } from "vitest";
import { avgMenuMargin, criticalStock, dayTag, eventsBetween, monthSummary, overdueTasks, pctChange, pendingLeaves, shiftsToday, spark30, taxUrgency, topExpenses } from "./dashboard.logic";

describe("tableau de bord", () => {
  it("variation en %", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(-50, -100)).toBe(50);
    expect(pctChange(10, 0)).toBe(100);
    expect(pctChange(0, 0)).toBe(0);
  });
  it("mois en cours vs précédent (revenus datés au début de période)", () => {
    const now = new Date(2026, 8, 25);
    const s = monthSummary(
      [{ id: "a", amount: 1000, dateStart: "2026-09-02" }, { id: "b", amount: 500, date: "2026-08-30" }],
      [{ id: "x", amount: 300, date: "2026-09-10" }, { id: "y", amount: 900, date: "2026-10-01" }],
      now,
    );
    expect(s.cur).toMatchObject({ revenue: 1000, expenses: 300, profit: 700 });
    expect(s.prev.revenue).toBe(500);
    expect(s.revChange).toBe(100);
  });
  it("30 derniers jours, dates locales", () => {
    const s = spark30([{ amount: 10, date: "2026-09-25" }, { amount: 5, date: "2026-08-27" }, { amount: 7, date: "2026-08-26" }, { amount: 1, date: "2026-09-26" }], "2026-09-25");
    expect(s[29]).toBe(10);
    expect(s[0]).toBe(5);
    expect(s.reduce((a, b) => a + b)).toBe(15);
  });
  it("listes", () => {
    expect(criticalStock([{ id: "a", currentStock: 5, minimum: 10 }, { id: "b", currentStock: 1, minimum: 2 }, { id: "c", currentStock: 50, minimum: 10 }, { id: "d", archived: true, currentStock: 0, minimum: 5 }]).map((p) => p.id)).toEqual(["b", "a"]);
    expect(overdueTasks([{ id: "1", dueDate: "2026-09-20" }, { id: "2", dueDate: "2026-09-01", status: "Complété" }, { id: "3", dueDate: "2026-09-10" }, { id: "4", dueDate: "2026-09-25" }], "2026-09-25").map((t) => t.id)).toEqual(["3", "1"]);
    expect(topExpenses([{ id: "a", amount: 5, date: "2026-09-01" }, { id: "b", amount: 50, date: "2026-09-02" }, { id: "c", amount: 500, date: "2026-08-02" }], "2026-09-01", "2026-09-30").map((e) => e.id)).toEqual(["b", "a"]);
    expect(eventsBetween([{ id: "a", date: "2026-09-26", time: "18:00" }, { id: "b", date: "2026-09-26" }, { id: "c", date: "2026-09-26", time: "11:00" }, { id: "d", date: "2026-09-27", status: "annule" }] as never, "2026-09-25", "2026-10-01").map((e) => e.id)).toEqual(["c", "a", "b"]);
  });
  it("marge moyenne du menu", () => {
    const r = avgMenuMargin([{ id: "m", price: 10, recipe: [{ ingredientId: "i", qty: 2 }] }, { id: "n", price: 0, recipe: [{ ingredientId: "i", qty: 1 }] }, { id: "o", price: 5 }], [{ id: "i", costPerUnit: 1.5 }]);
    expect(r).toEqual({ count: 1, pct: 70 });
  });
  it("équipe du jour, congés, jours, échéance", () => {
    const s = shiftsToday([{ id: "a", name: "A", section: "service", shifts: { d: { start: "16:00", end: "22:00" } } }, { id: "b", name: "B", section: "cuisine", shifts: { d: { start: "10:00" } } }, { id: "c", archived: true, shifts: { d: { start: "09:00" } } }], "d");
    expect(s.count).toBe(2);
    expect(s.groups.map((g) => g.key)).toEqual(["cuisine", "service"]);
    expect(pendingLeaves([{ id: "1", status: "pending", empName: "Ana" }, { id: "2", status: "pending", empName: "Ana" }, { id: "3", status: "approved", empName: "Beto" }])).toEqual({ count: 2, names: "Ana" });
    expect([dayTag("2026-09-25", "2026-09-25"), dayTag("2026-09-26", "2026-09-25"), dayTag("2026-09-28", "2026-09-25")]).toEqual(["Auj.", "Demain", "Lun 28"]);
    expect([taxUrgency(-1), taxUrgency(15), taxUrgency(16)]).toEqual(["late", "soon", "ok"]);
  });
});
