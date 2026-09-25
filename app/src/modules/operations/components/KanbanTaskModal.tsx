import { useState, type FormEvent } from "react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import { PRIORITIES, TASK_COLS } from "../ops.logic";
import type { KanbanTask } from "../ops.types";
import styles from "../Ops.module.css";

export interface KanbanFields {
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
}

export function KanbanTaskModal({ task, defaultStatus, names, onClose, onSave }: { task: KanbanTask | null; defaultStatus: string; names: string[]; onClose: () => void; onSave: (f: KanbanFields) => Promise<void> }) {
  const [f, setF] = useState<KanbanFields>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? defaultStatus,
    priority: task?.priority ?? "moyenne",
    assignedTo: task?.assignedTo ?? "",
    dueDate: task?.dueDate ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<KanbanFields>) => setF((x) => ({ ...x, ...p }));
  // Personne assignée qui n'est plus dans la liste (archivée) : on la garde.
  const people = f.assignedTo && !names.includes(f.assignedTo) ? [f.assignedTo, ...names] : names;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return setError("Entre un titre.");
    setSaving(true);
    try {
      await onSave({ ...f, title: f.title.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={task ? "Modifier la tâche" : "Ajouter une tâche"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="kanban-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="kanban-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <TextField label="Titre" required value={f.title} onChange={(e) => (set({ title: e.target.value }), setError(null))} error={error} autoFocus />
        <TextArea label="Description" rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        <div className={styles.row}>
          <SelectField label="Statut" value={f.status} onChange={(e) => set({ status: e.target.value })} options={TASK_COLS.map((c) => ({ value: c, label: c }))} />
          <SelectField label="Priorité" value={f.priority} onChange={(e) => set({ priority: e.target.value })} options={PRIORITIES.map((p) => ({ value: p.key, label: p.label }))} />
        </div>
        <div className={styles.row}>
          <SelectField label="Assignée à" value={f.assignedTo} onChange={(e) => set({ assignedTo: e.target.value })} options={[{ value: "", label: "— Personne —" }, ...people.map((n) => ({ value: n, label: n }))]} />
          <TextField label="Date limite" type="date" value={f.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
        </div>
      </form>
    </Modal>
  );
}
