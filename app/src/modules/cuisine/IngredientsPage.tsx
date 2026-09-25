import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtUnitCost } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { groupIngredients, menuItemsUsing } from "./cuisine.logic";
import type { Ingredient, MenuItem } from "./cuisine.types";
import { IngredientModal, type IngredientFields } from "./components/IngredientModal";
import styles from "./Cuisine.module.css";

const COL = "ingredients";

export default function IngredientsPage() {
  const ingQ = useCollection<Ingredient>(COL);
  const menuQ = useCollection<MenuItem>("menu");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ ing: Ingredient | null } | null>(null);

  const groups = useMemo(() => groupIngredients(ingQ.data, query), [ingQ.data, query]);
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of ingQ.data) m.set(i.id, menuItemsUsing(i.id, menuQ.data).length);
    return m;
  }, [ingQ.data, menuQ.data]);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function save(f: IngredientFields) {
    const target = editing?.ing;
    try {
      if (target) {
        await actions.update(COL, target.id, { ...f });
        await actions.log(f.name, "Ingrédient modifié", target.costPerUnit !== f.costPerUnit ? `Coût ${target.costPerUnit ?? 0} → ${f.costPerUnit} $/${f.unit}` : undefined);
      } else {
        await actions.create(COL, { ...f });
        await actions.log(f.name, "Ingrédient ajouté");
      }
      toast(target ? "Ingrédient enregistré." : "Ingrédient ajouté.", "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(i: Ingredient) {
    try {
      const { id: _id, ...rest } = i;
      const name = `${i.name ?? ""} (copie)`;
      const id = await actions.create(COL, { ...rest, name });
      await actions.log(name, "Dupliqué", `Depuis « ${i.name ?? ""} »`);
      setEditing({ ing: { ...i, id, name } });
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function remove(i: Ingredient) {
    const used = menuItemsUsing(i.id, menuQ.data);
    const ok = await confirm({
      title: "Supprimer l'ingrédient",
      danger: true,
      message: (
        <>
          <p>
            Supprimer <strong>{i.name}</strong> ?
          </p>
          {used.length > 0 && (
            <p style={{ marginTop: "var(--sp-2)" }}>
              Il est utilisé dans {used.length} plat{used.length > 1 ? "s" : ""} ({used.slice(0, 3).map((m) => m.name).join(", ")}
              {used.length > 3 ? "…" : ""}) : leur coût de revient baissera.
            </p>
          )}
        </>
      ),
    });
    if (!ok) return;
    try {
      await actions.remove(COL, i.id);
      await actions.log(i.name ?? "—", "Ingrédient supprimé");
      toast("Ingrédient supprimé.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  const loading = ingQ.loading || menuQ.loading;
  const error = ingQ.error ?? menuQ.error;

  return (
    <>
      <PageHeader
        eyebrow="Cuisine · coût de revient"
        title="Ingrédients"
        actions={
          <Button onClick={() => setEditing({ ing: null })}>
            <Plus size={16} aria-hidden /> Ajouter un ingrédient
          </Button>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : ingQ.data.length === 0 ? (
        <EmptyState icon={Tag} title="Aucun ingrédient">
          <p>Ajoute tes ingrédients avec leur coût pour calculer la marge de chaque plat du menu.</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un ingrédient…" />
            <span className={styles.spacer} />
            <span className={styles.muted}>{ingQ.data.length} ingrédients</span>
          </div>
          {groups.length === 0 ? (
            <EmptyState icon={Tag} title="Aucun résultat" />
          ) : (
            groups.map((g) => (
              <section key={g.key} aria-label={g.title}>
                <h2 className={styles.groupTitle}>
                  {g.title} <span className={styles.count}>{g.items.length}</span>
                </h2>
                <div className={styles.list}>
                  {g.items.map((i) => {
                    const n = usage.get(i.id) ?? 0;
                    return (
                      <div key={i.id} className={styles.ingRow}>
                        <div className={styles.name}>{i.name}</div>
                        <div className={styles.unit}>{i.unit || "unité"}</div>
                        <div className={styles.price}>
                          {fmtUnitCost(i.costPerUnit ?? 0)}
                          <span className={styles.sub}> /{i.unit || "unité"}</span>
                        </div>
                        {i.notes ? <div className={styles.notes}>{i.notes}</div> : <div className={styles.notesEmpty} />}
                        <div className={styles.used}>{n > 0 ? `Dans ${n} plat${n > 1 ? "s" : ""}` : "Aucun plat"}</div>
                        <ActionMenu
                          label={`Actions pour ${i.name}`}
                          items={[
                            { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ ing: i }) },
                            { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(i) },
                            { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(i) },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </>
      )}
      {editing && (
        <IngredientModal
          ingredient={editing.ing}
          usedIn={editing.ing ? (usage.get(editing.ing.id) ?? 0) : 0}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
