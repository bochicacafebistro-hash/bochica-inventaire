/**
 * Calculs purs du module Rapports — aucune dépendance à React ni à Firebase.
 * Reprend la logique de js/pages-rapports.js (v1), avec deux améliorations :
 *  - l'écart vs l'année précédente compare des mois équivalents seulement
 *    (avant : total complet vs total A-1 partiel) ;
 *  - les canaux « Ramassage » (salle + en ligne) sont regroupés.
 */
import type { MonthlyReport } from "./rapports.types";

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

// ── Périodes ────────────────────────────────────────────

export type PeriodPreset = "3" | "6" | "12" | "all" | "custom";

export interface PeriodFilter {
  preset: PeriodPreset;
  start?: string; // "YYYY-MM" (custom)
  end?: string;
}

const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MONTHS_LONG = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export function monthShort(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_SHORT[(m ?? 1) - 1] ?? "?"} ${String(y).slice(2)}`;
}

export function monthLong(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_LONG[(m ?? 1) - 1] ?? "?"} ${y}`;
}

export function prevYearPeriod(period: string): string {
  const [y, m] = period.split("-");
  return `${Number(y) - 1}-${m}`;
}

export function sortReports(reports: MonthlyReport[]): MonthlyReport[] {
  return reports.filter((r) => /^\d{4}-\d{2}$/.test(r.period ?? "")).sort((a, b) => a.period.localeCompare(b.period));
}

export function filterReports(sorted: MonthlyReport[], f: PeriodFilter): MonthlyReport[] {
  if (f.preset === "all") return sorted;
  if (f.preset === "custom") {
    const start = f.start && f.end && f.start > f.end ? f.end : f.start;
    const end = f.start && f.end && f.start > f.end ? f.start : f.end;
    return sorted.filter((r) => (!start || r.period >= start) && (!end || r.period <= end));
  }
  return sorted.slice(-Number(f.preset));
}

// ── KPI ─────────────────────────────────────────────────

export interface Totals {
  revenue: number;
  receipts: number;
  clients: number;
  tips: number;
  hours: number;
  avgReceipt: number;
}

export function totals(reports: MonthlyReport[]): Totals {
  const t = { revenue: 0, receipts: 0, clients: 0, tips: 0, hours: 0 };
  for (const r of reports) {
    t.revenue += n(r.summary?.total_with_tax);
    t.receipts += n(r.summary?.receipts);
    t.clients += n(r.summary?.clients);
    t.tips += n(r.total_tips);
    t.hours += n(r.total_hours);
  }
  return { ...t, avgReceipt: t.receipts > 0 ? t.revenue / t.receipts : 0 };
}

export interface YoyComparison {
  /** Totaux de la période courante, limités aux mois qui ont un équivalent A-1 */
  current: Totals;
  previous: Totals;
  comparableMonths: number;
}

export function yoyComparison(selected: MonthlyReport[], all: MonthlyReport[]): YoyComparison | null {
  const byPeriod = new Map(all.map((r) => [r.period, r]));
  const pairs = selected
    .map((r) => [r, byPeriod.get(prevYearPeriod(r.period))] as const)
    .filter((p): p is readonly [MonthlyReport, MonthlyReport] => p[1] !== undefined);
  if (pairs.length === 0) return null;
  return {
    current: totals(pairs.map((p) => p[0])),
    previous: totals(pairs.map((p) => p[1])),
    comparableMonths: pairs.length,
  };
}

export function pctDelta(curr: number, prev: number | null | undefined): number | null {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// ── Séries mensuelles ───────────────────────────────────

export interface MonthPoint {
  period: string;
  label: string;
  revenue: number;
  revenuePrev: number | null;
  tips: number;
  tipsPrev: number | null;
  hours: number;
  hoursPrev: number | null;
}

export function monthlySeries(selected: MonthlyReport[], all: MonthlyReport[]): MonthPoint[] {
  const byPeriod = new Map(all.map((r) => [r.period, r]));
  return selected.map((r) => {
    const p = byPeriod.get(prevYearPeriod(r.period));
    return {
      period: r.period,
      label: monthShort(r.period),
      revenue: n(r.summary?.total_with_tax),
      revenuePrev: p ? n(p.summary?.total_with_tax) : null,
      tips: n(r.total_tips),
      tipsPrev: p ? n(p.total_tips) : null,
      hours: n(r.total_hours),
      hoursPrev: p ? n(p.total_hours) : null,
    };
  });
}

// ── Canaux de vente ─────────────────────────────────────

/** Ordre fixe = couleur fixe (index dans la palette). */
export const CHANNELS = [
  { key: "tables", label: "Tables", sources: ["tables"] },
  { key: "comptoir", label: "Comptoir", sources: ["comptoir"] },
  { key: "emporter", label: "Pour emporter", sources: ["emporter"] },
  { key: "livraison", label: "Livraison", sources: ["el_livraison"] },
  { key: "ramassage", label: "Ramassage", sources: ["ramassage", "el_ramassage"] },
  { key: "autres", label: "Autres (en ligne)", sources: ["el_comptoir"] },
] as const;

export type ChannelKey = (typeof CHANNELS)[number]["key"];
export type ChannelRow = { period: string; label: string } & Record<ChannelKey, number>;

export function channelSeries(selected: MonthlyReport[]): { rows: ChannelRow[]; active: ChannelKey[] } {
  const rows = selected.map((r) => {
    const row = { period: r.period, label: monthShort(r.period) } as ChannelRow;
    for (const c of CHANNELS) {
      row[c.key] = c.sources.reduce(
        (s, src) => s + n(r.channels?.[src]?.total_with_tax ?? r.channels?.[src]?.sales_net),
        0,
      );
    }
    return row;
  });
  const active = CHANNELS.filter((c) => rows.some((row) => row[c.key] > 0)).map((c) => c.key);
  return { rows, active };
}

// ── Paiements, catégories, articles ─────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  INT: "Interac",
  MAS: "Mastercard",
  VIS: "Visa",
  AME: "American Express",
  DIS: "Discover",
  UBE: "Uber Eats",
  DOO: "DoorDash",
  GIF: "Carte-cadeau",
};

