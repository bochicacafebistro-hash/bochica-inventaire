import { describe, expect, it } from "vitest";
import { cleanRecipe, filterMenu, filterRecipes, foodCost, groupIngredients, menuItemsUsing, profitability, suggestedPrice } from "./cuisine.logic";

const ings = [
  { id: "arepa", name: "Arepa", unit: "unité", costPerUnit: 0.8, category: "base" },
  { id: "fromage", name: "Fromage", unit: "g", costPerUnit: 0.02, category: "garnish" },
  { id: "x", name: "Épice mystère", category: "inconnue" },
];
const byId = new Map(ings.map((i) => [i.id, i]));

describe("coût de revient", () => {
  it("additionne coût × quantité, ignore les ingrédients supprimés", () => {
    expect(foodCost([{ ingredientId: "arepa", qty: 2 }, { ingredientId: "fromage", qty: 50 }, { ingredientId: "gone", qty: 9 }], ings)).toBeCloseTo(2.6);
  });
  it("classe la marge avec les seuils v1 (70 % / 50 %)", () => {
    const item = (price: number) => ({ id: "m", price, recipe: [{ ingredientId: "arepa", qty: 3 }] }); // coût 2,40 $
    expect(profitability(item(10), byId).tier).toBe("good"); // marge 76 %
    expect(profitability(item(5), byId).tier).toBe("ok"); // 52 %
    expect(profitability(item(4), byId).tier).toBe("bad"); // 40 %
    expect(profitability({ id: "m", price: 10 }, byId).tier).toBe("none");
    expect(profitability(item(10), byId).costPct).toBeCloseTo(24);
  });
  it("prix suggéré pour 30 % de coût matière, arrondi au 0,25 $", () => {
    expect(suggestedPrice(2.4)).toBe(8);
    expect(suggestedPrice(2.5)).toBe(8.5);
    expect(suggestedPrice(0)).toBe(0);
  });
  it("nettoie la composition", () => {
    expect(cleanRecipe([{ ingredientId: "", qty: 1 }, { ingredientId: "a", qty: "0" }, { ingredientId: "b", qty: "1.5" }])).toEqual([{ ingredientId: "b", qty: 1.5 }]);
  });
});

describe("listes", () => {
  it("menu : filtre par catégorie et trie dans l'ordre des catégories", () => {
    const menu = [
      { id: "1", name: "Flan", category: "Desserts" },
      { id: "2", name: "Empanadas", category: "Entrées" },
      { id: "3", name: "Bol", category: "Plats principaux", description: "riz, frijoles" },
    ];
    expect(filterMenu(menu, "Toutes", "").map((m) => m.id)).toEqual(["2", "3", "1"]);
    expect(filterMenu(menu, "Toutes", "FRIJOLES").map((m) => m.id)).toEqual(["3"]);
    expect(menuItemsUsing("arepa", [{ id: "a", recipe: [{ ingredientId: "arepa", qty: 1 }] }, { id: "b" }])).toHaveLength(1);
  });
  it("ingrédients groupés, catégorie inconnue → Autre", () => {
    expect(groupIngredients(ings, "").map((g) => g.title)).toEqual(["Base", "Garniture", "Autre"]);
    expect(groupIngredients(ings, "epice")[0]!.items[0]!.id).toBe("x");
  });
  it("recettes : recherche aussi dans les ingrédients", () => {
    const r = [{ id: "1", name: "Ajiaco", ingredients: "- pommes de terre\n- guascas" }, { id: "2", name: "Arepa" }];
    expect(filterRecipes(r, "all", "guascas").map((x) => x.id)).toEqual(["1"]);
  });
});
