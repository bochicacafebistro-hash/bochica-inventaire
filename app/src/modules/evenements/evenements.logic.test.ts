import { describe, expect, it } from "vitest";
import { byDate, filterEvents, sameDayOthers, toDraft, toFields, typeIndex, upcoming, validate } from "./evenements.logic";

const evs = [
  { id: "a", name: "Anniversaire Dupont", date: "2026-10-03", time: "19:00", type: "reservation", contactName: "Marie Tremblay" },
  { id: "b", name: "Karaoké", date: "2026-10-03", time: "", type: "karaoke" },
  { id: "c", name: "Action de grâce", date: "2026-10-12", type: "ferie" },
  { id: "d", name: "Vieux", date: "2026-08-01", type: "special", status: "annule" },
];

describe("événements", () => {
  it("filtre par type et cherche dans le contact sans accents", () => {
    expect(filterEvents(evs, "ferie", "").map((e) => e.id)).toEqual(["c"]);
    expect(filterEvents(evs, "all", "tremblay").map((e) => e.id)).toEqual(["a"]);
  });
  it("à venir sur 30 jours, trié par date puis heure (sans heure en dernier)", () => {
    expect(upcoming(evs, 30, "2026-09-25").map((e) => e.id)).toEqual(["a", "b", "c"]);
    expect(upcoming(evs, 7, "2026-09-25").map((e) => e.id)).toEqual([]);
    expect(byDate(evs).get("2026-10-03")!.map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("couleur fixe par type ; ancien type « special » → interne", () => {
    expect(typeIndex("reservation")).toBe(0);
    expect(typeIndex("special")).toBe(5);
  });
  it("validation et champs v1 (capacité vide → null)", () => {
    const d = { ...toDraft(null, "2026-10-01"), name: " Souper ", capacity: "" };
    expect(validate(d)).toEqual({});
    expect(toFields(d)).toMatchObject({ name: "Souper", date: "2026-10-01", capacity: null, type: "reservation", status: "confirme" });
    expect(validate({ ...d, name: "", contactEmail: "x" })).toMatchObject({ name: expect.any(String), contactEmail: expect.any(String) });
  });
  it("conflits du même jour (hors annulés)", () => {
    expect(sameDayOthers(evs, "2026-10-03", "a").map((e) => e.id)).toEqual(["b"]);
  });
});
