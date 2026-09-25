import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { ACCENTS, accentHex } from "../soumissions.logic";
import type { QuoteTemplate } from "../soumissions.types";
import styles from "../Soumissions.module.css";

export type TemplateFields = Required<Omit<QuoteTemplate, "id" | "sortOrder">>;

export function TemplatesModal({
  templates,
  onClose,
  onSave,
  onAdd,
  onDelete,
}: {
  templates: QuoteTemplate[];
  onClose: () => void;
  onSave: (id: string, f: TemplateFields) => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (t: QuoteTemplate) => Promise<void>;
}) {
  const sorted = [...templates].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  return (
    <Modal
      open
      title="Gérer les forfaits"
      onClose={onClose}
      width={720}
      footer={<Button onClick={onClose}>Terminé</Button>}
    >
      <p style={{ color: "var(--text2)", fontSize: "var(--fs-sm)" }}>
        Les soumissions existantes gardent une copie figée du forfait : modifier un prix ici ne change pas les soumissions déjà faites.
      </p>
      <div className={styles.tplList}>
        {sorted.map((t) => (
          <TemplateEditor key={t.id} tpl={t} onSave={(f) => onSave(t.id, f)} onDelete={() => onDelete(t)} />
        ))}
      </div>
      <div>
        <Button variant="secondary" onClick={() => void onAdd()}>
          <Plus size={14} aria-hidden /> Ajouter un forfait
        </Button>
      </div>
    </Modal>
  );
}

function TemplateEditor({ tpl, onSave, onDelete }: { tpl: QuoteTemplate; onSave: (f: TemplateFields) => Promise<void>; onDelete: () => void }) {
  const [f, setF] = useState({
    label: tpl.label ?? "",
    name: tpl.name ?? "",
    pricePerPerson: String(tpl.pricePerPerson ?? 0),
    accentColor: String(tpl.accentColor ?? "yellow"),
    entree: tpl.entree ?? "",
    plat: tpl.plat ?? "",
    boisson: tpl.boisson ?? "",
    beerPrice: String(tpl.beerPrice ?? 0),
    dessertPrice: String(tpl.dessertPrice ?? 0),
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => {
    setDirty(true);
    setF((x) => ({ ...x, [k]: e.target.value }));
  };
  const n = (s: string) => Math.max(0, Number(s) || 0);

  async function save() {
    setSaving(true);
    try {
      await onSave({
        label: f.label.trim(),
        name: f.name.trim(),
        pricePerPerson: n(f.pricePerPerson),
        accentColor: f.accentColor,
        entree: f.entree.trim(),
        plat: f.plat.trim(),
        boisson: f.boisson.trim(),
        beerPrice: n(f.beerPrice),
        dessertPrice: n(f.dessertPrice),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.tpl} style={{ ["--c" as string]: accentHex(f.accentColor) }} aria-label={`Forfait ${f.name}`}>
      <div className={styles.row}>
        <TextField label="Étiquette" value={f.label} onChange={set("label")} placeholder="Forfait Un" />
        <TextField label="Nom" value={f.name} onChange={set("name")} placeholder="L'Essentiel" />
        <TextField label="Prix / personne ($)" type="number" min={0} step="0.01" value={f.pricePerPerson} onChange={set("pricePerPerson")} />
        <SelectField label="Couleur" value={f.accentColor} onChange={set("accentColor")} options={ACCENTS.map((a) => ({ value: a.key, label: a.label }))} />
      </div>
      <TextField label="Entrée" value={f.entree} onChange={set("entree")} />
      <TextField label="Plat principal" value={f.plat} onChange={set("plat")} />
      <TextField label="Boisson" value={f.boisson} onChange={set("boisson")} />
      <div className={styles.row}>
        <TextField label="Prix bière de remplacement ($)" type="number" min={0} step="0.01" value={f.beerPrice} onChange={set("beerPrice")} hint="Modifiable dans chaque soumission" />
        <TextField label="Prix café/thé + dessert ($)" type="number" min={0} step="0.01" value={f.dessertPrice} onChange={set("dessertPrice")} hint="Modifiable dans chaque soumission" />
      </div>
      <div className={styles.tplActions}>
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 size={14} aria-hidden /> Supprimer
        </Button>
        <Button onClick={() => void save()} disabled={saving || !dirty}>
          {saving ? "Enregistrement…" : dirty ? "Enregistrer ce forfait" : "Enregistré"}
        </Button>
      </div>
    </section>
  );
}
