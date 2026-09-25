/** Collections finances (format v1). Montants en dollars, avant taxes sauf mention. */
export interface CustomLine {
  description: string;
  amount: number;
}

export interface Expense {
  id: string;
  description?: string;
  supplier?: string;
  category?: string;
  type?: "fixe" | "variable" | string;
  date?: string; // AAAA-MM-JJ
  amount?: number; // avant taxes, frais supplémentaires inclus
  tps?: number;
  tvq?: number;
  noTax?: boolean;
  customLines?: CustomLine[]; // frais supplémentaires (livraison…) inclus dans amount
  notes?: string;
  isFixedAuto?: boolean;
}

export interface Revenue {
  id: string;
  description?: string;
  amount?: number; // avant taxes
  tps?: number;
  tvq?: number;
  date?: string; // = dateStart (compatibilité)
  dateStart?: string;
  dateEnd?: string | null;
  notes?: string;
  sourceInvoiceId?: string;
}

export interface ExpenseCategory {
  id: string;
  name?: string;
  type?: "fixe" | "variable" | string;
}

export interface FixedTemplate {
  id: string;
  supplier?: string;
  description?: string;
  category?: string;
  amount?: number;
  tps?: number;
  tvq?: number;
  notes?: string;
}

export interface InvoiceLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  invoiceDate?: string;
  dueDate?: string;
  lines?: InvoiceLine[];
  tpsRate?: number;
  tvqRate?: number;
  notes?: string;
  status?: string;
  paidRevenueId?: string;
}
