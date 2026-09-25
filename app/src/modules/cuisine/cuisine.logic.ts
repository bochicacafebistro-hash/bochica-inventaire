import { frCollator, normalize } from "@/core/text";
import type { Ingredient, MenuItem, Recipe, RecipeLine } from "./cuisine.types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

// ── Catégories (codes v1) ─────────────────────────────

export const MENU_CATS = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"];

export const INGREDIENT_CATS = [
  { key: "base", label: "Base" },
  { key: "protein", label: "Protéine" },
  { key: "garnish", label: "Garniture" },
  { key: "sauce", label: "Sauce" },
  { key: "vegetable", label: "Légume" },
  { key: "drink", label: "Boisson" },
  { key: "dessert", label: "Dessert" },
  { key: "other", label: "Autre" },
];

export const RECIPE_CATS = [
  { key: "main", label: "Plat principal" },
  { key: "starter", label: "Entrée" },
  { key: "dessert", label: "Dessert" },
  { key: "drink", label: "Boisson" },
  { key: "sauce", label: "Sauce" },
  { key: "base", label: "Préparation de base" },
  { key: "other", label: "Autre" },
];

export const ingCatLabel = (k?: string) => INGREDIENT_CATS.find((c) => c.key === k)?.label ?? "Autre";
export const recipeCatLabel = (k?: string) => RECIPE_CATS.find((c) => c.key === k)?.label ?? k ?? "";

// ── Coût de revient (food cost) ───────────────────────

/** Somme coût unitaire × quantité ; les ingrédients introuvables comptent pour 0 (comme la v1). */
export function foodCost(recipe: RecipeLine[] | undefined, ingredients: Map<string, Ingredient> | Ingredient[]): number {
  if (!Array.isArray(recipe)) return 0;
  const byId = ingredients instanceof Map ? ingredients : new Map(ingredients.map((i) => [i.id, i]));
  return recipe.reduce((sum, r) => {
    const ing = byId.get(r.ingredientId);
    return ing ? sum + num(ing.costPerUnit) * num(r.qty) : sum;
  }, 0);
}

export type MarginTier = "good" | "ok" | "bad" | "none";

export interface Profitability {
  cost: number;
  price: number;
  margin: number; // $
  marginPct: number; // % du prix
  costPct: number; // coût matière en % du prix
  tier: MarginTier;
}

/** Seuils v1 : marge ≥ 70 % bon, ≥ 50 % correct, sinon faible (= coût matière ≤ 30 % / ≤ 50 %). */
export function profitability(item: MenuItem, ingredients: Map<string, Ingredient>): Profitability {
  const cost = foodCost(item.recipe, ingredients);
  const price = num(item.price);
  const hasRecipe = (item.recipe?.length ?? 0) > 0;
  const margin = price - cost;
  const marginPct = price > 0 ? (margin / price) * 100 : 0;
  const costPct = price > 0 ? (cost / price) * 100 : 0;
  const tier: MarginTier = !hasRecipe || price <= 0 ? "none" : marginPct >= 70 ? "good" : marginPct >= 50 ? "ok" : "bad";
  return { cost, price, margin, marginPct, costPct, tier };
}

export const TIER_LABEL: Record<MarginTier, string> = {
  good: "Bonne marge",
  ok: "Marge correcte",
  bad: "Marge faible",
  none: "Sans composition",
};

/** Prix suggéré pour atteindre un coût matière cible (ex. 30 %). */
export function suggestedPrice(cost: number, targetCostPct = 30): number {
  if (cost <= 0) return 0;
  return Math.ceil((cost / (targetCostPct / 100)) * 4) / 4; // arrondi au 0,25 $ supérieur
}

/** Lignes valides à enregistrer (ingrédient choisi, quantité > 0). */
export function cleanRecipe(rows: { ingredientId: string; qty: string | number }[]): RecipeLine[] {
  return rows.filter((r) => r.ingredientId && num(r.qty) > 0).map((r) => ({ ingredientId: r.ingredientId, qty: num(r.qty) }));
}

export function filterMenu(items: MenuItem[], cat: string, query: string): MenuItem[] {
  const q = normalize(query);
  return items
    .filter((m) => cat === "Toutes" || m.category === cat)
    .filter((m) => !q || normalize(`${m.name ?? ""} ${m.description ?? ""}`).includes(q))
    .sort((a, b) => MENU_CATS.indexOf(a.category ?? "") - MENU_CATS.indexOf(b.category ?? "") || frCollator.compare(a.name ?? "", b.name ?? ""));
}

/** Plats du menu qui utilisent un ingrédient (pour avertir avant suppression). */
export function menuItemsUsing(ingredientId: string, menu: MenuItem[]): MenuItem[] {
  return menu.filter((m) => m.recipe?.some((r) => r.ingredientId === ingredientId));
}

export function groupIngredients(list: Ingredient[], query: string) {
  const q = normalize(query);
  const shown = list.filter((i) => !q || normalize(`${i.name ?? ""} ${i.notes ?? ""}`).includes(q));
  const groups = INGREDIENT_CATS.map((c) => ({
    key: c.key,
    title: c.label,
    items: shown.filter((i) => (i.category ?? "other") === c.key || (c.key === "other" && !INGREDIENT_CATS.some((x) => x.key === i.category))),
  }));
  for (const g of groups) g.items.sort((a, b) => frCollator.compare(a.name ?? "", b.name ?? ""));
  return groups.filter((g) => g.items.length > 0);
}

// ── Recettes ──────────────────────────────────────────

export function totalTime(r: Recipe): number {
  return num(r.prepTime) + num(r.cookTime);
}

export function ingredientLineCount(r: Recipe): number {
  return (r.ingredients ?? "").split("\n").filter((l) => l.trim()).length;
}

export function filterRecipes(list: Recipe[], cat: string, query: string): Recipe[] {
  const q = normalize(query);
  return list
    .filter((r) => cat === "all" || r.category === cat)
    .filter((r) => !q || normalize(`${r.name ?? ""} ${r.description ?? ""} ${r.ingredients ?? ""}`).includes(q))
    .sort((a, b) => frCollator.compare(a.name ?? "", b.name ?? ""));
}
