import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { todayISO } from "@/core/dates";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { expensesIn, revenuesIn } from "../finances.logic";
import type { Expense, Revenue } from "../finances.types";
import { reportSummary, type ReportInput } from "../report";
import styles from "../Finances.module.css";

export function ReportModal({
  revenues,
  expenses,
  onClose,
  onExport,
}: {
  revenues: Revenue[];
  expenses: Expense[];
  onClose: () => void;
  onExport: (format: "xlsx" | "pdf", input: ReportInput) => Promise<void>;
}) {
  const today = todayISO();
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [incRev, setIncRev] = useState(true);
  const [incExp, setIncExp] = useState(true);
  const [busy, setBusy] = useState(false);
  const valid = !!start && !!end && start <= end && (incRev || incExp);
  const input: ReportInput = useMemo(
    () => ({ start, end, revenues: revenuesIn(revenues, start, end), expenses: expensesIn(expenses, start, end), includeRevenues: incRev, includeExpenses: incExp }),
    [start, end, revenues, expenses, incRev, incExp],
  );
  const s = reportSummary(input);

  async function go(format: "xlsx" | "pdf") {
    setBusy(true);
    try {
      await onExport(format, input);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Rapport personnalisé"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="secondary" onClick={() => void go("pdf")} disabled={!valid || busy}>
            <FileText size={16} aria-hidden /> PDF
          </Button>
          <Button onClick={() => void go("xlsx")} disabled={!valid || busy}>
            <FileSpreadsheet size={16} aria-hidden /> Excel
          </Button>
        </>
      }
    >
      <p className={styles.hint}>Exporte les revenus et dépenses d'une période pour ta comptable.</p>
      <div className={styles.row}>
        <TextField label="Du" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        <TextField label="Au" type="date" value={end} onChange={(e) => setEnd(e.target.value)} error={start > end ? "La fin doit être après le début." : null} />
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={incRev} onChange={(e) => setIncRev(e.target.checked)} /> Inclure les revenus
      </label>
      <label className={styles.check}>
        <input type="checkbox" checked={incExp} onChange={(e) => setIncExp(e.target.checked)} /> Inclure les dépenses
      </label>
      {valid && (
        <div className={styles.box} aria-live="polite">
          {incRev && (
            <div>
              {s.revCount} revenu(s) : <strong>{fmtMoney(s.rev)}</strong> avant taxes
            </div>
          )}
          {incExp && (
            <div>
              {s.expCount} dépense(s) : <strong>{fmtMoney(s.exp)}</strong> avant taxes
            </div>
          )}
          {incRev && incExp && (
            <div className={s.rev - s.exp >= 0 ? styles.good : styles.bad}>
              {s.rev - s.exp >= 0 ? "Profit" : "Déficit"} (avant taxes) : <strong>{fmtMoney(Math.abs(s.rev - s.exp))}</strong>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
