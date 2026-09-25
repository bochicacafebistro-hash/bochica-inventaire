import { describe, expect, it } from "vitest";
import { addDays, calendarGrid, longDate, monthBounds, relativeDate } from "./dates";

describe("dates locales", () => {
  it("jour relatif", () => {
    expect(relativeDate("2026-09-25", "2026-09-25")).toBe("Aujourd'hui");
    expect(relativeDate("2026-09-26", "2026-09-25")).toBe("Demain");
    expect(relativeDate("2026-09-28", "2026-09-25")).toBe("Dans 3 jours");
    expect(relativeDate("2026-09-23", "2026-09-25")).toBe("Il y a 2 jours");
    expect(relativeDate("2026-12-01", "2026-09-25")).toBe("1 déc. 2026");
  });
  it("date longue et ajout de jours (fin de mois, changement d'heure)", () => {
    expect(longDate("2026-05-11")).toBe("Lundi 11 mai 2026");
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
  });
  it("grille : commence un lundi, 42 jours", () => {
    const g = calendarGrid(2026, 8); // septembre 2026 : le 1er est un mardi
    expect(g).toHaveLength(42);
    expect(g[0]).toBe("2026-08-31");
    expect(g[1]).toBe("2026-09-01");
  });
  it("bornes du mois décalé", () => {
    expect(monthBounds(1, new Date(2026, 11, 15))).toMatchObject({ year: 2027, month: 0, start: "2027-01-01", end: "2027-01-31" });
  });
});
