/**
 * Parité v1 ↔ v2 : les fonctions de l'horaire donnent exactement les mêmes
 * résultats que celles de l'ancienne app sur des centaines de cas générés.
 */
import { describe, expect, it } from "vitest";
import { hasV1, loadV1, rng } from "@/test/v1";
import type { Employee } from "./equipe.types";
import { coverageAt, dayRange, effectiveRate, hoursFromShift, normalizeRateHistory } from "./horaire.logic";

const pad = (n: number) => String(n).padStart(2, "0");
const rand = rng(7);
const time = () => `${pad(Math.floor(rand() * 24))}:${pad([0, 15, 30, 45, 4][Math.floor(rand() * 5)]!)}`;
const date = () => `2026-${pad(1 + Math.floor(rand() * 12))}-${pad(1 + Math.floor(rand() * 28))}`;

describe.skipIf(!hasV1)("parité avec la v1 — horaire", () => {
  const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const v1 = loadV1<{
    hoursFromShift: (s: unknown) => number;
    effectiveHourlyRate: (e: unknown, dk: string) => number;
    normalizeRateHistory: (h: unknown) => unknown;
    _dkRange: (a: string, b: string) => string[];
  }>("pages-hr.js", ["hoursFromShift", "effectiveHourlyRate", "normalizeRateHistory", "_dkRange"], { dayKey, todayKey: () => "2026-09-25" });

  it("hoursFromShift (500 quarts)", () => {
    for (let i = 0; i < 500; i++) {
      const s = { start: time(), end: time() };
      expect(hoursFromShift(s)).toBeCloseTo(v1.hoursFromShift(s), 10);
    }
  });

  it("taux daté + normalisation (300 historiques)", () => {
    for (let i = 0; i < 300; i++) {
      const hist = Array.from({ length: Math.floor(rand() * 5) }, () => ({ rate: [16, 17, 17.5, 18, 20][Math.floor(rand() * 5)]!, from: date() }));
      expect(normalizeRateHistory(hist)).toEqual(v1.normalizeRateHistory(hist));
      const e = { rateHistory: hist, hourlyRate: 15 };
      const dk = date();
      expect(effectiveRate(e, dk)).toBe(v1.effectiveHourlyRate(e, dk));
    }
  });

  it("plage de dates des congés", () => {
    for (let i = 0; i < 100; i++) {
      const a = date();
      const b = date();
      expect(dayRange(a, b)).toEqual(v1._dkRange(a, b));
    }
  });

  it("couverture par heure (200 équipes)", () => {
    for (let i = 0; i < 200; i++) {
      const employees: Employee[] = Array.from({ length: 6 }, (_, k) => ({ id: String(k), section: ["cuisine", "service", undefined, "other"][k % 4], shifts: (rand() < 0.8 ? { d: { start: time(), end: time() } } : {}) as Employee["shifts"] }));
      const cov = loadV1<{ countCoverageAtHour: (h: number, dk: string, s: string) => number }>("pages-hr.js", ["parseTimeToFloat", "countCoverageAtHour"], { employees });
      for (const sec of ["all", "cuisine", "service", "other"] as const)
        for (let h = 0; h < 24; h++) expect(coverageAt(employees, "d", h, sec)).toBe(cov.countCoverageAtHour(h, "d", sec));
    }
  });
});
