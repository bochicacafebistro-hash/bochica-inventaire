/**
 * Liste d'ingrédients (collection `shoppingList`) — liste de courses par
 * fournisseur. Mêmes codes que la v1 (fournisseurs et catégories fixes).
 * NB pour la vente : ces fournisseurs sont propres à Bochica ; à rendre
 * configurables à l'étape 7.
 */
import { frCollator, normalize } from "@/core/text";

export const SHOP_SUPPLIERS = [
  { key: "costco", label: "Costco" },
  { key: "viandex", label: "Viandex" },
  { key: "gordon", label: "Gordon" },
] as const;

export const SHOP_CATEGORIES = [
  { key: "proteine", label: "Protéine" },
  { key: "legume", label: "Légume" },
  { key: "laitier", label: "Produit laitier" },
  { key: "epicerie", label: "Épicerie" },
  { key: "autre", label: "Autre" },
] as const;

export type ShopSupplier = (typeof SHOP_SUPPLIERS)[number]["key"];

export interface ShopItem {
  id: string;
  name?: string;
  supplier?: string;
  category?: string;
  notes?: string;
}

export interface ShopDraft {
  name: string;
  supplier: ShopSupplier;
  category: string;
  notes: string;
}

export const supplierLabel = (k?: string) => SHOP_SUPPLIERS.find((s) => s.key === k)?.label ?? "Sans fournisseur";
export const categoryLabel = (k?: string) => SHOP_CATEGORIES.find((c) => c.key === k)?.label ?? "Autre";
const supplierRank = (k?: string) => {
  const i = SHOP_SUPPLIERS.findIndex((s) => s.key === k);
  return i < 0 ? 99 : i;
};

export type SortMode = "supplier" | "name";

export function filterItems(items: ShopItem[], supplier: string, query: string, sort: SortMode): ShopItem[] {
  const q = normalize(query);
  return items
    .filter((i) => supplier === "all" || i.supplier === supplier)
    .filter((i) => !q || normalize(`${i.name ?? ""} ${i.notes ?? ""}`).includes(q))
    .sort((a, b) =>
      sort === "name"
        ? frCollator.compare(a.name ?? "", b.name ?? "")
        : supplierRank(a.supplier) - supplierRank(b.supplier) || frCollator.compare(a.name ?? "", b.name ?? ""),
    );
}

export function countBySupplier(items: ShopItem[]): Record<string, number> {
  const c: Record<string, number> = { all: items.length };
  for (const s of SHOP_SUPPLIERS) c[s.key] = items.filter((i) => i.supplier === s.key).length;
  return c;
}

/** Groupes par fournisseur (ordre fixe), les items sans fournisseur valide à la fin. */
export function groupBySupplier(items: ShopItem[]): { key: string; title: string; items: ShopItem[] }[] {
  const groups: { key: string; title: string; items: ShopItem[] }[] = SHOP_SUPPLIERS.map((s) => ({
    key: s.key,
    title: s.label,
    items: items.filter((i) => i.supplier === s.key),
  }));
  const orphans = items.filter((i) => supplierRank(i.supplier) === 99);
  if (orphans.length) groups.push({ key: "__none", title: "Sans fournisseur", items: orphans });
  return groups.filter((g) => g.items.length > 0);
}

export function toDraft(i?: ShopItem | null): ShopDraft {
  const sup = SHOP_SUPPLIERS.some((s) => s.key === i?.supplier) ? (i!.supplier as ShopSupplier) : "costco";
  return { name: i?.name ?? "", supplier: sup, category: i?.category ?? "autre", notes: i?.notes ?? "" };
}

export function validate(d: ShopDraft, all: ShopItem[], editingId?: string): { name?: string } {
  const n = d.name.trim();
  if (!n) return { name: "Le nom est obligatoire." };
  const dup = all.find((i) => i.id !== editingId && i.supplier === d.supplier && normalize(i.name ?? "") === normalize(n));
  if (dup) return { name: `« ${dup.name} » existe déjà chez ${supplierLabel(d.supplier)}.` };
  return {};
}

export function clean(d: ShopDraft): ShopDraft {
  return { ...d, name: d.name.trim(), notes: d.notes.trim() };
}
