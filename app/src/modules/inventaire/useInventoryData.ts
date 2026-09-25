import { useMemo } from "react";
import { useCollection } from "@/core/data/useCollection";
import { useDocument } from "@/core/data/useDocument";
import { sectionsList } from "./inventaire.logic";
import type { Product, SectionsSettings, SupplierLite } from "./inventaire.types";

export function useInventoryData() {
  const products = useCollection<Product>("products");
  const suppliers = useCollection<SupplierLite>("suppliers");
  const sectionsDoc = useDocument<SectionsSettings>("settings", "sections");
  const sections = useMemo(() => sectionsList(sectionsDoc.data), [sectionsDoc.data]);
  return {
    products: products.data,
    suppliers: suppliers.data,
    sectionsSettings: sectionsDoc.data,
    sections,
    loading: products.loading || suppliers.loading || sectionsDoc.loading,
    error: products.error ?? suppliers.error ?? sectionsDoc.error,
  };
}
