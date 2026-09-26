/**
 * Rapport personnalisé (Excel / PDF) — même contenu que la v1
 * (js/pages-finance.js, exportReportExcel / exportReportPDF) ; PDF au style
 * moderne commun (ui/pdfTheme.ts).
 * Bibliothèques chargées seulement au clic.
 */
import { revenuePeriodLabel, revenueStart, round2 } from "./finances.logic";
import type { Expense, Revenue } from "./finances.types";

const num = (v: unknown) => Number(v) || 0;
const money = (n: number) => `${n.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} $`;

export interface ReportInput {
  start: string;
  end: string;
  revenues: Revenue[];
  expenses: Expense[];
  includeRevenues: boolean;
  includeExpenses: boolean;
}

export function reportSummary(r: ReportInput) {
  const revs = r.includeRevenues ? r.revenues : [];
  const exps = r.includeExpenses ? r.expenses : [];
  const sum = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
  return {
    revCount: revs.length,
    rev: sum(revs, (x) => num(x.amount)),
    revTps: sum(revs, (x) => num(x.tps)),
    revTvq: sum(revs, (x) => num(x.tvq)),
    expCount: exps.length,
    exp: sum(exps, (x) => num(x.amount)),
    expTps: sum(exps, (x) => num(x.tps)),
    expTvq: sum(exps, (x) => num(x.tvq)),
  };
}

const fileBase = (r: ReportInput) => `bochica_rapport_${r.start === r.end ? r.start : `${r.start}_au_${r.end}`}`;
const generated = () => new Date().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

