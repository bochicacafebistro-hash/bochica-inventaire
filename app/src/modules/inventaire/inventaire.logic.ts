/**
 * Règles de l'inventaire — reprises à l'identique de la v1 (js/utils.js,
 * js/inventaire.js, js/modals-produits.js, js/pages-secondaires.js).
 */
import { frCollator, normalize } from "@/core/text";
import type { Product, ProductDraft, SectionsSettings, StockStatus, SupplierLite } from "./inventaire.types";

export const DEFAULT_SECTIONS = ["Cuisine", "Emballage", "Bar", "Autre"];
export const ALL = "Toutes";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export const stockOf = (p: Product) => num(p.currentStock);
export const minimumOf = (p: Product) => num(p.minimum);
export const isBox = (p: Pick<Product, "orderUnit">) => p.orderUnit === "boîte";

/** Rouge : stock ≤ minimum · Jaune : ≤ minimum + 20 % · Vert : sinon. */
export function statusOf(p: Product): StockStatus {
  const s = stockOf(p);
  const m = minimumOf(p);
  if (s <= m) return "red";
  if (s <= m * 1.2) return "yellow";
  return "green";
}

const STATUS_RANK: Record<StockStatus, number> = { red: 0, yellow: 1, green: 2 };
export const STATUS_LABEL: Record<StockStatus, string> = { red: "À commander", yellow: "Bientôt bas", green: "OK" };

/** Tri v1 : statut (rouge d'abord), puis ordre manuel (sortOrder). */
export function sortProducts(list: Product[]): Product[] {
  return [...list].sort(
    (a, b) => STATUS_RANK[statusOf(a)] - STATUS_RANK[statusOf(b)] || (a.sortOrder ?? 999) - (b.sortOrder ?? 999),
  );
}

export function sectionsList(settings: SectionsSettings | null): string[] {
  if (settings?.all?.length) return [...settings.all];
  return [...DEFAULT_SECTIONS, ...(settings?.custom ?? [])];
}

export interface InventoryFilter {
  section: string;
  query: string;
  archived: boolean;
}

export function filterProducts(list: Product[], f: InventoryFilter): Product[] {
  const q = normalize(f.query);
  return sortProducts(
    list.filter(
      (p) =>
        !!p.archived === f.archived &&
        (f.archived || f.section === ALL || p.section === f.section) &&
        (!q || normalize(`${p.name ?? ""} ${p.note ?? ""}`).includes(q)),
    ),
  );
}

export interface InventoryCounts {
  total: number;
  red: number;
  yellow: number;
  green: number;
  archived: number;
  /** Produits rouges + jaunes par section (pastille sur les onglets) */
  lowBySection: Map<string, number>;
}

export function countProducts(list: Product[]): InventoryCounts {
  const c: InventoryCounts = { total: 0, red: 0, yellow: 0, green: 0, archived: 0, lowBySection: new Map() };
  for (const p of list) {
    if (p.archived) {
      c.archived++;
      continue;
    }
    c.total++;
    const st = statusOf(p);
    c[st]++;
    if (st !== "green") c.lowBySection.set(p.section ?? "", (c.lowBySection.get(p.section ?? "") ?? 0) + 1);
  }
  return c;
}

// ── Commandes ─────────────────────────────────────────

export function orderLabel(p: Product): string {
  const q = num(p.orderQty);
  if (isBox(p)) return `${q} boîte${q > 1 ? "s" : ""}`;
  return `${q} unité${q > 1 ? "s" : ""}`;
}

/** Nombre d'unités correspondant à une quantité commandée/reçue. */
export function unitsFor(p: Product, qty: number): number {
  return qty * (isBox(p) ? Math.max(1, num(p.unitsPerBox) || 1) : 1);
}

export interface ReceivePreview {
  units: number;
  newStock: number;
  expected: number;
  diff: number; // < 0 : moins que prévu
}

export function receivePreview(p: Product, qty: number): ReceivePreview {
  const units = unitsFor(p, Math.max(0, qty));
  const expected = unitsFor(p, num(p.orderQty));
  return { units, newStock: stockOf(p) + units, expected, diff: units - expected };
}

export function toOrder(list: Product[]): Product[] {
  return sortProducts(list.filter((p) => !p.archived && statusOf(p) !== "green"));
}

export interface OrderGroup {
  key: string;
  title: string;
  contact?: string;
  items: Product[];
  red: number;
  yellow: number;
}

function group(key: string, title: string, items: Product[], contact?: string): OrderGroup {
  return {
    key,
    title,
    contact,
    items,
    red: items.filter((p) => statusOf(p) === "red").length,
    yellow: items.filter((p) => statusOf(p) === "yellow").length,
  };
}