export interface RankedRow {
  name: string;
  total: number;
  qty: number;
}

export function paymentsRanking(selected: MonthlyReport[]): RankedRow[] {
  const agg = new Map<string, RankedRow>();
  for (const r of selected) {
    for (const p of r.payments ?? []) {
      const code = (p.type ?? "").trim();
      if (!code || code === "?") continue;
      const cur = agg.get(code) ?? { name: PAYMENT_LABELS[code] ?? code, total: 0, qty: 0 };
      cur.total += n(p.amount);
      cur.qty += n(p.qt);
      agg.set(code, cur);
    }
  }
  return [...agg.values()].filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
}

/** Catégories fusionnées sans tenir compte de la casse (« Bière » = « BIÈRE »). */
export function categoriesRanking(selected: MonthlyReport[]): RankedRow[] {
  const agg = new Map<string, RankedRow>();
  for (const r of selected) {
    for (const c of r.top_categories ?? []) {
      const name = (c.name ?? "").trim();
      if (!name) continue;
      const key = name.toUpperCase();
      const cur = agg.get(key) ?? { name, total: 0, qty: 0 };
      cur.total += n(c.total);
      cur.qty += n(c.qty);
      agg.set(key, cur);
    }
  }
  return [...agg.values()].sort((a, b) => b.total - a.total);
}

export function topItems(selected: MonthlyReport[], limit = 15): RankedRow[] {
  const agg = new Map<string, RankedRow>();
  for (const r of selected) {
    for (const it of r.top_items ?? []) {
      const name = (it.name ?? "").trim();
      if (!name) continue;
      const cur = agg.get(name) ?? { name, total: 0, qty: 0 };
      cur.total += n(it.total);
      cur.qty += n(it.qty);
      agg.set(name, cur);
    }
  }
  return [...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, limit);
}

/** Garde les N premiers et regroupe le reste dans « Autres ». */
export function foldTail(rows: RankedRow[], keep: number): RankedRow[] {
  if (rows.length <= keep + 1) return rows;
  const head = rows.slice(0, keep);
  const tail = rows.slice(keep);
  return [
    ...head,
    {
      name: `Autres (${tail.length})`,
      total: tail.reduce((s, x) => s + x.total, 0),
      qty: tail.reduce((s, x) => s + x.qty, 0),
    },
  ];
}

// ── Tableau récapitulatif ───────────────────────────────

export interface RecapRow {
  period: string;
  receipts: number;
  clients: number;
  avgReceipt: number;
  salesNet: number;
  taxes: number;
  total: number;
  deltaPrevMonth: number | null;
  totalPrevYear: number | null;
  deltaYoy: number | null;
  tips: number;
  hours: number;
  corrections: number;
}

export function recapRows(selected: MonthlyReport[], all: MonthlyReport[]): RecapRow[] {
  const byPeriod = new Map(all.map((r) => [r.period, r]));
  return selected.map((r, i) => {
    const s = r.summary ?? {};
    const total = n(s.total_with_tax);
    const prev = i > 0 ? selected[i - 1] : undefined;
    const py = byPeriod.get(prevYearPeriod(r.period));
    const totalPrevYear = py ? n(py.summary?.total_with_tax) : null;
    return {
      period: r.period,
      receipts: n(s.receipts),
      clients: n(s.clients),
      avgReceipt: n(s.avg_receipt),
      salesNet: n(s.sales_net),
      taxes: n(s.tps) + n(s.tvq),
      total,
      deltaPrevMonth: prev ? pctDelta(total, n(prev.summary?.total_with_tax)) : null,
      totalPrevYear,
      deltaYoy: pctDelta(total, totalPrevYear),
      tips: n(r.total_tips),
      hours: n(r.total_hours),
      corrections: n(r.corrections?.total_amount),
    };
  });
}
