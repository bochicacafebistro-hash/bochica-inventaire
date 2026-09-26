import { useState } from "react";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { LEAVE_TYPES } from "../equipe.logic";
import type { Employee } from "../equipe.types";
import { dayRange } from "../horaire.logic";
import styles from "../Horaire.module.css";

export interface TimeOffSave {
  emp: Employee;
  days: string[];
  type: string;
  note: string;
}

/** Congé saisi par l'admin sur une plage de dates (les quarts ces jours-là sont retirés). */
export function TimeOffModal({ emp, dk, employees, onClose, onSave }: { emp: Employee | null; dk: string; employees: Employee[]; onClose: () => void; onSave: (s: TimeOffSave) => Promise<void> }) {
  const [empId, setEmpId] = useState(emp?.id ?? "");
  const [start, setStart] = useState(dk);
  const [end, setEnd] = useState(dk);
  const [type, setType] = useState("vacances");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const target = emp ?? employees.find((e) => e.id === empId) ?? null;
  const days = dayRange(start, end);
  const shiftsLost = target ? days.filter((d) => target.shifts?.[d]?.start && target.shifts?.[d]?.end).length : 0;

  async function save() {
    if (!target) return setError("Choisis un employé.");
    if (!days.length) return setError("La date de fin doit être après la date de début.");
    setSaving(true);
    try {
      await onSave({ emp: target, days, type, note: note.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title="Ajouter un congé"
      onClose={onClose}
      width={480}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <p className={styles.hint}>Les journées choisies sont verrouillées : aucun quart ne peut y être copié ou déplacé.</p>
        {emp ? (
          <div className={styles.modalWho}>
            <strong>{emp.name}</strong>
          </div>
        ) : (
          <SelectField label="Employé" value={empId} onChange={(e) => (setEmpId(e.target.value), setError(null))} options={[{ value: "", label: "— Choisir —" }, ...employees.map((e) => ({ value: e.id, label: e.name ?? "" }))]} autoFocus />
        )}
        <div className={styles.row2}>
          <TextField label="Du" type="date" value={start} onChange={(e) => (setStart(e.target.value), end < e.target.value && setEnd(e.target.value))} />
          <TextField label="Au" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)} options={LEAVE_TYPES.map((l) => ({ value: l.id, label: l.label }))} />
        <TextField label="Note (optionnel)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="ex. demandé le 1er mai" />
        {days.length > 0 && (
          <p className={styles.hint}>
            {days.length} jour(s){shiftsLost ? ` · ${shiftsLost} quart(s) déjà prévu(s) seront retirés` : ""}
          </p>
        )}
        {error && (
          <p className={styles.errBox} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
