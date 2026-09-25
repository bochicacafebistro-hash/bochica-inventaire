/**
 * Couleurs des graphiques — thème « Bochica » validé (daltonisme, contraste)
 * avec scripts/validate_palette.js du skill dataviz, le 25 sept. 2026 :
 *   clair  (surface #ffffff) : ΔE CVD adj. min 9,2 · vision normale 27,6
 *   sombre (surface #1c1815) : ΔE CVD adj. min 9,4 · vision normale 19,7
 * Jaune, aqua et magenta sont < 3:1 sur fond clair → chaque graphique
 * offre une vue tableau (obligatoire).
 *
 * Règles : l'ordre des couleurs ne change jamais ; une couleur suit
 * l'entité (ex. « Tables » est toujours bleu), jamais son rang.
 */
import { useThemeName } from "./useThemeName";

const LIGHT = {
  series: ["#eda100", "#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7", "#e87ba4"],
  /** Série de comparaison (année précédente) — désaccentuée */
  muted: "#c9c2b4",
  surface: "#ffffff",
  grid: "#ebe5d9",
  axis: "#8a847a",
  ink: "#0e0d0c",
  ink2: "#52504b",
};

const DARK: typeof LIGHT = {
  series: ["#c98500", "#3987e5", "#d95926", "#199e70", "#9085e9", "#d55181"],
  muted: "#5a534c",
  surface: "#1c1815",
  grid: "#2e2824",
  axis: "#8a847a",
  ink: "#f5f1e8",
  ink2: "#c3bdb2",
};

export type ChartTheme = typeof LIGHT;

export function useChartTheme(): ChartTheme {
  return useThemeName() === "dark" ? DARK : LIGHT;
}
