import { describe, expect, it } from "vitest";
import { normalizeTime, parseTimes } from "./time";

describe("normalizeTime", () => {
  it("accepte les formats de la v1", () => {
    expect(normalizeTime("1704")).toBe("17:04");
    expect(normalizeTime("17h04")).toBe("17:04");
    expect(normalizeTime("17h")).toBe("17:00");
    expect(normalizeTime("9")).toBe("09:00");
    expect(normalizeTime("930")).toBe("09:30");
    expect(normalizeTime("9.30")).toBe("09:30");
    expect(normalizeTime("")).toBe("");
  });
  it("refuse l'invalide", () => {
    expect(normalizeTime("25:00")).toBeNull();
    expect(normalizeTime("abc")).toBeNull();
  });
  it("liste d'heures", () => {
    expect(parseTimes("12:00, 17h; 2100, xx")).toEqual(["12:00", "17:00", "21:00"]);
  });
});
