import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { DEFAULT_EXPENSE_CATS, type ExpenseType } from "../finances.logic";
import type { Expense, ExpenseCategory } from "../finances.types";
import styles from "../Finances.module.css";

export function CategoriesModal({
  categories,
  expenses,
  onClose,
  onAdd,
  onDelete,
}: {
  categories: ExpenseCategory[];
  expenses: Expense[];
  onClose: () => void;
  onAdd: (name: string, type: ExpenseType) => Promise<boolean>;
  onDelete: (c: ExpenseCategory) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<ExpenseType>("variable");
  const used = (n?: string) => expenses.filter((e) => e.category === n).length;
  return (
    <Modal open title="Catégories de dépenses" onClose={onClose} width={560} footer={<Button onClick={onClose}>Terminé</Button>}>
      <div className={styles.hint}>Catégories par défaut (non modifiables)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {DEFAULT_EXPENSE_CATS.map((c) => (
          <span key={c.name} className={`${styles.pill} ${c.type === "fixe" ? styles.pillFixed : ""}`}>
            {c.name} · {c.type}
          </span>
        ))}
      </div>
      <div className={styles.hint}>Catégories personnalisées</div>
      <div className={styles.itemList}>
        {categories.length === 0 && <span className={styles.dim}>Aucune.</span>}
        {categories.map((c) => (
          <div key={c.id} className={styles.item}>
            <span>{c.name}</span>
            <span className={`${styles.pill} ${c.type === "fixe" ? styles.pillFixed : ""}`}>{c.type}</span>
            <span className={styles.dim}>{used(c.name)} dépense(s)</span>
            <button className={styles.iconBtn} onClick={() => onDelete(c)} aria-label={`Supprimer ${c.name}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <form
        className={styles.row}
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onAdd(name.trim(), type)) setName("");
        }}
      >
        <TextField label="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} />
        <SelectField
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value as ExpenseType)}
          options={[
            { value: "variable", label: "Variable" },
            { value: "fixe", label: "Fixe" },
          ]}
        />
        <div style={{ alignSelf: "end" }}>
          <Button type="submit" disabled={!name.trim()}>
            Ajouter
          </Button>
        </div>
      </form>
    </Modal>
  );
}
