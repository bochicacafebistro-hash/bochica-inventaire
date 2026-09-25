import { describe, expect, it } from "vitest";
import { draftInvoice, invoiceKpis, invoiceTotals, isOverdue, nextInvoiceNumber, ratePct, revenueAction, revenueForInvoice, toInvoiceDraft, validateInvoice } from "./invoices.logic";

describe("factures", () => {
  const inv = { id: "i", invoiceNumber: "FAC-2026-004", clientName: "Traiteur X", invoiceDate: "2026-09-01", lines: [{ id: "a", description: "Service", quantity: 2, unitPrice: 150 }, { id: "b", description: "Salle", quantity: 1, unitPrice: 200 }], tpsRate: 0.05, tvqRate: 0.09975 };
  it("totaux (v1)", () => {
    const t = invoiceTotals(inv);
    expect(t.sub).toBe(500);
    expect(t.tps).toBeCloseTo(25);
    expect(t.tvq).toBeCloseTo(49.875);
    expect(t.total).toBeCloseTo(574.875);
  });
  it("numérotation FAC-AAAA-NNN", () => {
    expect(nextInvoiceNumber([inv, { id: "z", invoiceNumber: "FAC-2025-099" }], 2026)).toBe("FAC-2026-005");
  });
  it("en retard seulement si envoyée et échéance passée", () => {
    expect(isOverdue({ id: "x", status: "envoyee", dueDate: "2026-09-01" }, "2026-09-25")).toBe(true);
    expect(isOverdue({ id: "x", status: "payee", dueDate: "2026-09-01" }, "2026-09-25")).toBe(false);
  });
  it("revenu lié : avant taxes + taxes séparées", () => {
    expect(revenueForInvoice(inv, "i")).toMatchObject({ amount: 500, date: "2026-09-01", sourceInvoiceId: "i" });
  });
  it("synchronisation du revenu lié", () => {
    expect(revenueAction(false, true, false)).toBe("create");
    expect(revenueAction(true, false, true)).toBe("delete");
    expect(revenueAction(true, true, true)).toBe("update");
    expect(revenueAction(false, false, false)).toBe("none");
  });
  it("formulaire : taux en %, lignes, validation", () => {
    const d = toInvoiceDraft(null, "2026-09-25");
    expect(d.dueDate).toBe("2026-10-25");
    expect(d.tvqPct).toBe("9.975");
    expect(validateInvoice(d)).toMatchObject({ clientName: expect.any(String), lines: expect.any(String) });
    d.clientName = "A";
    d.lines[0] = { ...d.lines[0]!, description: "x", quantity: "3", unitPrice: "10" };
    expect(validateInvoice(d)).toEqual({});
    expect(draftInvoice(d)).toMatchObject({ tpsRate: 0.05, tvqRate: 0.09975, lines: [{ quantity: 3, unitPrice: 10 }] });
    expect(ratePct(0.09975)).toBe("9,975");
  });
  it("KPI", () => {
    const k = invoiceKpis([{ ...inv, status: "payee" }, { ...inv, id: "2", status: "envoyee", dueDate: "2000-01-01" }, { id: "3" }]);
    expect(k.paid).toBeCloseTo(574.875);
    expect(k.overdue).toBeCloseTo(574.875);
    expect(k.drafts).toBe(1);
  });
});

describe("revenueForInvoice — arrondi", () => {
  it("arrondit TPS/TVQ au cent", () => {
    const r = revenueForInvoice({ id: "f", invoiceNumber: "FAC-1", clientName: "A", invoiceDate: "2026-09-20", tpsRate: 0.05, tvqRate: 0.09975, lines: [{ id: "a", description: "x", quantity: 1, unitPrice: 975 }] }, "f");
    expect(r.amount).toBe(975);
    expect(r.tps).toBe(48.75);
    expect(r.tvq).toBe(97.26);
  });
});
