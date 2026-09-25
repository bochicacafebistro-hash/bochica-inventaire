import { useMemo, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney, fmtUnitCost } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { frCollator } from "@/core/text";
import { cleanRecipe, foodCost, MENU_CATS, suggestedPrice } from "../cuisine.logic";
import type { Ingredient, MenuItem, RecipeLine } from "../cuisine.types";
import styles from "../Cuisine.module.css";

export interface MenuFields {
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  recipe: RecipeLine[];
}

type Row = { key: number; ingredientId: string; qty: string };
let rowKey = 0;

export function MenuItemModal({
  item,
  ingredients,
  onClose,
  onSave,
}: {
  item: MenuItem | null;
  ingredients: Ingredient[];
  onClose: () => void;
  onSave: (f: MenuFields) => Promise<void>;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [price, setPrice] = useState(item?.price ? String(item.price) : "");
  const [category, setCategory] = useState(item?.category ?? "Plats principaux");
  const [available, setAvailable] = useState(item?.available !== false);
  const [rows, setRows] = useState<Row[]>(() => (item?.recipe ?? []).map((r) => ({ key: ++rowKey, ingredientId: r.ingredientId, qty: String(r.qty) })));
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);
  const sortedIngs = useMemo(() => [...ingredients].sort((a, b) => frCollator.compare(a.name ?? "", b.name ?? "")), [ingredients]);
  const recipe = cleanRecipe(rows);
  const cost = foodCost(recipe, byId);
  const p = Number(price) || 0;
  const margin = p - cost;
  const marginPct = p > 0 ? (margin / p) * 100 : 0;
  const suggestion = suggestedPrice(cost);

  const setRow = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(name.trim() ? null : "Le nom est obligatoire.");
    setPriceError(price.trim() && !(Number(price) >= 0) ? "Prix invalide." : null);
    if (!name.trim() || (price.trim() && !(Number(price) >= 0))) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), price: p, category, available, recipe });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={item ? "Modifier le plat" : "Nouveau plat"}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="menu-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="menu-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={name} onChange={(e) => setName(e.target.value)} error={error} autoFocus />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--sp-3)", alignItems: "start" }}>
          <TextField label="Prix de vente ($)" type="number" min={0} step="0.25" value={price} onChange={(e) => setPrice(e.target.value)} error={priceError} />
          <SelectField label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} options={MENU_CATS.map((c) => ({ value: c, label: c }))} />
        </div>
        <label style={{ display: "flex", gap: "var(--sp-2)", alignItems: "center", fontSize: "var(--fs-sm)", fontWeight: 600 }}>
          <input type="checkbox" checked={available} onChange={(e) => setAvailable(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
          Disponible au menu
        </label>

        <div className={styles.compo}>
          <div className={styles.compoHead}>
            <strong>Composition</strong>
            <Button
              variant="secondary"
              onClick={() => setRows((rs) => [...rs, { key: ++rowKey, ingredientId: "", qty: "1" }])}
              disabled={ingredients.length === 0}
            >
              <Plus size={14} aria-hidden /> Ingrédient
            </Button>
          </div>
          {ingredients.length === 0 ? (
            <div className={styles.muted}>Ajoute d'abord des ingrédients (page Ingrédients) pour calculer le coût de revient.</div>
          ) : rows.length === 0 ? (
            <div className={styles.muted}>Aucun ingrédient. Ajoute-les pour calculer le coût de revient.</div>
          ) : (
            rows.map((r) => {
              const ing = byId.get(r.ingredientId);
              return (
                <div key={r.key} className={styles.compoRow}>
                  <select value={r.ingredientId} onChange={(e) => setRow(r.key, { ingredientId: e.target.value })} aria-label="Ingrédient">
                    <option value="">Choisir…</option>
                    {r.ingredientId && !ing && <option value={r.ingredientId}>(ingrédient supprimé)</option>}
                    {sortedIngs.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({fmtUnitCost(i.costPerUnit ?? 0)}/{i.unit || "unité"})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={r.qty}
                    onChange={(e) => setRow(r.key, { qty: e.target.value })}
                    aria-label={`Quantité${ing ? ` (${ing.unit})` : ""}`}
                    placeholder={ing?.unit ?? "Qté"}
                  />
                  <span className={styles.compoCost}>{fmtMoney((ing?.costPerUnit ?? 0) * (Number(r.qty) || 0))}</span>
                  <button type="button" className={styles.iconBtn} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label="Retirer">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
          {recipe.length > 0 && (
            <div className={styles.totals} aria-live="polite">
              <div className={styles.totalLine}>
                <span>Coût de revient</span>
                <strong>{fmtMoney(cost)}</strong>
              </div>
              {p > 0 && (
                <>
                  <div className={styles.totalLine}>
                    <span>Coût matière</span>
                    <strong>{((cost / p) * 100).toFixed(1).replace(".", ",")} % du prix</strong>
                  </div>
                  <div className={styles.totalLine}>
                    <span>Marge</span>
                    <strong style={{ color: marginPct >= 70 ? "var(--status-green)" : marginPct >= 50 ? undefined : "var(--status-red)" }}>
                      {fmtMoney(margin)} ({marginPct.toFixed(1).replace(".", ",")} %)
                    </strong>
                  </div>
                </>
              )}
              {suggestion > 0 && Math.abs(suggestion - p) >= 0.25 && (
                <div className={styles.totalLine}>
                  <span>Prix suggéré (coût matière 30 %)</span>
                  <button type="button" className={styles.linkBtn} onClick={() => setPrice(String(suggestion))}>
                    Utiliser {fmtMoney(suggestion)}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
