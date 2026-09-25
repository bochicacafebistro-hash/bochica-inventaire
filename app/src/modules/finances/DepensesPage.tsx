import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, FileDown, Pencil, Plus, Repeat, Tags, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { ChartCard } from "@/ui/charts/ChartCard";
import { ColumnsChart } from "@/ui/charts/ColumnsChart";
import { RankedBarsChart } from "@/ui/charts/RankedBarsChart";
import { useChartTheme } from "@/ui/chartTheme";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtDec1, fmtMoney, fmtMoney0 } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Segmented } from "@/ui/Segmented";
import { SelectField } from "@/ui/Select";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import {
  allCategories,
  byCategory,
  expensesIn,
  expenseTotal,
  expenseType,
  lastMonthsSeries,
  pendingFixedExpenses,
  periodBounds,
  periodTotals,
  revenuePeriodLabel,
  revenuesIn,
  searchExpenses,
  sortByName,
  type expenseFields,
  type ExpenseType,
  type Period,
  type PeriodKind,
  type revenueFields,
} from "./finances.logic";
import type { Expense, ExpenseCategory, FixedTemplate, Revenue } from "./finances.types";
import { CategoriesModal } from "./components/CategoriesModal";
import { ExpenseModal } from "./components/ExpenseModal";
import { FixedTemplatesModal } from "./components/FixedTemplatesModal";
import { ReportModal } from "./components/ReportModal";
import { RevenueModal } from "./components/RevenueModal";
import { exportExcel, exportPdf, type ReportInput } from "./report";
import styles from "./Finances.module.css";

const EXP = "expenses";
const REV = "revenues";
const CATS = "expenseCategories";
const TPL = "fixedExpenseTemplates";

const KINDS: { value: PeriodKind; label: string }[] = [
  { value: "semaine", label: "7 jours" },
  { value: "mois", label: "Mois" },
  { value: "annee", label: "Année" },
];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

interface Supplier {
  id: string;
  name?: string;
}

