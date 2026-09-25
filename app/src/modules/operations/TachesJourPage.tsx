import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Clock, Copy, Info, ListChecks, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { useToday } from "@/core/useToday";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { DailyTaskModal } from "./components/DailyTaskModal";
import { dailyFields, isOnce, nextSortOrder, occurrences, sortForAdmin, taskBucket, taskTimes, type Bucket } from "./ops.logic";
import type { DailyTask } from "./ops.types";
import styles from "./Ops.module.css";

const COL = "dailyTasks";

/** Admin : définition des tâches du jour (récurrentes / temps mort). */
export default function TachesJourPage() {
  const q = useCollection<DailyTask>(COL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const today = useToday();
  const [editing, setEditing] = useState<{ task: DailyTask | null } | null>(null);
  const sorted = useMemo(() => sortForAdmin(q.data), [q.data]);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function save(f: ReturnType<typeof dailyFields>) {
    const target = editing?.task;
    try {
      if (target) {
        await actions.update(COL, target.id, f);
        await actions.log(f.title, "Tâche du jour — modifiée");
      } else {
        await actions.create(COL, { ...f, sortOrder: nextSortOrder(q.data), done: false, lastCompletedDate: null });
        await actions.log(f.title, "Tâche du jour — ajoutée");
      }
      toast("Tâche enregistrée.", "success");
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(t: DailyTask) {
    const times = taskTimes(t);
    try {
      await actions.create(COL, {
        title: `${t.title ?? ""} (Copie)`,
        type: isOnce(t) ? "once" : "recurring",
        bucket: taskBucket(t),
        time: (t.time ?? "").trim(),
        note: t.note ?? "",
        ...(times ? { times } : {}),
        sortOrder: nextSortOrder(q.data),
        done: false,
        doneDate: null,
        doneBy: null,
        lastCompletedDate: null,
        lastCompletedBy: null,
        dayState: null,
      });
      toast("Tâche dupliquée.", "success");
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function move(t: DailyTask) {
    const target: Bucket = taskBucket(t) === "idle" ? "recurrent" : "idle";
    try {
      await actions.update(COL, t.id, { bucket: target });
      toast(target === "idle" ? "Déplacée vers Temps mort." : "Déplacée vers Récurrentes.", "success");
    } catch (err) {
      fail("Déplacement")(err);
    }
  }

  async function remove(t: DailyTask) {
    const ok = await confirm({ title: "Supprimer la tâche ?", message: `« ${t.title} » sera supprimée définitivement.`, danger: true });
    if (!ok) return;
    try {
      await actions.remove(COL, t.id);
      await actions.log(t.title ?? "", "Tâche du jour — supprimée");
      toast("Tâche supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  const row = (t: DailyTask) => {
    const occ = occurrences(t, today);
    const done = occ.filter((o) => o.done).length;
    const all = done === occ.length;
    const times = taskTimes(t);
    const timesLabel = times ? times.filter(Boolean).join(" · ") : (t.time ?? "").trim();
    return (
      <div key={t.id} className={styles.adminItem}>
        <span className={`${styles.status} ${all ? styles.statusDone : ""}`} title={all ? "Faite aujourd'hui" : "Pas encore faite aujourd'hui"}>
          {times ? `${done}/${occ.length}` : all ? <Check size={14} strokeWidth={3} /> : null}
          <span className="visually-hidden">{all ? "faite aujourd'hui" : "pas encore faite"}</span>
        </span>
        <div>
          <div className={styles.itemTitle}>
            {t.title || "—"}
            {timesLabel && (
              <span className={styles.time}>
                <Clock size={11} aria-hidden /> {timesLabel}
              </span>
            )}
            {times && times.length > 1 && <span className={styles.tag}>{times.length}×/jour</span>}
            {isOnce(t) && <span className={styles.tag}>1 fois</span>}
          </div>
          {t.note && <div className={styles.itemNote}>{t.note}</div>}
        </div>
        <ActionMenu
          label={`Actions pour ${t.title}`}
          items={[
            { label: "Modifier", icon: <Pencil size={16} />, onSelect: () => setEditing({ task: t }) },
            { label: "Dupliquer", icon: <Copy size={16} />, onSelect: () => void duplicate(t) },
            { label: taskBucket(t) === "idle" ? "Déplacer vers Récurrentes" : "Déplacer vers Temps mort", icon: <ArrowLeftRight size={16} />, onSelect: () => void move(t) },
            { label: "Supprimer", icon: <Trash2 size={16} />, danger: true, onSelect: () => void remove(t) },
          ]}
        />
      </div>
    );
  };

  const column = (bucket: Bucket, Icon: typeof Clock, title: string, empty: string) => {
    const list = sorted.filter((t) => taskBucket(t) === bucket);
    return (
      <section className={styles.card} aria-label={title}>
        <h2 className={styles.cardTitle}>
          <Icon size={18} aria-hidden /> {title} <span className={styles.count}>{list.length}</span>
        </h2>
        {list.length === 0 ? <p className={styles.empty}>{empty}</p> : <div className={styles.list}>{list.map(row)}</div>}
      </section>
    );
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="RH & Horaires"
        title="Tâches du jour"
        actions={
          <Button onClick={() => setEditing({ task: null })}>
            <Plus size={16} aria-hidden /> Nouvelle tâche
          </Button>
        }
      />
      <p className={styles.intro}>
        <Info size={14} aria-hidden style={{ verticalAlign: "-2px" }} /> Ces tâches s'affichent sur l'accueil et la page « Tâches » des employés, qui les cochent. Les récurrentes reviennent chaque jour (le coché
        se remet à zéro à minuit) ; les tâches « 1 fois » disparaissent le lendemain du jour où elles sont faites. Plusieurs heures = plusieurs passages à cocher dans la journée.
      </p>
      {q.error ? (
        <EmptyState icon={ListChecks} title="Impossible de charger les tâches">
          {q.error.message}
        </EmptyState>
      ) : q.loading ? (
        <Spinner />
      ) : (
        <div className={styles.grid2}>
          {column("recurrent", RefreshCw, "Tâches récurrentes", "Aucune tâche récurrente. Clique « Nouvelle tâche ».")}
          {column("idle", Clock, "Temps mort", "Aucune tâche de temps mort.")}
        </div>
      )}
      {editing && <DailyTaskModal task={editing.task} onClose={() => setEditing(null)} onSave={save} />}
    </div>
  );
}
