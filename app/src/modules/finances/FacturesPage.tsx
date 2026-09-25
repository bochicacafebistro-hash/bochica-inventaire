import { useMemo, useState } from "react";
import { deleteField } from "firebase/firestore";
import { CircleAlert, Copy, FileDown, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { addDays, todayISO } from "@/core/dates";
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
import { filterInvoices, INVOICE_STATUSES, invoiceKpis, invoiceStatusLabel, invoiceTotals, isOverdue, nextInvoiceNumber, revenueAction, revenueForInvoice } from "./invoices.logic";
import type { Invoice } from "./finances.types";
import { InvoiceModal, type InvoiceFields } from "./components/InvoiceModal";
import styles from "./Finances.module.css";

const COL = "invoices";
const REV = "revenues";

export default function FacturesPage() {
  const user = useSessionUser();
  const q = useCollection<Invoice>(COL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ inv: Invoice | null; number: string } | null>(null);

  const shown = useMemo(() => filterInvoices(q.data, status, query), [q.data, status, query]);
  const kpis = useMemo(() => invoiceKpis(q.data), [q.data]);
  const counts = useMemo(() => {
    const m: Record<string, number> = { all: q.data.length };
    for (const i of q.data) m[i.status ?? "brouillon"] = (m[i.status ?? "brouillon"] ?? 0) + 1;
    return m;
  }, [q.data]);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  /** Synchronise le revenu lié (créer / supprimer / mettre à jour) après un changement. */
  async function syncRevenue(id: string, before: Invoice | null, after: Invoice) {
    const action = revenueAction(before?.status === "payee", after.status === "payee", !!before?.paidRevenueId);
    try {
      if (action === "create") {
        const revId = await actions.create(REV, revenueForInvoice(after, id));
        await actions.update(COL, id, { paidRevenueId: revId });
        return "Revenu ajouté à Dépenses & revenus.";
      }
      if (action === "delete" && before?.paidRevenueId) {
        await actions.remove(REV, before.paidRevenueId).catch(() => undefined);
        await actions.update(COL, id, { paidRevenueId: deleteField() });
        return "Revenu lié retiré.";
      }
      if (action === "update" && before?.paidRevenueId) {
        const { notes: _n, ...fields } = revenueForInvoice(after, id);
        await actions.update(REV, before.paidRevenueId, fields);
        return "Revenu lié mis à jour.";
      }
    } catch (err) {
      toast(`Facture enregistrée, mais le revenu lié n'a pas pu être synchronisé : ${(err as Error).message}`, "error", 8000);
    }
    return "";
  }

  async function save(f: InvoiceFields) {
    const before = editing?.inv ?? null;
    const invoiceNumber = editing!.number;
    try {
      let id: string;
      if (before) {
        id = before.id;
        await actions.update(COL, id, { ...f, invoiceNumber, ...(f.status === "payee" && before.status !== "payee" ? { paidAt: todayISO() } : {}) });
        await actions.log(invoiceNumber, "Facture — modifiée", `${f.clientName} · ${invoiceStatusLabel(f.status)}`);
      } else {
        id = await actions.create(COL, { ...f, invoiceNumber, createdBy: user.email, ...(f.status === "payee" ? { paidAt: todayISO() } : {}) });
        await actions.log(invoiceNumber, "Facture — créée", `${f.clientName} · ${fmtMoney(invoiceTotals(f).total)}`);
      }
      const extra = await syncRevenue(id, before, { ...before, ...f, id, invoiceNumber });
      toast(`Facture ${invoiceNumber} enregistrée. ${extra}`, "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function changeStatus(inv: Invoice, next: string) {
    try {
      const willBePaid = next === "payee";
      await actions.update(COL, inv.id, { status: next, ...(willBePaid ? { paidAt: todayISO() } : inv.status === "payee" ? { paidAt: deleteField() } : {}) });
      await actions.log(inv.invoiceNumber ?? inv.id, "Facture — statut", invoiceStatusLabel(next));
      const extra = await syncRevenue(inv.id, inv, { ...inv, status: next });
      toast(`${inv.invoiceNumber} : ${invoiceStatusLabel(next)}. ${extra}`, "success");
    } catch (err) {
      fail("Changement de statut")(err);
    }
  }

  async function duplicate(inv: Invoice) {
    const { id: _id, paidRevenueId: _r, ...rest } = inv as Invoice & { paidAt?: unknown; createdAt?: unknown; updatedAt?: unknown };
    const { paidAt: _p, createdAt: _c, updatedAt: _u, ...clean } = rest as typeof rest & { paidAt?: unknown; createdAt?: unknown; updatedAt?: unknown };
    const invoiceNumber = nextInvoiceNumber(q.data);
    try {
      await actions.create(COL, { ...clean, invoiceNumber, invoiceDate: todayISO(), dueDate: addDays(todayISO(), 30), status: "brouillon", createdBy: user.email });
      await actions.log(invoiceNumber, "Facture — dupliquée", `depuis ${inv.invoiceNumber}`);
      toast(`Facture dupliquée en brouillon (${invoiceNumber}).`, "success");
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function remove(inv: Invoice) {
    const linked = inv.status === "payee" && !!inv.paidRevenueId;
    const ok = await confirm({
      title: `Supprimer la facture ${inv.invoiceNumber} ?`,
      message: linked ? "Elle est marquée payée : le revenu lié dans Dépenses & revenus sera aussi supprimé. Action irréversible." : "Action irréversible.",
      danger: true,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      if (linked) await actions.remove(REV, inv.paidRevenueId!).catch(() => undefined);
      await actions.remove(COL, inv.id);
      await actions.log(inv.invoiceNumber ?? inv.id, "Facture — supprimée", inv.clientName);
      toast("Facture supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  async function pdf(inv: Invoice) {
    try {
      const { downloadInvoicePdf } = await import("./invoicePdf");
      toast(`PDF téléchargé : ${await downloadInvoicePdf(inv)}`, "success");
    } catch (err) {
      fail("Génération du PDF")(err);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Finances"
        title="Factures"
        actions={
          <Button onClick={() => setEditing({ inv: null, number: nextInvoiceNumber(q.data) })}>
            <Plus size={16} aria-hidden /> Nouvelle facture
          </Button>
        }
      />
      {q.error ? (
        <EmptyState icon={FileText} title="Impossible de charger les factures">
          {q.error.message}
        </EmptyState>
      ) : q.loading ? (
        <Spinner />
      ) : (
        <>
          <div className={styles.kpis}>
            <Kpi label="Total facturé" value={fmtMoney(kpis.total)} />
            <Kpi label="Payé" value={<span className={styles.good}>{fmtMoney(kpis.paid)}</span>} />
            <Kpi label="En attente" value={fmtMoney(kpis.pending)} sub={kpis.overdue > 0 ? `dont ${fmtMoney(kpis.overdue)} en retard` : undefined} alert={kpis.overdue > 0} />
            <Kpi label="Brouillons" value={String(kpis.drafts)} />
          </div>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Numéro, client, entreprise…" />
          </div>
          <div className={styles.chips} role="group" aria-label="Filtrer par statut">
            {[{ key: "all", label: "Toutes" }, ...INVOICE_STATUSES].map((s) => (
              <button key={s.key} className={styles.chip} aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>
                {s.label} <span className={styles.chipCount}>{counts[s.key] ?? 0}</span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={FileText} title={q.data.length ? "Aucune facture ne correspond" : "Aucune facture pour l'instant"}>
              {q.data.length ? "Change le filtre ou la recherche." : "Crée une facture pour un événement, un traiteur ou une location."}
            </EmptyState>
          ) : (
            <div className={styles.cards}>
              {shown.map((inv) => {
                const st = inv.status ?? "brouillon";
                const total = invoiceTotals(inv).total;
                return (
                  <article key={inv.id} className={styles.invCard}>
                    <div>
                      <div className={styles.invHead}>
                        <span className={styles.invNum}>{inv.invoiceNumber}</span>
                        <span className={`${styles.status} ${styles[`status_${st}`] ?? ""}`}>{invoiceStatusLabel(st)}</span>
                        {isOverdue(inv) && (
                          <span className={styles.overdue}>
                            <CircleAlert size={12} aria-hidden /> En retard
                          </span>
                        )}
                      </div>
                      <div className={styles.client}>
                        {inv.clientName}
                        {inv.clientCompany && <span className={styles.company}>{inv.clientCompany}</span>}
                      </div>
                      <div className={styles.meta}>
                        <span>Émise le {inv.invoiceDate || "—"}</span>
                        <span>Échéance {inv.dueDate || "—"}</span>
                        <span>{(inv.lines ?? []).length} ligne(s)</span>
                      </div>
                    </div>
                    <div className={styles.side}>
                      <span className={styles.total}>{fmtMoney(total)}</span>
                      <div className={styles.sideActions}>
                        <select
                          aria-label={`Statut de ${inv.invoiceNumber}`}
                          value={st}
                          onChange={(e) => void changeStatus(inv, e.target.value)}
                          className={styles.pill}
                          style={{ border: "1px solid var(--border-strong)", minHeight: 32 }}
                        >
                          {INVOICE_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                        <ActionMenu
                          label={`Actions pour ${inv.invoiceNumber}`}
                          items={[
                            { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setEditing({ inv, number: inv.invoiceNumber ?? nextInvoiceNumber(q.data) }) },
                            { label: "Télécharger le PDF", icon: <FileDown size={16} />, onSelect: () => void pdf(inv) },
                            { label: "Dupliquer", icon: <Copy size={16} />, onSelect: () => void duplicate(inv) },
                            { label: "Supprimer", icon: <Trash2 size={16} />, danger: true, onSelect: () => void remove(inv) },
                          ]}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {editing && <InvoiceModal invoice={editing.inv} number={editing.number} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}

function Kpi({ label, value, sub, alert }: { label: string; value: React.ReactNode; sub?: string; alert?: boolean }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && <div className={`${styles.kpiSub} ${alert ? styles.bad : ""}`}>{sub}</div>}
    </div>
  );
}
