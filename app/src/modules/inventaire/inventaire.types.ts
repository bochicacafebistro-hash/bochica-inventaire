/** Collection `products` (format v1). */
export type OrderUnit = "unité" | "boîte";

export interface Product {
  id: string;
  name?: string;
  section?: string;
  currentStock?: number;
  minimum?: number;
  orderQty?: number;
  orderUnit?: OrderUnit | string;
  unitsPerBox?: number;
  supplierId?: string;
  sortOrder?: number;
  archived?: boolean;
  note?: string;
  unit?: string;
}

/** Document settings/sections. */
export interface SectionsSettings {
  all?: string[];
  custom?: string[];
}

export interface SupplierLite {
  id: string;
  name?: string;
  contact?: string;
}

export type StockStatus = "red" | "yellow" | "green";

export interface ProductDraft {
  name: string;
  section: string;
  currentStock: string;
  minimum: string;
  orderUnit: OrderUnit;
  orderQty: string;
  unitsPerBox: string;
  supplierId: string;
  note: string;
}
