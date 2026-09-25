import { Clock, Info, RefreshCw } from "lucide-react";
import { useMessages } from "@/core/i18n/i18n";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { DailyTaskCard } from "./components/DailyTaskCard";
import { taskBucket, type Bucket } from "./ops.logic";
import { OPS_MESSAGES } from "./ops.messages";
import { useDailyTasks } from "./useDailyTasks";
import styles from "./Ops.module.css";

/** Page employé « Tâches » : récurrentes / temps mort, cochables. */
export default function MesTachesPage() {
  const m = useMessages(OPS_MESSAGES);
  const { units, toggle, loading, error } = useDailyTasks();

  const section = (bucket: Bucket, Icon: typeof Clock, title: string, empty: string) => {
    const list = units.filter((u) => taskBucket(u.task) === bucket);
    const done = list.filter((u) => u.occ.done).length;
    return (
      <section className={styles.card} aria-label={title}>
        <h2 className={styles.cardTitle}>
          <Icon size={18} aria-hidden /> {title}
          {list.length > 0 && <span className={`${styles.progress} ${done === list.length ? styles.progressDone : ""}`}>{done}/{list.length}</span>}
        </h2>
        {list.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          <div className={styles.list}>
            {list.map((u) => (
              <DailyTaskCard key={`${u.task.id}-${u.occ.idx}`} unit={u} onToggle={(x) => void toggle(x)} />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="page">
      <PageHeader title={m.dailyTitle} />
      {error ? (
        <EmptyState icon={Clock} title={m.dailyTitle}>
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : (
        <>
          <div className={styles.grid2}>
            {section("recurrent", RefreshCw, m.secRecurrent, m.noRecurrentToday)}
            {section("idle", Clock, m.secIdle, m.noIdleToday)}
          </div>
          <p className={styles.note}>
            <Info size={14} aria-hidden /> {m.empTasksNote}
          </p>
        </>
      )}
    </div>
  );
}
