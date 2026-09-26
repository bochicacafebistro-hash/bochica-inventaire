import { useState } from "react";
import { Sun, Trash2 } from "lucide-react";
import { isoToDate } from "@/core/dates";
import { normalizeTime } from "@/core/time";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { hasShift } from "../equipe.logic";
import type { Employee, Shift } from "../equipe.types";
import { hoursFromShift, fmtHours } from "../horaire.logic";
import { TimeField } from "./TimeField";
import styles from "../Horaire.module.css";

export interface ShiftSave {
  empId: string;
  fromDk: string;
  toDk: string;
  shift: Shift;
}

const dayLabel = (dk: string) => isoToDate(dk)!.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

/**
 * Ajouter / modifier / déplacer un quart. Remplace le glisser-déposer de la v1
 * par un choix de jour (fonctionne aussi au clavier et sur tablette).
 */
export function ShiftModal({
  emp,
  dk,
  days,
  candidates,
  onLeave,
  onClose,
  onSave,
  onDelete,
  onMarkLeave,
}: {
  emp: Employee | null; // null = création (choisir l'employé)
  dk: string;
  days: string[];
  candidates: Employee[];
  onLeave: (empId: string, dk: string) => boolean;
  onClose: () => void;
  onSave: (s: ShiftSave) => Promise<void>;
  onDelete: (emp: Employee, dk: string) => Promise<void>;
  onMarkLeave: (emp: Employee, dk: string) => void;
}) {
  const existing = emp?.shifts?.[dk];
  const [empId, setEmpId] = useState(emp?.id ?? "");
  const [toDk, setToDk] = useState(dk);
  const [start, setStart] = useState(existing?.start ?? "");
  const [end, setEnd] = useState(existing?.end ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const target = emp ?? candidates.find((c) => c.id === empId) ?? null;
  const ns = normalizeTime(start);
  const ne = normalizeTime(end);
  const hours = ns && ne ? hoursFromShift({ start: ns, end: ne }) : 0;
  const targetOnLeave = !!target && onLeave(target.id, toDk);
  const clash = target && toDk !== dk && hasShift(target.shifts?.[toDk]) ? target.shifts![toDk]! : null;

  async function save() {
    if (!target) return setError("Choisis un employé.");
    if (ns === null || ne === null) return setError("Heure invalide — ex. 17:04, 17h, 1704.");
    if (!ns || !ne) return setError("Saisis l'entrée et la sortie.");
    if (toDk !== dk && targetOnLeave) return setError(`${target.name} est en congé ce jour-là : impossible d'y déplacer le quart.`);
    setSaving(true);
    try {
      await onSave({ empId: target.id, fromDk: dk, toDk, shift: { start: ns, end: ne } });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={emp && hasShift(existing) ? "Modifier le quart" : "Ajouter un quart"}
      onClose={onClose}
      width={480}
      footer={
        <>
          {emp && hasShift(existing) && (
            <Button variant="ghost" onClick={() => void onDelete(emp, dk)}>
              <Trash2 size={16} aria-hidden /> Supprimer
            </Button>
          )}
          {emp && !onLeave(emp.id, dk) && (
            <Button variant="ghost" onClick={() => onMarkLeave(emp, dk)}>
              <Sun size={16} aria-hidden /> Congé
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        {emp ? (
          <div className={styles.modalWho}>
            <strong>{emp.name}</strong> · <span style={{ textTransform: "capitalize" }}>{dayLabel(dk)}</span>
          </div>
        ) : (
          <SelectField
            label={`Employé — ${dayLabel(dk)}`}
            value={empId}
            onChange={(e) => (setEmpId(e.target.value), setError(null))}
            options={[{ value: "", label: "— Choisir —" }, ...candidates.map((c) => ({ value: c.id, label: `${c.name}${c.section === "cuisine" ? " (Cuisine)" : c.section === "service" || !c.section ? " (Service)" : ""}` }))]}
            autoFocus
          />
        )}
        {target && onLeave(target.id, dk) && toDk === dk && <p className={styles.warnBox}>Journée marquée congé — ces heures s'ajoutent quand même, le congé reste.</p>}
        <div className={styles.row2}>
          <TimeField label="Entrée" value={start} onChange={(v) => (setStart(v), setError(null))} />
          <TimeField label="Sortie" value={end} onChange={(v) => (setEnd(v), setError(null))} />
        </div>
        <div className={styles.hint}>{hours ? `${fmtHours(hours)} h${ns && ne && ne <= ns ? " (passe minuit)" : ""}` : "Tape l'heure (17:04, 17h, 1704) ou choisis dans la liste."}</div>
        {emp && hasShift(existing) && (
          <SelectField
            label="Jour (pour déplacer le quart)"
            value={toDk}
            onChange={(e) => (setToDk(e.target.value), setError(null))}
            options={days.map((d) => ({ value: d, label: dayLabel(d) }))}
          />
        )}
        {clash && <p className={styles.warnBox}>Ce jour-là a déjà un quart {clash.start}–{clash.end} : il sera remplacé.</p>}
        {error && (
          <p className={styles.errBox} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
