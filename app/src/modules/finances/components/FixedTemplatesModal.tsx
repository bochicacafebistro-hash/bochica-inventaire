import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { autoTaxes } from "../finances.logic";
import type { FixedTemplate } from "../finances.types";
import styles from "../Finances.module.css";

export function FixedTemplatesModal({
  templates,
  categories,
  supplierNames,
  onClose,
  onAdd,
  onDelete,
}: {
  templates: FixedTemplate[];
  categories: string[];
  supplierNames: string[];
  onClose: () => void;
  onAdd: (t: Omit<FixedTemplate, "id">) => Promise<void>;
  onDelete: (t: FixedTemplate) => void;
}) {
  const [f, setF] = useState({ supplier: "", category: categories[0] ?? "", amount: "", tps: "", tvq: "" });
  const monthly = templates.reduce((s, t) => s + (t.amount ?? 0) + (t.tps ?? 0) + (t.tvq ?? 0), 0);
  return (
    <Modal open title="Frais fixes mensuels" onClose={onClose} width={600} footer={<Button onClick={onClose}>Terminé</Button>}>
      <p className={styles.hint}>
        Ces dépenses sont recopiées chaque mois, datées du 1er. Total mensuel : <strong>{fmtMoney(monthly)}</strong> taxes incluses.
      </p>
      <div className={styles.itemList}>
        {templates.length === 0 && <span className={styles.dim}>Aucun frais fixe.</span>}
        {templates.map((t) => (
          <div key={t.id} className={styles.item}>
            <span>
              <strong>{t.supplier || t.description || "—"}</strong> <span className={styles.dim}>· {t.category}</span>
            </span>
            <span className={styles.num}>{fmtMoney(t.amount ?? 0)}</span>
            <button className={styles.iconBtn} onClick={() => onDelete(t)} aria-label={`Supprimer ${t.supplier || t.description}`}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.box}>
        <div className={styles.boxHead}>Ajouter un frais fixe</div>
        <div className={styles.row}>
          <SelectField
            label="Fournisseur"
            value={f.supplier}
            onChange={(e) => setF({ ...f, supplier: e.target.value })}
            options={[{ value: "", label: "— Aucun —" }, ...supplierNames.map((n) => ({ value: n, label: n }))]}
          />
          <SelectField label="Catégorie" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={categories.map((c) => ({ value: c, label: c }))} />
        </div>
        <div className={styles.row}>
          <TextField
            label="Montant avant taxes ($)"
            type="number"
            step="0.01"
            value={f.amount}
            onChange={(e) => setF({ ...f, amount: e.target.value, ...autoTaxes(Number(e.target.value) || 0) })}
          />
          <TextField label="TPS ($)" type="number" step="0.01" value={f.tps} onChange={(e) => setF({ ...f, tps: e.target.value })} />
          <TextField label="TVQ ($)" type="number" step="0.01" value={f.tvq} onChange={(e) => setF({ ...f, tvq: e.target.value })} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            disabled={!(Number(f.amount) > 0)}
            onClick={async () => {
              await onAdd({ supplier: f.supplier, category: f.category, amount: Number(f.amount) || 0, tps: Number(f.tps) || 0, tvq: Number(f.tvq) || 0 });
              setF({ ...f, supplier: "", amount: "", tps: "", tvq: "" });
            }}
          >
            Ajouter ce frais fixe
          </Button>
        </div>
      </div>
    </Modal>
  );
}
