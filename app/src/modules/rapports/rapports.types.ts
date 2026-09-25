/**
 * Rapport mensuel Cluster (collection Firestore `monthlyReports`, id = "YYYY-MM").
 * Produit par parse_reports.py à partir des PDFs du POS. Tous les champs sont
 * optionnels côté lecture : on ne fait jamais confiance à la forme des données.
 */
export interface ReportSummary {
  receipts?: number;
  clients?: number;
  items_sold?: number;
  avg_receipt?: number;
  sales_net?: number;
  tps?: number;
  tvq?: number;
  total_with_tax?: number;
}

export interface ChannelStats {
  receipts?: number;
  sales_net?: number;
  total_with_tax?: number;
}

export interface PaymentLine {
  type?: string;
  qt?: number;
  amount?: number;
  tips?: number;
  total?: number;
}

export interface NamedTotal {
  name?: string;
  qty?: number;
  total?: number;
}

export interface MonthlyReport {
  period: string; // "2026-04"
  year?: number;
  month?: number;
  summary?: ReportSummary;
  channels?: Record<string, ChannelStats | undefined>;
  payments?: PaymentLine[];
  total_tips?: number;
  grand_total_with_tips?: number;
  top_categories?: NamedTotal[];
  top_items?: NamedTotal[];
  total_hours?: number;
  corrections?: { total_amount?: number };
}
