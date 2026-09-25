import { useId, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import {
  allCategories,
  autoTaxes,
  categoryType,
  expenseFields,
  expenseSubtotal,
  newKey,
  toExpenseDraft,
  validateExpense,
  type ExpenseDraft,
  type ExpenseErrors,
  type ExpenseType,
} from "../finances.logic";
import type { Expense, ExpenseCategory } from "../finances.types";
import styles from "../Finances.module.css";

export function ExpenseModal({
  expense,
  categories,
  supplierNames,
  onClose,
  onSave,
  onAddCategory,
}: {
  expense: Expense | null;
  categories: ExpenseCategory[];
  supplierNames: string[];
  onClose: () => void;
  onSave: (f: ReturnType<typeof expenseFields>) => Promise<void>;
  onAddCategory: (name: string, type: ExpenseType) => Promise<boolean>;
}) {
  const [d, setD] = useState<ExpenseDraft>(() => toExpenseDraft(expense, categories));
  const [errors, setErrors] = useState<ExpenseErrors>({});
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState<{ name: string; type: ExpenseType } | null>(null);
  const listId = useId();
  const cats = allCategories(categories);

  /** Met à jour et recalcule les taxes si elles ne sont pas saisies à la main. */
  function update(patch: Partial<ExpenseDraft>) {
    setD((x) => {
      const next = { ...x, ...patch };
      const amountChanged = "baseAmount" in patch || "extras" in patch || "noTax" in patch;
      if (amountChanged && !("tps" in patch) && !("tvq" in patch)) {
        const t = next.noTax ? { tps: "", tvq: "" } : autoTaxes(expenseSubtotal(next));
        return { ...next, ...t, taxesManual: false };
      }
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateExpense(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(expenseFields(d));
    } finally {
      setSaving(false);
    }
  }

  const subtotal = expenseSubtotal(d);
  const taxes = d.noTax ? 0 : (Number(d.tps) || 0) + (Number(d.tvq) || 0);

  return (
    <Modal
      open
      title={expense ? "Modifier la dépense" : "Nouvelle dépense"}
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="expense-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Description" required value={d.description} onChange={(e) => update({ description: e.target.value })} error={errors.description} autoFocus />
        <div>
          <TextField
            label="Fournisseur"
            value={d.supplier}
            onChange={(e) => update({ supplier: e.target.value })}
            list={listId}
            autoComplete="off"
            hint={
              d.supplier.trim() && !supplierNames.some((n) => n.toLowerCase() === d.supplier.trim().toLowerCase())
                ? "Nouveau fournisseur : il sera ajouté à la liste des fournisseurs."
                : "Choisis dans la liste ou tape un nouveau nom."
            }
          />
          <datalist id={listId}>
            {supplierNames.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>
        <div className={styles.row}>
          <div className={styles.inline}>
            <SelectField
              label="Catégorie"
              value={d.category}
              onChange={(e) => update({ category: e.target.value, type: categoryType(e.target.value, categories) })}
              options={[...cats, ...(cats.includes(d.category) ? [] : [d.category])].map((c) => ({ value: c, label: c }))}
            />
            <Button variant="secondary" onClick={() => setNewCat({ name: "", type: "variable" })} aria-label="Nouvelle catégorie" title="Nouvelle catégorie">
              <Plus size={16} />
            </Button>
          </div>
          <SelectField
            label="Type"
            value={d.type}
            onChange={(e) => update({ type: e.target.value as ExpenseType })}
            options={[
              { value: "variable", label: "Variable" },
              { value: "fixe", label: "Fixe" },
            ]}
          />
          <TextField label="Date" type="date" required value={d.date} onChange={(e) => update({ date: e.target.value })} error={errors.date} />
        </div>
        {newCat && (
          <div className={styles.box}>
            <div className={styles.boxHead}>Nouvelle catégorie</div>
            <div className={styles.row}>
              <TextField label="Nom" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} autoFocus />
              <SelectField
                label="Type"
                value={newCat.type}
                onChange={(e) => setNewCat({ ...newCat, type: e.target.value as ExpenseType })}
                options={[
                  { value: "variable", label: "Variable" },
                  { value: "fixe", label: "Fixe" },
                ]}
              />
            </div>
            <div style={{ display: "flex", gap: "var(--sp-2)", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setNewCat(null)}>
                Annuler
              </Button>
              <Button
                onClick={async () => {
                  if (await onAddCategory(newCat.name.trim(), newCat.type)) {
                    update({ category: newCat.name.trim(), type: newCat.type });
                    setNewCat(null);
                  }
                }}
                disabled={!newCat.name.trim()}
              >
                Créer la catégorie
              </Button>
            </div>
          </div>
        )}
        <TextField
          label="Montant avant taxes ($)"
          required
          type="number"
          step="0.01"
          value={d.baseAmount}
          onChange={(e) => update({ baseAmount: e.target.value })}
          error={errors.amount}
        />
        <div className={styles.box}>
          <div className={styles.boxHead}>
            Frais supplémentaires (livraison, dépôt…)
            <Button variant="ghost" onClick={() => update({ extras: [...d.extras, { key: newKey(), description: "", amount: "" }] })}>
              <Plus size={14} aria-hidden /> Ajouter
            </Button>
          </div>
          {d.extras.length === 0 ? (
            <span className={styles.hint}>Inclus dans le montant avant taxes de la dépense.</span>
          ) : (
            d.extras.map((x) => (
              <div key={x.key} className={styles.lineRow}>
                <input
                  value={x.description}
                  onChange={(e) => update({ extras: d.extras.map((y) => (y.key === x.key ? { ...y, description: e.target.value } : y)) })}
                  placeholder="Description"
                  aria-label="Description du frais"
                />
                <input
                  type="number"
                  step="0.01"
                  value={x.amount}
                  onChange={(e) => update({ extras: d.extras.map((y) => (y.key === x.key ? { ...y, amount: e.target.value } : y)) })}
                  placeholder="0,00"
                  aria-label="Montant du frais"
                />
                <button type="button" className={styles.iconBtn} onClick={() => update({ extras: d.extras.filter((y) => y.key !== x.key) })} aria-label="Retirer">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={d.noTax} onChange={(e) => update({ noTax: e.target.checked })} />
          Aucune taxe (achat non taxable)
        </label>
        {!d.noTax && (
          <div className={styles.row}>
            <TextField
              label="TPS ($)"
              type="number"
              step="0.01"
              value={d.tps}
              onChange={(e) => setD((x) => ({ ...x, tps: e.target.value, taxesManual: true }))}
              hint={d.taxesManual ? "Saisie manuelle" : "Calculée : 5 %"}
            />
            <TextField
              label="TVQ ($)"
              type="number"
              step="0.01"
              value={d.tvq}
              onChange={(e) => setD((x) => ({ ...x, tvq: e.target.value, taxesManual: true }))}
              hint={d.taxesManual ? "Saisie manuelle" : "Calculée : 9,975 %"}
            />
          </div>
        )}
        {subtotal > 0 && (
          <div className={styles.preview} aria-live="polite">
            {d.extras.length > 0 && <div>Sous-total avec frais : {fmtMoney(subtotal)}</div>}
            Total taxes incluses : <strong>{fmtMoney(subtotal + taxes)}</strong>
          </div>
        )}
        <TextArea label="Notes" value={d.notes} onChange={(e) => update({ notes: e.target.value })} rows={2} />
      </form>
    </Modal>
  );
}
