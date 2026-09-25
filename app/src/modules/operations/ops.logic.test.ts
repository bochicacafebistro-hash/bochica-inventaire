import { describe, expect, it } from "vitest";
import { buildSection, buildUnits, dailyFields, nextStatus, normalizeList, occurrences, showToday, slugId, togglePatch, toDailyDraft } from "./ops.logic";
import type { DailyTask } from "./ops.types";

const T = "2026-09-25";

describe("tâches du jour", () => {
  const rec: DailyTask = { id: "r", title: "Frigo", type: "recurring", time: "09:00", lastCompletedDate: T, lastCompletedBy: "Employé", sortOrder: 1 };
  const multi: DailyTask = { id: "m", title: "Salles de bain", type: "recurring", times: ["12:00", "17:00", "21:00"], dayState: { date: T, done: { "1": "Employé" } }, sortOrder: 0 };
  const stale: DailyTask = { ...multi, id: "s", dayState: { date: "2026-09-24", done: { "0": true } } };
  const onceDoneYesterday: DailyTask = { id: "o", title: "Ponctuelle", type: "once", done: true, doneDate: "2026-09-24" };
  const onceOpen: DailyTask = { id: "p", title: "Commande", type: "once", done: false };

  it("récurrente cochée aujourd'hui seulement", () => {
    expect(occurrences(rec, T)[0]!.done).toBe(true);
    expect(occurrences(rec, "2026-09-26")[0]!.done).toBe(false);
  });
  it("plusieurs passages, remis à zéro chaque jour", () => {
    expect(occurrences(multi, T).map((o) => o.done)).toEqual([false, true, false]);
    expect(occurrences(stale, T).every((o) => !o.done)).toBe(true);
  });
  it("ponctuelle faite hier disparaît", () => {
    expect(showToday(onceDoneYesterday, T)).toBe(false);
    expect(showToday(onceOpen, T)).toBe(true);
  });
  it("ordre chronologique, sans heure à la fin", () => {
    const units = buildUnits([onceOpen, rec, multi], T);
    expect(units.map((u) => `${u.task.id}${u.occ.time}`)).toEqual(["r09:00", "m12:00", "m17:00", "m21:00", "p"]);
  });
  it("cocher / décocher", () => {
    const o = occurrences(multi, T);
    expect(togglePatch(multi, o[0]!, T, "Ana")).toEqual({ dayState: { date: T, done: { "0": "Ana", "1": "Employé" } } });
    expect(togglePatch(multi, o[1]!, T, "Ana")).toEqual({ dayState: { date: T, done: {} } });
    expect(togglePatch(rec, occurrences(rec, T)[0]!, T, "x")).toEqual({ lastCompletedDate: null, lastCompletedBy: null });
    const p = togglePatch(onceOpen, occurrences(onceOpen, T)[0]!, T, "Ana");
    expect(p).toMatchObject({ done: true, doneDate: T, doneBy: "Ana" });
  });
  it("champs enregistrés comme la v1", () => {
    const d = { ...toDailyDraft(null), title: " Frigo ", times: "x" };
    expect(dailyFields(d, ["12:00", "17:00"])).toEqual({ title: "Frigo", type: "recurring", bucket: "recurrent", time: "12:00", note: "", times: ["12:00", "17:00"] });
    expect(dailyFields({ ...d, once: true }, ["12:00"]).times).toBeNull();
    expect(toDailyDraft(multi).times).toBe("12:00, 17:00, 21:00");
    expect(dailyFields(d, ["21:00", "09:30", "21:00"]).times).toEqual(["09:30", "21:00"]);
  });
});

describe("ouverture / fermeture", () => {
  it("anciens formats", () => {
    const l = normalizeList(["Allumer", { text: "Caisse", section: "service" }, { id: "a", text: "" }]);
    expect(l).toEqual([
      { id: slugId("Allumer"), text: "Allumer", section: "cuisine" },
      { id: slugId("Caisse"), text: "Caisse", section: "service" },
    ]);
  });
  it("garde l'id d'un élément inchangé", () => {
    const existing = [{ id: "a", text: "Allumer", section: "cuisine" as const }];
    let n = 0;
    const out = buildSection("Allumer\n\n Nouveau ", "cuisine", existing, new Set(), () => `n${++n}`);
    expect(out).toEqual([
      { id: "a", text: "Allumer", section: "cuisine" },
      { id: "n1", text: "Nouveau", section: "cuisine" },
    ]);
  });
});

describe("kanban", () => {
  it("cycle des colonnes", () => {
    expect(nextStatus("À faire")).toBe("En cours");
    expect(nextStatus("Complété")).toBe("À faire");
    expect(nextStatus(undefined)).toBe("À faire");
  });
});
