import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { autoTaxes, revenueFields, toRevenueDraft, validateRevenue, type RevenueDraft } from "../finances.logic";
import type { Revenue } from "../finances.types";
import styles from "../Finances.module.css";

export function RevenueModal({ revenue, onClose, onSave }: { revenue: Revenue | null; onClose: () => void; onSave: (f: ReturnType<typeof revenueFields>) => Promise<void> }) {
  const [d, setD] = useState<RevenueDraft>(() => toRevenueDraft(revenue));
  const [errors, setErrors] = useState<ReturnType<typeof validateRevenue>>({});
  const [saving, setSaving] = useState(false);
  const linked = !!revenue?.sourceInvoiceId;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateRevenue(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(revenueFields(d));
    } finally {
      setSaving(false);
    }
  }
  const amount = Number(d.amount) || 0;

  return (
    <Modal
      open
      title={revenue ? "Modifier le revenu" : "Nouveau revenu"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="revenue-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="revenue-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        {linked && <div className={styles.banner}>Ce revenu vient d'une facture : modifie plutôt la facture pour le garder synchronisé.</div>}
        <TextField label="Description" required value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} error={errors.description} autoFocus placeholder="ex. Ventes semaine 38" />
        <div className={styles.row}>
          <TextField label="Date (début)" type="date" required value={d.dateStart} onChange={(e) => setD({ ...d, dateStart: e.target.value })} error={errors.dateStart} />
          <TextField
            label="Fin (optionnel)"
            type="date"
            min={d.dateStart}
            value={d.dateEnd}
            onChange={(e) => setD({ ...d, dateEnd: e.target.value })}
            error={errors.dateEnd}
            hint="Pour un revenu qui couvre plusieurs jours"
          />
        </div>
        <TextField
          label="Montant avant taxes ($)"
          required
          type="number"
          step="0.01"
          value={d.amount}
          onChange={(e) => {
            const v = e.target.value;
            setD((x) => ({ ...x, amount: v, ...(x.taxesManual ? {} : autoTaxes(Number(v) || 0)) }));
          }}
          error={errors.amount}
        />
        <div className={styles.row}>
          <TextField label="TPS perçue ($)" type="number" step="0.01" value={d.tps} onChange={(e) => setD({ ...d, tps: e.target.value, taxesManual: true })} />
          <TextField label="TVQ perçue ($)" type="number" step="0.01" value={d.tvq} onChange={(e) => setD({ ...d, tvq: e.target.value, taxesManual: true })} />
        </div>
        {d.taxesManual && (
          <div>
            <Button variant="ghost" onClick={() => setD((x) => ({ ...x, ...autoTaxes(Number(x.amount) || 0), taxesManual: false }))}>
              Recalculer les taxes (5 % + 9,975 %)
            </Button>
          </div>
        )}
        {amount > 0 && (
          <div className={styles.preview}>
            Total taxes incluses : <strong>{fmtMoney(amount + (Number(d.tps) || 0) + (Number(d.tvq) || 0))}</strong>
          </div>
        )}
        <TextArea label="Notes" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} rows={2} />
      </form>
    </Modal>
  );
}
