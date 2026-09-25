import { describe, expect, it } from "vitest";
import {
  checkSectionName,
  countProducts,
  fallbackSection,
  filterProducts,
  groupBySection,
  groupBySupplier,
  moveItem,
  orderLabel,
  productFields,
  receivePreview,
  sectionsList,
  sortProducts,
  statusOf,
  toOrder,
  toProductDraft,
  validateProduct,
} from "./inventaire.logic";
import type { Product } from "./inventaire.types";

const P = (id: string, stock: number, min: number, extra: Partial<Product> = {}): Product => ({
  id,
  name: id,
  currentStock: stock,
  minimum: min,
  section: "Cuisine",
  ...extra,
});

describe("statut du stock (identique v1)", () => {
  it("rouge si stock ≤ minimum, jaune jusqu'à +20 %, vert au-delà", () => {
    expect(statusOf(P("a", 10, 10))).toBe("red");
    expect(statusOf(P("a", 12, 10))).toBe("yellow");
    expect(statusOf(P("a", 13, 10))).toBe("green");
    expect(statusOf(P("a", 0, 0))).toBe("red"); // comme la v1
    expect(statusOf({ id: "x" })).toBe("red");
  });
  it("trie par statut puis par ordre manuel", () => {
    const list = [P("vert", 50, 1, { sortOrder: 0 }), P("rouge2", 0, 1, { sortOrder: 5 }), P("rouge1", 0, 1, { sortOrder: 2 })];
    expect(sortProducts(list).map((p) => p.id)).toEqual(["rouge1", "rouge2", "vert"]);
  });
});

describe("filtres et compteurs", () => {
  const list = [
    P("Poulet", 0, 5),
    P("Bière", 50, 5, { section: "Bar" }),
    P("Limes", 6, 5, { section: "Bar" }),
    P("Vieux", 0, 5, { archived: true }),
  ];
  it("filtre par catégorie, recherche sans accents, archivés à part", () => {
    expect(filterProducts(list, { section: "Bar", query: "", archived: false }).map((p) => p.id)).toEqual(["Limes", "Bière"]);
    expect(filterProducts(list, { section: "Toutes", query: "biere", archived: false }).map((p) => p.id)).toEqual(["Bière"]);
    expect(filterProducts(list, { section: "Bar", query: "", archived: true }).map((p) => p.id)).toEqual(["Vieux"]);
  });
  it("compte par statut et par catégorie", () => {
    const c = countProducts(list);
    expect([c.total, c.red, c.yellow, c.green, c.archived]).toEqual([3, 1, 1, 1, 1]);
    expect(c.lowBySection.get("Bar")).toBe(1);
  });
});

describe("commandes et réception", () => {
  it("libellé de commande", () => {
    expect(orderLabel({ id: "a", orderQty: 2, orderUnit: "boîte" })).toBe("2 boîtes");
    expect(orderLabel({ id: "a", orderQty: 1 })).toBe("1 unité");
  });
  it("réception en boîtes : unités, nouveau stock et écart vs prévu", () => {
    const p = P("a", 3, 5, { orderUnit: "boîte", unitsPerBox: 12, orderQty: 2 });
    expect(receivePreview(p, 1)).toEqual({ units: 12, newStock: 15, expected: 24, diff: -12 });
    expect(receivePreview(P("b", 0, 1, { orderQty: 4 }), 5).diff).toBe(1);
  });
  it("liste à commander groupée par fournisseur (supprimé / sans fournisseur)", () => {
    const items = toOrder([
      P("x", 0, 1, { supplierId: "s1" }),
      P("y", 0, 1, { supplierId: "gone" }),
      P("z", 0, 1),
      P("ok", 99, 1, { supplierId: "s1" }),
    ]);
    const g = groupBySupplier(items, [{ id: "s1", name: "Viandex", contact: "418" }]);
    expect(g.map((x) => x.title)).toEqual(["Viandex", "Fournisseur supprimé", "Sans fournisseur"]);
    expect(g[0]!.contact).toBe("418");
  });
  it("groupes par catégorie, avec les catégories inconnues à la fin", () => {
    const g = groupBySection([P("a", 0, 1, { section: "Bar" }), P("b", 0, 1, { section: "Perdue" })], ["Cuisine", "Bar"]);
    expect(g.map((x) => x.title)).toEqual(["Bar", "Sans catégorie"]);
  });
});

describe("formulaire produit", () => {
  it("valide les champs", () => {
    const d = { ...toProductDraft(null, "Cuisine"), name: "", minimum: "-1", orderUnit: "boîte" as const, unitsPerBox: "0" };
    const e = validateProduct(d);
    expect(Object.keys(e).sort()).toEqual(["minimum", "name", "unitsPerBox"]);
  });
  it("produit les mêmes champs que la v1", () => {
    const f = productFields({ ...toProductDraft(null, "Bar"), name: " Lime ", orderQty: "3", unitsPerBox: "9" });
    expect(f).toMatchObject({ name: "Lime", section: "Bar", unit: "unité", orderUnit: "unité", orderQty: 3, unitsPerBox: 1 });
  });
});

describe("catégories", () => {
  it("liste : `all` sinon défaut + personnalisées", () => {
    expect(sectionsList({ all: ["A", "B"] })).toEqual(["A", "B"]);
    expect(sectionsList({ custom: ["Terrasse"] })).toEqual(["Cuisine", "Emballage", "Bar", "Autre", "Terrasse"]);
    expect(sectionsList(null)).toHaveLength(4);
  });
  it("refuse les doublons (sans accents) et le nom réservé", () => {
    expect(checkSectionName("cuisine", ["Cuisine"])).toBeTruthy();
    expect(checkSectionName("Cuisine", ["Cuisine"], 0)).toBeNull();
    expect(checkSectionName("Toutes", [])).toBeTruthy();
  });
  it("repli sur « Autre » à la suppression", () => {
    expect(fallbackSection(["Cuisine", "Bar", "Autre"], "Bar")).toBe("Autre");
    expect(fallbackSection(["Cuisine", "Bar"], "Cuisine")).toBe("Bar");
  });
  it("déplace un élément", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
