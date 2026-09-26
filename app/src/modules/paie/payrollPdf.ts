/**
 * PDF de paie — ports de generatePayrollPDF et generateBiWeeklyPDF (v1,
 * js/pages-payroll.js), même mise en page (Letter paysage, papier crème).
 * Différence voulue : les montants viennent de computePayroll, donc ils sont
 * identiques à l'écran (la v1 recalculait à part, sans « sans pourboire » ni
 * les pools de la semaine, et le PDF 2 semaines comptait les employés retirés).
 */
import { jsPDF } from "jspdf";
import { fmtHours } from "@/modules/equipe/horaire.logic";
import { pdfMoney } from "@/ui/pdfFormat";
import { mergeTwoWeeks, pdfRows, type PayrollResult } from "./paie.logic";

type RGB = [number, number, number];
const CREAM: RGB = [253, 246, 231];
const TEXT: RGB = [14, 13, 12];
const LIGHT: RGB = [110, 95, 80];
const BORDER: RGB = [200, 188, 165];
const ACCENT: RGB = [247, 179, 44];
const BLUE: RGB = [74, 144, 226];
const RED: RGB = [231, 76, 60];
const GREEN: RGB = [125, 191, 102];
const SURFACE2: RGB = [237, 227, 210];
const HEAD: RGB = [232, 220, 200];
const ALT: RGB = [248, 242, 228];
const W = 279.4;
const H = 215.9;
const M = 12;
const CW = W - 2 * M;

export interface PayWeekPdf {
  weekNum: number;
  monday: string;
  startLabel: string; // « 21 sept. »
  endLabel: string; // « 27 sept. 2026 »
  dayLabels: string[]; // « Lun 21/9 » par jour ouvert
  res: PayrollResult;
}

const hh = (n: number) => `${fmtHours(n) || "0"}h`;

function truncate(doc: jsPDF, text: string, maxW: number) {
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

/** Squelette commun : fond, en-têtes, saut de page, pied de page. */
function sheet(title: string, sub: string, compact: string) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const s = { doc, y: 0, onNewPage: () => {} };
  const bg = () => doc.setFillColor(...CREAM).rect(0, 0, W, H, "F");
  bg();
  s.y = 12;
  doc.setFont("helvetica", "bold").setFontSize(22).setTextColor(...TEXT).text("BOCHICA", W / 2, s.y, { align: "center" });
  s.y += 4;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...LIGHT).text("Restaurant Colombien", W / 2, s.y, { align: "center" });
  s.y += 2;
  const tw = 50;
  const x0 = (W - tw) / 2;
  doc.setFillColor(...ACCENT).rect(x0, s.y, tw / 3, 1.4, "F");
  doc.setFillColor(...BLUE).rect(x0 + tw / 3, s.y, tw / 3, 1.4, "F");
  doc.setFillColor(...RED).rect(x0 + (2 * tw) / 3, s.y, tw / 3, 1.4, "F");
  s.y += 7;
  doc.setFont("helvetica", "bold").setFontSize(15).setTextColor(...TEXT).text(title, W / 2, s.y, { align: "center" });
  s.y += 4.5;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...LIGHT).text(sub, W / 2, s.y, { align: "center" });
  s.y += 7;
  const ensure = (need: number) => {
    if (s.y + need <= H - 14) return false;
    doc.addPage();
    bg();
    s.y = 8;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXT).text(compact, M, s.y);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...LIGHT).text(sub, W - M, s.y, { align: "right" });
    s.y += 2;
    doc.setFillColor(...ACCENT).rect(M, s.y, CW, 0.6, "F");
    s.y += 5;
    s.onNewPage();
    return true;
  };
  const footer = (extra = "") => {
    const n = doc.getNumberOfPages();
    const gen = new Date().toLocaleString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    for (let p = 1; p <= n; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(...LIGHT);
      doc.text(`Généré le ${gen} · Bochica Café Bistro${extra}`, M, H - 6);
      doc.text(`Page ${p} / ${n}`, W - M, H - 6, { align: "right" });
    }
  };
  const kpis = (list: { label: string; value: string; color: RGB }[], size: number) => {
    const cw = (CW - (list.length - 1) * 4) / list.length;
    list.forEach((k, i) => {
      const cx = M + i * (cw + 4);
      doc.setFillColor(255, 255, 255).setDrawColor(...BORDER).setLineWidth(0.3).roundedRect(cx, s.y, cw, 14, 1.5, 1.5, "FD");
      doc.setFillColor(...k.color).rect(cx, s.y, 1.2, 14, "F");
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...LIGHT).text(k.label.toUpperCase(), cx + 3.5, s.y + 4);
      doc.setFont("helvetica", "bold").setFontSize(size).setTextColor(...TEXT).text(k.value, cx + 3.5, s.y + 10);
    });
    s.y += 14 + 5;
  };
  /** Cartes « bonus » (4 par ligne). */
  const bonusCards = (title: string, list: { name: string; amount: number; detail?: string }[], cardH: number) => {
    if (!list.length) return;
    ensure(cardH + 8);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXT).text(title, M, s.y);
    s.y += 5;
    const bw = (CW - 9) / 4;
    list.forEach((b, i) => {
      if (i % 4 === 0 && i > 0) s.y += cardH + 3;
      ensure(cardH);
      const cx = M + (i % 4) * (bw + 3);
      doc.setFillColor(254, 245, 220).setDrawColor(...ACCENT).setLineWidth(0.3).roundedRect(cx, s.y, bw, cardH, 1.5, 1.5, "FD");
      doc.setFillColor(...ACCENT).rect(cx, s.y, 1.2, cardH, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT).text(truncate(doc, b.name, bw - 6), cx + 4, s.y + 6);
      doc.setFontSize(13).text(pdfMoney(b.amount), cx + 4, s.y + 12);
      if (b.detail) doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(...LIGHT).text(b.detail, cx + 4, s.y + 16);
    });
    s.y += cardH + 6;
  };
  return { s, doc, ensure, footer, kpis, bonusCards };
}

