import { useState, type FormEvent } from "react";
import { longDate } from "@/core/dates";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  sameDayOthers,
  toDraft,
  toFields,
  validate,
  type BEvent,
  type DraftErrors,
  type EventDraft,
} from "./evenements.logic";
import styles from "./Evenements.module.css";

export function EventModal({
  ev,
  presetDate,
  all,
  onClose,
  onSave,
}: {
  ev: BEvent | null;
  presetDate?: string;
  all: BEvent[];
  onClose: () => void;
  onSave: (f: ReturnType<typeof toFields>) => Promise<void>;
}) {
  const [d, setD] = useState<EventDraft>(() => toDraft(ev, presetDate));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EventDraft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const others = d.status !== "annule" ? sameDayOthers(all, d.date, ev?.id) : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(d);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(toFields(d));
    } finally {
      setSaving(false);
    }
  }

  const row = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--sp-3)", alignItems: "start" } as const;

  return (
    <Modal
      open
      title={ev ? "Modifier l'événement" : "Nouvel événement"}
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="event-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Nom" required value={d.name} onChange={set("name")} error={errors.name} placeholder="ex. Anniversaire Mme Dupont" autoFocus />
        <div style={row}>
          <TextField label="Date" type="date" required value={d.date} onChange={set("date")} error={errors.date} />
          <TextField label="Heure (optionnel)" type="time" value={d.time} onChange={set("time")} />
        </div>
        {others.length > 0 && d.date && (
          <div className={styles.warn} role="status">
            Déjà ce jour-là ({longDate(d.date)}) : {others.map((o) => `${o.name}${o.time ? ` à ${o.time}` : ""}`).join(", ")}.
          </div>
        )}
        <div style={row}>
          <SelectField label="Type" value={d.type} onChange={set("type")} options={EVENT_TYPES.map((t) => ({ value: t.key, label: t.label }))} />
          <SelectField label="Statut" value={d.status} onChange={set("status")} options={EVENT_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
          <TextField label="Nombre de personnes" type="number" min={0} step={1} value={d.capacity} onChange={set("capacity")} error={errors.capacity} />
        </div>
        <TextField label="Nom du contact" value={d.contactName} onChange={set("contactName")} />
        <div style={row}>
          <TextField label="Téléphone" type="tel" value={d.contactPhone} onChange={set("contactPhone")} />
          <TextField label="Courriel" type="email" value={d.contactEmail} onChange={set("contactEmail")} error={errors.contactEmail} />
        </div>
        <TextArea label="Notes" value={d.notes} onChange={set("notes")} placeholder="Demandes particulières, menu, allergies, dépôt versé…" />
      </form>
    </Modal>
  );
}
