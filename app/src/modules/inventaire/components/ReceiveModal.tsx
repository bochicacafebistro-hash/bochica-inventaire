import { useState } from "react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { isBox, orderLabel, receivePreview, stockOf } from "../inventaire.logic";
import type { Product } from "../inventaire.types";

export function ReceiveModal({
  product,
  onClose,
  onConfirm,
}: {
  product: Product;
  onClose: () => void;
  onConfirm: (qty: number) => Promise<void>;
}) {
  const [qty, setQty] = useState(String(product.orderQty ?? 0));
  const [busy, setBusy] = useState(false);
  const box = isBox(product);
  const n = Number(qty);
  const valid = qty.trim() !== "" && Number.isFinite(n) && n >= 0;
  const prev = receivePreview(product, valid ? n : 0);

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    try {
      await onConfirm(n);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={`Réception — ${product.name}`}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void confirm()} disabled={!valid || busy}>
            Confirmer la réception
          </Button>
        </>
      }
    >
      <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-md)", padding: "var(--sp-3)", fontSize: "var(--fs-sm)" }}>
        Stock actuel : <strong>{stockOf(product)} unités</strong>
        <br />
        Commande prévue : <strong>{orderLabel(product)}</strong>
        {box && ` (${prev.expected} unités)`}
      </div>
      <TextField
        label={box ? "Boîtes reçues" : "Unités reçues"}
        type="number"
        min={0}
        step="any"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        hint={box ? `${product.unitsPerBox || 1} unités par boîte` : undefined}
        error={valid ? null : "Nombre positif ou zéro."}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") void confirm();
        }}
      />
      {valid && (
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--text2)" }} aria-live="polite">
          Ajoute <strong>{prev.units} unité{prev.units !== 1 ? "s" : ""}</strong> → nouveau stock : <strong>{prev.newStock}</strong>
          {prev.diff !== 0 && (
            <div style={{ color: prev.diff < 0 ? "var(--status-red)" : "var(--status-green)", marginTop: 4 }}>
              {prev.diff < 0 ? `▼ ${-prev.diff} unités de moins que prévu` : `▲ ${prev.diff} unités de plus que prévu`}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