export async function exportExcel(r: ReportInput): Promise<string> {
  const XLSX = await import("xlsx");
  const s = reportSummary(r);
  const wb = XLSX.utils.book_new();
  const summary: (string | number)[][] = [["BOCHICA — Rapport personnalisé"], [""], ["Période", `Du ${r.start} au ${r.end}`], ["Généré le", generated()], [""], ["RÉSUMÉ"]];
  if (r.includeRevenues) {
    summary.push(["Total revenus (avant taxes)", round2(s.rev)], ["TPS perçue (5 %)", round2(s.revTps)], ["TVQ perçue (9,975 %)", round2(s.revTvq)], ["Total revenus avec taxes", round2(s.rev + s.revTps + s.revTvq)], [""]);
  }
  if (r.includeExpenses) {
    summary.push(["Total dépenses (avant taxes)", round2(s.exp)], ["TPS payée (5 %)", round2(s.expTps)], ["TVQ payée (9,975 %)", round2(s.expTvq)], ["Total dépenses avec taxes", round2(s.exp + s.expTps + s.expTvq)], [""]);
  }
  if (r.includeRevenues && r.includeExpenses) summary.push([s.rev - s.exp >= 0 ? "PROFIT (avant taxes)" : "DÉFICIT (avant taxes)", round2(s.rev - s.exp)]);
  const ws = XLSX.utils.aoa_to_sheet(summary);
  ws["!cols"] = [{ wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, "Résumé");
  if (r.includeRevenues && r.revenues.length) {
    const rows = [...r.revenues]
      .sort((a, b) => revenueStart(a).localeCompare(revenueStart(b)))
      .map((x) => [revenueStart(x), x.dateEnd || "", x.description || "", num(x.amount), num(x.tps), num(x.tvq), round2(num(x.amount) + num(x.tps) + num(x.tvq)), x.notes || ""]);
    const w = XLSX.utils.aoa_to_sheet([["Date début", "Date fin", "Description", "Montant", "TPS", "TVQ", "Total", "Notes"], ...rows]);
    w["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 32 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, w, "Revenus");
  }
  if (r.includeExpenses && r.expenses.length) {
    const rows = [...r.expenses]
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      .map((x) => [x.date || "", x.description || "", x.supplier || "", x.category || "", x.type || "", num(x.amount), num(x.tps), num(x.tvq), round2(num(x.amount) + num(x.tps) + num(x.tvq)), x.notes || ""]);
    const w = XLSX.utils.aoa_to_sheet([["Date", "Description", "Fournisseur", "Catégorie", "Type", "Montant", "TPS", "TVQ", "Total", "Notes"], ...rows]);
    w["!cols"] = [{ wch: 12 }, { wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, w, "Dépenses");
  }
  const name = `${fileBase(r)}.xlsx`;
  XLSX.writeFile(wb, name);
  return name;
}

export async function exportPdf(r: ReportInput): Promise<string> {
  const [{ jsPDF }, T] = await Promise.all([import("jspdf"), import("@/ui/pdfTheme")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const MG = 16;
  const s = reportSummary(r);
  const period = r.start === r.end ? `Le ${r.start}` : `Du ${r.start} au ${r.end}`;
  let y = T.header(doc, { title: "Rapport financier", subtitle: period, meta: `Généré le ${generated()}` }, MG);

  const k: { label: string; value: string; note?: string; tone?: "green" | "red" | "blue" | "accent" }[] = [];
  if (r.includeRevenues) k.push({ label: "Revenus (avant taxes)", value: money(s.rev), note: `${s.revCount} entrée(s)`, tone: "green" });
  if (r.includeExpenses) k.push({ label: "Dépenses (avant taxes)", value: money(s.exp), note: `${s.expCount} entrée(s)`, tone: "red" });
  if (r.includeRevenues && r.includeExpenses) {
    const p = s.rev - s.exp;
    k.push({ label: p >= 0 ? "Profit (avant taxes)" : "Déficit (avant taxes)", value: money(Math.abs(p)), note: p >= 0 ? "positif" : "négatif", tone: p >= 0 ? "green" : "red" });
  }
  if (k.length) y = T.kpis(doc, y, k, MG);

  // Taxes
  const taxRows: string[][] = [];
  if (r.includeRevenues) taxRows.push(["Perçues (sur les revenus)", money(s.revTps), money(s.revTvq), money(s.revTps + s.revTvq)]);
  if (r.includeExpenses) taxRows.push(["Payées (sur les dépenses)", money(s.expTps), money(s.expTvq), money(s.expTps + s.expTvq)]);
  const foot = r.includeRevenues && r.includeExpenses ? [["Solde net", money(s.revTps - s.expTps), money(s.revTvq - s.expTvq), money(s.revTps + s.revTvq - s.expTps - s.expTvq)]] : undefined;
  y = T.section(doc, y, "Taxes", "TPS 5 % · TVQ 9,975 %", MG);
  y = T.table(doc, { y, margin: MG, head: [["", "TPS", "TVQ", "Total"]], body: taxRows, foot, right: [1, 2, 3], columnStyles: { 0: { fontStyle: "bold" } }, extra: { alternateRowStyles: { fillColor: T.C.white } } });

  const repeat = `Rapport financier · ${period}`;
  if (r.includeRevenues && r.revenues.length) {
    if (y > 230) (doc.addPage(), (y = 24));
    y = T.section(doc, y, "Revenus", `${r.revenues.length} entrée(s)`, MG);
    y = T.table(doc, {
      y,
      margin: MG,
      repeatHeader: repeat,
      fontSize: 8.3,
      head: [["Période", "Description", "Montant", "TPS", "TVQ", "Total"]],
      body: [...r.revenues]
        .sort((a, b) => revenueStart(a).localeCompare(revenueStart(b)))
        .map((x) => [revenuePeriodLabel(x), x.description || "", money(num(x.amount)), money(num(x.tps)), money(num(x.tvq)), money(num(x.amount) + num(x.tps) + num(x.tvq))]),
      foot: [["Total", "", money(s.rev), money(s.revTps), money(s.revTvq), money(s.rev + s.revTps + s.revTvq)]],
      right: [2, 3, 4, 5],
      columnStyles: { 5: { fontStyle: "bold" } },
    });
  }
  if (r.includeExpenses && r.expenses.length) {
    if (y > 230) (doc.addPage(), (y = 24));
    y = T.section(doc, y, "Dépenses", `${r.expenses.length} entrée(s)`, MG);
    T.table(doc, {
      y,
      margin: MG,
      repeatHeader: repeat,
      fontSize: 8.3,
      head: [["Date", "Description", "Fournisseur", "Catégorie", "Montant", "Total"]],
      body: [...r.expenses]
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .map((x) => [x.date || "", x.description || "", x.supplier || "", x.category || "", money(num(x.amount)), money(num(x.amount) + num(x.tps) + num(x.tvq))]),
      foot: [["Total", "", "", "", money(s.exp), money(s.exp + s.expTps + s.expTvq)]],
      right: [4, 5],
      columnStyles: { 0: { cellWidth: 22 }, 5: { fontStyle: "bold" } },
    });
  }
  T.footer(doc, "Bochica Café Bistro · 430, rue Saint-Vallier Ouest, Québec", MG);
  const name = `${fileBase(r)}.pdf`;
  doc.save(name);
  return name;
}
