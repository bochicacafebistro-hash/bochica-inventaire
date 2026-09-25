import { useMemo, useState } from "react";
import { Copy, Eye, EyeOff, Pencil, Plus, Trash2, Utensils } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { filterMenu, MENU_CATS, profitability } from "./cuisine.logic";
import type { Ingredient, MenuItem } from "./cuisine.types";
import { MenuItemModal, type MenuFields } from "./components/MenuItemModal";
import { TierTag } from "./components/TierTag";
import styles from "./Cuisine.module.css";

const COL = "menu";

export default function MenuPage() {
  const menuQ = useCollection<MenuItem>(COL);
  const ingQ = useCollection<Ingredient>("ingredients");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [cat, setCat] = useState("Toutes");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ item: MenuItem | null } | null>(null);

  const byId = useMemo(() => new Map(ingQ.data.map((i) => [i.id, i])), [ingQ.data]);
  const shown = useMemo(() => filterMenu(menuQ.data, cat, query), [menuQ.data, cat, query]);
  const available = menuQ.data.filter((m) => m.available !== false).length;
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function save(f: MenuFields) {
    const target = editing?.item;
    try {
      if (target) {
        await actions.update(COL, target.id, { ...f });
        await actions.log(f.name, "Menu — modifié");
      } else {
        await actions.create(COL, { ...f });
        await actions.log(f.name, "Menu — ajouté");
      }
      toast(target ? "Plat enregistré." : "Plat ajouté.", "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(m: MenuItem) {
    try {
      const { id: _id, ...rest } = m;
      const name = `${m.name ?? ""} (copie)`;
      const id = await actions.create(COL, { ...rest, name, available: m.available !== false });
      await actions.log(name, "Dupliqué", `Depuis « ${m.name ?? ""} »`);
      setEditing({ item: { ...m, id, name } });
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function toggleAvailable(m: MenuItem) {
    const next = m.available === false;
    try {
      await actions.update(COL, m.id, { available: next });
      await actions.log(m.name ?? "—", next ? "Menu — disponible" : "Menu — indisponible");
      toast(next ? `${m.name} est disponible.` : `${m.name} est indisponible.`, "success");
    } catch (err) {
      fail("Modification")(err);
    }
  }

  async function remove(m: MenuItem) {
    if (!(await confirm({ title: "Supprimer le plat", danger: true, message: `Supprimer « ${m.name} » du menu ? Astuce : « Rendre indisponible » le garde de côté.` })))
      return;
    try {
      await actions.remove(COL, m.id);
      await actions.log(m.name ?? "—", "Menu — supprimé");
      toast("Plat supprimé.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  const loading = menuQ.loading || ingQ.loading;
  const error = menuQ.error ?? ingQ.error;

  return (
    <>
      <PageHeader
        eyebrow={`Cuisine · ${available} plat${available > 1 ? "s" : ""} disponible${available > 1 ? "s" : ""}`}
        title="Menu"
        actions={
          <Button onClick={() => setEditing({ item: null })}>
            <Plus size={16} aria-hidden /> Ajouter un plat
          </Button>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label="Catégories">
            {["Toutes", ...MENU_CATS].map((c) => {
              const n = c === "Toutes" ? menuQ.data.length : menuQ.data.filter((m) => m.category === c).length;
              return (
                <button key={c} className={styles.chip} aria-pressed={cat === c} onClick={() => setCat(c)}>
                  {c} <span className={styles.chipCount}>{n}</span>
                </button>
              );
            })}
          </div>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Rechercher un plat…" />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={Utensils} title={query ? "Aucun résultat" : "Aucun plat ici"} />
          ) : (
            <div className={styles.grid}>
              {shown.map((m) => {
                const pr = profitability(m, byId);
                const lines = (m.recipe ?? []).map((r) => {
                  const ing = byId.get(r.ingredientId);
                  return ing ? `${r.qty} ${ing.unit ?? ""} ${ing.name}` : null;
                });
                const known = lines.filter(Boolean) as string[];
                return (
                  <article key={m.id} className={`${styles.card} ${m.available === false ? styles.unavailable : ""}`}>
                    <div className={styles.cardHead}>
                      <div>
                        <h2 className={styles.cardTitle}>{m.name}</h2>
                        <div className={styles.sub}>
                          {m.category}
                          {m.available === false && " · indisponible"}
                        </div>
                      </div>
                      <ActionMenu
                        label={`Actions pour ${m.name}`}
                        items={[
                          { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ item: m }) },
                          { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(m) },
                          {
                            label: m.available === false ? "Rendre disponible" : "Rendre indisponible",
                            icon: m.available === false ? <Eye size={14} /> : <EyeOff size={14} />,
                            onSelect: () => void toggleAvailable(m),
                          },
                          { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(m) },
                        ]}
                      />
                    </div>
                    {m.description && <div className={styles.desc}>{m.description}</div>}
                    <div className={styles.metrics}>
                      <div>
                        <div className={styles.metricLabel}>Coût</div>
                        <div className={styles.metricValue}>{pr.tier !== "none" || known.length ? fmtMoney(pr.cost) : "—"}</div>
                      </div>
                      <div>
                        <div className={styles.metricLabel}>Prix</div>
                        <div className={styles.metricValue}>{pr.price > 0 ? fmtMoney(pr.price) : "—"}</div>
                      </div>
                      <div>
                        <div className={styles.metricLabel}>Marge</div>
                        <div className={styles.metricValue}>{pr.tier !== "none" ? `${Math.round(pr.marginPct)} %` : "—"}</div>
                      </div>
                    </div>
                    <div>
                      <TierTag tier={pr.tier} />
                    </div>
                    {known.length > 0 && (
                      <div className={styles.ingPreview}>
                        {known.slice(0, 4).join(" · ")}
                        {known.length > 4 && ` · +${known.length - 4}`}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {editing && <MenuItemModal item={editing.item} ingredients={ingQ.data} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
