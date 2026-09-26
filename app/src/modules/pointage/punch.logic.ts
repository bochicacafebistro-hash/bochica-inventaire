/**
 * Pointage — mêmes règles que la v1 (js/pages-punch.js, updateActualShift de
 * js/pages-payroll.js). Les pointages vont dans payroll/{semaine}.actualShifts,
 * donc Salaires & Pourboires se remplit tout seul.
 */
import { addDays, isoToDate } from "@/core/dates";
import { isoWeek, weekStart } from "@/modules/equipe/equipe.logic";
import { hoursFromShift } from "@/modules/equipe/horaire.logic";

/** Quart réellement pointé (payroll/{semaine}.actualShifts[emp][jour]). */
export interface ActualShift {
  start?: string;
  end?: string;
  autoFilled?: boolean;
  autoFilledNoStart?: boolean;
  markedAbsent?: boolean;
}

export interface PayrollWeek {
  weekId?: string;
  weekStart?: string;
  actualShifts?: Record<string, Record<string, ActualShift>>;
}

/** Identifiant du document de paie : « 2026-W39 » (année et n° ISO du jeudi, comme payrollWeekId v1). */
export function payrollWeekId(monday: string): string {
  const thursday = addDays(monday, 3);
  return `${thursday.slice(0, 4)}-W${String(isoWeek(thursday)).padStart(2, "0")}`;
}

export const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Garde-fous du quart de nuit (v1) : seulement avant 10 h, et durée ≤ 12 h. */
export const OVERNIGHT_CUTOFF_HOUR = 10;
export const OVERNIGHT_MAX_HOURS = 12;

/**
 * Faut-il fermer le quart d'hier plutôt que créer une sortie aujourd'hui ?
 * Oui si : SORTIE, avant 10 h, pas d'entrée aujourd'hui, et hier = entrée
 * sans sortie (pas « absent ») avec une durée plausible (≤ 12 h).
 */
export function closesOvernight(action: "entree" | "sortie", hour: number, today: ActualShift | undefined, yesterday: ActualShift | undefined, now: string): boolean {
  if (action !== "sortie" || hour >= OVERNIGHT_CUTOFF_HOUR || today?.start) return false;
  if (!yesterday?.start || yesterday.end || yesterday.markedAbsent) return false;
  const dur = hoursFromShift({ start: yesterday.start, end: now });
  return dur > 0 && dur <= OVERNIGHT_MAX_HOURS;
}

/** Quart d'hier encore ouvert (pour l'indice affiché à l'employé). */
export function openOvernight(hour: number, today: ActualShift | undefined, yesterday: ActualShift | undefined): ActualShift | null {
  if (hour >= OVERNIGHT_CUTOFF_HOUR || today?.start) return null;
  return yesterday?.start && !yesterday.end && !yesterday.markedAbsent ? yesterday : null;
}

/**
 * Champ écrit par un pointage : SEULEMENT l'heure pointée. L'autre champ est
 * conservé par la fusion Firestore — on ne le réécrit jamais à partir des
 * données affichées (qui pourraient être en retard ou pas encore chargées).
 */
export function punchedShift(field: "start" | "end", time: string): { start: string } | { end: string } {
  return field === "start" ? { start: time } : { end: time };
}

/** Où écrire : document de la semaine + clé du jour (la veille peut être dans la semaine précédente). */
export function target(dk: string) {
  const monday = weekStart(dk);
  return { weekId: payrollWeekId(monday), weekStart: monday, dk };
}

export const yesterdayOf = (dk: string) => addDays(dk, -1);
export const isValidDay = (dk: string) => !!isoToDate(dk);

export type PunchMode = "in" | "out" | "complete";

/**
 * Bouton affiché à l'employé (un seul à la fois, pour éviter les erreurs) :
 * - rien de pointé → ENTRÉE (ou SORTIE s'il déclare avoir oublié son entrée) ;
 * - entrée pointée → SORTIE ;
 * - sortie pointée → journée complète, plus aucun bouton (pas de correction par l'employé).
 * Un quart de nuit ouvert depuis hier → SORTIE (il ferme le quart d'hier).
 */
export function punchMode(today: ActualShift | undefined, overnightOpen: boolean, forgotEntry: boolean): PunchMode {
  if (today?.end) return "complete";
  if (overnightOpen || today?.start) return "out";
  return forgotEntry ? "out" : "in";
}
