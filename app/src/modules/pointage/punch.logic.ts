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

/** Nouveau quart après un pointage (on garde l'autre champ ; les marques « auto » et « absent » sont retirées). */
export function punchedShift(current: ActualShift | undefined, field: "start" | "end", time: string) {
  return {
    start: field === "start" ? time : (current?.start ?? ""),
    end: field === "end" ? time : (current?.end ?? ""),
  };
}

/** Où écrire : document de la semaine + clé du jour (la veille peut être dans la semaine précédente). */
export function target(dk: string) {
  const monday = weekStart(dk);
  return { weekId: payrollWeekId(monday), weekStart: monday, dk };
}

export const yesterdayOf = (dk: string) => addDays(dk, -1);
export const isValidDay = (dk: string) => !!isoToDate(dk);
