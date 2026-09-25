import { describe, expect, it } from "vitest";
import { countBySupplier, filterItems, groupBySupplier, toDraft, validate } from "./liste.logic";

const items = [
  { id: "1", name: "Tomates", supplier: "gordon", category: "legume" },
  { id: "2", name: "Poulet", supplier: "viandex", notes: "cuisses désossées" },
  { id: "3", name: "Avocats", supplier: "costco" },
  { id: "4", name: "Épices", supplier: "?" },
];

describe("liste d'ingrédients", () => {
  it("trie par fournisseur (Costco → Viandex → Gordon) puis par nom", () => {
    expect(filterItems(items, "all", "", "supplier").map((i) => i.id)).toEqual(["3", "2", "1", "4"]);
    expect(filterItems(items, "all", "", "name").map((i) => i.id)).toEqual(["3", "4", "2", "1"]);
  });
  it("filtre par fournisseur et cherche dans les notes sans accents", () => {
    expect(filterItems(items, "viandex", "", "name")).toHaveLength(1);
    expect(filterItems(items, "all", "desossees", "name").map((i) => i.id)).toEqual(["2"]);
  });
  it("compte et groupe, orphelins à la fin", () => {
    expect(countBySupplier(items)).toEqual({ all: 4, costco: 1, viandex: 1, gordon: 1 });
    expect(groupBySupplier(items).map((g) => g.title)).toEqual(["Costco", "Viandex", "Gordon", "Sans fournisseur"]);
  });
  it("brouillon par défaut et doublons chez le même fournisseur", () => {
    expect(toDraft(null)).toEqual({ name: "", supplier: "costco", category: "autre", notes: "" });
    expect(validate({ name: "poulet", supplier: "viandex", category: "autre", notes: "" }, items).name).toMatch(/existe/);
    expect(validate({ name: "poulet", supplier: "costco", category: "autre", notes: "" }, items)).toEqual({});
  });
});
