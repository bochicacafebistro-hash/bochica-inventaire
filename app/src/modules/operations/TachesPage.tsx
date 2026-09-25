import { useMemo, useState } from "react";
import { CalendarDays, ChevronRight, CircleCheck, ClipboardList, Copy, Pencil, Plus, RefreshCw, Trash2, User } from "lucide-react";
import { todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import type { Employee } from "@/modules/equipe/equipe.types";
import { KanbanTaskModal, type KanbanFields } from "./components/KanbanTaskModal";
import { nextStatus, TASK_COLS } from "./ops.logic";
import type { KanbanTask } from "./ops.types";
import styles from "./Ops.module.css";

const COL = "tasks";
const PRIO_COLOR: Record<string, string> = { haute: "var(--status-red)", moyenne: "#eda100", basse: "var(--status-green)" };
const PRIO_LABEL: Record<string, string> = { haute: "Priorité haute", moyenne: "Priorité moyenne", basse: "Priorité basse" };
const COL_ICON = { "À faire": ClipboardList, "En cours": RefreshCw, Complété: CircleCheck } as const;

/** Tâches Kanban (admin) — collection /tasks. */
export default function TachesPage() {
  const q = useCollection<KanbanTask>(COL);
  const empQ = useCollection<Employee>("employees");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState<{ task: KanbanTask | null; status: string } | null>(null);
  const names = useMemo(() => empQ.data.filter((e) => !e.archived).map((e) => e.name ?? "").filter(Boolean).sort((a, b) => a.localeCompare(b, "fr")), [empQ.data]);
  const today = todayISO();
  const pending = q.data.filter((t) => t.status !== "Complété").length;
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function save(f: KanbanFields) {
    const target = editing?.task;
    try {
      if (target) await actions.update(COL, target.id, f);
      else await actions.create(COL, f);
      await actions.log(f.title, target ? "Tâche — modifiée" : "Tâche — ajoutée", f.status);
      setEditing(null);
      toast("Tâche enregistrée.", "success");
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function advance(t: KanbanTask) {
    const next = nextStatus(t.status);
    try {
      await actions.update(COL, t.id, { status: next });
    } catch (err) {
      fail("Changement de colonne")(err);
    }
  }

  async function duplicate(t: KanbanTask) {
    const { id: _id, ...rest } = t;
    try {
      await actions.create(COL, { ...rest, title: `${t.title ?? ""} (copie)` });
      toast("Tâche dupliquée.", "success");
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function remove(t: KanbanTask) {
    const ok = await confirm({ title: "Supprimer la tâche ?", message: `« ${t.title} » sera supprimée définitivement.`, danger: true });
    if (!ok) return;
    try {
      await actions.remove(COL, t.id);
      await actions.log(t.title ?? "", "Tâche — supprimée");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={`RH & Horaires · ${pending} tâche(s) en attente`}
        title="Tâches"
        actions={
          <Button onClick={() => setEditing({ task: null, status: "À faire" })}>
            <Plus size={16} aria-hidden /> Tâche
          </Button>
        }
      />
      {q.error ? (
        <EmptyState icon={ClipboardList} title="Impossible de charger les tâches">
          {q.error.message}
        </EmptyState>
      ) : q.loading ? (
        <Spinner />
      ) : (
        <div className={styles.kanban}>
          {TASK_COLS.map((col) => {
            const items = q.data.filter((t) => (t.status ?? "À faire") === col || (col === "À faire" && !TASK_COLS.includes(t.status as (typeof TASK_COLS)[number])));
            const Icon = COL_ICON[col];
            return (
              <section key={col} className={styles.col} aria-label={col}>
                <div className={styles.colHead}>
                  <Icon size={15} aria-hidden /> {col} <span className={styles.count}>{items.length}</span>
                </div>
                {items.map((t) => (
                  <article key={t.id} className={styles.kCard}>
                    <div>
                      <div className={styles.kTitle}>
                        <span className={styles.prio} style={{ background: PRIO_COLOR[t.priority ?? ""] ?? "var(--text3)" }} title={PRIO_LABEL[t.priority ?? ""]} aria-label={PRIO_LABEL[t.priority ?? ""]} />
                        {t.title}
                      </div>
                      {t.description && <div className={styles.kDesc}>{t.description}</div>}
                      <div className={styles.kMeta}>
                        {t.assignedTo && (
                          <span>
                            <User size={11} aria-hidden /> {t.assignedTo}
                          </span>
                        )}
                        {t.dueDate && (
                          <span className={t.dueDate < today && col !== "Complété" ? styles.overdue : undefined}>
                            <CalendarDays size={11} aria-hidden /> {t.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.kActions}>
                      <ActionMenu
                        label={`Actions pour ${t.title}`}
                        items={[
                          { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setEditing({ task: t, status: t.status ?? "À faire" }) },
                          { label: "Dupliquer", icon: <Copy size={16} />, onSelect: () => void duplicate(t) },
                          { label: "Supprimer", icon: <Trash2 size={16} />, danger: true, onSelect: () => void remove(t) },
                        ]}
                      />
                      <button className={styles.nextBtn} onClick={() => void advance(t)} title={`Passer à « ${nextStatus(t.status)} »`}>
                        {nextStatus(t.status)} <ChevronRight size={12} aria-hidden />
                      </button>
                    </div>
                  </article>
                ))}
                <button className={styles.addBtn} onClick={() => setEditing({ task: null, status: col })}>
                  <Plus size={14} aria-hidden /> Ajouter
                </button>
              </section>
            );
          })}
        </div>
      )}
      {editing && <KanbanTaskModal task={editing.task} defaultStatus={editing.status} names={names} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
