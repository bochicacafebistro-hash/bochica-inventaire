import { useMemo, useState } from "react";
import { deleteField } from "firebase/firestore";
import { Check, ClipboardList, Info, Moon, Pencil, Sun, Users, Utensils } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useDataActions } from "@/core/data/useDataActions";
import { useDocument } from "@/core/data/useDocument";
import { fill, useMessages } from "@/core/i18n/i18n";
import { useToday } from "@/core/useToday";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { OpenCloseEditor } from "./components/OpenCloseEditor";
import { normalizeList } from "./ops.logic";
import { OPS_MESSAGES } from "./ops.messages";
import type { ChecklistItem } from "./ops.types";
import styles from "./Ops.module.css";

type ListKey = "opening" | "closing";
type Section = ChecklistItem["section"];
interface DayState {
  opening?: Record<string, boolean>;
  closing?: Record<string, boolean>;
}

const SECTION_KEY = "bochica-oc-section";
const readSection = (): Section => {
  try {
    return localStorage.getItem(SECTION_KEY) === "service" ? "service" : "cuisine";
  } catch {
    return "cuisine";
  }
};

/** Listes d'ouverture / fermeture, cochables par tous, remises à zéro chaque jour. */
export default function OuvertureFermeturePage() {
  const m = useMessages(OPS_MESSAGES);
  const user = useSessionUser();
  const isAdmin = user.role === "global_admin";
  const today = useToday();
  const listsQ = useDocument<{ opening?: unknown; closing?: unknown }>("settings", "openClose");
  const stateQ = useDocument<DayState>("dailyChecklistState", today);
  const actions = useDataActions();
  const toast = useToast();
  const [section, setSectionState] = useState<Section>(readSection);
  const [editing, setEditing] = useState(false);

  const setSection = (s: Section) => {
    setSectionState(s);
    try {
      localStorage.setItem(SECTION_KEY, s); // la tablette cuisine reste sur « Cuisine »
    } catch {
      /* ignore */
    }
  };

  const lists = useMemo(() => ({ opening: normalizeList(listsQ.data?.opening), closing: normalizeList(listsQ.data?.closing) }), [listsQ.data]);
  const isDone = (list: ListKey, id: string) => !!stateQ.data?.[list]?.[id];

  async function toggle(list: ListKey, id: string) {
    const done = isDone(list, id);
    try {
      await actions.setFixed("dailyChecklistState", today, { date: today, [list]: { [id]: done ? deleteField() : true }, updatedAt: Date.now() });
    } catch (err) {
      toast(fill(m.toggleError, { msg: (err as Error).message }), "error");
    }
  }

  const progress = (s: Section) => {
    const o = lists.opening.filter((i) => i.section === s);
    const c = lists.closing.filter((i) => i.section === s);
    return { done: o.filter((i) => isDone("opening", i.id)).length + c.filter((i) => isDone("closing", i.id)).length, total: o.length + c.length };
  };

  const column = (list: ListKey, title: string, Icon: typeof Sun, empty: string, cls: string) => {
    const items = lists[list].filter((i) => i.section === section);
    const done = items.filter((i) => isDone(list, i.id)).length;
    return (
      <section className={`${styles.card} ${cls}`} aria-label={title}>
        <h2 className={styles.cardTitle}>
          <Icon size={18} aria-hidden /> {title}
          {items.length > 0 && <span className={`${styles.progress} ${done === items.length ? styles.progressDone : ""}`}>{done === items.length ? m.allDone : `${done}/${items.length}`}</span>}
        </h2>
        {items.length === 0 ? (
          <p className={styles.empty}>{empty}</p>
        ) : (
          <div className={styles.list}>
            {items.map((it) => {
              const d = isDone(list, it.id);
              return (
                <button key={it.id} type="button" className={styles.check} aria-pressed={d} onClick={() => void toggle(list, it.id)} title={d ? m.uncheck : m.markDone}>
                  <span className={styles.box} aria-hidden>
                    {d && <Check size={16} strokeWidth={3} />}
                  </span>
                  <span className={styles.label}>
                    <span className={styles.labelText}>{it.text}</span>
                  </span>
                  <span />
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const switchBtn = (s: Section, Icon: typeof Sun, label: string) => {
    const p = progress(s);
    return (
      <button role="tab" aria-selected={section === s} className={styles.switchBtn} onClick={() => setSection(s)}>
        <Icon size={22} aria-hidden /> {label}
        {p.total > 0 && <span className={styles.switchCount}>{p.done}/{p.total}</span>}
      </button>
    );
  };

  return (
    <div className="page">
      <PageHeader
        title={m.ocTitle}
        actions={
          isAdmin && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden /> {m.editLists}
            </Button>
          )
        }
      />
      {listsQ.error ? (
        <EmptyState icon={ClipboardList} title={m.ocTitle}>
          {listsQ.error.message}
        </EmptyState>
      ) : listsQ.loading ? (
        <Spinner />
      ) : (
        <>
          <div className={styles.switch} role="tablist" aria-label={m.sectionSwitch}>
            {switchBtn("cuisine", Utensils, m.kitchen)}
            {switchBtn("service", Users, m.service)}
          </div>
          <div className={styles.grid2}>
            {column("opening", m.opening, Sun, m.openingEmpty, styles.colOpen!)}
            {column("closing", m.closing, Moon, m.closingEmpty, styles.colClose!)}
          </div>
          <p className={styles.note}>
            <Info size={14} aria-hidden /> {m.ocNote}
          </p>
        </>
      )}
      {editing && <OpenCloseEditor opening={lists.opening} closing={lists.closing} onClose={() => setEditing(false)} />}
    </div>
  );
}
