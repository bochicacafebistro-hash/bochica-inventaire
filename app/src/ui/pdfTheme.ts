/**
 * Style commun des PDF Bochica (paie, soumissions, factures, rapports) —
 * version « moderne » du 26 sept. 2026 : fond blanc, beaucoup d'air, texte
 * presque noir, gris doux pour les cartes, jaune Bochica en touche d'accent
 * seulement, filet tricolore discret sous l'en-tête. Tableaux via
 * jspdf-autotable (sauts de page gérés, en-têtes répétés).
 */
import type { jsPDF } from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";

export type RGB = [number, number, number];

export const C = {
  ink: [24, 24, 27] as RGB, // texte principal
  ink2: [82, 82, 91] as RGB, // texte secondaire
  muted: [138, 138, 147] as RGB, // étiquettes, notes
  line: [228, 228, 231] as RGB, // filets
  soft: [247, 246, 243] as RGB, // fond des cartes
  softer: [251, 250, 248] as RGB, // rangées alternées
  accent: [247, 179, 44] as RGB, // jaune Bochica
  accentSoft: [254, 246, 225] as RGB,
  blue: [37, 99, 235] as RGB,
  blueSoft: [235, 242, 254] as RGB,
  red: [214, 64, 69] as RGB,
  redSoft: [253, 236, 236] as RGB,
  green: [22, 128, 72] as RGB,
  greenSoft: [232, 246, 238] as RGB,
  white: [255, 255, 255] as RGB,
};

/** Dimensions utiles d'une page. */
export function page(doc: jsPDF, margin = 16) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  return { W, H, M: margin, CW: W - 2 * margin };
}

/** Texte en petites capitales espacées (étiquettes). */
export function label(doc: jsPDF, text: string, x: number, y: number, opts: { color?: RGB; size?: number; align?: "left" | "right" | "center" } = {}) {
  doc.setFont("helvetica", "bold").setFontSize(opts.size ?? 6.8).setTextColor(...(opts.color ?? C.muted));
  doc.setCharSpace(0.35);
  doc.text(text.toUpperCase(), x, y, { align: opts.align ?? "left" });
  doc.setCharSpace(0);
}

/** Filet tricolore Bochica (jaune, bleu, rouge) — petite signature de marque. */
export function brandRule(doc: jsPDF, x: number, y: number, w = 18, h = 0.9) {
  const cols: RGB[] = [C.accent, [74, 144, 226], [231, 76, 60]];
  cols.forEach((c, i) => doc.setFillColor(...c).rect(x + (i * w) / 3, y, w / 3, h, "F"));
}

/**
 * En-tête de première page : marque à gauche, titre du document à droite.
 * Renvoie la position y sous l'en-tête.
 */
export function header(doc: jsPDF, o: { title: string; subtitle?: string; meta?: string }, margin = 16): number {
  const { W, M } = page(doc, margin);
  const top = 16;
  doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...C.ink);
  doc.setCharSpace(1.2);
  doc.text("BOCHICA", M, top + 4);
  doc.setCharSpace(0);
  label(doc, "Café bistro · Restaurant colombien", M, top + 9, { size: 6.2 });
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...C.ink);
  doc.text(o.title, W - M, top + 4, { align: "right" });
  if (o.subtitle) doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.ink2).text(o.subtitle, W - M, top + 9.5, { align: "right" });
  if (o.meta) doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...C.muted).text(o.meta, W - M, top + 14, { align: "right" });
  const ly = top + (o.meta ? 19 : 16);
  doc.setDrawColor(...C.line).setLineWidth(0.3).line(M, ly, W - M, ly);
  brandRule(doc, M, ly - 0.45);
  return ly + 9;
}

/** En-tête discret des pages suivantes. */
export function compactHeader(doc: jsPDF, text: string, margin = 16): number {
  const { W, M } = page(doc, margin);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...C.ink);
  doc.setCharSpace(0.8);
  doc.text("BOCHICA", M, 13);
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.muted).text(text, W - M, 13, { align: "right" });
  doc.setDrawColor(...C.line).setLineWidth(0.3).line(M, 16.5, W - M, 16.5);
  return 24;
}

/** Pied de page sur toutes les pages (texte à gauche, « Page x / n » à droite). */
export function footer(doc: jsPDF, left: string, margin = 16) {
  const { W, H, M } = page(doc, margin);
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setDrawColor(...C.line).setLineWidth(0.3).line(M, H - 12, W - M, H - 12);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...C.muted);
    doc.text(left, M, H - 7.5);
    doc.text(`Page ${p} / ${n}`, W - M, H - 7.5, { align: "right" });
  }
}

