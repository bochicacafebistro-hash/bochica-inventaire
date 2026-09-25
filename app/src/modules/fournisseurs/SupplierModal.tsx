import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { cleanDraft, toDraft, validateDraft, type DraftErrors } from "./fournisseurs.logic";
import type { Supplier, SupplierDraft } from "./fournisseurs.types";

interface Props {
  supplier: Supplier | null; // null = nouveau
  existing: Supplier[];
  onClose: () => void;
  onSave: (draft: SupplierDraft) => Promise<void>;
}

export function SupplierModal({ supplier, existing, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<SupplierDraft>(() => toDraft(supplier));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);

  const set = (k: keyof SupplierDraft) => (e: { target: { value: string } }) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateDraft(draft, existing, supplier?.id);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(cleanDraft(draft));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={supplier ? "Modifier le fournisseur" : "Nouveau fournisseur"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="supplier-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={draft.name} onChange={set("name")} error={errors.name} autoFocus />
        <TextField
          label="Téléphone"
          type="tel"
          value={draft.contact}
          onChange={set("contact")}
          placeholder="418 555-1234"
          autoComplete="off"
        />
        <TextField
          label="Courriel"
          type="email"
          value={draft.email}
          onChange={set("email")}
          error={errors.email}
          placeholder="commandes@exemple.ca"
          autoComplete="off"
        />
        <TextArea
          label="Notes"
          value={draft.notes}
          onChange={set("notes")}
          placeholder="Jours de livraison, représentant, conditions…"
        />
      </form>
    </Modal>
  );
}
