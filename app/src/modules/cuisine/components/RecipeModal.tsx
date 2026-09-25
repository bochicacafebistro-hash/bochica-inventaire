import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { MarkdownEditor } from "@/ui/Markdown";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { RECIPE_CATS } from "../cuisine.logic";
import type { Recipe } from "../cuisine.types";

export type RecipeFields = Required<Omit<Recipe, "id">>;

export function RecipeModal({ recipe, onClose, onSave }: { recipe: Recipe | null; onClose: () => void; onSave: (f: RecipeFields) => Promise<void> }) {
  const [f, setF] = useState({
    name: recipe?.name ?? "",
    description: recipe?.description ?? "",
    category: recipe?.category ?? "main",
    servings: String(recipe?.servings ?? 1),
    prepTime: recipe?.prepTime ? String(recipe.prepTime) : "",
    cookTime: recipe?.cookTime ? String(recipe.cookTime) : "",
    ingredients: recipe?.ingredients ?? "",
    steps: recipe?.steps ?? "",
    tips: recipe?.tips ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return setError("Le nom est obligatoire.");
    setSaving(true);
    try {
      await onSave({
        name: f.name.trim(),
        description: f.description.trim(),
        category: f.category,
        servings: Math.max(1, Number(f.servings) || 1),
        prepTime: Math.max(0, Number(f.prepTime) || 0),
        cookTime: Math.max(0, Number(f.cookTime) || 0),
        ingredients: f.ingredients,
        steps: f.steps,
        tips: f.tips.trim(),
      });
    } finally {
      setSaving(false);
    }
  }

  const row = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "var(--sp-3)", alignItems: "start" } as const;

  return (
    <Modal
      open
      title={recipe ? "Modifier la recette" : "Nouvelle recette"}
      onClose={onClose}
      width={680}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="recipe-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="recipe-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={f.name} onChange={(e) => set("name")(e.target.value)} error={error} autoFocus />
        <TextArea label="Description" value={f.description} onChange={(e) => set("description")(e.target.value)} rows={2} />
        <div style={row}>
          <SelectField label="Catégorie" value={f.category} onChange={(e) => set("category")(e.target.value)} options={RECIPE_CATS.map((c) => ({ value: c.key, label: c.label }))} />
          <TextField label="Portions" type="number" min={1} value={f.servings} onChange={(e) => set("servings")(e.target.value)} />
          <TextField label="Préparation (min)" type="number" min={0} value={f.prepTime} onChange={(e) => set("prepTime")(e.target.value)} />
          <TextField label="Cuisson (min)" type="number" min={0} value={f.cookTime} onChange={(e) => set("cookTime")(e.target.value)} />
        </div>
        <MarkdownEditor label="Ingrédients" value={f.ingredients} onChange={set("ingredients")} rows={6} hint="Un ingrédient par ligne (ex. : 200 g de farine)" />
        <MarkdownEditor label="Étapes" value={f.steps} onChange={set("steps")} rows={8} hint="Une étape par ligne — elles seront numérotées" />
        <MarkdownEditor label="Astuces" value={f.tips} onChange={set("tips")} rows={3} />
      </form>
    </Modal>
  );
}
