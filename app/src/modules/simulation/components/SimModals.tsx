import { useState } from "react";
import { Trash2 } from "lucide-react";
import { normalizeTime } from "@/core/time";
import { TimeField } from "@/modules/equipe/components/TimeField";
import { fmtHours, hoursFromShift } from "@/modules/equipe/horaire.logic";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import h from "@/modules/equipe/Horaire.module.css";
import type { SimShift } from "../sim.types";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function Foot({ onClose, onSave, busy, label, left }: { onClose: () => void; onSave: () => void; busy: boolean; label: string; left?: React.ReactNode }) {
  return (
    <>
      {left}
      <span style={{ flex: 1 }} />
      <Button variant="secondary" onClick={onClose}>
        Annuler
      </Button>
      <Button onClick={onSave} disabled={busy}>
        {busy ? "Enregistrement…" : label}
      </Button>
    </>
  );
}

const useBusy = () => {
  const [busy, setBusy] = useState(false);
  const run = (fn: () => Promise<unknown>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
};

export interface SimMetaSave {
  name: string;
  description: string;
  weekOffset: number;
}

/** Nouvelle simulation (nom, contexte, semaine copiée) ou renommer. */
export function SimMetaModal({ initial, create, weekOptions, onClose, onSave }: { initial?: { name?: string; description?: string }; create: boolean; weekOptions?: { value: number; label: string }[]; onClose: () => void; onSave: (s: SimMetaSave) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [week, setWeek] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const save = run(async () => {
    if (!name.trim()) return setError(create ? "Donne un nom à ta simulation." : "Le nom est obligatoire.");
    await onSave({ name: name.trim(), description: description.trim(), weekOffset: Number(week) });
  });
  return (
    <Modal open title={create ? "Nouvelle simulation" : "Modifier la simulation"} onClose={onClose} width={500} footer={<Foot onClose={onClose} onSave={() => void save()} busy={busy} label={create ? "Créer" : "Enregistrer"} />}>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        {create && (
          <p className={h.hint} style={{ margin: 0 }}>
            On copie l'horaire planifié (employés, taux, quarts), les heures de service et la répartition des pourboires. Tu pourras ensuite tout modifier sans toucher aux vraies données.
          </p>
        )}
        <TextField label="Nom de la simulation" required value={name} onChange={(e) => (setName(e.target.value), setError(null))} placeholder="ex. Embauche serveuse été" autoFocus error={error} />
        <TextArea label="Description / contexte (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ex. Impact d'une hausse de 2 $/h pour le service" rows={3} />
        {create && weekOptions && <SelectField label="Horaire à copier" value={week} onChange={(e) => setWeek(e.target.value)} options={weekOptions.map((o) => ({ value: String(o.value), label: o.label }))} />}
      </div>
    </Modal>
  );
}

/** Employé fictif (future embauche) : existe seulement dans la simulation. */
export function FictionalModal({ onClose, onSave }: { onClose: () => void; onSave: (x: { name: string; section: string; hourlyRate: number }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("service");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const save = run(async () => {
    if (!name.trim()) return setError("Donne un nom à l'employé.");
    await onSave({ name: name.trim(), section, hourlyRate: Number(rate.replace(",", ".")) || 0 });
  });
  return (
    <Modal open title="Ajouter un employé fictif" onClose={onClose} width={460} footer={<Foot onClose={onClose} onSave={() => void save()} busy={busy} label="Ajouter" />}>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <p className={h.hint} style={{ margin: 0 }}>
          Il existe <strong>seulement dans cette simulation</strong> — utile pour tester une future embauche.
        </p>
        <TextField label="Nom" required value={name} onChange={(e) => (setName(e.target.value), setError(null))} placeholder="ex. Nouvelle serveuse" autoFocus error={error} />
        <SelectField
          label="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          options={[
            { value: "service", label: "Service" },
            { value: "cuisine", label: "Cuisine" },
            { value: "other", label: "Autre" },
          ]}
        />
        <TextField label="Taux horaire ($/h)" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex. 17,50" />
      </div>
    </Modal>
  );
}

export interface SimShiftSave {
  toDow: number;
  shift: SimShift;
}

/** Ajouter / modifier / déplacer un quart d'une journée type (plusieurs quarts possibles). */
export function SimShiftModal({
  name,
  dow,
  index,
  existing,
  count,
  openDays,
  onClose,
  onSave,
  onDelete,
}: {
  name: string;
  dow: number;
  index: number; // -1 = nouveau quart
  existing: SimShift | null;
  count: number; // quarts déjà ce jour-là
  openDays: number[];
  onClose: () => void;
  onSave: (s: SimShiftSave) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [start, setStart] = useState(existing?.start ?? "");
  const [end, setEnd] = useState(existing?.end ?? "");
  const [toDow, setToDow] = useState(String(dow));
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const ns = normalizeTime(start);
  const ne = normalizeTime(end);
  const hours = ns && ne ? hoursFromShift({ start: ns, end: ne }) : 0;
  const save = run(async () => {
    if (ns === null || ne === null) return setError("Heure invalide — ex. 17:04, 17h, 1704.");
    if (!ns || !ne) return setError("Saisis l'entrée et la sortie.");
    await onSave({ toDow: Number(toDow), shift: { start: ns, end: ne } });
  });
  return (
    <Modal
      open
      title={existing ? "Modifier le quart" : "Ajouter un quart"}
      onClose={onClose}
      width={460}
      footer={
        <Foot
          onClose={onClose}
          onSave={() => void save()}
          busy={busy}
          label={existing ? "Enregistrer" : "Ajouter"}
          left={
            existing && (
              <Button variant="ghost" onClick={run(onDelete)} disabled={busy}>
                <Trash2 size={16} aria-hidden /> Supprimer
              </Button>
            )
          }
        />
      }
    >
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className={h.modalWho}>
          <strong>{name}</strong> · {DAYS[dow]}
          {count > 1 || (!existing && count > 0) ? ` · quart ${existing ? index + 1 : count + 1}` : ""}
        </div>
        <div className={h.row2}>
          <TimeField label="Entrée" value={start} onChange={(v) => (setStart(v), setError(null))} />
          <TimeField label="Sortie" value={end} onChange={(v) => (setEnd(v), setError(null))} />
        </div>
        <div className={h.hint}>{hours ? `${fmtHours(hours)} h${ns && ne && ne <= ns ? " (passe minuit)" : ""}` : "Plusieurs quarts possibles le même jour (ex. 12:00–14:00 puis 17:00–21:00)."}</div>
        {existing && (
          <SelectField label="Jour (pour déplacer le quart)" value={toDow} onChange={(e) => setToDow(e.target.value)} options={openDays.map((d) => ({ value: String(d), label: DAYS[d]! }))} />
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
