import { useState, type FormEvent } from "react";
import { parseTimes } from "@/core/time";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { dailyFields, toDailyDraft, type Bucket, type DailyTaskDraft } from "../ops.logic";
import type { DailyTask } from "../ops.types";
import styles from "../Ops.module.css";

export function DailyTaskModal({ task, onClose, onSave }: { task: DailyTask | null; onClose: () => void; onSave: (f: ReturnType<typeof dailyFields>) => Promise<void> }) {
  const [d, setD] = useState<DailyTaskDraft>(() => toDailyDraft(task));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<DailyTaskDraft>) => setD((x) => ({ ...x, ...p }));
  const parsed = parseTimes(d.times);
  const rawCount = d.times.split(/[,;\n]+/).filter((s) => s.trim()).length;
  const timesError = rawCount > parsed.length ? `Heure non reconnue (formats acceptés : 17:00, 17h, 1700).` : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!d.title.trim()) return setError("Entre un intitulé de tâche.");
    if (timesError) return;
    setSaving(true);
    try {
      await onSave(dailyFields(d, parsed));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={task ? "Modifier la tâche" : "Nouvelle tâche du jour"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="daily-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="daily-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Intitulé de la tâche" required value={d.title} onChange={(e) => (set({ title: e.target.value }), setError(null))} error={error} placeholder="Ex. Vérifier les températures du frigo" autoFocus />
        <div className={styles.row}>
          <SelectField
            label="Catégorie"
            value={d.bucket}
            onChange={(e) => set({ bucket: e.target.value as Bucket })}
            options={[
              { value: "recurrent", label: "Récurrente" },
              { value: "idle", label: "Temps mort" },
            ]}
          />
          <TextField
            label="Heure(s) (optionnel)"
            value={d.times}
            onChange={(e) => set({ times: e.target.value })}
            placeholder="ex. 12:00, 17:00, 21:00"
            error={timesError}
            hint={d.once ? "Une tâche « 1 fois » garde seulement la 1re heure." : parsed.length > 1 ? `${new Set(parsed).size} passages à cocher : ${[...new Set(parsed)].sort().join(" · ")}` : "Plusieurs heures = à faire plusieurs fois par jour."}
          />
        </div>
        <label className={styles.checkLine}>
          <input type="checkbox" checked={d.once} onChange={(e) => set({ once: e.target.checked })} /> À faire une seule fois (disparaît une fois faite)
        </label>
        <TextArea label="Détails / commentaire (optionnel)" rows={3} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Ex. Utiliser le produit désinfectant sous l'évier" />
      </form>
    </Modal>
  );
}
