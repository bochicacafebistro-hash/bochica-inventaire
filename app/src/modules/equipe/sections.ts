import type { Employee } from "./equipe.types";

/** Couleurs de section de la v1 (cuisine vert, service bleu, autre gris). */
export const SECTION_COLOR = { cuisine: "#5f9e4a", service: "#2a78d6", other: "#8a847a" } as const;
export type SectionKey = keyof typeof SECTION_COLOR;
export const sectionKey = (e: Pick<Employee, "section">): SectionKey => (e.section === "cuisine" ? "cuisine" : (e.section ?? "service") === "service" ? "service" : "other");
