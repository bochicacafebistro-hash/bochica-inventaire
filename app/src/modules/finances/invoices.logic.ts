/** Factures — calculs repris de js/pages-invoices.js (v1). */
import { addDays, todayISO } from "@/core/dates";
import { TPS_RATE, TVQ_RATE } from "@/core/taxes";
import { normalize } from "@/core/text";
import type { Invoice, InvoiceLine } from "./finances.types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export const INVOICE_STATUSES = [
  { key: "brouillon", label: "Brouillon" },
  { key: "envoyee", label: "Envoyée" },
  { key: "payee", label: "Payée" },
  { key: "annulee", label: "Annulée" },
] as const;

export const invoiceStatusLabel = (s?: string) => INVOICE_STATUSES.find((x) => x.key === s)?.label ?? "Brouillon";

export const lineTotal = (l: Pick<InvoiceLine, "quantity" | "unitPrice">) => num(l.quantity) * num(l.unitPrice);

export function invoiceTotals(inv: Pick<Invoice, "lines" | "tpsRate" | "tvqRate">) {
  const sub = (inv.lines ?? []).reduce((s, l) => s + lineTotal(l), 0);
  const tps = sub * num(inv.tpsRate);
  const tvq = sub * num(inv.tvqRate);
  return { sub, tps, tvq, total: sub + tps + tvq };
}

/** FAC-AAAA-NNN (v1). */
export function nextInvoiceNumber(list: Invoice[], year = new Date().getFullYear()): string {
  const prefix = `FAC-${year}-`;
  const max = list
    .map((i) => i.invoiceNumber ?? "")
    .filter((n) => n.startsWith(prefix))
    .reduce((m, n) => Math.max(m, parseInt(n.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const isOverdue = (i: Invoice, today = todayISO()) => i.status === "envoyee" && !!i.dueDate && i.dueDate < today;

export function filterInvoices(list: Invoice[], status: string, query: string): Invoice[] {
  const q = normalize(query);
  return list
    .filter((i) => status === "all" || (i.status ?? "brouillon") === status)
    .filter((i) => !q || normalize(`${i.invoiceNumber ?? ""} ${i.clientName ?? ""} ${i.clientCompany ?? ""} ${i.clientEmail ?? ""}`).includes(q))
    .sort((a, b) => (b.invoiceNumber ?? "").localeCompare(a.invoiceNumber ?? ""));
}

export function invoiceKpis(list: Invoice[]) {
  const sum = (f: (i: Invoice) => boolean) => list.filter(f).reduce((s, i) => s + invoiceTotals(i).total, 0);
  return {
    total: sum(() => true),
    paid: sum((i) => i.status === "payee"),
    pending: sum((i) => i.status === "envoyee"),
    overdue: sum((i) => isOverdue(i)),
    drafts: list.filter((i) => (i.status ?? "brouillon") === "brouillon").length,
  };
}

/** Revenu créé quand la facture est payée (mêmes champs que la v1). */
export function revenueForInvoice(inv: Invoice, invoiceId: string) {
  const t = invoiceTotals(inv);
  return {
    description: `Facture ${inv.invoiceNumber} — ${inv.clientName}${inv.clientCompany ? ` (${inv.clientCompany})` : ""}`,
    amount: t.sub,
    tps: Math.round(t.tps * 100) / 100,
    tvq: Math.round(t.tvq * 100) / 100,
    date: inv.invoiceDate || todayISO(),
    dateStart: inv.invoiceDate || todayISO(),
    dateEnd: null,
    notes: `Créé automatiquement depuis la facture ${inv.invoiceNumber}. Modifier la facture met à jour ce revenu.`,
    sourceInvoiceId: invoiceId,
  };
}

/** Pourcentage affiché : 0.09975 → « 9,975 ». */
export const ratePct = (r: number) => (r * 100).toFixed(3).replace(/\.?0+$/, "").replace(".", ",");

// ── Formulaire ────────────────────────────────────────

export interface InvoiceDraft {
  clientName: string;
  clientCompany: string;
  clientPhone: string;
  clientEmail: string;
  clientAddress: string;
  invoiceDate: string;
  dueDate: string;
  status: string;
  lines: { id: string; description: string; quantity: string; unitPrice: string }[];
  tpsPct: string;
  tvqPct: string;
  notes: string;
}

let k = 0;
export const newLineId = () => `L${Date.now().toString(36)}${(++k).toString(36)}`;

export function toInvoiceDraft(inv: Invoice | null, today = todayISO()): InvoiceDraft {
  const date = inv?.invoiceDate ?? today;
  const lines = (inv?.lines ?? []).map((l) => ({ id: l.id || newLineId(), description: l.description ?? "", quantity: String(l.quantity ?? 1), unitPrice: String(l.unitPrice ?? 0) }));
  return {
    clientName: inv?.clientName ?? "",
    clientCompany: inv?.clientCompany ?? "",
    clientPhone: inv?.clientPhone ?? "",
    clientEmail: inv?.clientEmail ?? "",
    clientAddress: inv?.clientAddress ?? "",
    invoiceDate: date,
    dueDate: inv?.dueDate ?? addDays(date, 30),
    status: inv?.status ?? "brouillon",
    lines: lines.length ? lines : [{ id: newLineId(), description: "", quantity: "1", unitPrice: "" }],
    tpsPct: (typeof inv?.tpsRate === "number" ? inv.tpsRate * 100 : TPS_RATE * 100).toFixed(3).replace(/\.?0+$/, ""),
    tvqPct: (typeof inv?.tvqRate === "number" ? inv.tvqRate * 100 : TVQ_RATE * 100).toFixed(3).replace(/\.?0+$/, ""),
    notes: inv?.notes ?? "",
  };
}

export function draftInvoice(d: InvoiceDraft) {
  return {
    clientName: d.clientName.trim(),
    clientCompany: d.clientCompany.trim(),
    clientPhone: d.clientPhone.trim(),
    clientEmail: d.clientEmail.trim(),
    clientAddress: d.clientAddress.trim(),
    invoiceDate: d.invoiceDate,
    dueDate: d.dueDate,
    lines: d.lines.map((l) => ({ id: l.id, description: l.description.trim(), quantity: num(l.quantity), unitPrice: num(l.unitPrice) })),
    tpsRate: Math.round(num(d.tpsPct) * 10_000) / 1_000_000,
    tvqRate: Math.round(num(d.tvqPct) * 10_000) / 1_000_000,
    notes: d.notes.trim(),
    status: d.status,
  };
}

export function validateInvoice(d: InvoiceDraft): Partial<Record<"clientName" | "lines" | "clientEmail", string>> {
  const e: Partial<Record<"clientName" | "lines" | "clientEmail", string>> = {};
  if (!d.clientName.trim()) e.clientName = "Le nom du client est obligatoire.";
  if (!d.lines.some((l) => l.description.trim() && num(l.quantity) > 0)) e.lines = "Ajoute au moins une ligne avec une description et une quantité.";
  if (d.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.clientEmail.trim())) e.clientEmail = "Courriel invalide.";
  return e;
}

/**
 * Ce qu'il faut faire avec le revenu lié quand une facture change.
 * La v1 ne mettait pas à jour le revenu quand on modifiait une facture déjà payée.
 */
export function revenueAction(wasPaid: boolean, willBePaid: boolean, hasRevenue: boolean): "create" | "delete" | "update" | "none" {
  if (!wasPaid && willBePaid) return "create";
  if (wasPaid && !willBePaid) return hasRevenue ? "delete" : "none";
  if (wasPaid && willBePaid) return hasRevenue ? "update" : "create";
  return "none";
}
