/**
 * PDF de paie (1 semaine et 2 semaines) — style moderne commun (ui/pdfTheme.ts) :
 * fond blanc, cartes-chiffres, tableaux épurés. Les montants viennent de
 * computePayroll : identiques à l'écran Salaires & Pourboires.
 */
import { jsPDF } from "jspdf";
import { fmtHours } from "@/modules/equipe/horaire.logic";
import { C, footer, generatedOn, header, kpis, page, section, table } from "@/ui/pdfTheme";
import { pdfMoney } from "@/ui/pdfFormat";
import { mergeTwoWeeks, pdfRows, type PayrollResult } from "./paie.logic";

export interface PayWeekPdf {
  weekNum: number;
  monday: string;
  startLabel: string; // « 21 sept. »
  endLabel: string; // « 27 sept. 2026 »
  dayLabels: string[]; // « Lun 21/9 » par jour ouvert
  res: PayrollResult;
}

const hh = (n: number) => `${fmtHours(n) || "0"} h`;
const money = (n: number) => (n ? pdfMoney(n) : "—");
const groupLabel = (g: string) => (g === "cuisine" ? "Cuisine" : g === "excluded" ? "Sans pourboire" : "Service");
const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")} %`;

/** Rapport de paie d'une semaine. Renvoie le nom du fichier, ou null si personne à imprimer. */
export function exportWeekPdf(w: PayWeekPdf): string | null {
  const rows = pdfRows(w.res.rows);
  if (!rows.length) return null;
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const sGross = sum((r) => r.grossWage);
  const sTips = sum((r) => r.tipShare);
  const sBonus = sum((r) => r.bonus);
  const sTotal = sum((r) => r.totalPay);
  const sHours = sum((r) => r.totalHours);
  const { res } = w;
  const range = `${w.startLabel} – ${w.endLabel}`;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const { CW } = page(doc);

  let y = header(doc, { title: `Rapport de paie — Semaine ${w.weekNum}`, subtitle: range, meta: generatedOn() });
  y = kpis(doc, y, [
    { label: "Total à payer", value: pdfMoney(sTotal), tone: "accent", note: sBonus ? `dont ${pdfMoney(sBonus)} de bonus` : undefined },
    { label: "Salaires bruts", value: pdfMoney(sGross) },
    { label: "Pourboires", value: pdfMoney(sTips), tone: "green" },
    { label: "Pourboires / ventes", value: res.totalNet > 0 ? pct(res.tipPctSales) : "—", note: res.totalNet > 0 ? `ventes nettes ${pdfMoney(res.totalNet)}` : "ventes non saisies" },
    { label: "Heures", value: hh(sHours) },
  ]);

  // Pourboires reçus par jour
  y = section(doc, y, "Pourboires reçus", `Pool cuisine ${Math.round(res.shares.cuisine * 100)} % · ${pdfMoney(res.poolK)}     Pool service ${Math.round(res.shares.service * 100)} % · ${pdfMoney(res.poolS)}`);
  y = table(doc, {
    y,
    head: [[...w.dayLabels, "Total"]],
    body: [[...res.dailyCalc.map((c) => money(c.dayTotal)), pdfMoney(res.totalTips)]],
    right: w.dayLabels.map((_, i) => i).concat(w.dayLabels.length),
    columnStyles: { [w.dayLabels.length]: { fontStyle: "bold" } },
    extra: { alternateRowStyles: { fillColor: C.white } },
  });

  // Heures et paie par employé
  y = section(doc, y, "Heures et paie par employé", "Entrée – sortie réellement pointées");
  const showBonus = sBonus > 0;
  const head = ["Employé", ...w.dayLabels, "Heures", "Salaire", "Pourb.", ...(showBonus ? ["Bonus"] : []), "Total"];
  const nDays = w.dayLabels.length;
  const body = rows.map((r) => [
    { content: `${r.emp.name ?? ""}${r.emp.isManual ? " (extra)" : ""}\n${groupLabel(r.group)} · ${pdfMoney(r.rate)}/h${r.emp.isSalaried ? " · fixe" : ""}` },
    ...r.daily.map((d) => (d.actual?.markedAbsent ? "absent" : d.actual?.start || d.actual?.end ? `${d.actual.start || "?"}–${d.actual.end || "?"}` : "")),
    hh(r.totalHours),
    money(r.grossWage),
    money(r.tipShare),
    ...(showBonus ? [money(r.bonus)] : []),
    pdfMoney(r.totalPay),
  ]);
  const foot = [[`Totaux · ${rows.length} employé${rows.length > 1 ? "s" : ""}`, ...w.dayLabels.map(() => ""), hh(sHours), pdfMoney(sGross), pdfMoney(sTips), ...(showBonus ? [pdfMoney(sBonus)] : []), pdfMoney(sTotal)]];
  const numCols = Array.from({ length: head.length - 1 - nDays }, (_, i) => nDays + 1 + i);
  y = table(doc, {
    y,
    head: [head],
    body,
    foot,
    right: numCols,
    center: w.dayLabels.map((_, i) => i + 1),
    fontSize: 8,
    repeatHeader: `Paie · semaine ${w.weekNum} · ${range}`,
    columnStyles: { 0: { cellWidth: 44 }, [head.length - 1]: { fontStyle: "bold" } },
    onParse: (d) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.fontStyle = "bold";
      if (d.section === "body" && d.column.index >= 1 && d.column.index <= nDays) {
        d.cell.styles.fontSize = 7.3;
        d.cell.styles.textColor = d.cell.text.join("") === "absent" ? C.red : C.ink2;
      }
    },
  });

  // Pourboires par employé
  const recap = rows.filter((r) => r.tipShare > 0 || r.tipEligibleHours > 0);
  if (recap.length) {
    if (y > doc.internal.pageSize.getHeight() - 50) {
      doc.addPage();
      y = 24;
    }
    y = section(doc, y, "Pourboires par employé", "Réparti chaque jour selon les heures faites pendant le service");
    table(doc, {
      y,
      head: [["Employé", "Pool", "Heures en service", "Pourboires", "Pourboires / h", "Taux effectif"]],
      body: recap.map((r) => {
        const perH = r.totalHours > 0 ? r.tipShare / r.totalHours : 0;
        return [r.emp.name ?? "", groupLabel(r.group), hh(r.tipEligibleHours), money(r.tipShare), perH ? `+ ${pdfMoney(perH)}` : "—", perH ? `${pdfMoney(r.rate + perH)} / h` : "—"];
      }),
      right: [2, 3, 4, 5],
      repeatHeader: `Paie · semaine ${w.weekNum} · ${range}`,
      columnStyles: { 0: { fontStyle: "bold", cellWidth: CW * 0.26 } },
    });
  }

  footer(doc, "Bochica Café Bistro · Rapport de paie hebdomadaire");
  const name = `Bochica_Paie_Sem${w.weekNum}_${w.monday}.pdf`;
  doc.save(name);
  return name;
}

