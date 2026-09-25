import { describe, expect, it } from "vitest";
import {
  categoriesRanking,
  channelSeries,
  filterReports,
  foldTail,
  monthShort,
  pctDelta,
  prevYearPeriod,
  sortReports,
  totals,
  yoyComparison,
} from "./rapports.logic";
import type { MonthlyReport } from "./rapports.types";

const r = (period: string, total: number, extra: Partial<MonthlyReport> = {}): MonthlyReport => ({
  period,
  summary: { total_with_tax: total, receipts: 10, clients: 12 },
  total_tips: total / 10,
  total_hours: 100,
  ...extra,
});

describe("périodes", () => {
  it("trie et ignore les périodes invalides", () => {
    const sorted = sortReports([r("2026-02", 1), r("bad", 1), r("2025-12", 1)]);
    expect(sorted.map((x) => x.period)).toEqual(["2025-12", "2026-02"]);
  });
  it("filtre les N derniers mois et les bornes personnalisées (inversées comprises)", () => {
    const all = sortReports(["2026-01", "2026-02", "2026-03", "2026-04"].map((p) => r(p, 1)));
    expect(filterReports(all, { preset: "3" }).map((x) => x.period)).toEqual(["2026-02", "2026-03", "2026-04"]);
    expect(filterReports(all, { preset: "custom", start: "2026-03", end: "2026-02" }).length).toBe(2);
  });
  it("formate les mois", () => {
    expect(monthShort("2026-04")).toBe("avr. 26");
    expect(prevYearPeriod("2026-01")).toBe("2025-01");
  });
});

describe("KPI", () => {
  it("additionne et calcule le reçu moyen", () => {
    const t = totals([r("2026-01", 1000), r("2026-02", 500)]);
    expect(t.revenue).toBe(1500);
    expect(t.receipts).toBe(20);
    expect(t.avgReceipt).toBe(75);
  });
  it("compare seulement les mois qui ont un équivalent l'an dernier", () => {
    const all = sortReports([r("2025-01", 800), r("2026-01", 1000), r("2026-02", 5000)]);
    const cmp = yoyComparison(all.filter((x) => x.period >= "2026"), all)!;
    expect(cmp.comparableMonths).toBe(1);
    expect(cmp.current.revenue).toBe(1000); // février 2026 exclu : pas de février 2025
    expect(pctDelta(cmp.current.revenue, cmp.previous.revenue)).toBe(25);
  });
  it("pas d'écart quand la référence est nulle", () => {
    expect(pctDelta(10, 0)).toBeNull();
  });
});

describe("regroupements", () => {
  it("regroupe ramassage salle + en ligne, et ne garde que les canaux actifs", () => {
    const { rows, active } = channelSeries([
      r("2026-01", 0, { channels: { tables: { total_with_tax: 100 }, ramassage: { total_with_tax: 5 }, el_ramassage: { total_with_tax: 7 } } }),
    ]);
    expect(rows[0]!.ramassage).toBe(12);
    expect(active).toEqual(["tables", "ramassage"]);
  });
  it("fusionne les catégories sans tenir compte de la casse", () => {
    const rows = categoriesRanking([
      r("2026-01", 0, { top_categories: [{ name: "Bière", total: 10 }] }),
      r("2026-02", 0, { top_categories: [{ name: "BIÈRE", total: 5 }] }),
    ]);
    expect(rows).toEqual([{ name: "Bière", total: 15, qty: 0 }]);
  });
  it("regroupe la queue dans « Autres »", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `c${i}`, total: 10 - i, qty: 1 }));
    const folded = foldTail(rows, 2);
    expect(folded.map((x) => x.name)).toEqual(["c0", "c1", "Autres (3)"]);
    expect(folded[2]!.total).toBe(8 + 7 + 6);
  });
});
