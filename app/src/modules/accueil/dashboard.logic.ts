/**
 * Tableau de bord admin — calculs purs (renderDashboard v1, js/pages-dashboard.js).
 * Corrections par rapport à la v1 : « aujourd'hui » est la date locale (la v1
 * prenait la date UTC : après 20 h l'été, le tableau de bord affichait déjà
 * le lendemain) ; le ratio salaires/ventes utilise les ventes nettes saisies
 * dans Salaires & Pourboires (le widget v1 était vide depuis la v3.76).
 */
import { addDays, isoToDate, monthBounds } from "@/core/dates";
import type { BEvent } from "@/modules/evenements/evenements.logic";
import type { Employee, LeaveRequest } from "@/modules/equipe/equipe.types";
import { foodCost } from "@/modules/cuisine/cuisine.logic";
import type { Ingredient, MenuItem } from "@/modules/cuisine/cuisine.types";
import { expensesIn, revenueStart, revenuesIn } from "@/modules/finances/finances.logic";
import type { Expense, Revenue } from "@/modules/finances/finances.types";
import { statusOf, stockOf } from "@/modules/inventaire/inventaire.logic";
import type { Product } from "@/modules/inventaire/inventaire.types";
import type { KanbanTask } from "@/modules/operations/ops.types";

const num = (v: unknown) => Number(v) || 0;
const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((s, x) => s + f(x), 0);

/** Variation en % (pctChange v1) : précédent 0 → 100 % si hausse, sinon 0. */
export function pctChange(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Revenus, dépenses et profit du mois en cours vs le mois précédent (avant taxes). */
export function monthSummary(revs: Revenue[], exps: Expense[], now: Date) {
  const tot = (offset: number) => {
    const b = monthBounds(offset, now);
    const r = sum(revenuesIn(revs, b.start, b.end), (x) => num(x.amount));
    const e = sum(expensesIn(exps, b.start, b.end), (x) => num(x.amount));
    return { revenue: r, expenses: e, profit: r - e, start: b.start, end: b.end };
  };
  const cur = tot(0);
  const prev = tot(-1);
  return {
    cur,
    prev,
    revChange: pctChange(cur.revenue, prev.revenue),
    expChange: pctChange(cur.expenses, prev.expenses),
    profitChange: pctChange(cur.profit, prev.profit),
  };
}

/** Série de 30 jours (du plus ancien à aujourd'hui) : somme des montants par jour. */
export function spark30(items: { amount?: number; date?: string; dateStart?: string }[], today: string): number[] {
  const out = new Array(30).fill(0) as number[];
  const t = isoToDate(today)!.getTime();
  for (const it of items) {
    const d = isoToDate(it.dateStart || it.date);
    if (!d) continue;
    const diff = Math.round((t - d.getTime()) / 86_400_000);
    if (diff >= 0 && diff < 30) out[29 - diff]! += num(it.amount);
  }
  return out;
}

/** Stock critique : produits actifs au rouge, les plus bas d'abord (5). */
export const criticalStock = (list: Product[], n = 5) =>
  list
    .filter((p) => !p.archived && statusOf(p) === "red")
    .sort((a, b) => stockOf(a) - stockOf(b))
    .slice(0, n);

/** Tâches Kanban en retard (non complétées, échéance passée), les plus vieilles d'abord (5). */
export const overdueTasks = (list: KanbanTask[], today: string, n = 5) =>
  list
    .filter((t) => t.status !== "Complété" && t.dueDate && t.dueDate < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
    .slice(0, n);

export const tasksDueToday = (list: KanbanTask[], today: string, n = 5) => list.filter((t) => t.status !== "Complété" && t.dueDate === today).slice(0, n);

/** Les 5 plus grosses dépenses du mois. */
export const topExpenses = (exps: Expense[], start: string, end: string, n = 5) =>
  [...expensesIn(exps, start, end)].sort((a, b) => num(b.amount) - num(a.amount)).slice(0, n);

const byDateTime = (a: BEvent, b: BEvent) => (a.date ?? "").localeCompare(b.date ?? "") || (a.time || "99:99").localeCompare(b.time || "99:99");

/** Événements non annulés entre deux dates, dans l'ordre. */
export const eventsBetween = (list: BEvent[], start: string, end: string) => list.filter((e) => e.date && e.date >= start && e.date <= end && e.status !== "annule").sort(byDateTime);

/** Marge moyenne du menu (plats avec recette et prix). */
export function avgMenuMargin(menu: MenuItem[], ingredients: Ingredient[]) {
  const map = new Map(ingredients.map((i) => [i.id, i]));
  const items = menu.filter((m) => (m.recipe?.length ?? 0) > 0 && num(m.price) > 0);
  if (!items.length) return { count: 0, pct: 0 };
  const pct = sum(items, (m) => ((num(m.price) - foodCost(m.recipe, map)) / num(m.price)) * 100) / items.length;
  return { count: items.length, pct };
}

export type Section = "cuisine" | "service" | "other";
const secOf = (s?: string): Section => (s === "cuisine" ? "cuisine" : (s ?? "service") === "service" ? "service" : "other");

/** Qui travaille aujourd'hui (horaire prévu), groupé Cuisine / Service / Autre, par heure d'arrivée. */
export function shiftsToday(emps: Employee[], today: string) {
  const list = emps
    .filter((e) => !e.archived && e.shifts?.[today]?.start)
    .map((e) => ({ id: e.id, name: e.name || "—", start: e.shifts![today]!.start!, end: e.shifts![today]!.end || "", section: secOf(e.section) }))
    .sort((a, b) => a.start.localeCompare(b.start));
  const groups = (["cuisine", "service", "other"] as const).map((k) => ({ key: k, list: list.filter((s) => s.section === k) })).filter((g) => g.list.length);
  return { count: list.length, groups };
}

/** Demandes de congé en attente (bannière) : nombre et jusqu'à 4 noms. */
export function pendingLeaves(list: LeaveRequest[]) {
  const pending = list.filter((r) => r.status === "pending");
  const names = [...new Set(pending.map((r) => r.empName).filter(Boolean))] as string[];
  return { count: pending.length, names: names.slice(0, 4).join(", ") + (names.length > 4 ? "…" : "") };
}

/** Libellé court d'un jour de la semaine : « Auj. », « Demain », « Ven 26 ». */
export function dayTag(iso: string, today: string) {
  if (iso === today) return "Auj.";
  if (iso === addDays(today, 1)) return "Demain";
  const d = isoToDate(iso)!;
  return `${["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][d.getDay()]} ${d.getDate()}`;
}

/** Urgence de la remise TPS/TVQ : en retard, dans ≤ 15 jours, ou OK. */
export const taxUrgency = (daysLeft: number) => (daysLeft < 0 ? "late" : daysLeft <= 15 ? "soon" : "ok");

export { revenueStart };
