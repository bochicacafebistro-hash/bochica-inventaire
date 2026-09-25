import { useMemo, useState } from "react";
import { Copy, Mail, Pencil, Phone, Plus, Store, Trash2 } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { copyName, filterSuppliers, productsBySupplier, sortSuppliers, telHref } from "./fournisseurs.logic";
import type { ProductRef, Supplier, SupplierDraft } from "./fournisseurs.types";
import { SupplierModal } from "./SupplierModal";
import styles from "./Fournisseurs.module.css";

const COLLECTION = "suppliers";
const MAX_TAGS = 8;

type Editing = { supplier: Supplier | null } | null;

export default function FournisseursPage() {
  const suppliersQ = useCollection<Supplier>(COLLECTION);
  const productsQ = useCollection<ProductRef>("products");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();

  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const all = useMemo(() => sortSuppliers(suppliersQ.data), [suppliersQ.data]);
  const linked = useMemo(() => productsBySupplier(productsQ.data), [productsQ.data]);
  const shown = useMemo(() => filterSuppliers(all, query, linked), [all, query, linked]);

  async function save(draft: SupplierDraft) {
    const target = editing?.supplier;
    try {
      if (target) {
        await actions.update(COLLECTION, target.id, { ...draft });
        await actions.log(draft.name, "Fournisseur modifié");
        toast("Fournisseur enregistré.", "success");
      } else {
        await actions.create(COLLECTION, { ...draft });
        await actions.log(draft.name, "Fournisseur ajouté");
        toast("Fournisseur ajouté.", "success");
      }
      setEditing(null);
    } catch (err) {
      toast(`Enregistrement impossible : ${(err as Error).message}`, "error");
    }
  }

  async function duplicate(s: Supplier) {
    try {
      const name = copyName(s.name ?? "Fournisseur", all);
      const id = await actions.create(COLLECTION, {
        name,
        contact: s.contact ?? "",
        email: s.email ?? "",
        notes: s.notes ?? "",
      });
      await actions.log(name, "Dupliqué", `Depuis « ${s.name ?? ""} »`);
      toast("Copie créée — tu peux la renommer.", "success");
      setEditing({ supplier: { ...s, id, name } });
    } catch (err) {
      toast(`Duplication impossible : ${(err as Error).message}`, "error");
    }
  }

  async function remove(s: Supplier) {
    const count = linked.get(s.id)?.length ?? 0;
    const ok = await confirm({
      title: "Supprimer le fournisseur",
      danger: true,
      message: (
        <>
          <p>
            Supprimer <strong>{s.name}</strong> définitivement ?
          </p>
          {count > 0 && (
            <p style={{ marginTop: "var(--sp-2)" }}>
              {count === 1 ? "1 produit y est lié" : `${count} produits y sont liés`} : ils resteront dans l'inventaire,
              mais apparaîtront sous « Fournisseur supprimé » dans À commander.
            </p>
          )}
        </>
      ),
    });
    if (!ok) return;
    try {
      await actions.remove(COLLECTION, s.id);
      await actions.log(s.name ?? "—", "Fournisseur supprimé", count ? `${count} produit(s) lié(s)` : undefined);
      toast("Fournisseur supprimé.", "success");
    } catch (err) {
      toast(`Suppression impossible : ${(err as Error).message}`, "error");
    }
  }

  const loading = suppliersQ.loading || productsQ.loading;
  const error = suppliersQ.error ?? productsQ.error;

  return (
    <>
      <PageHeader
        eyebrow="Inventaire"
        title="Fournisseurs"
        actions={
          <Button onClick={() => setEditing({ supplier: null })}>
            <Plus size={16} aria-hidden /> Ajouter
          </Button>
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : all.length === 0 ? (
        <EmptyState icon={Store} title="Aucun fournisseur">
          <p>Ajoute tes fournisseurs pour les lier à tes produits d'inventaire.</p>
          <Button onClick={() => setEditing({ supplier: null })}>
            <Plus size={16} aria-hidden /> Ajouter un fournisseur
          </Button>
        </EmptyState>
      ) : (
        <>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Nom, téléphone, produit…" />
            <span className={styles.count}>
              {shown.length === all.length ? `${all.length} fournisseurs` : `${shown.length} sur ${all.length}`}
            </span>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={Store} title="Aucun résultat">
              <p>Aucun fournisseur ne correspond à « {query} ».</p>
            </EmptyState>
          ) : (
            <div className={styles.grid}>
              {shown.map((s) => {
                const prods = linked.get(s.id) ?? [];
                const isOpen = expanded.has(s.id);
                const visible = isOpen ? prods : prods.slice(0, MAX_TAGS);
                const tel = s.contact ? telHref(s.contact) : null;
                return (
                  <article key={s.id} className={styles.card}>
                    <div className={styles.head}>
                      <h2 className={styles.name}>{s.name || "(sans nom)"}</h2>
                      <div className={styles.actions}>
                        <button className={styles.iconBtn} onClick={() => setEditing({ supplier: s })} aria-label={`Modifier ${s.name}`} title="Modifier">
                          <Pencil size={16} />
                        </button>
                        <button className={styles.iconBtn} onClick={() => void duplicate(s)} aria-label={`Dupliquer ${s.name}`} title="Dupliquer">
                          <Copy size={16} />
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.danger}`}
                          onClick={() => void remove(s)}
                          aria-label={`Supprimer ${s.name}`}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {(s.contact || s.email) && (
                      <div className={styles.contacts}>
                        {s.contact &&
                          (tel ? (
                            <a className={styles.contact} href={tel}>
                              <Phone size={14} aria-hidden /> {s.contact}
                            </a>
                          ) : (
                            <span className={styles.contact}>
                              <Phone size={14} aria-hidden /> {s.contact}
                            </span>
                          ))}
                        {s.email && (
                          <a className={styles.contact} href={`mailto:${s.email}`}>
                            <Mail size={14} aria-hidden /> {s.email}
                          </a>
                        )}
                      </div>
                    )}

                    {s.notes && <div className={styles.notes}>{s.notes}</div>}

                    <div className={styles.products}>
                      <div className={styles.productsLabel}>
                        {prods.length === 0 ? "Produits liés" : `Produits liés (${prods.length})`}
                      </div>
                      {prods.length === 0 ? (
                        <div className={styles.noProducts}>Aucun produit d'inventaire lié.</div>
                      ) : (
                        <div className={styles.tags}>
                          {visible.map((p) => (
                            <span key={p.id} className={styles.tag}>
                              {p.name}
                            </span>
                          ))}
                          {prods.length > MAX_TAGS && (
                            <button
                              className={styles.more}
                              onClick={() =>
                                setExpanded((set) => {
                                  const next = new Set(set);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  return next;
                                })
                              }
                            >
                              {isOpen ? "Voir moins" : `+${prods.length - MAX_TAGS}`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {editing && (
        <SupplierModal supplier={editing.supplier} existing={all} onClose={() => setEditing(null)} onSave={save} />
      )}
    </>
  );
}
