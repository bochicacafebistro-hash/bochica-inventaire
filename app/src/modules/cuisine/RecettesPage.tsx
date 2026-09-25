import { useMemo, useState } from "react";
import { BookOpen, Clock, Copy, List, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { filterRecipes, ingredientLineCount, RECIPE_CATS, recipeCatLabel, totalTime } from "./cuisine.logic";
import type { Recipe } from "./cuisine.types";
import { RecipeModal, type RecipeFields } from "./components/RecipeModal";
import { RecipeView } from "./components/RecipeView";
import styles from "./Cuisine.module.css";

const COL = "recipes";

export default function RecettesPage() {
  const { data, loading, error } = useCollection<Recipe>(COL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [cat, setCat] = useState("all");
  const [query, setQuery] = useState("");
  const [viewing, setViewing] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<{ recipe: Recipe | null } | null>(null);

  const shown = useMemo(() => filterRecipes(data, cat, query), [data, cat, query]);
  const cats = RECIPE_CATS.filter((c) => data.some((r) => r.category === c.key));
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function save(f: RecipeFields) {
    const target = editing?.recipe;
    try {
      if (target) {
        await actions.update(COL, target.id, { ...f });
        await actions.log(f.name, "Recette modifiée");
      } else {
        await actions.create(COL, { ...f });
        await actions.log(f.name, "Recette ajoutée");
      }
      toast(target ? "Recette enregistrée." : "Recette ajoutée.", "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(r: Recipe) {
    try {
      const { id: _id, ...rest } = r;
      const name = `${r.name ?? ""} (copie)`;
      const id = await actions.create(COL, { ...rest, name });
      await actions.log(name, "Dupliqué", `Depuis « ${r.name ?? ""} »`);
      setEditing({ recipe: { ...r, id, name } });
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function remove(r: Recipe) {
    if (!(await confirm({ title: "Supprimer la recette", danger: true, message: `Supprimer « ${r.name} » définitivement ?` }))) return;
    try {
      await actions.remove(COL, r.id);
      await actions.log(r.name ?? "—", "Recette supprimée");
      toast("Recette supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Cuisine · livre de recettes"
        title="Recettes"
        actions={
          <Button onClick={() => setEditing({ recipe: null })}>
            <Plus size={16} aria-hidden /> Ajouter une recette
          </Button>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : data.length === 0 ? (
        <EmptyState icon={BookOpen} title="Aucune recette">
          <p>Écris tes recettes pour que toute l'équipe prépare les plats de la même façon.</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label="Catégories">
            <button className={styles.chip} aria-pressed={cat === "all"} onClick={() => setCat("all")}>
              Toutes <span className={styles.chipCount}>{data.length}</span>
            </button>
            {cats.map((c) => (
              <button key={c.key} className={styles.chip} aria-pressed={cat === c.key} onClick={() => setCat(c.key)}>
                {c.label} <span className={styles.chipCount}>{data.filter((r) => r.category === c.key).length}</span>
              </button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Nom ou ingrédient…" />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={BookOpen} title="Aucun résultat" />
          ) : (
            <div className={styles.grid}>
              {shown.map((r) => {
                const t = totalTime(r);
                const n = ingredientLineCount(r);
                return (
                  <article key={r.id} className={styles.card}>
                    <div className={styles.cardHead}>
                      <button
                        onClick={() => setViewing(r)}
                        style={{ all: "unset", cursor: "pointer", flex: 1 }}
                        aria-label={`Ouvrir la recette ${r.name}`}
                      >
                        <h2 className={styles.cardTitle}>{r.name}</h2>
                        {r.category && <div className={styles.sub}>{recipeCatLabel(r.category)}</div>}
                      </button>
                      <ActionMenu
                        label={`Actions pour ${r.name}`}
                        items={[
                          { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ recipe: r }) },
                          { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(r) },
                          { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(r) },
                        ]}
                      />
                    </div>
                    {r.description && <div className={styles.desc}>{r.description}</div>}
                    <div className={styles.meta}>
                      {t > 0 && (
                        <span className={styles.metaItem}>
                          <Clock size={13} aria-hidden /> {t} min
                        </span>
                      )}
                      {!!r.servings && (
                        <span className={styles.metaItem}>
                          <Users size={13} aria-hidden /> {r.servings} portion{r.servings > 1 ? "s" : ""}
                        </span>
                      )}
                      {n > 0 && (
                        <span className={styles.metaItem}>
                          <List size={13} aria-hidden /> {n} ingrédient{n > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Button variant="secondary" onClick={() => setViewing(r)}>
                      <BookOpen size={16} aria-hidden /> Ouvrir
                    </Button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {viewing && (
        <RecipeView
          recipe={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing({ recipe: viewing });
            setViewing(null);
          }}
        />
      )}
      {editing && <RecipeModal recipe={editing.recipe} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