export function groupBySection(items: Product[], sections: string[]): OrderGroup[] {
  const known = sections.map((s) => group(s, s, items.filter((p) => p.section === s)));
  const orphans = items.filter((p) => !sections.includes(p.section ?? ""));
  if (orphans.length) known.push(group("__none", "Sans catégorie", orphans));
  return known.filter((g) => g.items.length > 0);
}

export function groupBySupplier(items: Product[], suppliers: SupplierLite[]): OrderGroup[] {
  const byId = new Map(suppliers.map((s) => [s.id, s]));
  const buckets = new Map<string, Product[]>();
  const none: Product[] = [];
  for (const p of items) {
    if (!p.supplierId) none.push(p);
    else buckets.set(p.supplierId, [...(buckets.get(p.supplierId) ?? []), p]);
  }
  const named: OrderGroup[] = [];
  const deleted: Product[] = [];
  for (const [id, list] of buckets) {
    const s = byId.get(id);
    if (s) named.push(group(id, s.name || "Sans nom", list, s.contact));
    else deleted.push(...list);
  }
  named.sort((a, b) => frCollator.compare(a.title, b.title));
  const groups = named;
  if (deleted.length) groups.push(group("__deleted", "Fournisseur supprimé", deleted));
  if (none.length) groups.push(group("__none", "Sans fournisseur", none));
  return groups;
}

// ── Formulaire produit ────────────────────────────────

export function toProductDraft(p: Product | null, defaultSection: string): ProductDraft {
  return {
    name: p?.name ?? "",
    section: p?.section ?? defaultSection,
    currentStock: String(p?.currentStock ?? 0),
    minimum: String(p?.minimum ?? 0),
    orderUnit: p?.orderUnit === "boîte" ? "boîte" : "unité",
    orderQty: String(p?.orderQty ?? 0),
    unitsPerBox: String(p?.unitsPerBox ?? 1),
    supplierId: p?.supplierId ?? "",
    note: p?.note ?? "",
  };
}

export type ProductErrors = Partial<Record<keyof ProductDraft, string>>;

const isNonNegNumber = (s: string) => s.trim() !== "" && Number.isFinite(Number(s)) && Number(s) >= 0;

export function validateProduct(d: ProductDraft): ProductErrors {
  const e: ProductErrors = {};
  if (!d.name.trim()) e.name = "Le nom est obligatoire.";
  if (!d.section) e.section = "Choisis une catégorie.";
  if (!isNonNegNumber(d.currentStock)) e.currentStock = "Nombre positif ou zéro.";
  if (!isNonNegNumber(d.minimum)) e.minimum = "Nombre positif ou zéro.";
  if (!isNonNegNumber(d.orderQty)) e.orderQty = "Nombre positif ou zéro.";
  if (d.orderUnit === "boîte" && !(isNonNegNumber(d.unitsPerBox) && Number(d.unitsPerBox) >= 1)) {
    e.unitsPerBox = "Au moins 1 unité par boîte.";
  }
  return e;
}

/** Champs Firestore à partir du formulaire (mêmes noms que la v1). */
export function productFields(d: ProductDraft) {
  const box = d.orderUnit === "boîte";
  return {
    name: d.name.trim(),
    section: d.section,
    unit: "unité",
    currentStock: Number(d.currentStock),
    minimum: Number(d.minimum),
    orderUnit: d.orderUnit,
    orderQty: Number(d.orderQty),
    unitsPerBox: box ? Number(d.unitsPerBox) : 1,
    supplierId: d.supplierId,
    note: d.note.trim(),
  };
}

export function nextSortOrder(list: Product[]): number {
  return list.reduce((m, p) => Math.max(m, p.sortOrder ?? 0), 0) + 1;
}

// ── Catégories ────────────────────────────────────────

export type SectionError = string | null;

export function checkSectionName(name: string, sections: string[], exceptIndex = -1): SectionError {
  const n = name.trim();
  if (!n) return "Le nom est vide.";
  if (n === ALL) return `« ${ALL} » est réservé.`;
  if (sections.some((s, i) => i !== exceptIndex && normalize(s) === normalize(n))) return "Cette catégorie existe déjà.";
  return null;
}

/** Catégorie de repli quand on en supprime une : « Autre » si possible. */
export function fallbackSection(sections: string[], removed: string): string {
  const remaining = sections.filter((s) => s !== removed);
  return remaining.includes("Autre") ? "Autre" : (remaining[0] ?? "Autre");
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  if (to < 0 || to >= next.length || from === to) return next;
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x as T);
  return next;
}
