/**
 * Dates « jour » en texte AAAA-MM-JJ, toujours en heure LOCALE (comme la v1),
 * pour éviter les décalages de fuseau horaire.
 */
export const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayISO(now = new Date()): string {
  return toISO(now);
}

export function isoToDate(iso: string | undefined | null): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = isoToDate(iso)!;
  return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

export function daysBetween(a: string, b: string): number | null {
  const da = isoToDate(a);
  const db = isoToDate(b);
  if (!da || !db) return null;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MONTHS_SHORT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOWS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

export const monthName = (m: number) => MONTHS[m]!;
export const monthShortName = (m: number) => MONTHS_SHORT[m]!;

/** « Lundi 11 mai 2026 » */
export function longDate(iso: string): string {
  const d = isoToDate(iso);
  if (!d) return iso || "—";
  const s = `${DOWS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Aujourd'hui / Demain / Hier / Dans 3 jours / Il y a 2 jours / 15 juin 2026 */
export function relativeDate(iso: string, today = todayISO()): string {
  const n = daysBetween(today, iso);
  if (n === null) return iso || "—";
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return "Demain";
  if (n === -1) return "Hier";
  if (n > 1 && n <= 7) return `Dans ${n} jours`;
  if (n < -1 && n >= -7) return `Il y a ${-n} jours`;
  const d = isoToDate(iso)!;
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Premier et dernier jour du mois décalé de `offset` mois par rapport à `now`. */
export function monthBounds(offset: number, now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return { year: first.getFullYear(), month: first.getMonth(), start: toISO(first), end: toISO(last) };
}

/** 42 jours (6 semaines) d'une grille de calendrier qui commence un lundi. */
export function calendarGrid(year: number, month: number): string[] {
  const first = new Date(year, month, 1);
  const shift = (first.getDay() + 6) % 7; // 0 = lundi
  return Array.from({ length: 42 }, (_, i) => toISO(new Date(year, month, 1 - shift + i)));
}
