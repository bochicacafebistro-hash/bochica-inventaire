import { useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import {
  draftInvoice,
  INVOICE_STATUSES,
  invoiceTotals,
  lineTotal,
  newLineId,
  ratePct,
  toInvoiceDraft,
  validateInvoice,
  type InvoiceDraft,
} from "../invoices.logic";
import type { Invoice } from "../finances.types";
import styles from "../Finances.module.css";

export type InvoiceFields = ReturnType<typeof draftInvoice>;

export function InvoiceModal({
  invoice,
  number,
  onClose,
  onSave,
}: {
  invoice: Invoice | null;
  number: string;
  onClose: () => void;
  onSave: (f: InvoiceFields) => Promise<void>;
}) {
  const [d, setD] = useState<InvoiceDraft>(() => toInvoiceDraft(invoice));
  const [errors, setErrors] = useState<ReturnType<typeof validateInvoice>>({});
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<InvoiceDraft>) =>
    setD((x) => ({ ...x, ...patch }));
  const setLine = (id: string, patch: Partial<InvoiceDraft["lines"][number]>) =>
    setD((x) => ({
      ...x,
      lines: x.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));

  const fields = draftInvoice(d);
  const t = invoiceTotals(fields);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateInvoice(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      // Les lignes complètement vides sont ignorées.
      await onSave({
        ...fields,
        lines: fields.lines.filter((l) => l.description || l.unitPrice),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={invoice ? `Facture ${number}` : `Nouvelle facture ${number}`}
      onClose={onClose}
      width={760}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="invoice-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form
        id="invoice-form"
        onSubmit={submit}
        noValidate
        style={{ display: "grid", gap: "var(--sp-4)" }}
      >
        <div className={styles.row}>
          <TextField
            label="Nom du client"
            required
            value={d.clientName}
            onChange={(e) => set({ clientName: e.target.value })}
            error={errors.clientName}
            autoFocus
          />
          <TextField
            label="Entreprise"
            value={d.clientCompany}
            onChange={(e) => set({ clientCompany: e.target.value })}
          />
        </div>
        <div className={styles.row}>
          <TextField
            label="Téléphone"
            type="tel"
            value={d.clientPhone}
            onChange={(e) => set({ clientPhone: e.target.value })}
          />
          <TextField
            label="Courriel"
            type="email"
            value={d.clientEmail}
            onChange={(e) => set({ clientEmail: e.target.value })}
            error={errors.clientEmail}
          />
        </div>
        <TextField
          label="Adresse"
          value={d.clientAddress}
          onChange={(e) => set({ clientAddress: e.target.value })}
        />
        <div className={styles.row}>
          <TextField
            label="Date d'émission"
            type="date"
            value={d.invoiceDate}
            onChange={(e) => set({ invoiceDate: e.target.value })}
          />
          <TextField
            label="Échéance"
            type="date"
            value={d.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
          />
          <SelectField
            label="Statut"
            value={d.status}
            onChange={(e) => set({ status: e.target.value })}
            options={INVOICE_STATUSES.map((s) => ({
              value: s.key,
              label: s.label,
            }))}
          />
        </div>

        <div className={styles.box}>
          <div className={styles.boxHead}>
            <span>Lignes</span>
            <Button
              variant="ghost"
              type="button"
              onClick={() =>
                set({
                  lines: [
                    ...d.lines,
                    {
                      id: newLineId(),
                      description: "",
                      quantity: "1",
                      unitPrice: "",
                    },
                  ],
                })
              }
            >
              <Plus size={16} aria-hidden /> Ligne
            </Button>
          </div>
          <div
            className={`${styles.invLine} ${styles.invLineHead}`}
            aria-hidden
          >
            <span>Description</span>
            <span>Qté</span>
            <span>Prix unit.</span>
            <span className={`${styles.num} ${styles.lineTotalCell}`}>
              Total
            </span>
            <span />
          </div>
          {d.lines.map((l, i) => (
            <div key={l.id} className={styles.invLine}>
              <input
                aria-label={`Description ligne ${i + 1}`}
                value={l.description}
                onChange={(e) => setLine(l.id, { description: e.target.value })}
                placeholder="Service, location…"
              />
              <input
                aria-label={`Quantité ligne ${i + 1}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={l.quantity}
                onChange={(e) => setLine(l.id, { quantity: e.target.value })}
                placeholder="Qté"
              />
              <input
                aria-label={`Prix unitaire ligne ${i + 1}`}
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={l.unitPrice}
                onChange={(e) => setLine(l.id, { unitPrice: e.target.value })}
                placeholder="0,00"
              />
              <span className={`${styles.num} ${styles.lineTotalCell}`}>
                {fmtMoney(
                  lineTotal({
                    quantity: Number(l.quantity) || 0,
                    unitPrice: Number(l.unitPrice) || 0,
                  }),
                )}
              </span>
              <button
                type="button"
                className={styles.iconBtn}
                aria-label={`Retirer la ligne ${i + 1}`}
                onClick={() =>
                  set({
                    lines:
                      d.lines.length > 1
                        ? d.lines.filter((x) => x.id !== l.id)
                        : d.lines,
                  })
                }
                disabled={d.lines.length === 1}
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {errors.lines && (
            <div className={styles.formError}>{errors.lines}</div>
          )}
        </div>

        <div className={styles.row}>
          <TextField
            label="TPS (%)"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={d.tpsPct}
            onChange={(e) => set({ tpsPct: e.target.value })}
            hint="0 si exonéré"
          />
          <TextField
            label="TVQ (%)"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={d.tvqPct}
            onChange={(e) => set({ tvqPct: e.target.value })}
          />
        </div>
        <div className={styles.totals} aria-live="polite">
          <div className={styles.totalLine}>
            <span>Sous-total</span>
            <span>{fmtMoney(t.sub)}</span>
          </div>
          <div className={styles.totalLine}>
            <span>TPS ({ratePct(fields.tpsRate)} %)</span>
            <span>{fmtMoney(t.tps)}</span>
          </div>
          <div className={styles.totalLine}>
            <span>TVQ ({ratePct(fields.tvqRate)} %)</span>
            <span>{fmtMoney(t.tvq)}</span>
          </div>
          <div className={`${styles.totalLine} ${styles.grand}`}>
            <span>Total</span>
            <span>{fmtMoney(t.total)}</span>
          </div>
        </div>
        <TextArea
          label="Notes (visibles sur le PDF)"
          rows={3}
          value={d.notes}
          onChange={(e) => set({ notes: e.target.value })}
          placeholder="Conditions de paiement, virement Interac…"
        />
        {invoice?.status === "payee" && d.status === "payee" && (
          <p className={styles.hint}>
            Facture payée : le revenu lié dans Dépenses & revenus sera mis à
            jour.
          </p>
        )}
      </form>
    </Modal>
  );
}
