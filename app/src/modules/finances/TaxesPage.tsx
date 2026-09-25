import { useMemo, useState } from "react";
import { Check, CircleAlert, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { daysBetween, isoToDate, longDate, todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { recentQuarters, taxesForPeriod } from "./finances.logic";
import type { Expense, Revenue } from "./finances.types";
import styles from "./Finances.module.css";

const dayMonth = (iso: string) => isoToDate(iso)?.toLocaleDateString("fr-CA", { day: "numeric", month: "long" }) ?? iso;

interface Remittance {
  id: string;
  period?: string;
  amount?: number;
  paidAt?: string;
  by?: string;
}

export default function TaxesPage() {
  const user = useSessionUser();
  const expQ = useCollection<Expense>("expenses");
  const revQ = useCollection<Revenue>("revenues");
  const remQ = useCollection<Remittance>("taxRemittances");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const quarters = useMemo(() => recentQuarters(4), []);
  const [key, setKey] = useState(quarters[0]!.key);
  const q = quarters.find((x) => x.key === key) ?? quarters[0]!;
  const t = useMemo(() => taxesForPeriod(revQ.data, expQ.data, q.start, q.end), [revQ.data, expQ.data, q.start, q.end]);
  const remits = remQ.data.filter((r) => r.period === q.key).sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
  const toRemit = t.tpsToRemit + t.tvqToRemit;
  const today = todayISO();
  const daysLeft = daysBetween(today, q.due) ?? 0;
  const rulesMissing = !!remQ.error;

  async function markRemitted() {
    const ok = await confirm({ title: `Marquer ${q.key} comme remis ?`, message: `Montant : ${fmtMoney(toRemit)}. Ça sert seulement d'aide-mémoire, rien n'est envoyé à Revenu Québec.`, confirmLabel: "Marquer comme remis" });
    if (!ok) return;
    try {
      await actions.setFixed("taxRemittances", `tax_${q.key}_${Date.now()}`, { period: q.key, amount: Math.round(toRemit * 100) / 100, paidAt: today, by: user.email ?? "Admin" });
      await actions.log(q.key, "Taxes — marquées remises", fmtMoney(toRemit));
      toast("Taxes marquées comme remises.", "success");
    } catch (err) {
      const msg = (err as { code?: string }).code === "permission-denied" ? "les règles Firestore pour « taxRemittances » ne sont pas encore publiées." : (err as Error).message;
      toast(`Impossible d'enregistrer : ${msg}`, "error", 8000);
    }
  }

  const row = (label: string, collected: number, paid: number, remit: number, total = false) => (
    <tr className={total ? styles.taxTotal : undefined}>
      <td><strong>{label}</strong></td>
      <td className={styles.good}>{fmtMoney(collected)}</td>
      <td className={styles.bad}>{fmtMoney(paid)}</td>
      <td className={total ? styles.remit : styles.strong}>{fmtMoney(remit)}</td>
    </tr>
  );

  return (
    <div className="page">
      <PageHeader eyebrow="Finances" title="Taxes TPS / TVQ" />
      <div className={styles.chips} role="group" aria-label="Trimestre">
        {quarters.map((x) => (
          <button key={x.key} className={styles.chip} aria-pressed={x.key === q.key} onClick={() => setKey(x.key)}>
            T{x.quarter} · {x.year}
            {remQ.data.some((r) => r.period === x.key) && <Check size={14} aria-label="remis" />}
          </button>
        ))}
      </div>

      {expQ.error || revQ.error ? (
        <EmptyState icon={ShieldCheck} title="Impossible de charger les données">
          {(expQ.error || revQ.error)?.message}
        </EmptyState>
      ) : expQ.loading || revQ.loading ? (
        <Spinner />
      ) : (
        <>
          <section className={styles.card} aria-label={`Trimestre ${q.quarter} ${q.year}`}>
            <h2 className={styles.cardTitle}>
              Trimestre {q.quarter} · {q.year}
              <span className={styles.rangeHint}>
                du {dayMonth(q.start)} au {dayMonth(q.end)} {q.year}
              </span>
            </h2>
            <div className={styles.list} style={{ border: 0 }}>
              <table className={styles.taxTable}>
                <thead>
                  <tr>
                    <th />
                    <th>Perçues</th>
                    <th>Payées</th>
                    <th>À remettre</th>
                  </tr>
                </thead>
                <tbody>
                  {row("TPS 5 %", t.tpsCollected, t.tpsPaid, t.tpsToRemit)}
                  {row("TVQ 9,975 %", t.tvqCollected, t.tvqPaid, t.tvqToRemit)}
                  {row("Total", t.tpsCollected + t.tvqCollected, t.tpsPaid + t.tvqPaid, toRemit, true)}
                </tbody>
              </table>
            </div>
            {toRemit < 0 && <p className={styles.hint}>Montant négatif : tu as payé plus de taxes que tu en as perçu — c'est un remboursement à demander.</p>}
            <div className={styles.dueBox}>
              <div>
                <div className={styles.hint}>DATE LIMITE DE REMISE</div>
                <div className={styles.strong}>
                  {longDate(q.due)}{" "}
                  {remits.length === 0 && (
                    <span className={daysLeft < 0 ? styles.bad : styles.dim}>
                      {daysLeft < 0 ? `· en retard de ${-daysLeft} j` : daysLeft === 0 ? "· aujourd'hui" : `· dans ${daysLeft} j`}
                    </span>
                  )}
                </div>
              </div>
              {remits.length > 0 ? (
                <span className={styles.paidTag}>
                  <Check size={14} aria-hidden /> Remis le {remits[0]!.paidAt} ({fmtMoney(Number(remits[0]!.amount) || 0)})
                </span>
              ) : (
                <Button onClick={() => void markRemitted()}>
                  <Check size={16} aria-hidden /> Marquer comme remis
                </Button>
              )}
            </div>
            {rulesMissing && (
              <p className={styles.formError} style={{ marginTop: 12 }}>
                <CircleAlert size={14} aria-hidden /> L'historique des remises n'est pas lisible : les règles Firestore pour « taxRemittances » doivent être publiées.
              </p>
            )}
          </section>

          <div className={styles.grid2} style={{ marginTop: 16 }}>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>
                <TrendingUp size={14} aria-hidden /> Revenus du trimestre
              </div>
              <div className={styles.kpiValue}>{fmtMoney(t.revenueTotal)}</div>
              <div className={styles.kpiSub}>{t.revenueCount} entrée(s) · avant taxes</div>
            </div>
            <div className={styles.kpi}>
              <div className={styles.kpiLabel}>
                <TrendingDown size={14} aria-hidden /> Dépenses du trimestre
              </div>
              <div className={styles.kpiValue}>{fmtMoney(t.expenseTotal)}</div>
              <div className={styles.kpiSub}>{t.expenseCount} entrée(s) · avant taxes</div>
            </div>
          </div>
          {remits.length > 1 && (
            <p className={styles.hint}>
              Remises enregistrées pour ce trimestre : {remits.map((r) => `${r.paidAt} (${fmtMoney(Number(r.amount) || 0)}, ${r.by ?? "?"})`).join(" · ")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
