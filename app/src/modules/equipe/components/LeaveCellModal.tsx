import { useState } from "react";
import { Link } from "react-router";
import { Clock, Trash2 } from "lucide-react";
import { isoToDate } from "@/core/dates";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { LEAVE_TYPES, leaveMeta } from "../equipe.logic";
import type { Employee } from "../equipe.types";
import styles from "../Horaire.module.css";

/** Clic sur une journée en congé : modifier/retirer (congé manuel) ou renvoyer vers la demande. */
export function LeaveCellModal({
  emp,
  dk,
  leave,
  onClose,
  onUpdate,
  onRemove,
  onAddHours,
}: {
  emp: Employee;
  dk: string;
  leave: { type?: string; note?: string; fromRequest?: boolean };
  onClose: () => void;
  onUpdate: (type: string, note: string) => Promise<void>;
  onRemove: () => Promise<void>;
  onAddHours: () => void;
}) {
  const [type, setType] = useState(leave.type ?? "vacances");
  const [note, setNote] = useState(leave.note ?? "");
  const label = isoToDate(dk)!.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  const fromReq = !!leave.fromRequest;

  return (
    <Modal
      open
      title={`${fromReq ? "Congé approuvé" : "Congé"} — ${emp.name}`}
      onClose={onClose}
      width={460}
      footer={
        fromReq ? (
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => void onRemove()}>
              <Trash2 size={16} aria-hidden /> Retirer le congé
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={() => void onUpdate(type, note.trim())}>Enregistrer</Button>
          </>
        )
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className={styles.modalWho} style={{ textTransform: "capitalize" }}>
          {label}
        </div>
        {fromReq ? (
          <p className={styles.hint}>
            Congé approuvé par une demande ({leaveMeta(leave.type).label}
            {leave.note ? ` — ${leave.note}` : ""}). Le type, la note ou l'annulation se gèrent dans <Link to="/demandes-conge">Demandes de congé</Link>.
          </p>
        ) : (
          <>
            <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)} options={LEAVE_TYPES.map((l) => ({ value: l.id, label: l.label }))} />
            <TextField label="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} />
          </>
        )}
        <Button variant="secondary" onClick={onAddHours}>
          <Clock size={16} aria-hidden /> Ajouter des heures quand même
        </Button>
      </div>
    </Modal>
  );
}
