/**
 * PDF de soumission — mise en page reprise de la v1 (js/pages-quotes.js,
 * generateQuotePDF) : format Lettre, fond crème, tricolore, cartes forfait,
 * options A/B/C à cocher, location de salle, notes, QR code du menu.
 * jsPDF et le générateur de QR sont chargés seulement au clic (pas dans
 * le paquet principal).
 */
import { TPS_RATE, TVQ_RATE } from "@/core/taxes";
import {
  getOptions,
  getRooms,
  optionLetter,
  optionTotals,
  roomTotals,
  shortDate,
  templateOf,
  venueLabel,
} from "./soumissions.logic";
import type { Quote, QuoteTemplate } from "./soumissions.types";

type RGB = [number, number, number];

export { pdfMoney } from "@/ui/pdfFormat";
import { pdfMoney } from "@/ui/pdfFormat";

const MENU_URL = "https://bochicacafebistro.ca/";

export async function downloadQuotePdf(qt: Quote, templates: QuoteTemplate[]): Promise<string> {
  const [{ jsPDF }, qrMod] = await Promise.all([import("jspdf"), import("qrcode-generator")]);
  const qrcode = (qrMod as unknown as { default: typeof import("qrcode-generator") }).default ?? qrMod;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });

  const W = 215.9;
  const H = 279.4;
  const M = 18;
  const contentW = W - 2 * M;
  const FOOTER_RESERVE = 60;

  const CREAM: RGB = [253, 246, 231];
  const TEXT: RGB = [14, 13, 12];
  const TEXT_LIGHT: RGB = [110, 95, 80];
  const ACCENT: RGB = [247, 179, 44];
  const BLUE: RGB = [74, 144, 226];
  const RED: RGB = [231, 76, 60];
  const GREEN: RGB = [125, 191, 102];
  const accentBy: Record<string, RGB> = { yellow: ACCENT, red: RED, blue: BLUE, green: GREEN };
  const fillBy: Record<string, RGB> = { yellow: [254, 242, 212], red: [252, 230, 226], blue: [226, 238, 252], green: [232, 244, 224] };

  let y = 0;
  const paint = () => {
    doc.setFillColor(...CREAM);
    doc.rect(0, 0, W, H, "F");
  };
  const tricolore = (cy: number) => {
    const tw = 56;
    const x0 = (W - tw) / 2;
    ([ACCENT, BLUE, RED] as RGB[]).forEach((c, i) => {
      doc.setFillColor(...c);
      doc.rect(x0 + (i * tw) / 3, cy, tw / 3, 1.4, "F");
    });
  };
  const fullHeader = () => {
    y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(32);
    doc.setTextColor(...TEXT);
    doc.text("BOCHICA", W / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
    y += 3;
    tricolore(y);
    y += 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(...TEXT);
    doc.text("Soumission", W / 2, y, { align: "center" });
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(`N° ${qt.quoteNumber || "—"}`, W / 2, y, { align: "center" });
    y += 10;
  };
  const compactHeader = () => {
    y = 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...TEXT);
    doc.text("BOCHICA", M, y);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(`Soumission ${qt.quoteNumber || ""} · ${qt.clientName || ""}`, W - M, y, { align: "right" });
    y += 3;
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(0.8);
    doc.line(M, y, W - M, y);
    y += 8;
  };
  const newPage = () => {
    doc.addPage();
    paint();
    compactHeader();
  };
  const ensure = (needed: number) => {
    if (y + needed > H - FOOTER_RESERVE) newPage();
  };
  const totalLine = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(...(bold ? TEXT : TEXT_LIGHT));
    doc.text(label, M + contentW * 0.55, y, { align: "right" });
    doc.setTextColor(...TEXT);
    doc.text(value, M + contentW, y, { align: "right" });
    y += bold ? 7 : 5;
  };
  const checkbox = (color: RGB, label: string) => {
    const s = 6;
    doc.setDrawColor(...color);
    doc.setLineWidth(0.8);
    doc.setFillColor(255, 255, 255);
    doc.rect(M, y, s, s, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(label, M + s + 4, y + 4.5);
    y += s + 8;
  };
  const optionBadge = (color: RGB, label: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(label, M, y);
    doc.setDrawColor(...color);
    doc.setLineWidth(1.2);
    doc.line(M + doc.getTextWidth(label) + 4, y - 1, W - M, y - 1);
    y += 5;
  };
  const addonBand = (title: string, price: number) => {
    const h = 14;
    doc.setFillColor(...ACCENT);
    doc.roundedRect(M, y, contentW, h, 2, 2, "F");
    doc.setFillColor(...TEXT);
    doc.circle(M + 6, y + 7, 1.8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(title, M + 11, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("(supplément par personne)", M + 11, y + 10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...RED);
    doc.setFontSize(12);
    doc.text(`+ ${pdfMoney(price)} / pers.`, M + contentW - 4, y + 8.5, { align: "right" });
    y += h + 4;
  };
  const tpsLabel = `TPS (${(TPS_RATE * 100).toFixed(0)} %)`;
  const tvqLabel = `TVQ (${(TVQ_RATE * 100).toFixed(3).replace(".", ",")} %)`;

  // ── Page 1 : en-tête + client / événement ──
  paint();
  fullHeader();
  const colW = (contentW - 6) / 2;
  const infoBox = (x: number, y0: number, title: string, lines: string[]) => {
    let yy = y0;
    doc.setFillColor(...fillBy.yellow!);
    doc.roundedRect(x, yy, colW, 4 + 4.5 * (lines.length + 1) + 2, 2, 2, "F");
    yy += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text(title.toUpperCase(), x + 4, yy);
    yy += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    for (const l of lines) {
      doc.text(doc.splitTextToSize(l, colW - 8)[0] as string, x + 4, yy);
      yy += 4.5;
    }
    return yy;
  };
  const clientLines = [
    qt.clientName || "—",
    qt.clientCompany ?? "",
    qt.clientPhone ? `Tél. : ${qt.clientPhone}` : "",
    qt.clientEmail ? `Courriel : ${qt.clientEmail}` : "",
  ].filter(Boolean);
  const eventLines = [
    qt.eventDate ? `Date : ${shortDate(qt.eventDate)}${qt.eventTime ? ` · ${qt.eventTime}` : ""}` : "",
    `Lieu : ${venueLabel(qt.eventVenue || "bochica")}`,
    qt.eventAddress ?? "",
    qt.guestCount ? `Nombre de personnes : ${qt.guestCount}` : "",
  ].filter(Boolean);
  y = Math.max(infoBox(M, y, "Client", clientLines), infoBox(M + colW + 6, y, "Événement", eventLines)) + 8;

  // ── Options de forfait ──
  const options = getOptions(qt);
  const multi = options.length > 1;
  if (multi) {
    ensure(22);
    doc.setFillColor(...ACCENT);
    doc.roundedRect(M, y, contentW, 16, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(`${options.length} options proposées — choisissez celle qui vous convient`, W / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Cochez l'option retenue dans la case en bas de chaque carte et retournez la soumission signée.", W / 2, y + 12, { align: "center" });
    y += 22;
  }

  options.forEach((opt, idx) => {
    const tpl = templateOf(opt, templates);
    const accent = accentBy[tpl.accentColor ?? "yellow"] ?? ACCENT;
    const fill = fillBy[tpl.accentColor ?? "yellow"] ?? fillBy.yellow!;
    const t = optionTotals(opt, qt.guestCount, tpl);
    let est = 60 + 6 + 46 + (multi ? 20 : 0) + (opt.beerAddon ? 18 : 0) + (opt.dessertAddon ? 18 : 0);
    if (opt.customLines.length) est += 10 + opt.customLines.length * 5;
    if (opt.depositAmount > 0) est += 10;
    ensure(est);
    if (multi) optionBadge(accent, `OPTION ${optionLetter(idx)}`);

    const cardY = y;
    const cardH = 60;
    doc.setFillColor(...fill);
    doc.roundedRect(M, cardY, contentW, cardH, 3, 3, "F");
    doc.setFillColor(...accent);
    doc.roundedRect(M, cardY, 3, cardH, 1.5, 1.5, "F");
    doc.rect(M, cardY, 3, cardH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text((tpl.label || "FORFAIT").toUpperCase(), M + 9, cardY + 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...TEXT);
    doc.text(tpl.name || "—", M + 9, cardY + 18);
    doc.setFontSize(22);
    doc.setTextColor(...RED);
    doc.text(pdfMoney(tpl.pricePerPerson ?? 0), M + contentW - 6, cardY + 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_LIGHT);
    doc.text("PAR PERSONNE", M + contentW - 6, cardY + 20, { align: "right" });
    doc.setDrawColor(...TEXT_LIGHT);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(M + 9, cardY + 24, M + contentW - 6, cardY + 24);
    doc.setLineDashPattern([], 0);
    let iy = cardY + 30;
    for (const [label, content] of [
      ["ENTRÉE", tpl.entree],
      ["PLAT PRINCIPAL", tpl.plat],
      ["BOISSON", tpl.boisson],
    ] as const) {
      doc.setFillColor(...BLUE);
      doc.circle(M + 11, iy - 0.8, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BLUE);
      doc.text(label, M + 15, iy);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...TEXT);
      doc.text(doc.splitTextToSize(content || "—", contentW - 24)[0] as string, M + 15, iy + 4);
      iy += 10;
    }
    y = cardY + cardH + 6;

    if (opt.beerAddon) addonBand("Boisson remplacée par une bière", tpl.beerPrice ?? 0);
    if (opt.dessertAddon) addonBand("Café ou thé + dessert", tpl.dessertPrice ?? 0);

    if (opt.customLines.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...TEXT);
      doc.text("Suppléments et ajustements", M, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      for (const l of opt.customLines) {
        doc.setTextColor(...TEXT);
        doc.text(l.description || "—", M, y + 4);
        doc.setTextColor(...(l.amount < 0 ? GREEN : TEXT));
        doc.text(`${l.amount >= 0 ? "+" : ""}${pdfMoney(l.amount)}`, M + contentW, y + 4, { align: "right" });
        y += 5;
      }
      y += 4;
    }

    doc.setDrawColor(...TEXT_LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + contentW, y);
    y += 5;
    const g = qt.guestCount || 0;
    totalLine(`Forfait (${g} × ${pdfMoney(tpl.pricePerPerson ?? 0)})`, pdfMoney(t.subtotal));
    if (t.beerSubtotal > 0) totalLine(`Bière en remplacement (${g} × ${pdfMoney(tpl.beerPrice ?? 0)})`, pdfMoney(t.beerSubtotal));
    if (t.dessertSubtotal > 0) totalLine(`Café/thé + dessert (${g} × ${pdfMoney(tpl.dessertPrice ?? 0)})`, pdfMoney(t.dessertSubtotal));
    if (t.customSubtotal !== 0) totalLine("Suppléments", pdfMoney(t.customSubtotal));
    totalLine("Sous-total", pdfMoney(t.preTaxTotal));
    totalLine(tpsLabel, pdfMoney(t.tps));
    totalLine(tvqLabel, pdfMoney(t.tvq));
    y += 1;
    totalLine(multi ? `TOTAL — OPTION ${optionLetter(idx)}` : "TOTAL", pdfMoney(t.total), true);
    if (t.deposit > 0) {
      totalLine(`Dépôt ${opt.depositPaid ? "(versé)" : "exigé"}`, pdfMoney(t.deposit));
      totalLine("Solde à payer", pdfMoney(t.balance), true);
    }
    y += 4;
    if (multi) checkbox(accent, `Je choisis l'OPTION ${optionLetter(idx)} — ${tpl.name || ""}`);
    else y += 4;
  });

  // ── Location de salle ──
  const rooms = getRooms(qt);
  if (rooms.length) {
    const roomsMulti = rooms.length > 1;
    const headH = roomsMulti ? 16 : 11;
    ensure(headH + 30);
    doc.setFillColor(...BLUE);
    doc.roundedRect(M, y, contentW, headH, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text("LOCATION DE SALLE", W / 2, y + 7, { align: "center" });
    if (roomsMulti) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.text("Choisissez la date qui vous convient — cochez l'option retenue.", W / 2, y + 12, { align: "center" });
    }
    y += headH + 6;
    rooms.forEach((room, idx) => {
      const rt = roomTotals(room);
      const hrs = [room.startTime, room.endTime].filter(Boolean).join(" – ");
      const dateLabel = room.date ? shortDate(room.date) : "Date à confirmer";
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const desc = room.description ? (doc.splitTextToSize(room.description, contentW - 18) as string[]).slice(0, 2) : [];
      const cardH = Math.max(20, (hrs ? 22 : 16) + (desc.length ? desc.length * 4 + 4 : 2));
      ensure(cardH + 35 + (roomsMulti ? 17 : 0));
      if (roomsMulti) optionBadge(BLUE, `OPTION ${idx + 1}`);
      const cy = y;
      doc.setFillColor(...fillBy.blue!);
      doc.roundedRect(M, cy, contentW, cardH, 3, 3, "F");
      doc.setFillColor(...BLUE);
      doc.roundedRect(M, cy, 3, cardH, 1.5, 1.5, "F");
      doc.rect(M, cy, 3, cardH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text("DATE DE LOCATION", M + 9, cy + 6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...TEXT);
      doc.text(dateLabel, M + 9, cy + 14);
      if (hrs) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...TEXT_LIGHT);
        doc.text(hrs, M + 9, cy + 20);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(19);
      doc.setTextColor(...RED);
      doc.text(pdfMoney(rt.total), M + contentW - 6, cy + 13, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text("TAXES INCLUSES", M + contentW - 6, cy + 18, { align: "right" });
      if (desc.length) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        let dy = cy + (hrs ? 26 : 20);
        for (const l of desc) {
          doc.text(l, M + 9, dy);
          dy += 4;
        }
      }
      y = cy + cardH + 6;
      doc.setDrawColor(...TEXT_LIGHT);
      doc.setLineWidth(0.3);
      doc.line(M, y, M + contentW, y);
      y += 5;
      totalLine("Sous-total (location)", pdfMoney(rt.preTax));
      totalLine(tpsLabel, pdfMoney(rt.tps));
      totalLine(tvqLabel, pdfMoney(rt.tvq));
      y += 1;
      totalLine(roomsMulti ? `TOTAL — OPTION ${idx + 1}` : "TOTAL LOCATION", pdfMoney(rt.total), true);
      y += 4;
      if (roomsMulti) checkbox(BLUE, `Je choisis la salle du ${dateLabel}`);
      else y += 4;
    });
  }

  // ── Notes ──
  if (qt.notes?.trim()) {
    ensure(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEXT);
    doc.text("Notes et conditions :", M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_LIGHT);
    const split = doc.splitTextToSize(qt.notes, contentW) as string[];
    if (y + split.length * 4 > H - FOOTER_RESERVE) newPage();
    doc.text(split, M, y);
    y += split.length * 4 + 4;
  }

  // ── Pied de page : QR + mentions (dernière page) ──
  if (y > H - FOOTER_RESERVE - 5) newPage();
  const qrSize = 26;
  const qrY = H - 56;
  let qrDrawn = false;
  try {
    const qr = qrcode(0, "M");
    qr.addData(MENU_URL);
    qr.make();
    const n = qr.getModuleCount();
    const dot = qrSize / n;
    doc.setFillColor(255, 255, 255);
    doc.rect(M - 1, qrY - 1, qrSize + 2, qrSize + 2, "F");
    doc.setFillColor(...TEXT);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(M + c * dot, qrY + r * dot, dot, dot, "F");
    qrDrawn = true;
  } catch {
    qrDrawn = false;
  }
  const tx = M + qrSize + 8;
  let ty = qrY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...TEXT);
  doc.text("Consultez notre menu en ligne", tx, ty);
  ty += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text(qrDrawn ? "Scannez ce code QR avec votre téléphone" : "Visitez notre site web", tx, ty);
  ty += 4;
  doc.text("ou visitez :", tx, ty);
  ty += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...ACCENT);
  doc.textWithLink(MENU_URL, tx, ty, { url: MENU_URL });
  ty += 6;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text("Découvrez tous nos plats colombiens authentiques.", tx, ty);
  doc.setDrawColor(...TEXT_LIGHT);
  doc.setLineWidth(0.2);
  doc.line(M, H - 24, W - M, H - 24);
  const fy = H - 19;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text("Le service (pourboire) n'est pas inclus dans les montants ci-dessus.", W / 2, fy, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_LIGHT);
  doc.text("Les montants ci-dessus incluent les taxes applicables (TPS 5 % + TVQ 9,975 %).", W / 2, fy + 5, { align: "center" });
  if (qt.validUntil) doc.text(`Soumission valide jusqu'au ${shortDate(qt.validUntil)}.`, W / 2, fy + 10, { align: "center" });

  const pages = doc.getNumberOfPages();
  if (pages > 1) {
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...TEXT_LIGHT);
      doc.text(`Page ${p} / ${pages}`, W - M, H - 4, { align: "right" });
    }
  }

  const clean = (qt.clientName || "client").normalize("NFD").replace(/[^a-z0-9]/gi, "_");
  const filename = `Bochica_Soumission_${qt.quoteNumber || "brouillon"}_${clean}.pdf`;
  doc.save(filename);
  return filename;
}
