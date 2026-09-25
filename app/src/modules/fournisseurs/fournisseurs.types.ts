/** Collection `suppliers` (même format que la v1). */
export interface Supplier {
  id: string;
  name?: string;
  contact?: string; // téléphone
  email?: string;
  notes?: string;
}

/** Champs de `products` utiles à ce module. */
export interface ProductRef {
  id: string;
  name?: string;
  supplierId?: string;
  archived?: boolean;
}

export interface SupplierDraft {
  name: string;
  contact: string;
  email: string;
  notes: string;
}
