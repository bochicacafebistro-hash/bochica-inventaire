import { describe, expect, it } from "vitest";
import { reportSummary } from "./report";

describe("reportSummary", () => {
  const input = {
    start: "2026-09-01",
    end: "2026-09-30",
    revenues: [{ id: "r", amount: 1000, tps: 50, tvq: 99.75 }],
    expenses: [{ id: "e", amount: 200, tps: 10, tvq: 19.95 }],
    includeRevenues: true,
    includeExpenses: false,
  };
  it("ignore les dépenses si non incluses", () => {
    const s = reportSummary(input);
    expect(s.rev).toBe(1000);
    expect(s.revTps + s.revTvq).toBeCloseTo(149.75);
    expect(s.expCount).toBe(0);
  });
  it("compte les deux", () => {
    const s = reportSummary({ ...input, includeExpenses: true });
    expect(s.exp).toBe(200);
    expect(s.rev - s.exp).toBe(800);
  });
});
