import { useState } from "react";
import { Check } from "lucide-react";
import { fill, useMessages } from "@/core/i18n/i18n";
import { INV_MESSAGES } from "../inventaire.messages";
import styles from "../Inventaire.module.css";

/** Saisie du nouveau stock compté : Entrée ou ✓ pour enregistrer. */
export function StockInput({ productName, onCommit }: { productName: string; onCommit: (qty: number) => Promise<void> }) {
  const m = useMessages(INV_MESSAGES);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

  async function commit() {
    if (!valid || busy) return;
    setBusy(true);
    try {
      await onCommit(Number(value));
      setValue("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.stockInput}>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder={m.qty}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void commit();
          if (e.key === "Escape") setValue("");
        }}
        aria-label={fill(m.newStockFor, { name: productName })}
        disabled={busy}
      />
      <button onClick={() => void commit()} disabled={!valid || busy} aria-label={fill(m.saveStockFor, { name: productName })}>
        <Check size={16} />
      </button>
    </div>
  );
}
