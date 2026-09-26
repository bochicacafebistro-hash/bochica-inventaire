/**
 * Horaire de l'équipe et demandes de congé — fonctions pures, mêmes règles
 * que la v1 (js/pages-hr.js, js/pages-leave.js, js/pages-employee.js).
 */
import { addDays, daysBetween, isoToDate, toISO } from "@/core/dates";
import type { Employee, LeaveRequest, ScheduleSettings, Shift } from "./equipe.types";

// ── Semaines ──────────────────────────────────────────

/** Lundi de la semaine de `today` décalée de `offset` semaines (AAAA-MM-JJ). */
export function weekStart(today: string, offset = 0): string {
  const d = isoToDate(today)!;
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  return addDays(toISO(d), offset * 7 - dow);
}

export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, i) => addDays(monday, i));

/** Numéro de semaine ISO 8601. */
export function isoWeek(iso: string): number {
  const d0 = isoToDate(iso)!;
  const d = new Date(Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export const hasShift = (s?: Shift) => !!(s && s.start && s.end);
const sectionPriority = (e: Employee) => (e.section === "cuisine" ? 0 : (e.section ?? "service") === "service" ? 1 : 2);

/**
 * Employés affichés pour une semaine — même liste et même ordre que l'horaire
 * admin (visibleScheduleEmployees) : masqués exclus, archivés seulement s'ils
 * ont travaillé, ordre de la semaine puis Cuisine → Service → Autre.
 */
export function visibleEmployees<E extends Employee>(list: E[], days: string[], settings: ScheduleSettings, key = days[0]!): E[] {
  const hidden = new Set(settings.weekHidden?.[key] ?? []);
  const order = settings.weekOrder?.[key] ?? [];
  const idx = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  return list
    .filter((e) => !hidden.has(e.id) && (!e.archived || days.some((d) => hasShift(e.shifts?.[d]))))
    .sort((a, b) => {
      const ai = idx(a.id);
      const bi = idx(b.id);
      if (ai !== bi) return ai - bi;
      return sectionPriority(a) - sectionPriority(b) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
}

export const openDayIndexes = (settings: ScheduleSettings) =>
  (Array.isArray(settings.openDays) ? settings.openDays : [0, 1, 2, 3, 4, 5, 6]).filter((i) => i >= 0 && i <= 6).sort();

// ── Congés ────────────────────────────────────────────

export const LEAVE_TYPES = [
  { id: "vacances", label: "Vacances", labelEs: "Vacaciones", color: "#0d9488" },
  { id: "maladie", label: "Maladie", labelEs: "Enfermedad", color: "#d97706" },
  { id: "personnel", label: "Personnel", labelEs: "Personal", color: "#7c3aed" },
  { id: "sans_solde", label: "Sans solde", labelEs: "Sin sueldo", color: "#64748b" },
] as const;

export function leaveMeta(type?: string) {
  return LEAVE_TYPES.find((l) => l.id === type) ?? { id: type ?? "", label: "Congé", labelEs: "Descanso", color: "#0d9488" };
}

/** Jours entre aujourd'hui et `dk` (négatif = passé). */
export const daysUntil = (dk: string, today: string) => daysBetween(today, dk) ?? 0;
export const isPast = (dk: string, today: string) => daysUntil(dk, today) < 0;

/** Règle des 2 semaines : approuvé automatiquement si TOUS les jours sont à plus de 14 jours. */
export function autoApproves(dates: string[], today: string): boolean {
  if (!dates.length) return false;
  return Math.min(...dates.map((d) => daysUntil(d, today))) > 14;
}

/** Congé d'un employé ce jour-là : saisi à la main (fiche) ou demande approuvée (journée complète). */
export function timeOffFor(emp: Employee, dk: string, requests: LeaveRequest[]): { type?: string; note?: string; fromRequest?: boolean } | null {
  const manual = emp.timeOff?.[dk];
  if (manual) return manual;
  const r = requests.find((x) => x.status === "approved" && x.kind !== "partial" && x.empId === emp.id && Array.isArray(x.dates) && x.dates.includes(dk));
  return r ? { type: r.type, note: r.reason ?? "", fromRequest: true } : null;
}

/** Congé partiel approuvé ce jour-là (entrée plus tard / fin plus tôt). */
export function partialFor(empId: string, dk: string, requests: LeaveRequest[]) {
  const r = requests.find((x) => x.status === "approved" && x.kind === "partial" && x.partial && x.empId === empId && x.partial.dk === dk);
  return r?.partial ?? null;
}

export interface LeaveDraft {
  type: string;
  kind: "full" | "partial";
  days: string[];
  partialMode: "late" | "early";
  partialTime: string; // normalisée
  reason: string;
}

/** Document /leaveRequests créé (mêmes champs que la v1). */
export function leaveRequestDoc(emp: Employee, d: LeaveDraft, today: string, now = Date.now()) {
  const dates = d.kind === "partial" ? d.days.slice(0, 1) : [...d.days].sort();
  const auto = autoApproves(dates, today);
  return {
    empId: emp.id,
    empName: emp.name ?? "",
    type: d.type,
    kind: d.kind,
    dates,
    partial: d.kind === "partial" ? { dk: dates[0]!, mode: d.partialMode, time: d.partialTime } : null,
    status: auto ? "approved" : "pending",
    autoApproved: auto,
    reason: d.reason.trim(),
    requestedAt: now,
    decidedAt: auto ? now : null,
    decidedBy: auto ? "auto" : null,
  };
}

export const findByPin = (list: Employee[], pin: string) => list.find((e) => !e.archived && e.pin != null && String(e.pin).trim() === pin) ?? null;

export const byRequestedDesc = (a: LeaveRequest, b: LeaveRequest) => (Number(b.requestedAt) || 0) - (Number(a.requestedAt) || 0);
