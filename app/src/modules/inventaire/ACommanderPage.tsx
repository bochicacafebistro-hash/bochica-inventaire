import { useMemo, useState } from "react";
import { CircleCheck, PackageCheck, Phone, Printer } from "lucide-react";
import { useDataActions } from "@/core/data/useDataActions";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { telHref } from "@/core/text";
import { Segmented } from "@/ui/Segmented";
import {
  groupBySection,
  groupBySupplier,
  isBox,
  orderLabel,
  receivePreview,
  statusOf,
  stockOf,
  toOrder,
  unitsFor,
} from "./inventaire.logic";
import type { Product } from "./inventaire.types";
import { useInventoryData } from "./useInventoryData";
import { ReceiveModal } from "./components/ReceiveModal";
import { StatusBadge } from "./components/StatusBadge";
import styles from "./Inventaire.module.css";

type GroupMode = "section" | "supplier";
const MODE_KEY = "bochica-acommander-mode";

function initialMode(): GroupMode {
  try {
    return localStorage.getItem(MODE_KEY) === "supplier" ? "supplier" : "section";
  } catch {
    return "section";
  }
}

export default function ACommanderPage() {
  const { products, suppliers, sections, loading, error } = useInventoryData();
  const actions = useDataActions();
  const toast = useToast();
  const [mode, setModeState] = useState<GroupMode>(initialMode);
  const [receiving, setReceiving] = useState<Product | null>(null);

  const items = useMemo(() => toOrder(products), [products]);
  const groups = useMemo(
    () => (mode === "section" ? groupBySection(items, sections) : groupBySupplier(items, suppliers)),
    [mode, items, sections, suppliers],
  );
  const supplierName = useMemo(() => new Map(suppliers.map((s) => [s.id, s.name])), [suppliers]);

  function setMode(m: GroupMode) {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* stockage indisponible */
    }
  }

  async function receive(p: Product, qty: number) {
    const { units, newStock } = receivePreview(p, qty);
    const old = stockOf(p);
    try {
      await actions.update("products", p.id, { currentStock: newStock });
      await actions.log(
        p.name ?? "—",
        "Réception",
        `+${units} unités (${qty} ${p.orderUnit ?? "unité"}${qty > 1 ? "s" : ""}) · ${old} → ${newStock}`,
      );
      toast(`${p.name} reçu : stock ${old} → ${newStock}`, "success");
      setReceiving(null);
    } catch (err) {
      toast(`Réception impossible : ${(err as Error).message}`, "error");
    }
  }

  if (loading) return <Spinner />;
  if (error) return <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>;

  const red = items.filter((p) => statusOf(p) === "red").length;
  const yellow = items.length - red;
  const today = new Date().toLocaleDateString("fr-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        eyebrow={`Inventaire · ${today}`}
        title="À commander"
        actions={
          items.length > 0 ? (
            <Button variant="secondary" onClick={() => window.print()} className="no-print">
              <Printer size={16} aria-hidden /> Imprimer
            </Button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <EmptyState icon={CircleCheck} title="Tout est en stock">
          <p>Aucun produit sous son minimum pour l'instant.</p>
        </EmptyState>
      ) : (
        <>
          <div className={`${styles.toolbar} no-print`}>
            <Segmented
              label="Grouper par"
              value={mode}
              onChange={setMode}
              options={[
                { value: "section", label: "Par catégorie" },
                { value: "supplier", label: "Par fournisseur" },
              ]}
            />
          </div>

          <div className={styles.summary}>
            <div className={styles.stat}>
              <div className={styles.statValue}>{red}</div>
              <div className={styles.statLabel}>
                <span className={`${styles.dot} ${styles.dot_red}`} aria-hidden /> À commander maintenant
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>{yellow}</div>
              <div className={styles.statLabel}>
                <span className={`${styles.dot} ${styles.dot_yellow}`} aria-hidden /> Bientôt bas
              </div>
            </div>
          </div>

          {groups.map((g) => {
            const tel = g.contact ? telHref(g.contact) : null;
            return (
              <section key={g.key} aria-label={g.title}>
                <h2 className={styles.groupTitle}>
                  {g.title}
                  <span className={styles.groupCount}>{g.items.length}</span>
                  {g.contact && (
                    <span className={styles.groupContact}>
                      <Phone size={13} aria-hidden />
                      {tel ? <a href={tel}>{g.contact}</a> : g.contact}
                    </span>
                  )}
                </h2>
                <div className={styles.cards}>
                  {g.items.map((p) => {
                    const st = statusOf(p);
                    return (
                      <article key={p.id} className={`${styles.card} ${styles[`row_${st}`]}`}>
                        <div className={styles.cardHead}>
                          <div>
                            <div className={styles.name}>{p.name}</div>
                            <div className={styles.sub}>
                              {mode === "supplier"
                                ? p.section
                                : p.supplierId
                                  ? (supplierName.get(p.supplierId) ?? "Fournisseur supprimé")
                                  : "Sans fournisseur"}
                            </div>
                          </div>
                          <StatusBadge status={st} />
                        </div>
                        <div className={styles.cardNums}>
                          <div>
                            <div className={styles.numLabel}>Stock (min. {p.minimum ?? 0})</div>
                            <div className={`${styles.numValue} ${styles.num}`}>{stockOf(p)}</div>
                          </div>
                          <div>
                            <div className={styles.numLabel}>À commander</div>
                            <div className={styles.numValue}>{orderLabel(p)}</div>
                            {isBox(p) && <div className={styles.sub}>= {unitsFor(p, p.orderQty ?? 0)} unités</div>}
                          </div>
                        </div>
                        {p.note && <div className={styles.note}>{p.note}</div>}
                        <Button variant="secondary" onClick={() => setReceiving(p)} className="no-print">
                          <PackageCheck size={16} aria-hidden /> Réceptionner
                        </Button>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      {receiving && <ReceiveModal product={receiving} onClose={() => setReceiving(null)} onConfirm={(q) => receive(receiving, q)} />}
    </>
  );
}
