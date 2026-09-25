import type { ProductRef, Supplier, SupplierDraft } from "./fournisseurs.types";

import { frCollator as collator, normalize, telHref } from "@/core/text";

export { normalize, telHref };

export function sortSuppliers(list: Supplier[]): Supplier[] {
  return [...list].sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
}

/** Produits actifs (non archivés) regroupés par fournisseur. */
export function productsBySupplier(products: ProductRef[]): Map<string, ProductRef[]> {
  const map = new Map<string, ProductRef[]>();
  for (const p of products) {
    if (p.archived || !p.supplierId) continue;
    const list = map.get(p.supplierId) ?? [];
    list.push(p);
    map.set(p.supplierId, list);
  }
  for (const list of map.values()) list.sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""));
  return map;
}

/** Recherche dans le nom, le téléphone, le courriel, les notes et les produits liés. */
export function filterSuppliers(list: Supplier[], query: string, linked: Map<string, ProductRef[]>): Supplier[] {
  const q = normalize(query);
  if (!q) return list;
  return list.filter((s) => {
    const haystack = [s.name, s.contact, s.email, s.notes, ...(linked.get(s.id) ?? []).map((p) => p.name)]
      .filter(Boolean)
      .join(" ");
    return normalize(haystack).includes(q);
  });
}

export function toDraft(s?: Supplier | null): SupplierDraft {
  return { name: s?.name ?? "", contact: s?.contact ?? "", email: s?.email ?? "", notes: s?.notes ?? "" };
}

export type DraftErrors = Partial<Record<keyof SupplierDraft, string>>;

export function validateDraft(d: SupplierDraft, existing: Supplier[], editingId?: string): DraftErrors {
  const errors: DraftErrors = {};
  const name = d.name.trim();
  if (!name) errors.name = "Le nom est obligatoire.";
  else if (existing.some((s) => s.id !== editingId && normalize(s.name ?? "") === normalize(name))) {
    errors.name = "Un fournisseur porte déjà ce nom.";
  }
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) {
    errors.email = "Courriel invalide.";
  }
  return errors;
}

/** Nettoie le brouillon avant l'enregistrement. */
export function cleanDraft(d: SupplierDraft): SupplierDraft {
  return { name: d.name.trim(), contact: d.contact.trim(), email: d.email.trim().toLowerCase(), notes: d.notes.trim() };
}

export function copyName(name: string, existing: Supplier[]): string {
  const base = `${name} (copie)`;
  const taken = new Set(existing.map((s) => normalize(s.name ?? "")));
  if (!taken.has(normalize(base))) return base;
  let i = 2;
  while (taken.has(normalize(`${name} (copie ${i})`))) i++;
  return `${name} (copie ${i})`;
}
