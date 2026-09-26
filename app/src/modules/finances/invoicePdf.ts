/** PDF de facture — style moderne commun (ui/pdfTheme.ts), même contenu que la v1 (js/pages-invoices.js). */
import { jsPDF } from "jspdf";
import { C, footer, header, label, page, table } from "@/ui/pdfTheme";
import { pdfMoney } from "@/ui/pdfFormat";
import { invoiceStatusLabel, invoiceTotals, lineTotal, ratePct } from "./invoices.logic";
import type { Invoice } from "./finances.types";

export async function downloadInvoicePdf(inv: Invoice): Promise<string> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const MG = 18;
  const { W, H, M, CW } = page(doc, MG);
  const t = invoiceTotals(inv);
  const status = invoiceStatusLabel(inv.status);

  let y = header(doc, { title: "Facture", subtitle: `N° ${inv.invoiceNumber || "—"}`, meta: inv.invoiceDate ? `Émise le ${inv.invoiceDate}` : undefined }, MG);

  // Client + détails
  const colW = (CW - 5) / 2;
  const clientRest = [inv.clientCompany ?? "", inv.clientAddress ?? "", inv.clientPhone ? `Tél. : ${inv.clientPhone}` : "", inv.clientEmail ?? ""].filter(Boolean);
  const details: [string, string][] = [
    ["Date d'émission", inv.invoiceDate || "—"],
    ["Date d'échéance", inv.dueDate || "—"],
    ["Statut", status],
  ];
  const boxH = Math.max(19 + clientRest.length * 4.6, 13 + details.length * 5.6) + 3;
  doc.setFillColor(...C.soft).roundedRect(M, y, colW, boxH, 2.2, 2.2, "F");
  label(doc, "Facturé à", M + 5, y + 7);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...C.ink).text(doc.splitTextToSize(inv.clientName || "—", colW - 10)[0] as string, M + 5, y + 13.5);
  doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2);
  clientRest.forEach((l, i) => doc.text(doc.splitTextToSize(l, colW - 10)[0] as string, M + 5, y + 19 + i * 4.6));
  const cx = M + colW + 5;
  doc.setFillColor(...C.soft).roundedRect(cx, y, colW, boxH, 2.2, 2.2, "F");
  label(doc, "Détails", cx + 5, y + 7);
  details.forEach(([k, v], i) => {
    const ly = y + 13.5 + i * 5.6;
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2).text(k, cx + 5, ly);
    const paid = k === "Statut" && /pay/i.test(status);
    doc.setFont("helvetica", "bold").setTextColor(...(paid ? C.green : C.ink)).text(v, cx + colW - 5, ly, { align: "right" });
  });
  y += boxH + 10;

  // Lignes
  y = table(doc, {
    y,
    margin: MG,
    head: [["Description", "Qté", "Prix unit.", "Total"]],
    body: (inv.lines ?? []).map((l) => [l.description || "—", String(Number(l.quantity) || 0), pdfMoney(Number(l.unitPrice) || 0), pdfMoney(lineTotal(l))]),
    right: [1, 2, 3],
    fontSize: 9,
    columnStyles: { 1: { cellWidth: 18 }, 2: { cellWidth: 30 }, 3: { cellWidth: 32, fontStyle: "bold" } },
    repeatHeader: `Facture ${inv.invoiceNumber ?? ""} · ${inv.clientName ?? ""}`,
  });

  // Totaux
  if (y + 40 > H - 20) {
    doc.addPage();
    y = 24;
  }
  const TW = 84;
  const TX = W - M - TW;
  const line = (k: string, v: string) => {
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.ink2).text(k, TX, y);
    doc.setTextColor(...C.ink).text(v, W - M - 2, y, { align: "right" });
    y += 5.6;
  };
  line("Sous-total", pdfMoney(t.sub));
  line(`TPS (${ratePct(Number(inv.tpsRate) || 0)} %)`, pdfMoney(t.tps));
  line(`TVQ (${ratePct(Number(inv.tvqRate) || 0)} %)`, pdfMoney(t.tvq));
  y += 2;
  doc.setFillColor(...C.soft).roundedRect(TX - 4, y - 5.6, TW + 4, 9.5, 1.8, 1.8, "F");
  doc.setFillColor(...C.accent).roundedRect(TX - 4, y - 5.6, 1.4, 9.5, 0.7, 0.7, "F");
  doc.setFont("helvetica", "bold").setFontSize(11.5).setTextColor(...C.ink).text("Total", TX, y + 0.2);
  doc.text(pdfMoney(t.total), W - M - 2, y + 0.2, { align: "right" });
  y += 14;

  if (inv.notes) {
    doc.setFont("helvetica", "normal").setFontSize(8.8);
    const lines = doc.splitTextToSize(inv.notes, CW) as string[];
    if (y + 10 + lines.length * 4.2 > H - 20) {
      doc.addPage();
      y = 24;
    }
    label(doc, "Notes", M, y);
    y += 5;
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2).text(lines, M, y);
  }

  footer(doc, "Bochica Café Bistro · Merci de votre confiance — bochicacafebistro@gmail.com", MG);

  const safeClient = (inv.clientName || "client").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
  const name = `Bochica_Facture_${inv.invoiceNumber}_${safeClient}.pdf`;
  doc.save(name);
  return name;
}
