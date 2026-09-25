/**
 * Dépenses, revenus, catégories, frais fixes, TPS/TVQ — règles reprises de
 * js/pages-finance.js et js/pages-dashboard.js (v1), avec les dates lues en
 * heure locale partout (la v1 lisait parfois « 2026-03-01 » comme minuit UTC,
 * ce qui classait les dépenses du 1er du mois dans le mois précédent du graphique).
 */
import { addDays, isoToDate, pad2, todayISO, toISO } from "@/core/dates";
import { TPS_RATE, TVQ_RATE } from "@/core/taxes";
import { frCollator, normalize } from "@/core/text";
import type { CustomLine, Expense, ExpenseCategory, FixedTemplate, Revenue } from "./finances.types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Catégories ────────────────────────────────────────

export type ExpenseType = "fixe" | "variable";

export const DEFAULT_EXPENSE_CATS: { name: string; type: ExpenseType }[] = [
  { name: "Nourriture", type: "variable" },
  { name: "Loyer", type: "fixe" },
  { name: "Électricité", type: "fixe" },
  { name: "Internet", type: "fixe" },
  { name: "Logiciels", type: "fixe" },
  { name: "Abonnements", type: "fixe" },
  { name: "Salaires", type: "fixe" },
  { name: "Taxes", type: "fixe" },
  { name: "Autres", type: "variable" },
];

export function allCategories(custom: ExpenseCategory[]): string[] {
  return [...new Set([...DEFAULT_EXPENSE_CATS.map((c) => c.name), ...custom.map((c) => c.name ?? "").filter(Boolean)])];
}

export function categoryType(name: string | undefined, custom: ExpenseCategory[]): ExpenseType {
  const d = DEFAULT_EXPENSE_CATS.find((c) => c.name === name);
  if (d) return d.type;
  return custom.find((c) => c.name === name)?.type === "fixe" ? "fixe" : "variable";
}

/** Type d'une dépense : celui choisi dans le formulaire, sinon celui de sa catégorie. */
export function expenseType(e: Expense, custom: ExpenseCategory[]): ExpenseType {
  return e.type === "fixe" || e.type === "variable" ? e.type : categoryType(e.category, custom);
}

// ── Montants ──────────────────────────────────────────

export const expenseTaxes = (e: Expense) => num(e.tps) + num(e.tvq);
export const expenseTotal = (e: Expense) => num(e.amount) + expenseTaxes(e);
export const revenueStart = (r: Revenue) => r.dateStart || r.date || "";

// ── Périodes ──────────────────────────────────────────

export type PeriodKind = "semaine" | "mois" | "annee";
export interface Period {
  kind: PeriodKind;
  year: number;
  month: number; // 0-11
}

/** Bornes AAAA-MM-JJ incluses. « semaine » = 7 derniers jours (comme la v1). */
export function periodBounds(p: Period, today = todayISO()): { start: string; end: string } {
  if (p.kind === "semaine") return { start: addDays(today, -7), end: today };
  if (p.kind === "mois") {
    const last = new Date(p.year, p.month + 1, 0).getDate();
    return { start: `${p.year}-${pad2(p.month + 1)}-01`, end: `${p.year}-${pad2(p.month + 1)}-${pad2(last)}` };
  }
  return { start: `${p.year}-01-01`, end: `${p.year}-12-31` };
}

export const inRange = (iso: string | undefined, start: string, end: string) => !!iso && iso >= start && iso <= end;

