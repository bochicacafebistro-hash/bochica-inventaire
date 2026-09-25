/** Heures « HH:MM » (même logique que normalizeTimeInput de la v1). */

/**
 * « 1704 », « 17h04 », « 17 », « 9.30 » → « 17:04 », « 17:00 », « 09:30 ».
 * Chaîne vide → "" ; saisie invalide → null.
 */
export function normalizeTime(raw: string | null | undefined): string | null {
  if (raw == null) return "";
  const s = String(raw).trim().toLowerCase().replace(/h/g, ":").replace(/\./g, ":").replace(/:$/, "");
  if (s === "" || s === "—" || s === "-") return "";
  let h: number;
  let m: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/^(\d{1,2}):(\d{1,2})$/))) {
    h = +mt[1]!;
    m = +mt[2]!;
  } else if ((mt = s.match(/^(\d{1,2})$/))) {
    h = +mt[1]!;
    m = 0;
  } else if ((mt = s.match(/^(\d{3,4})$/))) {
    const d = mt[1]!;
    h = d.length === 3 ? +d.slice(0, 1) : +d.slice(0, 2);
    m = d.length === 3 ? +d.slice(1) : +d.slice(2);
  } else return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** « 12:00, 17h, 2100 » → ["12:00", "17:00", "21:00"] (invalides ignorées). */
export function parseTimes(raw: string): string[] {
  return raw
    .split(/[,;\n]+/)
    .map((s) => normalizeTime(s))
    .filter((s): s is string => !!s);
}
