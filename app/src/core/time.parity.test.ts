import { describe, expect, it } from "vitest";
import { hasV1, loadV1, rng } from "@/test/v1";
import { normalizeTime } from "./time";

describe.skipIf(!hasV1)("parité avec la v1 — saisie d'heure", () => {
  const v1 = loadV1<{ normalizeTimeInput: (s: string) => string | null }>("utils.js", ["normalizeTimeInput"]);
  it("mêmes résultats (sauf « 17h », que la v1 refusait)", () => {
    const r = rng(3);
    const samples = ["", "—", "9", "17", "930", "1704", "17:04", "17.30", "25:00", "abc", "7:5", "0000", "2359", "12:60"];
    for (let i = 0; i < 300; i++) samples.push(String(Math.floor(r() * 2500)), `${Math.floor(r() * 26)}:${Math.floor(r() * 70)}`, `${Math.floor(r() * 26)}h${Math.floor(r() * 70)}`);
    for (const s of samples) expect(normalizeTime(s)).toBe(v1.normalizeTimeInput(s));
    expect(v1.normalizeTimeInput("17h")).toBeNull();
    expect(normalizeTime("17h")).toBe("17:00");
  });
});
