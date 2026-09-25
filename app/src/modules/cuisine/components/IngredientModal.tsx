import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { INGREDIENT_CATS } from "../cuisine.logic";
import type { Ingredient } from "../cuisine.types";

export interface IngredientFields {
  name: string;
  unit: string;
  costPerUnit: number;
  category: string;
  notes: string;
}

export function IngredientModal({
  ingredient,
  usedIn,
  onClose,
  onSave,
}: {
  ingredient: Ingredient | null;
  usedIn: number;
  onClose: () => void;
  onSave: (f: IngredientFields) => Promise<void>;
}) {
  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState(ingredient?.unit ?? "unité");
  const [cost, setCost] = useState(ingredient?.costPerUnit != null ? String(ingredient.costPerUnit) : "");
  const [category, setCategory] = useState(ingredient?.category ?? "other");
  const [notes, setNotes] = useState(ingredient?.notes ?? "");
  const [errors, setErrors] = useState<{ name?: string; cost?: string }>({});
  const [saving, setSaving] = useState(false);
  const costChanged = ingredient && Number(cost) !== (ingredient.costPerUnit ?? 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = {
      name: name.trim() ? undefined : "Le nom est obligatoire.",
      cost: cost.trim() === "" || Number(cost) >= 0 ? undefined : "Coût invalide.",
    };
    setErrors(errs);
    if (errs.name || errs.cost) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), unit: unit.trim() || "unité", costPerUnit: Number(cost) || 0, category, notes: notes.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={ingredient ? "Modifier l'ingrédient" : "Nouvel ingrédient"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="ing-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="ing-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "var(--sp-3)", alignItems: "start" }}>
          <TextField label="Unité" value={unit} onChange={(e) => setUnit(e.target.value)} hint="Ex. : unité, g, ml, portion, tranche" />
          <TextField
            label={`Coût par ${unit || "unité"} ($)`}
            type="number"
            min={0}
            step="any"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            error={errors.cost}
            hint={costChanged && usedIn > 0 ? `Mettra à jour le coût de ${usedIn} plat${usedIn > 1 ? "s" : ""} du menu` : undefined}
          />
        </div>
        <SelectField label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} options={INGREDIENT_CATS.map((c) => ({ value: c.key, label: c.label }))} />
        <TextArea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </form>
    </Modal>
  );
}