export default function DepensesPage() {
  const expQ = useCollection<Expense>(EXP);
  const revQ = useCollection<Revenue>(REV);
  const catQ = useCollection<ExpenseCategory>(CATS);
  const tplQ = useCollection<FixedTemplate>(TPL);
  const supQ = useCollection<Supplier>("suppliers");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const theme = useChartTheme();

  const now = new Date();
  const [period, setPeriod] = useState<Period>({ kind: "mois", year: now.getFullYear(), month: now.getMonth() });
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [editExp, setEditExp] = useState<{ e: Expense | null } | null>(null);
  const [editRev, setEditRev] = useState<{ r: Revenue | null } | null>(null);
  const [modal, setModal] = useState<"cats" | "fixed" | "report" | null>(null);
  const [applying, setApplying] = useState(false);

  const customCats = catQ.data;
  const categories = useMemo(() => allCategories(customCats), [customCats]);
  const supplierNames = useMemo(() => [...supQ.data].sort(sortByName).map((s) => s.name ?? "").filter(Boolean), [supQ.data]);
  const { start, end } = periodBounds(period);
  const exps = useMemo(() => expensesIn(expQ.data, start, end), [expQ.data, start, end]);
  const revs = useMemo(() => revenuesIn(revQ.data, start, end), [revQ.data, start, end]);
  const totals = periodTotals(exps, revs, customCats);
  const shownExps = useMemo(() => searchExpenses(exps, query, cat), [exps, query, cat]);
  const months = useMemo(() => lastMonthsSeries(expQ.data, revQ.data, 6), [expQ.data, revQ.data]);
  const cats = useMemo(() => byCategory(exps), [exps]);
  const pending = useMemo(() => pendingFixedExpenses(tplQ.data, expQ.data), [tplQ.data, expQ.data]);

  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");
  const loading = expQ.loading || revQ.loading;
  const error = expQ.error || revQ.error;

  function shift(delta: number) {
    setPeriod((p) => {
      if (p.kind === "annee") return { ...p, year: p.year + delta };
      const d = new Date(p.year, p.month + delta, 1);
      return { ...p, year: d.getFullYear(), month: d.getMonth() };
    });
  }
  const periodLabel = period.kind === "mois" ? `${MONTHS[period.month]} ${period.year}` : period.kind === "annee" ? String(period.year) : "7 derniers jours";

  // ── Écritures ───────────────────────────────────────
  async function ensureSupplier(name: string) {
    const n = name.trim();
    if (!n || supQ.data.some((s) => (s.name ?? "").trim().toLowerCase() === n.toLowerCase())) return;
    try {
      await actions.create("suppliers", { name: n, contact: "", email: "", notes: "Créé automatiquement depuis une dépense" });
      toast(`Fournisseur « ${n} » ajouté à la liste.`, "info");
    } catch {
      /* non bloquant, comme la v1 */
    }
  }

  async function saveExpense(f: ReturnType<typeof expenseFields>) {
    const target = editExp?.e;
    try {
      await ensureSupplier(f.supplier ?? "");
      if (target) {
        await actions.update(EXP, target.id, f);
        await actions.log(f.description, "Dépense — modifiée", fmtMoney(f.amount));
      } else {
        await actions.create(EXP, f);
        await actions.log(f.description, "Dépense — ajoutée", fmtMoney(f.amount));
      }
      toast("Dépense enregistrée.", "success");
      setEditExp(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicateExpense(e: Expense) {
    const { id: _id, isFixedAuto: _auto, ...rest } = e;
    try {
      await actions.create(EXP, { ...rest, date: todayISO(), isFixedAuto: false });
      await actions.log(e.description ?? "", "Dépense — dupliquée");
      toast("Dépense dupliquée à la date d'aujourd'hui.", "success");
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function deleteExpense(e: Expense) {
    const ok = await confirm({ title: "Supprimer la dépense ?", message: `« ${e.description} » (${fmtMoney(expenseTotal(e))}) sera supprimée définitivement.`, danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try {
      await actions.remove(EXP, e.id);
      await actions.log(e.description ?? "", "Dépense — supprimée", fmtMoney(Number(e.amount) || 0));
      toast("Dépense supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  async function saveRevenue(f: ReturnType<typeof revenueFields>) {
    const target = editRev?.r;
    try {
      if (target) {
        await actions.update(REV, target.id, f);
        await actions.log(f.description, "Revenu — modifié", fmtMoney(f.amount));
      } else {
        await actions.create(REV, f);
        await actions.log(f.description, "Revenu — ajouté", fmtMoney(f.amount));
      }
      toast("Revenu enregistré.", "success");
      setEditRev(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function deleteRevenue(r: Revenue) {
    const ok = await confirm({
      title: "Supprimer le revenu ?",
      message: r.sourceInvoiceId
        ? `Ce revenu vient d'une facture payée. La facture restera « payée », mais sans revenu associé.`
        : `« ${r.description} » (${fmtMoney(Number(r.amount) || 0)}) sera supprimé définitivement.`,
      danger: true,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await actions.remove(REV, r.id);
      if (r.sourceInvoiceId) await actions.update("invoices", r.sourceInvoiceId, { paidRevenueId: null }).catch(() => undefined);
      await actions.log(r.description ?? "", "Revenu — supprimé", fmtMoney(Number(r.amount) || 0));
      toast("Revenu supprimé.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  async function addCategory(name: string, type: ExpenseType): Promise<boolean> {
    const n = name.trim();
    if (!n) return false;
    if (categories.some((c) => c.toLowerCase() === n.toLowerCase())) {
      toast(`La catégorie « ${n} » existe déjà.`, "error");
      return false;
    }
    try {
      await actions.create(CATS, { name: n, type });
      await actions.log(n, "Catégorie de dépense — ajoutée", type);
      toast(`Catégorie « ${n} » ajoutée.`, "success");
      return true;
    } catch (err) {
      fail("Ajout")(err);
      return false;
    }
  }

  async function deleteCategory(c: ExpenseCategory) {
    const used = expQ.data.filter((e) => e.category === c.name).length;
    const ok = await confirm({
      title: "Supprimer la catégorie ?",
      message: used ? `${used} dépense(s) l'utilisent : elles garderont ce nom de catégorie.` : `« ${c.name} » sera retirée de la liste.`,
      danger: true,
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    try {
      await actions.remove(CATS, c.id);
      await actions.log(c.name ?? "", "Catégorie de dépense — supprimée");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  async function addTemplate(t: Omit<FixedTemplate, "id">) {
    try {
      await ensureSupplier(t.supplier ?? "");
      await actions.create(TPL, t);
      await actions.log(t.supplier || t.description || "", "Frais fixe — ajouté", fmtMoney(Number(t.amount) || 0));
      toast("Frais fixe ajouté.", "success");
    } catch (err) {
      fail("Ajout")(err);
    }
  }

  async function deleteTemplate(t: FixedTemplate) {
    const ok = await confirm({ title: "Retirer ce frais fixe ?", message: `« ${t.supplier || t.description} » ne sera plus créé chaque mois. Les dépenses déjà créées restent.`, danger: true, confirmLabel: "Retirer" });
    if (!ok) return;
    try {
      await actions.remove(TPL, t.id);
      await actions.log(t.supplier || t.description || "", "Frais fixe — retiré");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  async function applyFixed() {
    setApplying(true);
    try {
      for (const entry of pending.entries) await actions.create(EXP, entry);
      await actions.log(pending.months.join(", "), "Frais fixes — créés", `${pending.entries.length} dépense(s)`);
      toast(`${pending.entries.length} frais fixe(s) créé(s).`, "success");
    } catch (err) {
      fail("Création des frais fixes")(err);
    } finally {
      setApplying(false);
    }
  }

  async function exportReport(format: "xlsx" | "pdf", input: ReportInput) {
    try {
      const name = format === "xlsx" ? await exportExcel(input) : await exportPdf(input);
      toast(`Rapport téléchargé : ${name}`, "success");
    } catch (err) {
      fail("Export")(err);
    }
  }

  // ── Rendu ───────────────────────────────────────────
  const REV_COLOR = theme.series[3]!;
  const EXP_COLOR = theme.series[2]!;
  const margin = totals.revenue > 0 ? totals.profit / totals.revenue : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Finances"
        title="Dépenses & revenus"
        actions={
          <>
            <ActionMenu
              label="Réglages des dépenses"
              items={[
                { label: "Catégories", icon: <Tags size={16} />, onSelect: () => setModal("cats") },
                { label: "Frais fixes mensuels", icon: <Repeat size={16} />, onSelect: () => setModal("fixed") },
                { label: "Rapport Excel / PDF", icon: <FileDown size={16} />, onSelect: () => setModal("report") },
              ]}
            />
            <Button variant="secondary" onClick={() => setEditRev({ r: null })}>
              <TrendingUp size={16} aria-hidden /> Revenu
            </Button>
            <Button onClick={() => setEditExp({ e: null })}>
              <Plus size={16} aria-hidden /> Dépense
            </Button>
          </>
        }
      />

      {pending.entries.length > 0 && (
        <div className={styles.banner} role="status">
          <Repeat size={18} aria-hidden />
          <span>
            <strong>{pending.entries.length} frais fixe(s)</strong> pas encore créé(s) pour {pending.months.join(", ")}. La v1 les crée automatiquement à l'ouverture ; ici, c'est sur demande.
          </span>
          <span className={styles.spacer} />
          <Button variant="secondary" onClick={() => void applyFixed()} disabled={applying}>
            {applying ? "Création…" : "Créer maintenant"}
          </Button>
        </div>
      )}

      <div className={styles.toolbar}>
        <Segmented label="Période" value={period.kind} options={KINDS} onChange={(kind) => setPeriod((p) => ({ ...p, kind }))} />
        {period.kind !== "semaine" && (
          <div className={styles.monthNav}>
            <button className={styles.navBtn} onClick={() => shift(-1)} aria-label="Période précédente">
              <ChevronLeft size={16} />
            </button>
            <span className={styles.monthLabel} aria-live="polite">
              {periodLabel}
            </span>
            <button className={styles.navBtn} onClick={() => shift(1)} aria-label="Période suivante">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {error ? (
        <EmptyState icon={Wallet} title="Impossible de charger les finances">
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          <div className={styles.kpis}>
            <Kpi label="Revenus" icon={<TrendingUp size={14} aria-hidden />} value={fmtMoney(totals.revenue)} sub={`${revs.length} entrée(s) · avant taxes`} />
            <Kpi label="Dépenses" icon={<TrendingDown size={14} aria-hidden />} value={fmtMoney(totals.expenses)} sub={`${exps.length} entrée(s) · + ${fmtMoney(totals.expenseTaxes)} de taxes`} />
            <Kpi
              label={totals.profit >= 0 ? "Profit" : "Déficit"}
              value={<span className={totals.profit >= 0 ? styles.good : styles.bad}>{fmtMoney(totals.profit)}</span>}
              sub={margin == null ? "revenus − dépenses taxes incl." : `marge ${fmtDec1(margin * 100)} %`}
            />
            <Kpi label="Fixes / variables" value={`${fmtMoney0(totals.fixed)} / ${fmtMoney0(totals.variable)}`} sub="avant taxes" />
          </div>

          <div className={styles.grid2}>
            <ChartCard
              title="6 derniers mois"
              subtitle="Revenus avant taxes · dépenses taxes incluses"
              legend={[
                { label: "Revenus", color: REV_COLOR },
                { label: "Dépenses", color: EXP_COLOR },
              ]}
              chart={
                <ColumnsChart
                  data={months}
                  series={[
                    { key: "revenue", label: "Revenus", color: REV_COLOR },
                    { key: "expenses", label: "Dépenses", color: EXP_COLOR },
                  ]}
                  extraTooltip={(r) => ({ label: "Écart", value: fmtMoney0(Number(r.profit)) })}
                />
              }
              table={
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Mois</th>
                      <th className={styles.num}>Revenus</th>
                      <th className={styles.num}>Dépenses</th>
                      <th className={styles.num}>Écart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map((m) => (
                      <tr key={m.key}>
                        <td>{m.label}</td>
                        <td className={styles.num}>{fmtMoney0(m.revenue)}</td>
                        <td className={styles.num}>{fmtMoney0(m.expenses)}</td>
                        <td className={`${styles.num} ${m.profit >= 0 ? styles.good : styles.bad}`}>{fmtMoney0(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
            <ChartCard
              title="Dépenses par catégorie"
              subtitle={`${periodLabel} · avant taxes`}
              chart={cats.length ? <RankedBarsChart rows={cats.slice(0, 8)} share /> : <p className={styles.empty}>Aucune dépense sur la période.</p>}
              table={
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Catégorie</th>
                      <th className={styles.num}>Entrées</th>
                      <th className={styles.num}>Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className={styles.num}>{c.qty}</td>
                        <td className={styles.num}>{fmtMoney(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              }
            />
          </div>

          <h2 className={styles.sectionTitle}>
            Revenus <span className={styles.count}>{revs.length}</span>
          </h2>
          <div className={styles.list}>
            {revs.length === 0 ? (
              <p className={styles.empty}>Aucun revenu sur la période.</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Période</th>
                    <th>Description</th>
                    <th className={styles.num}>Montant</th>
                    <th className={`${styles.num} ${styles.hideSm}`}>Taxes</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {revs.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.nowrap}>{revenuePeriodLabel(r)}</td>
                      <td>
                        {r.description}
                        {r.sourceInvoiceId && <span className={styles.auto}>FACTURE</span>}
                        {r.notes && <div className={styles.hint}>{r.notes}</div>}
                      </td>
                      <td className={`${styles.num} ${styles.strong}`}>{fmtMoney(Number(r.amount) || 0)}</td>
                      <td className={`${styles.num} ${styles.dim} ${styles.hideSm}`}>{fmtMoney((Number(r.tps) || 0) + (Number(r.tvq) || 0))}</td>
                      <td>
                        <ActionMenu
                          label={`Actions pour ${r.description}`}
                          items={[
                            { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setEditRev({ r }) },
                            { label: "Supprimer", icon: <Trash2 size={16} />, danger: true, onSelect: () => void deleteRevenue(r) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className={styles.sectionTitle}>
            Dépenses <span className={styles.count}>{shownExps.length}</span>
          </h2>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="Description, fournisseur, note…" />
            <SelectField
              label="Catégorie"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              options={[{ value: "all", label: "Toutes les catégories" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
          </div>
          <div className={styles.list}>
            {shownExps.length === 0 ? (
              <p className={styles.empty}>{exps.length ? "Aucune dépense ne correspond à la recherche." : "Aucune dépense sur la période."}</p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className={styles.hideSm}>Catégorie</th>
                    <th className={`${styles.num} ${styles.hideSm}`}>Avant taxes</th>
                    <th className={styles.num}>Total</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {shownExps.map((e) => {
                    const fixed = expenseType(e, customCats) === "fixe";
                    return (
                      <tr key={e.id}>
                        <td className={styles.nowrap}>{e.date}</td>
                        <td>
                          <span className={styles.strong}>{e.description}</span>
                          {e.isFixedAuto && <span className={styles.auto}>AUTO</span>}
                          {e.supplier && e.supplier !== e.description && <div className={styles.hint}>{e.supplier}</div>}
                        </td>
                        <td className={styles.hideSm}>
                          <span className={`${styles.pill} ${fixed ? styles.pillFixed : ""}`}>{e.category || "—"}</span>
                        </td>
                        <td className={`${styles.num} ${styles.hideSm}`}>{fmtMoney(Number(e.amount) || 0)}</td>
                        <td className={`${styles.num} ${styles.strong}`}>{fmtMoney(expenseTotal(e))}</td>
                        <td>
                          <ActionMenu
                            label={`Actions pour ${e.description}`}
                            items={[
                              { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setEditExp({ e }) },
                              { label: "Dupliquer", icon: <Copy size={16} />, onSelect: () => void duplicateExpense(e) },
                              { label: "Supprimer", icon: <Trash2 size={16} />, danger: true, onSelect: () => void deleteExpense(e) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {editExp && (
        <ExpenseModal expense={editExp.e} categories={customCats} supplierNames={supplierNames} onClose={() => setEditExp(null)} onSave={saveExpense} onAddCategory={addCategory} />
      )}
      {editRev && <RevenueModal revenue={editRev.r} onClose={() => setEditRev(null)} onSave={saveRevenue} />}
      {modal === "cats" && <CategoriesModal categories={customCats} expenses={expQ.data} onClose={() => setModal(null)} onAdd={addCategory} onDelete={(c) => void deleteCategory(c)} />}
      {modal === "fixed" && (
        <FixedTemplatesModal templates={tplQ.data} categories={categories} supplierNames={supplierNames} onClose={() => setModal(null)} onAdd={addTemplate} onDelete={(t) => void deleteTemplate(t)} />
      )}
      {modal === "report" && <ReportModal revenues={revQ.data} expenses={expQ.data} onClose={() => setModal(null)} onExport={exportReport} />}
    </div>
  );
}

function Kpi({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>
        {icon}
        {label}
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {sub && <div className={styles.kpiSub}>{sub}</div>}
    </div>
  );
}
