import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { clean, SHOP_CATEGORIES, SHOP_SUPPLIERS, toDraft, validate, type ShopDraft, type ShopItem } from "./liste.logic";

export function ItemModal({
  item,
  all,
  onClose,
  onSave,
}: {
  item: ShopItem | null;
  all: ShopItem[];
  onClose: () => void;
  onSave: (d: ShopDraft) => Promise<void>;
}) {
  const [d, setD] = useState<ShopDraft>(() => toDraft(item));
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ShopDraft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const err = validate(d, all, item?.id).name;
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await onSave(clean(d));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={item ? "Modifier l'ingrédient" : "Ajouter un ingrédient"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="shop-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="shop-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={d.name} onChange={set("name")} error={error} placeholder="ex. Filet de poulet, tomates italiennes…" autoFocus />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--sp-3)", alignItems: "start" }}>
          <SelectField label="Fournisseur" value={d.supplier} onChange={set("supplier")} options={SHOP_SUPPLIERS.map((s) => ({ value: s.key, label: s.label }))} />
          <SelectField label="Catégorie" value={d.category} onChange={set("category")} options={SHOP_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
        </div>
        <TextArea label="Notes" value={d.notes} onChange={set("notes")} placeholder="Format, marque, code produit, fréquence de commande…" />
      </form>
    </Modal>
  );
}
