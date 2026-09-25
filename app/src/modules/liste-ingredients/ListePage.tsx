import { useMemo, useState } from "react";
import { Copy, Pencil, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Segmented } from "@/ui/Segmented";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import {
  categoryLabel,
  countBySupplier,
  filterItems,
  groupBySupplier,
  SHOP_SUPPLIERS,
  supplierLabel,
  type ShopDraft,
  type ShopItem,
  type SortMode,
} from "./liste.logic";
import { ItemModal } from "./ItemModal";
import styles from "./Liste.module.css";

const COL = "shoppingList";

export default function ListePage() {
  const { data, loading, error } = useCollection<ShopItem>(COL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [supplier, setSupplier] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("supplier");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: ShopItem | null } | null>(null);

  const counts = useMemo(() => countBySupplier(data), [data]);
  const items = useMemo(() => filterItems(data, supplier, query, sort), [data, supplier, query, sort]);
  const grouped = sort === "supplier" && supplier === "all";

  async function save(d: ShopDraft) {
    const target = editing?.item;
    try {
      if (target) {
        await actions.update(COL, target.id, { ...d });
        await actions.log(d.name, "Liste ingrédients — modifié", `Fournisseur : ${supplierLabel(d.supplier)}`);
      } else {
        await actions.create(COL, { ...d });
        await actions.log(
          d.name,
          "Liste ingrédients — ajouté",
          `Fournisseur : ${supplierLabel(d.supplier)} · Catégorie : ${categoryLabel(d.category)}`,
        );
      }
      toast(target ? "Ingrédient modifié." : "Ingrédient ajouté.", "success");
      setEditing(null);
    } catch (err) {
      toast(`Enregistrement impossible : ${(err as Error).message}`, "error");
    }
  }

  async function duplicate(i: ShopItem) {
    try {
      const name = `${i.name ?? ""} (copie)`;
      const id = await actions.create(COL, { name, supplier: i.supplier ?? "costco", category: i.category ?? "autre", notes: i.notes ?? "" });
      await actions.log(name, "Dupliqué", `Depuis « ${i.name ?? ""} »`);
      setEditing({ item: { ...i, id, name } });
    } catch (err) {
      toast(`Duplication impossible : ${(err as Error).message}`, "error");
    }
  }

  async function remove(i: ShopItem) {
    if (!(await confirm({ title: "Supprimer l'ingrédient", danger: true, message: `Supprimer « ${i.name} » de la liste ?` }))) return;
    try {
      await actions.remove(COL, i.id);
      await actions.log(i.name ?? "—", "Liste ingrédients — supprimé");
      toast("Ingrédient supprimé.", "success");
    } catch (err) {
      toast(`Suppression impossible : ${(err as Error).message}`, "error");
    }
  }

  const renderRows = (list: ShopItem[], showSupplier: boolean) => (
    <div className={styles.list}>
      {list.map((i) => (
        <div key={i.id} className={`${styles.row} ${showSupplier ? "" : styles.noSupplierCol}`}>
          <div className={styles.name}>{i.name}</div>
          {showSupplier && <span className={styles.pill}>{supplierLabel(i.supplier)}</span>}
          <span className={styles.pill}>{categoryLabel(i.category)}</span>
          <div className={styles.notes}>{i.notes}</div>
          <ActionMenu
            label={`Actions pour ${i.name}`}
            items={[
              { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ item: i }) },
              { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(i) },
              { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(i) },
            ]}
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Inventaire · liste de courses"
        title="Liste d'ingrédients"
        actions={
          <Button onClick={() => setEditing({ item: null })}>
            <Plus size={16} aria-hidden /> Ajouter
          </Button>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : data.length === 0 ? (
        <EmptyState icon={ShoppingBasket} title="Liste vide">
          <p>Ajoute les ingrédients que tu commandes chez chaque fournisseur.</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Segmented
              label="Fournisseur"
              value={supplier}
              onChange={setSupplier}
              options={[
                { value: "all", label: `Tous (${counts.all})` },
                ...SHOP_SUPPLIERS.map((s) => ({ value: s.key, label: `${s.label} (${counts[s.key] ?? 0})` })),
              ]}
            />
          </div>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Nom ou notes…" />
            <span className={styles.spacer} />
            <Segmented
              label="Trier"
              value={sort}
              onChange={setSort}
              options={[
                { value: "supplier", label: "Par fournisseur" },
                { value: "name", label: "A → Z" },
              ]}
            />
          </div>

          {items.length === 0 ? (
            <EmptyState icon={ShoppingBasket} title="Aucun résultat">
              <p>Essaie une autre recherche ou un autre fournisseur.</p>
            </EmptyState>
          ) : grouped ? (
            groupBySupplier(items).map((g) => (
              <section key={g.key} aria-label={g.title}>
                <h2 className={styles.groupTitle}>
                  {g.title} <span className={styles.count}>{g.items.length}</span>
                </h2>
                {renderRows(g.items, false)}
              </section>
            ))
          ) : (
            renderRows(items, supplier === "all")
          )}
        </>
      )}

      {editing && <ItemModal item={editing.item} all={data} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
