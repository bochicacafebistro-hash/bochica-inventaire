import { describe, expect, it } from "vitest";
import {
  autoTaxes,
  byCategory,
  categoryType,
  currentQuarter,
  expenseFields,
  expensesIn,
  lastMonthsSeries,
  monthsBetween,
  pendingFixedExpenses,
  periodBounds,
  periodTotals,
  recentQuarters,
  revenuePeriodLabel,
  taxesForPeriod,
  toExpenseDraft,
  validateExpense,
  validateRevenue,
  toRevenueDraft,
} from "./finances.logic";

const custom = [{ id: "c", name: "Assurances", type: "fixe" }];

describe("catégories et périodes", () => {
  it("type de catégorie (défaut, personnalisée, inconnue)", () => {
    expect(categoryType("Loyer", custom)).toBe("fixe");
    expect(categoryType("Assurances", custom)).toBe("fixe");
    expect(categoryType("Bidon", custom)).toBe("variable");
  });
  it("bornes : mois, année, 7 derniers jours", () => {
    expect(periodBounds({ kind: "mois", year: 2026, month: 1 })).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(periodBounds({ kind: "annee", year: 2026, month: 0 })).toEqual({ start: "2026-01-01", end: "2026-12-31" });
    expect(periodBounds({ kind: "semaine", year: 0, month: 0 }, "2026-09-25")).toEqual({ start: "2026-09-18", end: "2026-09-25" });
  });
});

describe("totaux", () => {
  const exps = [
    { id: "1", date: "2026-03-01", amount: 1000, tps: 50, tvq: 99.75, category: "Loyer" },
    { id: "2", date: "2026-03-15", amount: 200, tps: 10, tvq: 19.95, category: "Nourriture", type: "fixe" },
    { id: "3", date: "2026-04-02", amount: 50, category: "Autres" },
  ];
  const revs = [{ id: "r", date: "2026-03-10", amount: 3000, tps: 150, tvq: 299.25 }];
  it("période : revenus, dépenses, taxes, profit (dépenses taxes incluses), fixe/variable", () => {
    const t = periodTotals(expensesIn(exps, "2026-03-01", "2026-03-31"), revs, custom);
    expect(t.expenses).toBe(1200);
    expect(t.expenseTaxes).toBeCloseTo(179.7);
    expect(t.profit).toBeCloseTo(3000 - 1379.7);
    expect(t.fixed).toBe(1200); // le type choisi (« fixe ») l'emporte sur la catégorie
  });
  it("graphique 6 mois : une dépense du 1er reste dans son mois (correction v1)", () => {
    const s = lastMonthsSeries(exps, revs, 6, "2026-04-15");
    expect(s.map((m) => m.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(s[4]!.expenses).toBeCloseTo(1379.7);
    expect(s[3]!.expenses).toBe(0);
  });
  it("par catégorie, trié", () => {
    expect(byCategory(exps).map((c) => c.name)).toEqual(["Loyer", "Nourriture", "Autres"]);
  });
});

describe("formulaires", () => {
  it("dépense : frais supplémentaires inclus dans le montant, taxes auto arrondies", () => {
    const d = { ...toExpenseDraft(null, custom, "2026-09-25"), description: "Costco", baseAmount: "100" };
    d.extras = [{ key: "k", description: "Livraison", amount: "15" }];
    expect(autoTaxes(115)).toEqual({ tps: "5.75", tvq: "11.47" });
    d.tps = "5.75";
    d.tvq = "11.47";
    const f = expenseFields(d);
    expect(f.amount).toBe(115);
    expect(f.customLines).toEqual([{ description: "Livraison", amount: 15 }]);
    expect(validateExpense({ ...d, description: "" }).description).toBeTruthy();
  });
  it("dépense existante : le montant de base exclut les frais supplémentaires", () => {
    const d = toExpenseDraft({ id: "e", amount: 115, customLines: [{ description: "Livraison", amount: 15 }] }, custom);
    expect(d.baseAmount).toBe("100");
  });
  it("sans taxes → 0", () => {
    const d = { ...toExpenseDraft(null, custom), description: "x", baseAmount: "10", noTax: true, tps: "9", tvq: "9" };
    expect(expenseFields(d)).toMatchObject({ tps: 0, tvq: 0 });
  });
  it("revenu : fin avant début refusée ; période affichée", () => {
    expect(validateRevenue({ ...toRevenueDraft(null, "2026-09-25"), description: "x", amount: "1", dateEnd: "2026-09-01" }).dateEnd).toBeTruthy();
    expect(revenuePeriodLabel({ id: "r", dateStart: "2026-11-10", dateEnd: "2026-11-16" })).toBe("10 nov. – 16 nov. 2026");
    expect(revenuePeriodLabel({ id: "r", date: "2026-11-10" })).toBe("10 nov. 2026");
  });
});

describe("frais fixes automatiques (logique v1)", () => {
  const tpl = [{ id: "t", supplier: "Loyer", category: "Loyer", amount: 2500, tps: 0, tvq: 0 }];
  it("rattrape les mois manqués depuis le plus ancien mois appliqué", () => {
    const p = pendingFixedExpenses(tpl, [{ id: "a", isFixedAuto: true, date: "2026-06-01" }], "2026-09-25");
    expect(p.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(p.entries[0]).toMatchObject({ date: "2026-07-01", amount: 2500, isFixedAuto: true, description: "Loyer" });
  });
  it("rien à faire si le mois courant est déjà appliqué ; mois courant seulement la première fois", () => {
    expect(pendingFixedExpenses(tpl, [{ id: "a", isFixedAuto: true, date: "2026-09-01" }], "2026-09-25").months).toEqual([]);
    expect(pendingFixedExpenses(tpl, [], "2026-09-25").months).toEqual(["2026-09"]);
    expect(pendingFixedExpenses([], [], "2026-09-25").entries).toEqual([]);
  });
  it("au plus 12 mois", () => {
    expect(monthsBetween("2024-01", "2026-09")).toHaveLength(12);
  });
});

describe("TPS/TVQ", () => {
  it("trimestres et échéance (fin du mois suivant)", () => {
    expect(currentQuarter("2026-09-25")).toMatchObject({ quarter: 3, start: "2026-07-01", end: "2026-09-30", due: "2026-10-31" });
    expect(currentQuarter("2026-12-01").due).toBe("2027-01-31");
    expect(recentQuarters(4, "2026-02-10").map((q) => q.key)).toEqual(["2026-Q1", "2025-Q4", "2025-Q3", "2025-Q2"]);
  });
  it("à remettre = perçues − payées", () => {
    const t = taxesForPeriod(
      [{ id: "r", dateStart: "2026-07-05", amount: 1000, tps: 50, tvq: 99.75 }],
      [{ id: "e", date: "2026-08-01", amount: 200, tps: 10, tvq: 19.95 }, { id: "o", date: "2026-10-01", tps: 999 }],
      "2026-07-01",
      "2026-09-30",
    );
    expect(t.tpsToRemit).toBeCloseTo(40);
    expect(t.tvqToRemit).toBeCloseTo(79.8);
    expect(t.expenseCount).toBe(1);
  });
});
