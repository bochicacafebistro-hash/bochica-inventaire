/**
 * PDF de soumission — style moderne commun (ui/pdfTheme.ts) : fond blanc,
 * cartes forfait épurées, options A/B/C à cocher, location de salle, notes,
 * QR code du menu. Même contenu que la v1 (js/pages-quotes.js).
 * jsPDF et le générateur de QR sont chargés seulement au clic.
 */
import { TPS_RATE, TVQ_RATE } from "@/core/taxes";
import { C, compactHeader, footer, header, label, page, type RGB } from "@/ui/pdfTheme";
import { getOptions, getRooms, optionLetter, optionTotals, roomTotals, shortDate, templateOf, venueLabel } from "./soumissions.logic";
import type { Quote, QuoteTemplate } from "./soumissions.types";

export { pdfMoney } from "@/ui/pdfFormat";
import { pdfMoney } from "@/ui/pdfFormat";

const MENU_URL = "https://bochicacafebistro.ca/";

const TONES: Record<string, { c: RGB; soft: RGB }> = {
  yellow: { c: [214, 146, 12], soft: C.accentSoft },
  red: { c: C.red, soft: C.redSoft },
  blue: { c: C.blue, soft: C.blueSoft },
  green: { c: C.green, soft: C.greenSoft },
};