/** Rapport aux 2 semaines (semaine affichée + la précédente). */
export function exportTwoWeekPdf(older: PayWeekPdf, recent: PayWeekPdf): string | null {
  const rows = mergeTwoWeeks(older.res.rows, recent.res.rows);
  if (!rows.length) return null;
  const tot = (f: (r: (typeof rows)[number]) => [number, number]) => rows.reduce((a, r) => a + f(r)[0] + f(r)[1], 0);
  const wk = (i: 0 | 1, f: (r: (typeof rows)[number]) => [number, number]) => rows.reduce((a, r) => a + f(r)[i], 0);
  const n1 = older.weekNum;
  const n2 = recent.weekNum;
  const range = `${older.startLabel} – ${recent.endLabel}`;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const { M, CW } = page(doc);

  let y = header(doc, { title: `Rapport de paie — Semaines ${n1} et ${n2}`, subtitle: range, meta: generatedOn() });
  const bonusTotal = tot((r) => r.bonus);
  y = kpis(doc, y, [
    { label: "Total à payer (2 sem.)", value: pdfMoney(tot((r) => r.total)), tone: "accent", note: bonusTotal ? `dont ${pdfMoney(bonusTotal)} de bonus` : undefined },
    { label: "Salaires bruts", value: pdfMoney(tot((r) => r.sal)) },
    { label: "Pourboires", value: pdfMoney(tot((r) => r.tips)), tone: "green" },
    { label: "Heures", value: hh(tot((r) => r.hrs)) },
  ]);

  // Détail par semaine : deux cartes
  y = section(doc, y, "Détail par semaine");
  const half = (CW - 4) / 2;
  const cardH = bonusTotal ? 34 : 29;
  ([older, recent] as const).forEach((w, i) => {
    const ii = i as 0 | 1;
    const x = M + i * (half + 4);
    doc.setFillColor(...C.soft).roundedRect(x, y, half, cardH, 2.2, 2.2, "F");
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...C.ink).text(`Semaine ${w.weekNum}`, x + 5, y + 7);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...C.muted).text(`${w.startLabel} – ${w.endLabel}`, x + half - 5, y + 7, { align: "right" });
    let ly = y + 13;
    const line = (name: string, v: string, strong = false, color: typeof C.ink = C.ink2) => {
      doc.setFont("helvetica", strong ? "bold" : "normal").setFontSize(strong ? 9.5 : 8.8).setTextColor(...color).text(name, x + 5, ly);
      doc.setTextColor(...(strong ? C.ink : color)).text(v, x + half - 5, ly, { align: "right" });
      ly += 4.6;
    };
    line("Salaires", pdfMoney(wk(ii, (r) => r.sal)));
    line("Pourboires", `+ ${pdfMoney(wk(ii, (r) => r.tips))}`, false, C.green);
    if (bonusTotal) line("Bonus", `+ ${pdfMoney(wk(ii, (r) => r.bonus))}`);
    line("Total", pdfMoney(wk(ii, (r) => r.total)), true);
    const net = w.res.totalNet;
    doc.setFont("helvetica", "normal").setFontSize(7.3).setTextColor(...C.muted);
    doc.text(`${hh(wk(ii, (r) => r.hrs))} · ventes nettes ${net > 0 ? pdfMoney(net) : "non saisies"}${net > 0 ? ` · pourboires ${pct(w.res.tipPctSales)} des ventes` : ""}`, x + 5, ly + 0.5);
  });
  y += cardH + 8;

  y = section(doc, y, "Par employé");
  const head = ["Employé", "Pool", `Heures S${n1}`, `Heures S${n2}`, "Heures", `Salaire S${n1}`, `Salaire S${n2}`, `Pourb. S${n1}`, `Pourb. S${n2}`, "Pourb.", "Total"];
  const h2 = (a: number, b: number) => (a + b ? hh(a + b) : "—");
  const body = rows.map((r) => [
    `${r.emp.name ?? ""}${r.emp.isManual ? " (extra)" : ""}\n${pdfMoney(r.rate)}/h${r.emp.isSalaried ? " · fixe" : ""}`,
    groupLabel(r.group),
    r.hrs[0] ? hh(r.hrs[0]) : "—",
    r.hrs[1] ? hh(r.hrs[1]) : "—",
    h2(r.hrs[0], r.hrs[1]),
    money(r.sal[0]),
    money(r.sal[1]),
    money(r.tips[0]),
    money(r.tips[1]),
    money(r.tips[0] + r.tips[1]),
    pdfMoney(r.total[0] + r.total[1]),
  ]);
  const foot = [[`Totaux · ${rows.length} employé${rows.length > 1 ? "s" : ""}`, "", hh(wk(0, (r) => r.hrs)), hh(wk(1, (r) => r.hrs)), hh(tot((r) => r.hrs)), pdfMoney(wk(0, (r) => r.sal)), pdfMoney(wk(1, (r) => r.sal)), pdfMoney(wk(0, (r) => r.tips)), pdfMoney(wk(1, (r) => r.tips)), pdfMoney(tot((r) => r.tips)), pdfMoney(tot((r) => r.total))]];
  y = table(doc, {
    y,
    head: [head],
    body,
    foot,
    right: [2, 3, 4, 5, 6, 7, 8, 9, 10],
    fontSize: 8.2,
    repeatHeader: `Paie · semaines ${n1} et ${n2} · ${range}`,
    columnStyles: { 0: { cellWidth: 44, fontStyle: "bold" }, 4: { fontStyle: "bold" }, 9: { fontStyle: "bold" }, 10: { fontStyle: "bold" } },
  });

  const bonusRows = rows.filter((r) => r.bonus[0] + r.bonus[1] > 0);
  if (bonusRows.length) {
    y = section(doc, y, "Bonus des 2 semaines");
    table(doc, {
      y,
      head: [["Employé", `Semaine ${n1}`, `Semaine ${n2}`, "Total"]],
      body: bonusRows.map((r) => [r.emp.name ?? "", money(r.bonus[0]), money(r.bonus[1]), pdfMoney(r.bonus[0] + r.bonus[1])]),
      right: [1, 2, 3],
      columnStyles: { 0: { fontStyle: "bold" }, 3: { fontStyle: "bold" } },
    });
  }

  footer(doc, "Bochica Café Bistro · Période de paie de 2 semaines");
  const name = `Bochica_Paie2Sem_S${n1}-${n2}_${older.monday}.pdf`;
  doc.save(name);
  return name;
}
