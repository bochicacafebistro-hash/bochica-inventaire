import { describe, expect, it } from "vitest";
import {
  DEFAULT_TEMPLATES,
  filterQuotes,
  getOptions,
  headlineRange,
  isPastDue,
  nextQuoteNumber,
  optionTotals,
  roomTotals,
  templateOf,
  toDraft,
  toFields,
  validateQuote,
} from "./soumissions.logic";
import type { Quote } from "./soumissions.types";

const T = DEFAULT_TEMPLATES;

describe("calculs identiques à la v1", () => {
  it("forfait + bière + dessert + lignes + taxes + dépôt", () => {
    const opt = {
      id: "o",
      packageId: "forfait-essentiel",
      packageSnapshot: null,
      beerAddon: true,
      dessertAddon: true,
      customLines: [{ description: "DJ", amount: 150 }, { description: "Rabais", amount: -50 }],
      depositAmount: 200,
      depositPaid: true,
    };
    const t = optionTotals(opt, 20, T[0]!);
    expect(t.subtotal).toBe(440); // 20 × 22
    expect(t.beerSubtotal).toBe(140); // 20 × 7
    expect(t.dessertSubtotal).toBe(120);
    expect(t.customSubtotal).toBe(100);
    expect(t.preTaxTotal).toBe(800);
    expect(t.tps).toBeCloseTo(40);
    expect(t.tvq).toBeCloseTo(79.8);
    expect(t.total).toBeCloseTo(919.8);
    expect(t.balance).toBeCloseTo(719.8);
  });
  it("salle : prix avant taxes", () => {
    expect(roomTotals({ id: "r", date: "", startTime: "", endTime: "", description: "", price: 200 }).total).toBeCloseTo(229.95);
  });
  it("lit les anciennes soumissions à un seul forfait", () => {
    const legacy: Quote = { id: "q", packageId: "forfait-gourmand", beerAddon: true, guestCount: 10 };
    const opts = getOptions(legacy);
    expect(opts).toHaveLength(1);
    expect(optionTotals(opts[0]!, 10, templateOf(opts[0]!, T)).preTaxTotal).toBe(340); // 10 × (27 + 7)
  });
  it("utilise le forfait figé plutôt que le forfait actuel", () => {
    const q: Quote = { id: "q", guestCount: 1, packageOptions: [{ packageId: "forfait-essentiel", packageSnapshot: { id: "x", pricePerPerson: 18 } }] };
    expect(headlineRange(q, T).max).toBeCloseTo(18 * 1.14975);
  });
});

describe("numérotation et statut", () => {
  it("prochain numéro de l'année", () => {
    expect(nextQuoteNumber([{ id: "a", quoteNumber: "2026-007" }, { id: "b", quoteNumber: "2025-099" }], 2026)).toBe("2026-008");
    expect(nextQuoteNumber([], 2027)).toBe("2027-001");
  });
  it("expirée automatiquement si la validité est dépassée", () => {
    expect(isPastDue({ id: "a", validUntil: "2026-09-01", status: "envoyee" }, "2026-09-25")).toBe(true);
    expect(isPastDue({ id: "a", validUntil: "2026-09-01", status: "acceptee" }, "2026-09-25")).toBe(false);
  });
  it("recherche et tri (plus récente d'abord)", () => {
    const list = [
      { id: "1", quoteNumber: "2026-001", clientName: "Élise Côté" },
      { id: "2", quoteNumber: "2026-002", clientName: "Bob", status: "acceptee" },
    ];
    expect(filterQuotes(list, "all", "").map((q) => q.id)).toEqual(["2", "1"]);
    expect(filterQuotes(list, "all", "elise cote").map((q) => q.id)).toEqual(["1"]);
    expect(filterQuotes(list, "brouillon", "").map((q) => q.id)).toEqual(["1"]);
  });
});

describe("formulaire", () => {
  it("valide et écrit les champs v1 (y compris les champs hérités)", () => {
    const d = toDraft(null, T, "2026-09-25");
    expect(d.validUntil).toBe("2026-10-25");
    expect(validateQuote(d, T)).toMatchObject({ clientName: expect.any(String), guestCount: expect.any(String) });
    d.clientName = "Marie";
    d.guestCount = "25";
    d.options[0]!.beerAddon = true;
    d.options[0]!.beerPrice = "5";
    expect(validateQuote(d, T)).toEqual({});
    const f = toFields(d, T);
    expect(f.packageOptions[0]!.packageSnapshot!.beerPrice).toBe(5);
    expect(f.packageId).toBe("forfait-essentiel");
    expect(f.beerAddon).toBe(true);
    expect(f.roomRentals).toEqual([]);
  });
  it("salle seulement : pas de forfait obligatoire", () => {
    const d = { ...toDraft(null, T), clientName: "X", guestCount: "10", options: [] };
    d.rooms = [{ key: "r", date: "2026-10-10", startTime: "18:00", endTime: "23:00", description: "", price: "300" }];
    expect(validateQuote(d, T)).toEqual({});
    expect(toFields(d, T).packageSnapshot).toBeNull();
  });
});