export async function downloadQuotePdf(qt: Quote, templates: QuoteTemplate[]): Promise<string> {
  const [{ jsPDF }, qrMod] = await Promise.all([import("jspdf"), import("qrcode-generator")]);
  const qrcode = (qrMod as unknown as { default: typeof import("qrcode-generator") }).default ?? qrMod;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const MG = 18;
  const { W, H, M, CW } = page(doc, MG);
  const BOTTOM = H - 20; // limite du contenu (pied de page en dessous)
  const LAST_RESERVE = 50; // QR + mentions, dernière page

  let y = header(doc, {
    title: "Soumission",
    subtitle: `N° ${qt.quoteNumber || "—"}`,
    meta: [`Émise le ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}`, qt.validUntil ? `valide jusqu'au ${shortDate(qt.validUntil)}` : ""].filter(Boolean).join(" · "),
  }, MG);

  const newPage = () => {
    doc.addPage();
    y = compactHeader(doc, `Soumission ${qt.quoteNumber || ""} · ${qt.clientName || ""}`, MG);
  };
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) newPage();
  };
  const TOT_W = 92;
  const TOT_X = W - M - TOT_W;
  const tline = (name: string, value: string, strong = false, color?: RGB) => {
    ensure(strong ? 10 : 6);
    if (strong) {
      doc.setFillColor(...C.soft).roundedRect(TOT_X - 4, y - 5.2, TOT_W + 4, 8.4, 1.6, 1.6, "F");
      doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...C.ink);
      doc.text(name, TOT_X, y);
      doc.text(value, W - M - 2, y, { align: "right" });
      y += 9;
      return;
    }
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2);
    doc.text(name, TOT_X, y);
    doc.setTextColor(...(color ?? C.ink)).text(value, W - M - 2, y, { align: "right" });
    y += 5.2;
  };
  const rule = (x1 = M, x2 = W - M) => doc.setDrawColor(...C.line).setLineWidth(0.3).line(x1, y, x2, y);
  const pill = (text: string, tone: { c: RGB; soft: RGB }) => {
    doc.setFont("helvetica", "bold").setFontSize(7.2);
    doc.setCharSpace(0.4);
    const w = doc.getTextWidth(text) + text.length * 0.4 + 7;
    doc.setFillColor(...tone.soft).roundedRect(M, y, w, 6, 3, 3, "F");
    doc.setTextColor(...tone.c).text(text, M + 3.5, y + 4.1);
    doc.setCharSpace(0);
    y += 9;
  };
  const checkbox = (text: string) => {
    ensure(10);
    doc.setDrawColor(...C.ink2).setLineWidth(0.4).roundedRect(M, y, 5, 5, 1, 1, "S");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...C.ink).text(text, M + 8, y + 3.8);
    y += 16;
  };
  const tpsLabel = `TPS (${(TPS_RATE * 100).toFixed(0)} %)`;
  const tvqLabel = `TVQ (${(TVQ_RATE * 100).toFixed(3).replace(".", ",")} %)`;

  // ── Client / événement ──
  const colW = (CW - 5) / 2;
  const infoBox = (x: number, y0: number, title: string, first: string, rest: string[], h: number) => {
    doc.setFillColor(...C.soft).roundedRect(x, y0, colW, h, 2.2, 2.2, "F");
    label(doc, title, x + 5, y0 + 7);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...C.ink).text(doc.splitTextToSize(first, colW - 10)[0] as string, x + 5, y0 + 13.5);
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2);
    rest.forEach((l, i) => doc.text(doc.splitTextToSize(l, colW - 10)[0] as string, x + 5, y0 + 19 + i * 4.6));
  };
  const clientRest = [qt.clientCompany ?? "", qt.clientPhone ? `Tél. : ${qt.clientPhone}` : "", qt.clientEmail ?? ""].filter(Boolean);
  const eventFirst = qt.eventDate ? `${shortDate(qt.eventDate)}${qt.eventTime ? ` · ${qt.eventTime}` : ""}` : "Date à confirmer";
  const eventRest = [venueLabel(qt.eventVenue || "bochica"), qt.eventAddress ?? "", qt.guestCount ? `${qt.guestCount} personnes` : ""].filter(Boolean);
  const infoH = 19 + Math.max(clientRest.length, eventRest.length, 1) * 4.6 + 2;
  infoBox(M, y, "Client", qt.clientName || "—", clientRest, infoH);
  infoBox(M + colW + 5, y, "Événement", eventFirst, eventRest, infoH);
  y += infoH + 10;

  // ── Options de forfait ──
  const options = getOptions(qt);
  const multi = options.length > 1;
  if (multi) {
    ensure(20);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...C.ink).text(`${options.length} options proposées`, M, y);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...C.muted).text("Cochez l'option retenue sous la carte choisie et retournez la soumission signée.", M, y + 5);
    y += 13;
  }

  options.forEach((opt, idx) => {
    const tpl = templateOf(opt, templates);
    const tone = TONES[tpl.accentColor ?? "yellow"] ?? TONES.yellow!;
    const t = optionTotals(opt, qt.guestCount, tpl);

    // Menu en 3 colonnes (texte sur 3 lignes max)
    const mcW = (CW - 16) / 3;
    doc.setFont("helvetica", "normal").setFontSize(8.8);
    const menu = ([
      ["Entrée", tpl.entree],
      ["Plat principal", tpl.plat],
      ["Boisson", tpl.boisson],
    ] as const).map(([l, v]) => [l, (doc.splitTextToSize(v || "—", mcW - 4) as string[]).slice(0, 3)] as const);
    const menuLines = Math.max(...menu.map(([, v]) => v.length));
    const cardH = 36 + menuLines * 4.2;

    // Sous la carte : suppléments à gauche, totaux à droite (côte à côte).
    const LW = CW - TOT_W - 12;
    const addons: [string, number][] = [];
    if (opt.beerAddon) addons.push(["Boisson remplacée par une bière", tpl.beerPrice ?? 0]);
    if (opt.dessertAddon) addons.push(["Café ou thé + dessert", tpl.dessertPrice ?? 0]);
    const leftH = addons.length * 14 + (opt.customLines.length ? 8 + opt.customLines.length * 5.2 : 0);
    const nLines = 4 + (t.beerSubtotal > 0 ? 1 : 0) + (t.dessertSubtotal > 0 ? 1 : 0) + (t.customSubtotal !== 0 ? 1 : 0);
    const rightH = nLines * 5.2 + 3 + 12 + (t.deposit > 0 ? 16.5 : 0);
    ensure(Math.min((multi ? 9 : 0) + cardH + 6 + Math.max(leftH, rightH) + (multi ? 16 : 6), BOTTOM - 26));
    if (multi) pill(`OPTION ${optionLetter(idx)}`, tone);

    const cy = y;
    doc.setDrawColor(...C.line).setLineWidth(0.35).roundedRect(M, cy, CW, cardH, 3, 3, "S");
    doc.setFillColor(...tone.c).roundedRect(M, cy, CW, 1.6, 0.8, 0.8, "F");
    label(doc, tpl.label || "Forfait", M + 7, cy + 10);
    doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...C.ink).text(doc.splitTextToSize(tpl.name || "—", CW - 70)[0] as string, M + 7, cy + 18.5);
    doc.setFont("helvetica", "bold").setFontSize(19).setTextColor(...C.ink).text(pdfMoney(tpl.pricePerPerson ?? 0), W - M - 7, cy + 16, { align: "right" });
    label(doc, "par personne", W - M - 7, cy + 21, { align: "right" });
    doc.setDrawColor(...C.line).setLineWidth(0.25).line(M + 7, cy + 25, W - M - 7, cy + 25);
    menu.forEach(([l, lines], i) => {
      const x = M + 7 + i * (mcW + 1);
      doc.setFillColor(...tone.c).circle(x + 0.8, cy + 30.6, 0.8, "F");
      label(doc, l, x + 3, cy + 31.3, { color: tone.c });
      doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2);
      lines.forEach((ln, k) => doc.text(ln, x, cy + 36.5 + k * 4.2));
    });
    const top = cy + cardH + 6;

    // Colonne gauche
    let yl = top;
    for (const [title, price] of addons) {
      doc.setFillColor(...C.soft).roundedRect(M, yl, LW, 11.5, 1.8, 1.8, "F");
      doc.setFont("helvetica", "bold").setFontSize(8.6).setTextColor(...C.ink).text(doc.splitTextToSize(title, LW - 10)[0] as string, M + 4, yl + 4.9);
      doc.setFont("helvetica", "normal").setFontSize(7.8).setTextColor(...C.muted).text("Supplément par personne", M + 4, yl + 8.9);
      doc.setFont("helvetica", "bold").setFontSize(8.6).setTextColor(...C.ink).text(`+ ${pdfMoney(price)}`, M + LW - 4, yl + 6.9, { align: "right" });
      yl += 14;
    }
    if (opt.customLines.length) {
      label(doc, "Suppléments et ajustements", M, yl + 3);
      yl += 8.5;
      for (const l of opt.customLines) {
        doc.setFont("helvetica", "normal").setFontSize(8.6).setTextColor(...C.ink2).text(doc.splitTextToSize(l.description || "—", LW - 26)[0] as string, M, yl);
        doc.setTextColor(...(l.amount < 0 ? C.green : C.ink)).text(`${l.amount >= 0 ? "+ " : ""}${pdfMoney(l.amount)}`, M + LW - 4, yl, { align: "right" });
        yl += 5.2;
      }
    }

    // Colonne droite : totaux
    y = top + 4;
    const g = qt.guestCount || 0;
    tline(`Forfait (${g} × ${pdfMoney(tpl.pricePerPerson ?? 0)})`, pdfMoney(t.subtotal));
    if (t.beerSubtotal > 0) tline(`Bière (${g} × ${pdfMoney(tpl.beerPrice ?? 0)})`, pdfMoney(t.beerSubtotal));
    if (t.dessertSubtotal > 0) tline(`Café/thé + dessert (${g} × ${pdfMoney(tpl.dessertPrice ?? 0)})`, pdfMoney(t.dessertSubtotal));
    if (t.customSubtotal !== 0) tline("Suppléments", pdfMoney(t.customSubtotal));
    y -= 1.6;
    rule(TOT_X, W - M);
    y += 4.6;
    tline("Sous-total", pdfMoney(t.preTaxTotal));
    tline(tpsLabel, pdfMoney(t.tps));
    tline(tvqLabel, pdfMoney(t.tvq));
    y += 3;
    tline(multi ? `Total — option ${optionLetter(idx)}` : "Total", pdfMoney(t.total), true);
    if (t.deposit > 0) {
      tline(`Dépôt ${opt.depositPaid ? "(versé)" : "exigé"}`, pdfMoney(t.deposit), false, opt.depositPaid ? C.green : undefined);
      y += 2;
      tline("Solde à payer", pdfMoney(t.balance), true);
    }
    y = Math.max(y, yl) + 2;
    if (multi) checkbox(`Je choisis l'option ${optionLetter(idx)} — ${tpl.name || ""}`);
    else y += 6;
  });

  // ── Location de salle ──
  const rooms = getRooms(qt);
  if (rooms.length) {
    const roomsMulti = rooms.length > 1;
    ensure(60);
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...C.ink).text("Location de salle", M, y);
    if (roomsMulti) doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...C.muted).text("Choisissez la date qui vous convient — cochez l'option retenue.", M, y + 5);
    y += roomsMulti ? 13 : 8;
    rooms.forEach((room, idx) => {
      const rt = roomTotals(room);
      const hrs = [room.startTime, room.endTime].filter(Boolean).join(" – ");
      const dateLabel = room.date ? shortDate(room.date) : "Date à confirmer";
      doc.setFont("helvetica", "normal").setFontSize(8.8);
      const desc = room.description ? (doc.splitTextToSize(room.description, CW - 60) as string[]).slice(0, 3) : [];
      const cardH = 22 + (hrs ? 5 : 0) + desc.length * 4.2;
      ensure(cardH + 30 + (roomsMulti ? 9 : 0));
      if (roomsMulti) pill(`OPTION ${idx + 1}`, TONES.blue!);
      const cy = y;
      doc.setDrawColor(...C.line).setLineWidth(0.35).roundedRect(M, cy, CW, cardH, 3, 3, "S");
      doc.setFillColor(...C.blue).roundedRect(M, cy, CW, 1.6, 0.8, 0.8, "F");
      label(doc, "Date de location", M + 7, cy + 9);
      doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(...C.ink).text(dateLabel, M + 7, cy + 16);
      let dy = cy + 16;
      if (hrs) {
        dy += 5;
        doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...C.ink2).text(hrs, M + 7, dy);
      }
      doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.muted);
      desc.forEach((l) => {
        dy += 4.6;
        doc.text(l, M + 7, dy);
      });
      doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...C.ink).text(pdfMoney(rt.total), W - M - 7, cy + 14, { align: "right" });
      label(doc, "taxes incluses", W - M - 7, cy + 19, { align: "right" });
      y = cy + cardH + 7;
      ensure(3 * 5.2 + 14 + (roomsMulti ? 16 : 0));
      tline("Sous-total (location)", pdfMoney(rt.preTax));
      tline(tpsLabel, pdfMoney(rt.tps));
      tline(tvqLabel, pdfMoney(rt.tvq));
      y += 3;
      tline(roomsMulti ? `Total — option ${idx + 1}` : "Total location", pdfMoney(rt.total), true);
      y += 2;
      if (roomsMulti) checkbox(`Je choisis la salle du ${dateLabel}`);
      else y += 6;
    });
  }

  // ── Notes ──
  if (qt.notes?.trim()) {
    doc.setFont("helvetica", "normal").setFontSize(8.8);
    const split = doc.splitTextToSize(qt.notes.trim(), CW) as string[];
    ensure(Math.min(12 + split.length * 4.2, BOTTOM - 30));
    doc.setFont("helvetica", "bold").setFontSize(10.5).setTextColor(...C.ink).text("Notes et conditions", M, y);
    y += 6;
    doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2);
    for (const l of split) {
      if (y > BOTTOM) newPage();
      doc.text(l, M, y);
      y += 4.2;
    }
    y += 4;
  }

  // ── Bas de la dernière page : QR du menu + mentions ──
  if (y > H - LAST_RESERVE - 18) newPage();
  const py = H - 60;
  const ph = 30;
  doc.setFillColor(...C.soft).roundedRect(M, py, CW, ph, 2.5, 2.5, "F");
  const qrSize = 22;
  let qrDrawn = false;
  try {
    const qr = qrcode(0, "M");
    qr.addData(MENU_URL);
    qr.make();
    const n = qr.getModuleCount();
    const dot = qrSize / n;
    const qx = M + 4;
    const qy = py + 4;
    doc.setFillColor(...C.white).roundedRect(qx - 1, qy - 1, qrSize + 2, qrSize + 2, 1, 1, "F");
    doc.setFillColor(...C.ink);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * dot, qy + r * dot, dot, dot, "F");
    qrDrawn = true;
  } catch {
    qrDrawn = false;
  }
  const tx = M + (qrDrawn ? qrSize + 12 : 6);
  doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...C.ink).text("Consultez notre menu en ligne", tx, py + 10);
  doc.setFont("helvetica", "normal").setFontSize(8.8).setTextColor(...C.ink2).text(qrDrawn ? "Scannez le code QR avec votre téléphone ou visitez :" : "Visitez notre site web :", tx, py + 15.5);
  doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...C.blue).textWithLink(MENU_URL, tx, py + 21, { url: MENU_URL });

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...C.red).text("Le service (pourboire) n'est pas inclus dans les montants ci-dessus.", W / 2, H - 23, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...C.muted).text("Les totaux incluent les taxes applicables (TPS 5 % + TVQ 9,975 %).", W / 2, H - 18.5, { align: "center" });

  footer(doc, "Bochica Café Bistro · Restaurant colombien · bochicacafebistro.ca", MG);

  const clean = (qt.clientName || "client").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "_");
  const filename = `Bochica_Soumission_${qt.quoteNumber || "brouillon"}_${clean}.pdf`;
  doc.save(filename);
  return filename;
}
