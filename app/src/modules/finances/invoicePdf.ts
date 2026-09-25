/** PDF de facture — port fidèle de generateInvoicePDF (v1, js/pages-invoices.js). */
import { jsPDF } from "jspdf";
import { pdfMoney } from "@/ui/pdfFormat";
import { invoiceStatusLabel, invoiceTotals, lineTotal, ratePct } from "./invoices.logic";
import type { Invoice } from "./finances.types";

type RGB = [number, number, number];

export async function downloadInvoicePdf(inv: Invoice): Promise<string> {
  const doc = new jsPDF({ unit: "pt", format: "letter" }); // 612 × 792 pt
  const W = doc.internal.pageSize.getWidth();
  const H = 792;
  const M = 40;
  const accent: RGB = [247, 179, 44];
  const blue: RGB = [74, 144, 226];
  const red: RGB = [231, 76, 60];
  const text: RGB = [14, 13, 12];
  const text2: RGB = [110, 95, 80];
  let y = M;

  const newPage = () => {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...text);
    doc.text("BOCHICA", M, y);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text2);
    doc.text(`Facture ${inv.invoiceNumber ?? ""} · ${inv.clientName ?? ""}`, W - M, y, { align: "right" });
    y += 6;
    doc.setDrawColor(...accent).setLineWidth(1.5).line(M, y, W - M, y);
    y += 18;
  };

  // En-tête
  doc.setFont("helvetica", "bold").setFontSize(26).setTextColor(...text);
  doc.text("BOCHICA", W / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text2);
  doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
  y += 10;
  const barW = 80;
  doc.setFillColor(...accent).rect(W / 2 - barW * 1.5, y, barW, 3, "F");
  doc.setFillColor(...blue).rect(W / 2 - barW * 0.5, y, barW, 3, "F");
  doc.setFillColor(...red).rect(W / 2 + barW * 0.5, y, barW, 3, "F");
  y += 22;
  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...text);
  doc.text("FACTURE", W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...accent);
  doc.text(inv.invoiceNumber || "—", W / 2, y, { align: "center" });
  y += 22;

  // Blocs client / détails
  const colW = (W - M * 2 - 16) / 2;
  const blockH = 90;
  doc.setFillColor(245, 241, 232).rect(M, y, colW, blockH, "F");
  doc.setDrawColor(200, 188, 165).setLineWidth(0.5).rect(M, y, colW, blockH);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
  doc.text("CLIENT", M + 10, y + 14);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...text);
  doc.text(inv.clientName || "—", M + 10, y + 30);
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text);
  let cy = y + 44;
  if (inv.clientCompany) {
    doc.text(inv.clientCompany, M + 10, cy);
    cy += 11;
  }
  if (inv.clientAddress) {
    doc.text(inv.clientAddress, M + 10, cy, { maxWidth: colW - 20 });
    cy += 11;
  }
  if (inv.clientPhone) {
    doc.text(`Tél: ${inv.clientPhone}`, M + 10, cy);
    cy += 11;
  }
  if (inv.clientEmail) doc.text(`Courriel: ${inv.clientEmail}`, M + 10, cy);

  const cx = M + colW + 16;
  doc.setFillColor(245, 241, 232).rect(cx, y, colW, blockH, "F");
  doc.setDrawColor(200, 188, 165).setLineWidth(0.5).rect(cx, y, colW, blockH);
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
  doc.text("DÉTAILS", cx + 10, y + 14);
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  doc.text(`Date d'émission : ${inv.invoiceDate || "—"}`, cx + 10, y + 32);
  doc.text(`Date d'échéance : ${inv.dueDate || "—"}`, cx + 10, y + 48);
  doc.text(`Statut : ${invoiceStatusLabel(inv.status)}`, cx + 10, y + 64);
  y += blockH + 20;

  // Lignes
  const colDescW = W - M * 2 - 70 - 80 - 80;
  doc.setFillColor(...text).rect(M, y, W - M * 2, 22, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(255, 255, 255);
  doc.text("DESCRIPTION", M + 8, y + 14);
  doc.text("QTÉ", M + 8 + colDescW, y + 14);
  doc.text("PRIX UNIT.", M + 8 + colDescW + 70, y + 14);
  doc.text("TOTAL", W - M - 8, y + 14, { align: "right" });
  y += 22;
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  let zebra = false;
  for (const line of inv.lines ?? []) {
    const descLines = doc.splitTextToSize(line.description || "—", colDescW - 8) as string[];
    const rowH = Math.max(20, descLines.length * 12 + 8);
    if (y + rowH > H - M - 100) {
      newPage();
      doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
    }
    if (zebra) doc.setFillColor(248, 244, 235).rect(M, y, W - M * 2, rowH, "F");
    doc.text(descLines, M + 8, y + 13);
    doc.text(String(Number(line.quantity) || 0), M + 8 + colDescW, y + 13);
    doc.text(pdfMoney(Number(line.unitPrice) || 0), M + 8 + colDescW + 70, y + 13);
    doc.setFont("helvetica", "bold");
    doc.text(pdfMoney(lineTotal(line)), W - M - 8, y + 13, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += rowH;
    zebra = !zebra;
  }
  y += 14;

  // Totaux
  if (y + 100 > H - M) newPage();
  const totW = 240;
  const totX = W - M - totW;
  const t = invoiceTotals(inv);
  const rows: [string, string][] = [
    ["Sous-total", pdfMoney(t.sub)],
    [`TPS (${ratePct(Number(inv.tpsRate) || 0)} %)`, pdfMoney(t.tps)],
    [`TVQ (${ratePct(Number(inv.tvqRate) || 0)} %)`, pdfMoney(t.tvq)],
  ];
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(...text);
  for (const [label, val] of rows) {
    doc.text(label, totX, y);
    doc.text(val, W - M, y, { align: "right" });
    doc.setDrawColor(220).line(totX, y + 3, W - M, y + 3);
    y += 16;
  }
  doc.setFillColor(...accent).rect(totX - 4, y - 2, totW + 4, 24, "F");
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...text);
  doc.text("TOTAL", totX, y + 14);
  doc.text(pdfMoney(t.total), W - M, y + 14, { align: "right" });
  y += 32;

  if (inv.notes) {
    if (y + 60 > H - M) newPage();
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...text2);
    doc.text("NOTES", M, y);
    y += 12;
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...text);
    const noteLines = doc.splitTextToSize(inv.notes, W - M * 2) as string[];
    doc.text(noteLines, M, y);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...text2).setLineWidth(0.3).line(M, H - M - 30, W - M, H - M - 30);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...text2);
    doc.text("Bochica Café Bistro · Restaurant Colombien", M, H - M - 16);
    doc.text("Merci de votre confiance — bochicacafebistro@gmail.com", M, H - M - 6);
    if (pages > 1) doc.text(`Page ${p} / ${pages}`, W - M, H - M - 6, { align: "right" });
  }

  const safeClient = (inv.clientName || "client").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const name = `Bochica_Facture_${inv.invoiceNumber}_${safeClient}.pdf`;
  doc.save(name);
  return name;
}
