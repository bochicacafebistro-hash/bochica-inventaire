/**
 * Rapport personnalisé (Excel / PDF) — même contenu que la v1
 * (js/pages-finance.js, exportReportExcel / exportReportPDF).
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
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const s = reportSummary(r);
  const lastY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("BOCHICA", 14, 18);
  doc.setFillColor(247, 179, 44);
  doc.rect(14, 22, 18, 1.5, "F");
  doc.setFillColor(74, 144, 226);
  doc.rect(32, 22, 18, 1.5, "F");
  doc.setFillColor(231, 76, 60);
  doc.rect(50, 22, 18, 1.5, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.text("Rapport personnalisé", 14, 32);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Période : du ${r.start} au ${r.end}`, 14, 38);
  doc.text(`Généré le ${generated()}`, 14, 43);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Résumé", 14, 52);
  const body: string[][] = [];
  if (r.includeRevenues) body.push(["Total revenus (avant taxes)", money(s.rev), `${s.revCount} entrée(s)`]);
  if (r.includeExpenses) body.push(["Total dépenses (avant taxes)", money(s.exp), `${s.expCount} entrée(s)`]);
  if (r.includeRevenues) body.push(["Taxes perçues (TPS + TVQ)", money(s.revTps + s.revTvq), ""]);
  if (r.includeExpenses) body.push(["Taxes payées (TPS + TVQ)", money(s.expTps + s.expTvq), ""]);
  if (r.includeRevenues && r.includeExpenses) {
    const p = s.rev - s.exp;
    body.push([p >= 0 ? "Profit (avant taxes)" : "Déficit (avant taxes)", money(Math.abs(p)), p >= 0 ? "positif" : "négatif"]);
  }
  autoTable(doc, { startY: 55, head: [["", "Montant", "Détail"]], body, theme: "striped", headStyles: { fillColor: [14, 13, 12], textColor: 255 }, styles: { fontSize: 10 }, margin: { left: 14, right: 14 } });
  let y = lastY() + 10;
  if (r.includeRevenues && r.revenues.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Revenus", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Période", "Description", "Montant", "TPS", "TVQ", "Total"]],
      body: [...r.revenues]
        .sort((a, b) => revenueStart(a).localeCompare(revenueStart(b)))
        .map((x) => [revenuePeriodLabel(x), x.description || "", money(num(x.amount)), money(num(x.tps)), money(num(x.tvq)), money(num(x.amount) + num(x.tps) + num(x.tvq))]),
      theme: "striped",
      headStyles: { fillColor: [63, 143, 44], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = lastY() + 10;
  }
  if (r.includeExpenses && r.expenses.length) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Dépenses", 14, y);
    autoTable(doc, {
      startY: y + 3,
      head: [["Date", "Description", "Fournisseur", "Catégorie", "Montant", "Total"]],
      body: [...r.expenses]
        .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
        .map((x) => [x.date || "", x.description || "", x.supplier || "", x.category || "", money(num(x.amount)), money(num(x.amount) + num(x.tps) + num(x.tvq))]),
      theme: "striped",
      headStyles: { fillColor: [192, 57, 43], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${i} / ${pages}`, 196, 290, { align: "right" });
    doc.text("Bochica — Restaurant Colombien · 430 Rue Saint-Vallier Ouest, Québec", 14, 290);
  }
  const name = `${fileBase(r)}.pdf`;
  doc.save(name);
  return name;
}