export const generatedOn = () =>
  `Généré le ${new Date().toLocaleString("fr-CA", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;

/** Titre de section (+ texte d'appoint aligné à droite). Renvoie y sous le titre. */
export function section(doc: jsPDF, y: number, title: string, aside?: string, margin = 16): number {
  const { W, M } = page(doc, margin);
  doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...C.ink).text(title, M, y);
  if (aside) doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.muted).text(aside, W - M, y, { align: "right" });
  return y + 5;
}

export interface Kpi {
  label: string;
  value: string;
  note?: string;
  tone?: "ink" | "accent" | "green" | "red" | "blue";
}

/** Rangée de cartes-chiffres (fond gris doux, sans bordure). Renvoie y sous la rangée. */
export function kpis(doc: jsPDF, y: number, items: Kpi[], margin = 16): number {
  const { M, CW } = page(doc, margin);
  const gap = 3.5;
  const w = (CW - gap * (items.length - 1)) / items.length;
  const h = items.some((k) => k.note) ? 21 : 17;
  items.forEach((k, i) => {
    const x = M + i * (w + gap);
    doc.setFillColor(...C.soft).roundedRect(x, y, w, h, 2.2, 2.2, "F");
    const dot = k.tone && k.tone !== "ink" ? C[k.tone] : null;
    if (dot) doc.setFillColor(...dot).circle(x + 5, y + 5.6, 0.9, "F");
    label(doc, k.label, x + (dot ? 7.5 : 5), y + 6.5);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...C.ink).text(k.value, x + 5, y + 13.5);
    if (k.note) doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...C.muted).text(k.note, x + 5, y + 18);
  });
  return y + h + 7;
}

/**
 * Tableau au style Bochica : en-tête gris clair en petites capitales, filets
 * fins, rangées alternées très douces, pied de tableau en gras.
 * Les colonnes listées dans `right` sont alignées à droite (montants).
 */
export function table(
  doc: jsPDF,
  o: { y: number; head: string[][]; body: RowInput[]; foot?: RowInput[]; right?: number[]; center?: number[]; columnStyles?: UserOptions["columnStyles"]; fontSize?: number; repeatHeader?: string; margin?: number; onParse?: NonNullable<UserOptions["didParseCell"]>; extra?: Partial<UserOptions> },
): number {
  const margin = o.margin ?? 16;
  const colStyles: NonNullable<UserOptions["columnStyles"]> = { ...(o.columnStyles ?? {}) };
  for (const i of o.right ?? []) colStyles[i] = { halign: "right", ...(colStyles[i] ?? {}) };
  for (const i of o.center ?? []) colStyles[i] = { halign: "center", ...(colStyles[i] ?? {}) };
  const subs = new WeakMap<object, string>();
  const alignFor = (i: number) => ((o.right ?? []).includes(i) ? "right" : (o.center ?? []).includes(i) ? "center" : "left");
  autoTable(doc, {
    startY: o.y,
    head: o.head,
    body: o.body,
    foot: o.foot,
    theme: "plain",
    margin: { left: margin, right: margin, top: 24, bottom: 18 },
    styles: { font: "helvetica", fontSize: o.fontSize ?? 8.5, textColor: C.ink, cellPadding: { top: 2.4, bottom: 2.4, left: 2.2, right: 2.2 }, lineColor: C.line, lineWidth: 0, valign: "middle" },
    headStyles: { fontStyle: "bold", fontSize: 6.8, textColor: C.muted, fillColor: C.white, cellPadding: { top: 2, bottom: 2.4, left: 2.2, right: 2.2 } },
    footStyles: { fontStyle: "bold", textColor: C.ink, fillColor: C.soft },
    alternateRowStyles: { fillColor: C.softer },
    columnStyles: colStyles,
    showFoot: "lastPage",
    rowPageBreak: "avoid",
    didParseCell: (d) => {
      if (d.section === "head" || d.section === "foot") d.cell.styles.halign = alignFor(d.column.index);
      if (d.section === "head") d.cell.text = d.cell.text.map((t) => t.toUpperCase());
      // 1re colonne sur 2 lignes : la 2e ligne devient une sous-ligne grise (ex. « Cuisine · 25,00 $/h »).
      if (d.section === "body" && d.column.index === 0) {
        const lines = d.cell.text.join("\n").split("\n");
        if (lines.length === 2) {
          subs.set(d.cell, lines[1]!);
          d.cell.text = [lines[0]!, " "];
        }
      }
      o.onParse?.(d);
    },
    didDrawCell: (d) => {
      const sub = d.section === "body" ? subs.get(d.cell) : undefined;
      if (sub) {
        const pad = d.cell.padding("left");
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...C.muted);
        doc.text(sub, d.cell.x + pad, d.cell.y + d.cell.height - d.cell.padding("bottom") - 0.6);
      }
      if (d.section === "head") doc.setDrawColor(...C.ink2).setLineWidth(0.25).line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      else if (d.section === "body") doc.setDrawColor(...C.line).setLineWidth(0.2).line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
    },
    didDrawPage: (d) => {
      if (o.repeatHeader && d.pageNumber > 1) compactHeader(doc, o.repeatHeader, margin);
    },
    ...(o.extra ?? {}),
  } as UserOptions);
  return ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? o.y) + 8;
}

/** Tronque un texte pour qu'il tienne dans une largeur (mm), avec « … ». */
export function fit(doc: jsPDF, text: string, maxW: number) {
  if (!text || doc.getTextWidth(text) <= maxW) return text ?? "";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.getTextWidth(text.slice(0, mid) + "…") <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}

/** Ligne « libellé ………… montant » alignée à droite (totaux). */
export function totalLine(doc: jsPDF, y: number, x1: number, x2: number, name: string, value: string, strong = false): number {
  doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 11 : 9).setTextColor(...(strong ? C.ink : C.ink2));
  doc.text(name, x1, y);
  doc.setTextColor(...C.ink).text(value, x2, y, { align: "right" });
  return y + (strong ? 7 : 5.2);
}
