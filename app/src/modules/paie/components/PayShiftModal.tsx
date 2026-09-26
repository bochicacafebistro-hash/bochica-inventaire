import { useState } from "react";
import { RefreshCw, Undo2, UserX } from "lucide-react";
import { isoToDate } from "@/core/dates";
import { normalizeTime } from "@/core/time";
import { TimeField } from "@/modules/equipe/components/TimeField";
import { fmtHours, hoursFromShift } from "@/modules/equipe/horaire.logic";
import type { ActualShift } from "@/modules/pointage/punch.logic";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import h from "@/modules/equipe/Horaire.module.css";
import styles from "../Paie.module.css";

const dayLabel = (dk: string) => isoToDate(dk)!.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

export interface PayShiftSave {
  start: string;
  end: string;
  toDk: string;
}

/** Heures réellement travaillées d'un jour : saisir, corriger, déplacer, marquer absent, réinitialiser. */
export function PayShiftModal({
  name,
  dk,
  days,
  actual,
  planned,
  targetHas,
  onClose,
  onSave,
  onClear,
  onAbsent,
}: {
  name: string;
  dk: string;
  days: string[];
  actual: ActualShift | null;
  planned: { start?: string; end?: string } | null;
  targetHas: (dk: string) => ActualShift | null;
  onClose: () => void;
  onSave: (s: PayShiftSave) => Promise<void>;
  onClear: () => Promise<void>;
  onAbsent: () => Promise<void>;
}) {
  const [start, setStart] = useState(actual?.start ?? "");
  const [end, setEnd] = useState(actual?.end ?? "");
  const [toDk, setToDk] = useState(dk);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const isAbsent = !!actual?.markedAbsent;
  const hasShift = !!(actual?.start && actual.end);
  const hasEntry = !!(actual?.start || actual?.end);
  const ns = normalizeTime(start);
  const ne = normalizeTime(end);
  const hours = ns && ne ? hoursFromShift({ start: ns, end: ne }) : 0;
  const clash = toDk !== dk ? targetHas(toDk) : null;

  const run = (fn: () => Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const save = run(async () => {
    if (ns === null || ne === null) return setError("Heure invalide — ex. 17:04, 17h, 1704.");
    if (!ns || !ne) return setError("Saisis l'entrée et la sortie.");
    await onSave({ start: ns, end: ne, toDk });
  });

  return (
    <Modal
      open
      title={isAbsent ? "Cellule « Absent »" : hasShift ? "Modifier les heures" : "Saisir les heures"}
      onClose={onClose}
      width={500}
      footer={
        <>
          {isAbsent ? (
            <Button variant="ghost" onClick={run(onClear)} disabled={busy} title="La cellule redevient vide">
              <Undo2 size={16} aria-hidden /> Retirer absent
            </Button>
          ) : (
            <Button variant="ghost" onClick={run(onAbsent)} disabled={busy} title="L'employé n'est pas venu — aucune heure comptée">
              <UserX size={16} aria-hidden /> Marquer absent
            </Button>
          )}
          {hasEntry && !isAbsent && (
            <Button variant="ghost" onClick={() => setConfirmReset(true)} disabled={busy}>
              <RefreshCw size={16} aria-hidden /> Réinitialiser
            </Button>
          )}
          <span style={{ flex: 1 }} />
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Enregistrement…" : isAbsent ? "Saisir les heures" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className={h.modalWho}>
          <strong>{name}</strong> · <span style={{ textTransform: "capitalize" }}>{dayLabel(dk)}</span>
          {planned?.start && planned.end && (
            <span className={h.hint}>
              {" "}
              · prévu {planned.start} → {planned.end}
            </span>
          )}
        </div>
        {isAbsent && <p className={styles.bannerAbsent}>Employé absent — aucune heure comptée ce jour. Saisis des heures (ou « Retirer absent ») s'il est finalement venu.</p>}
        {actual?.autoFilled && <p className={h.warnBox}>Heures remplies automatiquement depuis l'horaire prévu — vérifie puis enregistre pour valider. S'il n'est pas venu, clique « Marquer absent ».</p>}
        <div className={h.row2}>
          <TimeField label="Entrée" value={start} onChange={(v) => (setStart(v), setError(null))} />
          <TimeField label="Sortie" value={end} onChange={(v) => (setEnd(v), setError(null))} />
        </div>
        <div className={h.hint}>{hours ? `${fmtHours(hours)} h${ns && ne && ne <= ns ? " (passe minuit)" : ""}` : "Tape l'heure exacte (17:04, 17h, 1704) ou choisis aux 15 min."}</div>
        {hasShift && (
          <SelectField label="Jour (pour déplacer les heures)" value={toDk} onChange={(e) => setToDk(e.target.value)} options={days.map((d) => ({ value: d, label: dayLabel(d) }))} />
        )}
        {clash?.start && clash.end && (
          <p className={h.warnBox}>
            Ce jour-là a déjà {clash.start} → {clash.end} : ces heures seront remplacées.
          </p>
        )}
        {confirmReset && (
          <div className={h.errBox}>
            Effacer l'entrée{actual?.start ? ` ${actual.start}` : ""} et la sortie{actual?.end ? ` ${actual.end}` : ""} ? L'employé pourra re-pointer.{" "}
            <Button variant="danger" onClick={run(onClear)} disabled={busy}>
              Réinitialiser la journée
            </Button>
          </div>
        )}
        {error && (
          <p className={h.errBox} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