/** Rapport de paie d'une semaine. Renvoie le nom du fichier, ou null si personne à imprimer. */
export function exportWeekPdf(w: PayWeekPdf): string | null {
  const rows = pdfRows(w.res.rows);
  if (!rows.length) return null;
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const sGross = sum((r) => r.grossWage);
  const sTips = sum((r) => r.tipShare);
  const sTotal = sum((r) => r.totalPay);
  const sHours = sum((r) => r.totalHours);
  const { res } = w;
  const range = `${w.startLabel} – ${w.endLabel}`;
  const { s, doc, ensure, footer, kpis, bonusCards } = sheet(`Rapport de paie — Semaine ${w.weekNum}`, range, `BOCHICA · Rapport de paie sem. ${w.weekNum}`);

  kpis(
    [
      { label: "Total à payer", value: pdfMoney(sTotal), color: ACCENT },
      { label: "Salaires bruts", value: pdfMoney(sGross), color: BLUE },
      { label: "Pourboires distribués", value: pdfMoney(sTips), color: GREEN },
      { label: "% pourb. / ventes", value: res.totalNet > 0 ? `${(res.tipPctSales * 100).toFixed(1).replace(".", ",")} %` : "—", color: ACCENT },
      { label: "Heures totales", value: `${fmtHours(sHours) || "0"} h`, color: TEXT },
    ],
    12,
  );

  // Pourboires par jour
  ensure(18);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT).text(`Pourboires de la semaine — Total ${pdfMoney(res.totalTips)}`, M, s.y);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...LIGHT);
  doc.text(`Pool Cuisine ${Math.round(res.shares.cuisine * 100)} % : ${pdfMoney(res.poolK)}   ·   Pool Service+Admin ${Math.round(res.shares.service * 100)} % : ${pdfMoney(res.poolS)}`, W - M, s.y, { align: "right" });
  s.y += 3;
  const dayW = CW / w.dayLabels.length;
  res.dailyCalc.forEach((c, k) => {
    const cx = M + k * dayW;
    doc.setFillColor(...SURFACE2).setDrawColor(...BORDER).setLineWidth(0.2).rect(cx, s.y, dayW - 1, 9, "FD");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...LIGHT).text(w.dayLabels[k]!, cx + 2, s.y + 3.2);
    doc.setFontSize(9).setTextColor(...TEXT).text(c.dayTotal > 0 ? pdfMoney(c.dayTotal) : "—", cx + 2, s.y + 7.5);
  });
  s.y += 9 + 6;

  // Tableau principal
  const C_EMP = 36;
  const C_HRS = 14;
  const C_SAL = 18;
  const C_TIP = 18;
  const C_TOT = 22;
  const C_DAY = (CW - C_EMP - C_HRS - C_SAL - C_TIP - C_TOT) / w.dayLabels.length;
  const header = () => {
    ensure(11);
    let cx = M;
    doc.setFillColor(...HEAD).rect(M, s.y, CW, 10, "F");
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...TEXT).text("EMPLOYÉ", cx + 2, s.y + 6);
    cx += C_EMP;
    w.dayLabels.forEach((l) => {
      doc.setDrawColor(...BORDER).setLineWidth(0.2).line(cx, s.y, cx, s.y + 10);
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...TEXT).text(l, cx + C_DAY / 2, s.y + 3.8, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...LIGHT);
      doc.text("Entrée", cx + C_DAY / 4, s.y + 8, { align: "center" });
      doc.text("Sortie", cx + (3 * C_DAY) / 4, s.y + 8, { align: "center" });
      cx += C_DAY;
    });
    (
      [
        ["HRS", C_HRS],
        ["SALAIRE", C_SAL],
        ["POURB.", C_TIP],
        ["TOTAL", C_TOT],
      ] as const
    ).forEach(([l, cw]) => {
      doc.setDrawColor(...BORDER).line(cx, s.y, cx, s.y + 10);
      doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...TEXT).text(l, cx + cw / 2, s.y + 6, { align: "center" });
      cx += cw;
    });
    doc.setDrawColor(...BORDER).setLineWidth(0.3).line(M, s.y, M + CW, s.y).line(M, s.y + 10, M + CW, s.y + 10);
    s.y += 10;
  };
  header();
  const rowH = 6;
  rows.forEach((r, idx) => {
    if (ensure(rowH + 2)) header();
    if (idx % 2 === 1) doc.setFillColor(...ALT).rect(M, s.y, CW, rowH, "F");
    let cx = M;
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TEXT).text(truncate(doc, `${r.emp.name ?? ""}${r.emp.isManual ? " (EXTRA)" : ""}`, C_EMP - 4), cx + 2, s.y + 3.3);
    const grp = r.group === "cuisine" ? "Cuisine" : r.group === "excluded" ? "Exclu pourb." : "Service+Adm";
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...LIGHT).text(`${grp} · ${r.rate.toFixed(2)}$/h${r.emp.isSalaried ? " · FIXE" : ""}`, cx + 2, s.y + 5.3);
    cx += C_EMP;
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...TEXT);
    r.daily.forEach((d) => {
      doc.text(d.actual?.start || "—", cx + C_DAY / 4, s.y + 4, { align: "center" });
      doc.text(d.actual?.end || "—", cx + (3 * C_DAY) / 4, s.y + 4, { align: "center" });
      cx += C_DAY;
    });
    doc.setFont("helvetica", "bold").text(r.totalHours ? hh(r.totalHours) : "—", cx + C_HRS / 2, s.y + 4, { align: "center" });
    cx += C_HRS;
    doc.setFont("helvetica", "normal").text(r.grossWage ? pdfMoney(r.grossWage) : "—", cx + C_SAL / 2, s.y + 4, { align: "center" });
    cx += C_SAL;
    doc.setTextColor(...GREEN).text(r.tipShare > 0 ? pdfMoney(r.tipShare) : "—", cx + C_TIP / 2, s.y + 4, { align: "center" });
    cx += C_TIP;
    doc.setFont("helvetica", "bold").setTextColor(...TEXT).text(r.totalPay ? pdfMoney(r.totalPay) : "—", cx + C_TOT / 2, s.y + 4, { align: "center" });
    doc.setDrawColor(...BORDER).setLineWidth(0.15).line(M, s.y + rowH, M + CW, s.y + rowH);
    s.y += rowH;
  });

  // Totaux
  ensure(7);
  doc.setFillColor(...HEAD).rect(M, s.y, CW, 7, "F");
  let cx = M;
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TEXT).text(`TOTAUX (${rows.length} employé${rows.length > 1 ? "s" : ""})`, cx + 2, s.y + 4.5);
  cx += C_EMP + w.dayLabels.length * C_DAY;
  doc.text(hh(sHours), cx + C_HRS / 2, s.y + 4.5, { align: "center" });
  cx += C_HRS;
  doc.text(pdfMoney(sGross), cx + C_SAL / 2, s.y + 4.5, { align: "center" });
  cx += C_SAL;
  doc.setTextColor(...GREEN).text(pdfMoney(sTips), cx + C_TIP / 2, s.y + 4.5, { align: "center" });
  cx += C_TIP;
  doc.setTextColor(...TEXT).setFontSize(9).text(pdfMoney(sTotal), cx + C_TOT / 2, s.y + 4.5, { align: "center" });
  doc.setDrawColor(...TEXT).setLineWidth(0.4).line(M, s.y, M + CW, s.y).line(M, s.y + 7, M + CW, s.y + 7);
  s.y += 7 + 6;

  bonusCards(
    "Bonus de la semaine",
    rows.filter((r) => r.bonus > 0).map((r) => ({ name: r.emp.name ?? "", amount: r.bonus })),
    15,
  );

  // Pourboires par employé
  const recap = rows.filter((r) => r.tipShare > 0 || r.tipEligibleHours > 0);
  if (recap.length) {
    ensure(30);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...TEXT).text("Pourboires par employé", M, s.y);
    s.y += 5;
    const rw = (CW - 9) / 4;
    const rh = 22;
    recap.forEach((r, i) => {
      if (i % 4 === 0 && i > 0) s.y += rh + 3;
      ensure(rh);
      const x = M + (i % 4) * (rw + 3);
      const kitchen = r.group === "cuisine";
      const ring = kitchen ? ACCENT : BLUE;
      doc.setFillColor(...((kitchen ? [254, 245, 220] : [228, 240, 252]) as RGB)).setDrawColor(...ring).setLineWidth(0.3).roundedRect(x, s.y, rw, rh, 1.5, 1.5, "FD");
      doc.setFillColor(...ring).rect(x, s.y, 1.2, rh, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT).text(truncate(doc, r.emp.name ?? "", rw - 6), x + 4, s.y + 5);
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...LIGHT).text(kitchen ? "Cuisine" : r.group === "excluded" ? "Exclu" : "Service + Admin", x + 4, s.y + 8.5);
      doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...GREEN).text(pdfMoney(r.tipShare), x + 4, s.y + 13.5);
      if (r.totalHours > 0 && r.tipShare > 0) {
        const perH = r.tipShare / r.totalHours;
        doc.setFontSize(8).setTextColor(...ACCENT).text(`+ ${pdfMoney(perH)}/h`, x + 4, s.y + 17.5);
        doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...LIGHT).text(`Effectif : ${pdfMoney(r.rate + perH)}/h (base ${pdfMoney(r.rate)})`, x + 4, s.y + 20.5);
      } else {
        doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(...LIGHT).text(`${hh(r.tipEligibleHours)} éligibles`, x + 4, s.y + 18);
      }
    });
    s.y += rh + 3;
  }

  footer();
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
  const { s, doc, ensure, footer, kpis, bonusCards } = sheet(`Rapport de paie — 2 semaines (S${n1} + S${n2})`, range, `BOCHICA · Paie 2 sem. ${n1} + ${n2}`);

  kpis(
    [
      { label: "Total à payer (2 sem)", value: pdfMoney(tot((r) => r.total)), color: ACCENT },
      { label: "Salaires bruts (2 sem)", value: pdfMoney(tot((r) => r.sal)), color: BLUE },
      { label: "Pourboires (2 sem)", value: pdfMoney(tot((r) => r.tips)), color: GREEN },
      { label: "Heures totales (2 sem)", value: `${fmtHours(tot((r) => r.hrs)) || "0"} h`, color: TEXT },
    ],
    11,
  );

  // Détail par semaine
  ensure(44);
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT).text("Détail par semaine", M, s.y);
  s.y += 4;
  const half = (CW - 6) / 2;
  const anyBonus = tot((r) => r.bonus) > 0;
  const fh = anyBonus ? 33 : 28;
  ([older, recent] as const).forEach((w, i) => {
    const ii = i as 0 | 1;
    const cx = M + i * (half + 6);
    doc.setFillColor(...HEAD).setDrawColor(...BORDER).setLineWidth(0.3).roundedRect(cx, s.y, half, fh, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(...TEXT).text(`Semaine ${w.weekNum}`, cx + 4, s.y + 5.5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...LIGHT).text(`${w.startLabel} – ${w.endLabel}`, cx + half - 4, s.y + 5.5, { align: "right" });
    let ly = s.y + 10.5;
    const line = (label: string, v: string, color: RGB, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9).setTextColor(...color).text(label, cx + 4, ly);
      doc.text(v, cx + 38, ly);
      ly += 4.5;
    };
    line("Avant pourb.", pdfMoney(wk(ii, (r) => r.sal)), TEXT);
    line("Pourboires", `+ ${pdfMoney(wk(ii, (r) => r.tips))}`, GREEN);
    if (anyBonus) line("Bonus", `+ ${pdfMoney(wk(ii, (r) => r.bonus))}`, [138, 90, 0]);
    line("Après pourb.", pdfMoney(wk(ii, (r) => r.total)), TEXT, true);
    ly += 1;
    const net = w.res.totalNet;
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...LIGHT);
    doc.text(`${hh(wk(ii, (r) => r.hrs))} · Ventes ${net > 0 ? pdfMoney(net) : "—"} · ${net > 0 ? `${(w.res.tipPctSales * 100).toFixed(1).replace(".", ",")} % des ventes en pourb.` : "ventes non saisies"}`, cx + 4, ly);
  });
  s.y += fh + 6;

  // Tableau
  const C_NAME = 42;
  const C_SEC = 22;
  const C_HRS = 14;
  const C_SAL = 19;
  const C_TIP = 19;
  const C_TOT = CW - C_NAME - C_SEC - 3 * C_HRS - 2 * C_SAL - 3 * C_TIP;
  const header = () => {
    ensure(12);
    let cx = M;
    doc.setFillColor(...HEAD).rect(M, s.y, CW, 11, "F");
    doc.setDrawColor(...BORDER).setLineWidth(0.2);
    doc.setFont("helvetica", "bold").setFontSize(7).setTextColor(...TEXT).text("EMPLOYÉ", cx + 2, s.y + 7);
    cx += C_NAME;
    doc.line(cx, s.y, cx, s.y + 11).text("SECTION", cx + C_SEC / 2, s.y + 7, { align: "center" });
    cx += C_SEC;
    const group = (label: string, cw: number, subs: string[]) => {
      doc.line(cx, s.y, cx, s.y + 11);
      doc.setFontSize(6).text(label, cx + (cw * subs.length) / 2, s.y + 3.5, { align: "center" });
      doc.setFontSize(7);
      subs.forEach((l) => {
        doc.text(l, cx + cw / 2, s.y + 8, { align: "center" });
        cx += cw;
      });
    };
    group("HEURES", C_HRS, [`S${n1}`, `S${n2}`, "Total"]);
    group("SALAIRE", C_SAL, [`S${n1}`, `S${n2}`]);
    group("POURBOIRE", C_TIP, [`S${n1}`, `S${n2}`, "Total"]);
    doc.line(cx, s.y, cx, s.y + 11).setFontSize(8).text("TOTAL", cx + C_TOT / 2, s.y + 7, { align: "center" });
    doc.setLineWidth(0.3).line(M, s.y, M + CW, s.y).line(M, s.y + 11, M + CW, s.y + 11);
    s.y += 11;
  };
  header();
  const rowH = 7;
  rows.forEach((r, idx) => {
    if (ensure(rowH + 2)) header();
    if (idx % 2 === 1) doc.setFillColor(...ALT).rect(M, s.y, CW, rowH, "F");
    let cx = M;
    const cell = (v: string, cw: number, bold = false) => {
      doc.setFont("helvetica", bold ? "bold" : "normal").text(v, cx + cw / 2, s.y + 4.5, { align: "center" });
      cx += cw;
    };
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TEXT).text(truncate(doc, `${r.emp.name ?? ""}${r.emp.isManual ? " (EXTRA)" : ""}`, C_NAME - 4), cx + 2, s.y + 4.2);
    doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(...LIGHT).text(`${r.rate.toFixed(2)}$/h${r.emp.isSalaried ? " · FIXE" : ""}`, cx + 2, s.y + 6.2);
    cx += C_NAME;
    doc.setFontSize(7).setTextColor(...TEXT);
    cell(r.group === "cuisine" ? "Cuisine" : r.group === "excluded" ? "Exclu" : "Service", C_SEC);
    cell(r.hrs[0] ? hh(r.hrs[0]) : "—", C_HRS);
    cell(r.hrs[1] ? hh(r.hrs[1]) : "—", C_HRS);
    cell(r.hrs[0] + r.hrs[1] ? hh(r.hrs[0] + r.hrs[1]) : "—", C_HRS, true);
    cell(r.sal[0] ? pdfMoney(r.sal[0]) : "—", C_SAL);
    cell(r.sal[1] ? pdfMoney(r.sal[1]) : "—", C_SAL);
    doc.setTextColor(...GREEN);
    cell(r.tips[0] > 0 ? pdfMoney(r.tips[0]) : "—", C_TIP);
    cell(r.tips[1] > 0 ? pdfMoney(r.tips[1]) : "—", C_TIP);
    cell(r.tips[0] + r.tips[1] > 0 ? pdfMoney(r.tips[0] + r.tips[1]) : "—", C_TIP, true);
    doc.setFontSize(9).setTextColor(...TEXT);
    cell(r.total[0] + r.total[1] ? pdfMoney(r.total[0] + r.total[1]) : "—", C_TOT, true);
    doc.setDrawColor(...BORDER).setLineWidth(0.15).line(M, s.y + rowH, M + CW, s.y + rowH);
    s.y += rowH;
  });

  // Totaux
  ensure(8);
  doc.setFillColor(...HEAD).rect(M, s.y, CW, 8, "F");
  let cx = M;
  const tcell = (v: string, cw: number) => {
    doc.text(v, cx + cw / 2, s.y + 5, { align: "center" });
    cx += cw;
  };
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...TEXT).text(`TOTAUX (${rows.length} employé${rows.length > 1 ? "s" : ""})`, cx + 2, s.y + 5);
  cx += C_NAME + C_SEC;
  tcell(hh(wk(0, (r) => r.hrs)), C_HRS);
  tcell(hh(wk(1, (r) => r.hrs)), C_HRS);
  tcell(hh(tot((r) => r.hrs)), C_HRS);
  tcell(pdfMoney(wk(0, (r) => r.sal)), C_SAL);
  tcell(pdfMoney(wk(1, (r) => r.sal)), C_SAL);
  doc.setTextColor(...GREEN);
  tcell(pdfMoney(wk(0, (r) => r.tips)), C_TIP);
  tcell(pdfMoney(wk(1, (r) => r.tips)), C_TIP);
  tcell(pdfMoney(tot((r) => r.tips)), C_TIP);
  doc.setTextColor(...TEXT).setFontSize(10);
  tcell(pdfMoney(tot((r) => r.total)), C_TOT);
  doc.setDrawColor(...TEXT).setLineWidth(0.4).line(M, s.y, M + CW, s.y).line(M, s.y + 8, M + CW, s.y + 8);
  s.y += 8 + 6;

  bonusCards(
    "Bonus des 2 semaines",
    rows
      .filter((r) => r.bonus[0] + r.bonus[1] > 0)
      .map((r) => ({
        name: r.emp.name ?? "",
        amount: r.bonus[0] + r.bonus[1],
        detail: [r.bonus[0] > 0 && `S${n1} ${pdfMoney(r.bonus[0])}`, r.bonus[1] > 0 && `S${n2} ${pdfMoney(r.bonus[1])}`].filter(Boolean).join(" · "),
      })),
    18,
  );

  footer(" · Période de paie 2 semaines");
  const name = `Bochica_Paie2Sem_S${n1}-${n2}_${older.monday}.pdf`;
  doc.save(name);
  return name;
}