export function expensesIn(list: Expense[], start: string, end: string): Expense[] {
  return list.filter((e) => inRange(e.date, start, end)).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

export function revenuesIn(list: Revenue[], start: string, end: string): Revenue[] {
  return list.filter((r) => inRange(revenueStart(r), start, end)).sort((a, b) => revenueStart(b).localeCompare(revenueStart(a)));
}

export interface PeriodTotals {
  revenue: number; // avant taxes
  expenses: number; // avant taxes
  expenseTaxes: number;
  profit: number; // revenus − dépenses taxes incluses (comme la v1)
  fixed: number;
  variable: number;
}

export function periodTotals(exps: Expense[], revs: Revenue[], custom: ExpenseCategory[]): PeriodTotals {
  const revenue = revs.reduce((s, r) => s + num(r.amount), 0);
  const expenses = exps.reduce((s, e) => s + num(e.amount), 0);
  const taxes = exps.reduce((s, e) => s + expenseTaxes(e), 0);
  const fixed = exps.filter((e) => expenseType(e, custom) === "fixe").reduce((s, e) => s + num(e.amount), 0);
  return { revenue, expenses, expenseTaxes: taxes, profit: revenue - (expenses + taxes), fixed, variable: expenses - fixed };
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** 6 derniers mois : revenus (avant taxes) et dépenses (taxes incluses), comme le graphique v1. */
export function lastMonthsSeries(exps: Expense[], revs: Revenue[], count = 6, today = todayISO()) {
  const t = isoToDate(today)!;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth() - (count - 1 - i), 1);
    const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    const revenue = revs.filter((r) => revenueStart(r).startsWith(key)).reduce((s, r) => s + num(r.amount), 0);
    const expenses = exps.filter((e) => (e.date ?? "").startsWith(key)).reduce((s, e) => s + expenseTotal(e), 0);
    return { key, label: `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, revenue, expenses, profit: revenue - expenses };
  });
}

export function byCategory(exps: Expense[]): { name: string; total: number; qty: number }[] {
  const m = new Map<string, { name: string; total: number; qty: number }>();
  for (const e of exps) {
    const k = e.category || "Sans catégorie";
    const cur = m.get(k) ?? { name: k, total: 0, qty: 0 };
    cur.total += num(e.amount);
    cur.qty += 1;
    m.set(k, cur);
  }
  return [...m.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
}

export function searchExpenses(list: Expense[], query: string, category: string): Expense[] {
  const q = normalize(query);
  return list.filter(
    (e) =>
      (category === "all" || e.category === category) &&
      (!q || normalize(`${e.description ?? ""} ${e.supplier ?? ""} ${e.notes ?? ""} ${e.category ?? ""}`).includes(q)),
  );
}

/** « 10 nov. – 16 nov. 2026 » ou la date seule. */
export function revenuePeriodLabel(r: Revenue): string {
  const s = revenueStart(r);
  const e = r.dateEnd;
  const fmt = (iso: string, year: boolean) => {
    const d = isoToDate(iso);
    return d ? `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}${year ? ` ${d.getFullYear()}` : ""}` : iso;
  };
  if (!e || e === s) return s ? fmt(s, true) : "";
  return `${fmt(s, s.slice(0, 4) !== e.slice(0, 4))} – ${fmt(e, true)}`;
}

// ── Formulaire dépense ────────────────────────────────

export interface ExpenseDraft {
  description: string;
  supplier: string;
  category: string;
  type: ExpenseType;
  date: string;
  baseAmount: string; // montant avant frais supplémentaires
  extras: { key: string; description: string; amount: string }[];
  noTax: boolean;
  tps: string;
  tvq: string;
  taxesManual: boolean;
  notes: string;
}

let k = 0;
export const newKey = () => `x${Date.now().toString(36)}${(++k).toString(36)}`;

export function toExpenseDraft(e: Expense | null, custom: ExpenseCategory[], today = todayISO()): ExpenseDraft {
  const extras = (e?.customLines ?? []).map((l) => ({ key: newKey(), description: l.description ?? "", amount: String(l.amount ?? "") }));
  const extrasTotal = extras.reduce((s, x) => s + num(x.amount), 0);
  const category = e?.category ?? allCategories(custom)[0]!;
  const base = e ? round2(num(e.amount) - extrasTotal) : 0;
  return {
    description: e?.description ?? "",
    supplier: e?.supplier ?? "",
    category,
    type: e ? expenseType(e, custom) : categoryType(category, custom),
    date: e?.date ?? today,
    baseAmount: e ? String(base || "") : "",
    extras,
    noTax: !!e?.noTax,
    tps: e?.tps != null ? String(e.tps) : "",
    tvq: e?.tvq != null ? String(e.tvq) : "",
    // Une dépense existante garde ses taxes telles quelles tant qu'on ne touche pas au montant
    taxesManual: !!e,
    notes: e?.notes ?? "",
  };
}

export function expenseSubtotal(d: ExpenseDraft): number {
  return num(d.baseAmount) + d.extras.reduce((s, x) => s + num(x.amount), 0);
}

/** Taxes proposées automatiquement (arrondies au cent, comme la v1). */
export function autoTaxes(subtotal: number): { tps: string; tvq: string } {
  return subtotal > 0 ? { tps: (subtotal * TPS_RATE).toFixed(2), tvq: (subtotal * TVQ_RATE).toFixed(2) } : { tps: "", tvq: "" };
}

export type ExpenseErrors = Partial<Record<"description" | "amount" | "date", string>>;

export function validateExpense(d: ExpenseDraft): ExpenseErrors {
  const e: ExpenseErrors = {};
  if (!d.description.trim()) e.description = "La description est obligatoire.";
  if (!expenseSubtotal(d)) e.amount = "Le montant est obligatoire.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = "Choisis une date.";
  return e;
}

export function expenseFields(d: ExpenseDraft) {
  const customLines: CustomLine[] = d.extras
    .map((x) => ({ description: x.description.trim(), amount: num(x.amount) }))
    .filter((x) => x.description || x.amount);
  return {
    supplier: d.supplier.trim(),
    description: d.description.trim(),
    amount: round2(num(d.baseAmount) + customLines.reduce((s, l) => s + l.amount, 0)),
    tps: d.noTax ? 0 : num(d.tps),
    tvq: d.noTax ? 0 : num(d.tvq),
    noTax: d.noTax,
    customLines,
    date: d.date,
    category: d.category,
    type: d.type,
    notes: d.notes.trim(),
  };
}

// ── Formulaire revenu ─────────────────────────────────

export interface RevenueDraft {
  description: string;
  dateStart: string;
  dateEnd: string;
  amount: string;
  tps: string;
  tvq: string;
  taxesManual: boolean;
  notes: string;
}

export function toRevenueDraft(r: Revenue | null, today = todayISO()): RevenueDraft {
  return {
    description: r?.description ?? "",
    dateStart: r ? revenueStart(r) || today : today,
    dateEnd: r?.dateEnd ?? "",
    amount: r?.amount != null ? String(r.amount) : "",
    tps: r?.tps != null ? String(r.tps) : "",
    tvq: r?.tvq != null ? String(r.tvq) : "",
    taxesManual: !!r,
    notes: r?.notes ?? "",
  };
}

export function validateRevenue(d: RevenueDraft): Partial<Record<"description" | "amount" | "dateStart" | "dateEnd", string>> {
  const e: Partial<Record<"description" | "amount" | "dateStart" | "dateEnd", string>> = {};
  if (!d.description.trim()) e.description = "La description est obligatoire.";
  if (!num(d.amount)) e.amount = "Le montant est obligatoire.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dateStart)) e.dateStart = "Choisis une date.";
  if (d.dateEnd && d.dateEnd < d.dateStart) e.dateEnd = "La fin doit être après le début.";
  return e;
}

export function revenueFields(d: RevenueDraft) {
  return {
    description: d.description.trim(),
    amount: num(d.amount),
    tps: num(d.tps),
    tvq: num(d.tvq),
    dateStart: d.dateStart,
    dateEnd: d.dateEnd || null,
    date: d.dateStart, // compatibilité v1
    notes: d.notes.trim(),
  };
}

// ── Frais fixes automatiques ──────────────────────────

/** Mois AAAA-MM de start à end inclus, au plus `maxBack` derniers (v1 : 12). */
export function monthsBetween(startKey: string, endKey: string, maxBack = 12): string[] {
  const [sy, sm] = startKey.split("-").map(Number);
  const [ey, em] = endKey.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return [endKey];
  const out: string[] = [];
  for (let y = sy, m = sm; y < ey || (y === ey && m <= em); m === 12 ? ((m = 1), y++) : m++) {
    out.push(`${y}-${pad2(m)}`);
    if (out.length > 24) break;
  }
  return out.slice(-maxBack);
}

/**
 * Frais fixes à créer (même logique que autoApplyFixedExpenses v1) : depuis
 * le plus ancien mois déjà appliqué jusqu'au mois courant, chaque mois sans
 * aucune dépense `isFixedAuto` reçoit une copie de chaque modèle, datée du 1er.
 */
export function pendingFixedExpenses(templates: FixedTemplate[], expenses: Expense[], today = todayISO()) {
  if (!templates.length) return { months: [] as string[], entries: [] as Record<string, unknown>[] };
  const current = today.slice(0, 7);
  const applied = expenses.filter((e) => e.isFixedAuto && e.date).map((e) => e.date!.slice(0, 7));
  const oldest = [...applied].sort()[0] ?? current;
  const months = monthsBetween(oldest, current, 12).filter((m) => !applied.includes(m));
  const entries = months.flatMap((m) =>
    templates.map((t) => ({
      supplier: t.supplier || "",
      description: t.supplier || t.description || "",
      amount: num(t.amount),
      tps: num(t.tps),
      tvq: num(t.tvq),
      category: t.category || "",
      date: `${m}-01`,
      notes: t.notes || "",
      isFixedAuto: true,
    })),
  );
  return { months, entries };
}

// ── TPS / TVQ ─────────────────────────────────────────

export interface Quarter {
  quarter: number;
  year: number;
  start: string;
  end: string;
  due: string; // dernier jour du mois suivant la fin du trimestre
  key: string; // « 2026-Q3 »
}

export function quarterOf(year: number, quarter: number): Quarter {
  const sm = (quarter - 1) * 3;
  return {
    quarter,
    year,
    start: toISO(new Date(year, sm, 1)),
    end: toISO(new Date(year, sm + 3, 0)),
    due: toISO(new Date(year, sm + 4, 0)),
    key: `${year}-Q${quarter}`,
  };
}

export function currentQuarter(today = todayISO()): Quarter {
  const d = isoToDate(today)!;
  return quarterOf(d.getFullYear(), Math.floor(d.getMonth() / 3) + 1);
}

/** Le trimestre courant et les N−1 précédents (plus récent en premier). */
export function recentQuarters(n = 4, today = todayISO()): Quarter[] {
  const c = currentQuarter(today);
  return Array.from({ length: n }, (_, i) => {
    const idx = c.year * 4 + (c.quarter - 1) - i;
    return quarterOf(Math.floor(idx / 4), (idx % 4) + 1);
  });
}

export interface TaxSummary {
  tpsCollected: number;
  tvqCollected: number;
  tpsPaid: number;
  tvqPaid: number;
  tpsToRemit: number;
  tvqToRemit: number;
  revenueCount: number;
  revenueTotal: number;
  expenseCount: number;
  expenseTotal: number;
}

export function taxesForPeriod(revs: Revenue[], exps: Expense[], start: string, end: string): TaxSummary {
  const r = revs.filter((x) => inRange(revenueStart(x), start, end));
  const e = exps.filter((x) => inRange(x.date, start, end));
  const tpsCollected = r.reduce((s, x) => s + num(x.tps), 0);
  const tvqCollected = r.reduce((s, x) => s + num(x.tvq), 0);
  const tpsPaid = e.reduce((s, x) => s + num(x.tps), 0);
  const tvqPaid = e.reduce((s, x) => s + num(x.tvq), 0);
  return {
    tpsCollected,
    tvqCollected,
    tpsPaid,
    tvqPaid,
    tpsToRemit: tpsCollected - tpsPaid,
    tvqToRemit: tvqCollected - tvqPaid,
    revenueCount: r.length,
    revenueTotal: r.reduce((s, x) => s + num(x.amount), 0),
    expenseCount: e.length,
    expenseTotal: e.reduce((s, x) => s + num(x.amount), 0),
  };
}

export const sortByName = (a: { name?: string }, b: { name?: string }) => frCollator.compare(a.name ?? "", b.name ?? "");
