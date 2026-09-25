import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, Package, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import {
  ALL,
  countProducts,
  filterProducts,
  isBox,
  minimumOf,
  nextSortOrder,
  orderLabel,
  statusOf,
  stockOf,
  unitsFor,
  type productFields,
} from "./inventaire.logic";
import type { Product } from "./inventaire.types";
import { useInventoryData } from "./useInventoryData";
import { CategoriesModal } from "./components/CategoriesModal";
import { ProductModal } from "./components/ProductModal";
import { StatusBadge } from "./components/StatusBadge";
import { StockInput } from "./components/StockInput";
import styles from "./Inventaire.module.css";

const COL = "products";
type Editing = { product: Product | null } | null;

export default function InventairePage() {
  const user = useSessionUser();
  const canManage = user.role === "global_admin" || user.role === "chef";
  const { products, suppliers, sections, sectionsSettings, loading, error } = useInventoryData();
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();

  const [section, setSection] = useState(ALL);
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [managingCats, setManagingCats] = useState(false);

  const counts = useMemo(() => countProducts(products), [products]);
  const shown = useMemo(
    () => filterProducts(products, { section, query, archived: showArchived }),
    [products, section, query, showArchived],
  );
  const supplierName = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name || "(sans nom)"])), [suppliers]);

  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function updateStock(p: Product, qty: number) {
    const old = stockOf(p);
    try {
      await actions.update(COL, p.id, { currentStock: qty });
      await actions.log(p.name ?? "—", "Mise à jour stock", `${old} → ${qty} unités`);
      toast(`${p.name} : ${old} → ${qty}`, "success");
    } catch (err) {
      fail("Mise à jour")(err);
    }
  }

  async function saveProduct(fields: ReturnType<typeof productFields>) {
    const target = editing?.product;
    try {
      if (target) {
        await actions.update(COL, target.id, fields);
        await actions.log(fields.name, "Modifié");
      } else {
        await actions.create(COL, { ...fields, sortOrder: nextSortOrder(products), archived: false });
        await actions.log(fields.name, "Ajouté");
      }
      toast(target ? "Produit enregistré." : "Produit ajouté.", "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(p: Product) {
    try {
      const { id: _id, ...rest } = p;
      const name = `${p.name ?? ""} (copie)`;
      const id = await actions.create(COL, { ...rest, name, currentStock: 0, archived: false, sortOrder: nextSortOrder(products) });
      await actions.log(name, "Dupliqué", `Depuis « ${p.name ?? ""} »`);
      setEditing({ product: { ...p, id, name, currentStock: 0 } });
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function toggleArchive(p: Product) {
    const restoring = !!p.archived;
    const ok = await confirm({
      title: restoring ? "Restaurer le produit" : "Archiver le produit",
      message: restoring
        ? `Remettre « ${p.name} » dans l'inventaire actif ?`
        : `Archiver « ${p.name} » ? Il disparaît de l'inventaire et d'À commander, mais reste récupérable.`,
      confirmLabel: restoring ? "Restaurer" : "Archiver",
    });
    if (!ok) return;
    try {
      await actions.update(COL, p.id, { archived: !restoring });
      await actions.log(p.name ?? "—", restoring ? "Restauré" : "Archivé");
      toast(restoring ? "Produit restauré." : "Produit archivé.", "success");
    } catch (err) {
      fail(restoring ? "Restauration" : "Archivage")(err);
    }
  }

  async function remove(p: Product) {
    const ok = await confirm({
      title: "Supprimer le produit",
      danger: true,
      message: (
        <>
          Supprimer <strong>{p.name}</strong> définitivement ? Pour le garder de côté, utilise plutôt « Archiver ».
        </>
      ),
    });
    if (!ok) return;
    try {
      await actions.remove(COL, p.id);
      await actions.log(p.name ?? "—", "Supprimé");
      toast("Produit supprimé.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  // ── Catégories ──
  async function saveSectionList(list: string[]) {
    await actions.setFixed("settings", "sections", { all: list, custom: sectionsSettings?.custom ?? [] });
  }
  async function renameSection(index: number, newName: string) {
    const oldName = sections[index]!;
    const affected = products.filter((p) => p.section === oldName);
    try {
      await actions.updateMany(COL, affected.map((p) => ({ id: p.id, data: { section: newName } })));
      await saveSectionList(sections.map((s, i) => (i === index ? newName : s)));
      await actions.log("—", "Catégorie renommée", `${oldName} → ${newName} (${affected.length} produit(s))`);
      if (section === oldName) setSection(newName);
    } catch (err) {
      fail("Renommage")(err);
    }
  }
  async function deleteSection(name: string, fallback: string) {
    const affected = products.filter((p) => p.section === name);
    const ok = await confirm({
      title: "Supprimer la catégorie",
      danger: true,
      message:
        affected.length > 0 ? (
          <>
            Supprimer « {name} » ? <strong>{affected.length} produit(s)</strong> seront déplacés vers « {fallback} ».
          </>
        ) : (
          `Supprimer « ${name} » ?`
        ),
    });
    if (!ok) return;
    try {
      await actions.updateMany(COL, affected.map((p) => ({ id: p.id, data: { section: fallback } })));
      const list = sections.filter((s) => s !== name);
      await saveSectionList(list.includes(fallback) ? list : [...list, fallback]);
      await actions.log("—", "Catégorie supprimée", `${name} (${affected.length} produit(s) → ${fallback})`);
      if (section === name) setSection(ALL);
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  if (loading) return <Spinner label="Chargement de l'inventaire…" />;
  if (error) return <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>;

  const tabs = [ALL, ...sections];

  return (
    <>
      <PageHeader
        eyebrow="Inventaire"
        title="Inventaire"
        actions={
          canManage && !showArchived ? (
            <Button onClick={() => setEditing({ product: null })}>
              <Plus size={16} aria-hidden /> Ajouter un produit
            </Button>
          ) : undefined
        }
      />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{counts.total}</div>
          <div className={styles.statLabel}>Produits</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{counts.red}</div>
          <div className={styles.statLabel}>
            <span className={`${styles.dot} ${styles.dot_red}`} aria-hidden /> À commander
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{counts.yellow}</div>
          <div className={styles.statLabel}>
            <span className={`${styles.dot} ${styles.dot_yellow}`} aria-hidden /> Bientôt bas
          </div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{counts.green}</div>
          <div className={styles.statLabel}>
            <span className={`${styles.dot} ${styles.dot_green}`} aria-hidden /> En stock
          </div>
        </div>
      </div>

      {showArchived ? (
        <div className={styles.archivedNote}>
          <Archive size={16} aria-hidden /> Produits archivés ({counts.archived})
          <span className={styles.spacer} />
          <Button variant="secondary" onClick={() => setShowArchived(false)}>
            Retour à l'inventaire
          </Button>
        </div>
      ) : (
        <div className={styles.tabsRow}>
          <div className={styles.tabs} role="tablist" aria-label="Catégories">
            {tabs.map((s) => {
              const low = s === ALL ? counts.red + counts.yellow : (counts.lowBySection.get(s) ?? 0);
              return (
                <button key={s} role="tab" aria-selected={section === s} className={styles.tab} onClick={() => setSection(s)}>
                  {s}
                  {low > 0 && (
                    <span className={styles.tabCount} aria-label={`${low} à surveiller`}>
                      {low}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {canManage && (
            <Button variant="ghost" onClick={() => setManagingCats(true)} aria-label="Gérer les catégories" title="Gérer les catégories">
              <Settings2 size={16} />
            </Button>
          )}
        </div>
      )}

      <div className={styles.toolbar}>
        <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un produit…" />
        <span className={styles.spacer} />
        {canManage && !showArchived && counts.archived > 0 && (
          <Button variant="ghost" onClick={() => setShowArchived(true)}>
            <Archive size={16} aria-hidden /> Archivés ({counts.archived})
          </Button>
        )}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Package} title={query ? "Aucun résultat" : showArchived ? "Aucun produit archivé" : "Aucun produit ici"}>
          {query && <p>Aucun produit ne correspond à « {query} ».</p>}
        </EmptyState>
      ) : (
        <div className={styles.list} role="table" aria-label="Produits">
          <div className={styles.head} role="row">
            <span role="columnheader">Produit</span>
            <span role="columnheader">Stock</span>
            <span role="columnheader">Nouvelle qté</span>
            <span role="columnheader">Min.</span>
            <span role="columnheader">Fournisseur</span>
            <span role="columnheader">Statut</span>
            <span role="columnheader">À commander</span>
            <span role="columnheader">
              <span className="visually-hidden">Actions</span>
            </span>
          </div>
          {shown.map((p) => {
            const st = statusOf(p);
            return (
              <div key={p.id} className={`${styles.row} ${styles[`row_${st}`]}`} role="row">
                <div className={styles.cName} role="cell">
                  <div className={styles.name}>{p.name}</div>
                  {(section === ALL || showArchived) && <div className={styles.sub}>{p.section}</div>}
                  {p.note && <div className={styles.note}>{p.note}</div>}
                </div>
                <div className={`${styles.cStock} ${styles.stock} ${styles.num}`} role="cell">
                  <span className={styles.cellLabel}>Stock actuel</span>
                  {stockOf(p)}
                </div>
                <div className={styles.cInput} role="cell">
                  {!showArchived && <StockInput productName={p.name ?? ""} onCommit={(q) => updateStock(p, q)} />}
                </div>
                <div className={`${styles.cMin} ${styles.num}`} role="cell">
                  <span className={styles.cellLabel}>Minimum</span>
                  {minimumOf(p)}
                </div>
                <div className={styles.cSup} role="cell">
                  <span className={styles.cellLabel}>Fournisseur</span>
                  {p.supplierId ? (supplierName.get(p.supplierId) ?? "Fournisseur supprimé") : "—"}
                </div>
                <div className={styles.cStatus} role="cell">
                  <StatusBadge status={st} />
                </div>
                <div className={`${styles.cOrder} ${styles.order}`} role="cell">
                  <span className={styles.cellLabel}>À commander</span>
                  {orderLabel(p)}
                  {isBox(p) && <div className={styles.sub}>= {unitsFor(p, p.orderQty ?? 0)} unités</div>}
                </div>
                <div className={styles.cMenu} role="cell">
                  {canManage && (
                    <ActionMenu
                      label={`Actions pour ${p.name}`}
                      items={[
                        { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ product: p }) },
                        { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(p) },
                        {
                          label: p.archived ? "Restaurer" : "Archiver",
                          icon: p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />,
                          onSelect: () => void toggleArchive(p),
                        },
                        { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(p) },
                      ]}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ProductModal
          product={editing.product}
          sections={sections}
          defaultSection={section !== ALL ? section : (sections[0] ?? "Cuisine")}
          suppliers={suppliers}
          onClose={() => setEditing(null)}
          onSave={saveProduct}
        />
      )}
      {managingCats && (
        <CategoriesModal
          sections={sections}
          products={products}
          onClose={() => setManagingCats(false)}
          onSaveList={saveSectionList}
          onRename={renameSection}
          onDelete={deleteSection}
        />
      )}
    </>
  );
}
