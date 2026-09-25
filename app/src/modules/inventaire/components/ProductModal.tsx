import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { productFields, toProductDraft, unitsFor, validateProduct, type ProductErrors } from "../inventaire.logic";
import type { Product, ProductDraft, SupplierLite } from "../inventaire.types";

interface Props {
  product: Product | null;
  sections: string[];
  defaultSection: string;
  suppliers: SupplierLite[];
  onClose: () => void;
  onSave: (fields: ReturnType<typeof productFields>) => Promise<void>;
}

export function ProductModal({ product, sections, defaultSection, suppliers, onClose, onSave }: Props) {
  const [d, setD] = useState<ProductDraft>(() => toProductDraft(product, defaultSection));
  const [errors, setErrors] = useState<ProductErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ProductDraft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const box = d.orderUnit === "boîte";

  // Garde la catégorie actuelle visible même si elle n'existe plus dans la liste
  const sectionOptions = [...new Set([...sections, ...(d.section ? [d.section] : [])])];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateProduct(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(productFields(d));
    } finally {
      setSaving(false);
    }
  }

  const row = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "var(--sp-3)", alignItems: "start" } as const;

  return (
    <Modal
      open
      title={product ? "Modifier le produit" : "Nouveau produit"}
      onClose={onClose}
      width={540}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="product-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={d.name} onChange={set("name")} error={errors.name} autoFocus />
        <SelectField
          label="Catégorie"
          value={d.section}
          onChange={set("section")}
          error={errors.section}
          options={sectionOptions.map((s) => ({ value: s, label: s }))}
        />
        <div style={row}>
          <TextField label="Stock actuel" type="number" min={0} step="any" value={d.currentStock} onChange={set("currentStock")} error={errors.currentStock} />
          <TextField
            label="Minimum"
            type="number"
            min={0}
            step="any"
            value={d.minimum}
            onChange={set("minimum")}
            error={errors.minimum}
            hint="Sous ce seuil : « À commander »"
          />
        </div>
        <div style={row}>
          <SelectField
            label="Commander par"
            value={d.orderUnit}
            onChange={set("orderUnit")}
            options={[
              { value: "unité", label: "Unité" },
              { value: "boîte", label: "Boîte" },
            ]}
          />
          <TextField
            label={box ? "Boîtes à commander" : "Unités à commander"}
            type="number"
            min={0}
            step="any"
            value={d.orderQty}
            onChange={set("orderQty")}
            error={errors.orderQty}
          />
          {box && (
            <TextField
              label="Unités par boîte"
              type="number"
              min={1}
              step="any"
              value={d.unitsPerBox}
              onChange={set("unitsPerBox")}
              error={errors.unitsPerBox}
              hint={
                !errors.unitsPerBox && Number(d.orderQty) > 0
                  ? `= ${unitsFor({ id: "", orderUnit: "boîte", unitsPerBox: Number(d.unitsPerBox) }, Number(d.orderQty))} unités`
                  : undefined
              }
            />
          )}
        </div>
        <SelectField
          label="Fournisseur"
          value={d.supplierId}
          onChange={set("supplierId")}
          options={[
            { value: "", label: "— Aucun —" },
            ...suppliers
              .slice()
              .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "", "fr-CA"))
              .map((s) => ({ value: s.id, label: s.name || "(sans nom)" })),
            ...(d.supplierId && !suppliers.some((s) => s.id === d.supplierId)
              ? [{ value: d.supplierId, label: "Fournisseur supprimé" }]
              : []),
          ]}
        />
        <TextArea label="Note" value={d.note} onChange={set("note")} placeholder="Ex. : format 4 L, garder au frais…" />
      </form>
    </Modal>
  );
}
