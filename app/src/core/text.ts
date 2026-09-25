/** Minuscules sans accents, pour des recherches tolérantes. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export const frCollator = new Intl.Collator("fr-CA", { sensitivity: "base", numeric: true });

/** Lien tel: à partir d'un numéro saisi librement (« 418 555-1234 poste 2 »). */
export function telHref(phone: string): string | null {
  const digits = phone.split(/poste|ext|#/i)[0]!.replace(/[^\d+]/g, "");
  return digits.length >= 7 ? `tel:${digits}` : null;
}
