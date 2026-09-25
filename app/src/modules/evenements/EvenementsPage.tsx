import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { calendarGrid, isoToDate, longDate, monthBounds, monthName, todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { Button } from "@/ui/Button";
import { useChartTheme } from "@/ui/chartTheme";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Segmented } from "@/ui/Segmented";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { byDate, EVENT_TYPES, filterEvents, inRange, typeLabel, upcoming, type BEvent, type toFields } from "./evenements.logic";
import { EventCard } from "./EventCard";
import { EventModal } from "./EventModal";
import { TypeIcon, typeColor } from "./typeMeta";
import styles from "./Evenements.module.css";

const COL = "events";
type View = "calendar" | "month" | "upcoming";
const DOWS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function EvenementsPage() {
  const user = useSessionUser();
  const canEdit = user.role === "global_admin" || user.role === "chef";
  const { data, loading, error } = useCollection<BEvent>(COL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const { series } = useChartTheme();

  const [view, setView] = useState<View>("calendar");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const today = todayISO();
  const [selected, setSelected] = useState(today);
  const [editing, setEditing] = useState<{ ev: BEvent | null; date?: string } | null>(null);

  const filtered = useMemo(() => filterEvents(data, type, query), [data, type, query]);
  const month = monthBounds(offset);
  const dayMap = useMemo(() => byDate(filtered), [filtered]);
  const color = (t?: string) => typeColor(series, t);

  async function save(f: ReturnType<typeof toFields>) {
    const target = editing?.ev;
    try {
      if (target) {
        await actions.update(COL, target.id, f);
        await actions.log(f.name, "Événement — modifié", `${typeLabel(f.type)} · ${longDate(f.date)}`);
      } else {
        await actions.create(COL, f);
        await actions.log(f.name, "Événement — ajouté", `${typeLabel(f.type)} · ${longDate(f.date)}`);
      }
      toast(target ? "Événement modifié." : "Événement ajouté.", "success");
      setSelected(f.date);
      setEditing(null);
    } catch (err) {
      toast(`Enregistrement impossible : ${(err as Error).message}`, "error");
    }
  }

  async function duplicate(ev: BEvent) {
    try {
      const { id: _id, ...rest } = ev;
      const name = `${ev.name ?? ""} (copie)`;
      const id = await actions.create(COL, { ...rest, name });
      await actions.log(name, "Dupliqué", `Depuis « ${ev.name ?? ""} »`);
      setEditing({ ev: { ...ev, id, name } });
    } catch (err) {
      toast(`Duplication impossible : ${(err as Error).message}`, "error");
    }
  }

  async function remove(ev: BEvent) {
    if (!(await confirm({ title: "Supprimer l'événement", danger: true, message: `Supprimer « ${ev.name} » (${longDate(ev.date ?? "")}) ?` }))) return;
    try {
      await actions.remove(COL, ev.id);
      await actions.log(ev.name ?? "—", "Événement — supprimé");
      toast("Événement supprimé.", "success");
    } catch (err) {
      toast(`Suppression impossible : ${(err as Error).message}`, "error");
    }
  }

  const cards = (list: BEvent[]) => (
    <div className={styles.cards}>
      {list.map((ev) => (
        <EventCard
          key={ev.id}
          ev={ev}
          color={color(ev.type)}
          canEdit={canEdit}
          onEdit={() => setEditing({ ev })}
          onDuplicate={() => void duplicate(ev)}
          onDelete={() => void remove(ev)}
        />
      ))}
    </div>
  );

  const monthTitle = `${monthName(month.month).charAt(0).toUpperCase()}${monthName(month.month).slice(1)} ${month.year}`;
  const monthNav = (
    <div className={styles.calHead}>
      <button className={styles.navBtn} onClick={() => setOffset((o) => o - 1)} aria-label="Mois précédent">
        <ChevronLeft size={16} />
      </button>
      <h2 className={styles.calTitle} aria-live="polite">
        {monthTitle}
      </h2>
      <button className={styles.navBtn} onClick={() => setOffset((o) => o + 1)} aria-label="Mois suivant">
        <ChevronRight size={16} />
      </button>
      {offset !== 0 && (
        <Button
          variant="ghost"
          onClick={() => {
            setOffset(0);
            setSelected(today);
          }}
        >
          Aujourd'hui
        </Button>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        eyebrow="Clients & événements"
        title="Événements"
        actions={
          canEdit ? (
            <Button onClick={() => setEditing({ ev: null, date: view === "calendar" ? selected : undefined })}>
              <Plus size={16} aria-hidden /> Ajouter
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : (
        <>
          <div className={styles.toolbar}>
            <Segmented
              label="Vue"
              value={view}
              onChange={setView}
              options={[
                { value: "calendar", label: "Calendrier" },
                { value: "month", label: "Liste du mois" },
                { value: "upcoming", label: "À venir (30 j)" },
              ]}
            />
            <span className={styles.spacer} />
            <SearchInput value={query} onChange={setQuery} placeholder="Nom, contact, notes…" />
          </div>
          <div className={styles.chips} role="group" aria-label="Types">
            <button className={styles.chip} aria-pressed={type === "all"} onClick={() => setType("all")}>
              Tous <span className={styles.chipCount}>{data.length}</span>
            </button>
            {EVENT_TYPES.map((t) => (
              <button key={t.key} className={styles.chip} aria-pressed={type === t.key} onClick={() => setType(t.key)}>
                <span className={styles.swatch} style={{ background: color(t.key) }} aria-hidden />
                <TypeIcon type={t.key} /> {t.short} <span className={styles.chipCount}>{data.filter((e) => e.type === t.key).length}</span>
              </button>
            ))}
          </div>

          {view === "calendar" && (
            <>
              {monthNav}
              <div className={styles.cal}>
                <div className={styles.dows} aria-hidden>
                  {DOWS.map((d) => (
                    <div key={d} className={styles.dow}>
                      {d}
                    </div>
                  ))}
                </div>
                <div className={styles.grid}>
                  {calendarGrid(month.year, month.month).map((iso) => {
                    const list = dayMap.get(iso) ?? [];
                    const inMonth = iso >= month.start && iso <= month.end;
                    const cls = [styles.cell, !inMonth && styles.other, iso === today && styles.today, iso === selected && styles.selected]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <button
                        key={iso}
                        className={cls}
                        onClick={() => setSelected(iso)}
                        onDoubleClick={() => canEdit && setEditing({ ev: null, date: iso })}
                        aria-label={`${longDate(iso)}${list.length ? ` — ${list.length} événement${list.length > 1 ? "s" : ""}` : ""}`}
                        aria-pressed={iso === selected}
                      >
                        <span className={styles.dayNum}>{isoToDate(iso)!.getDate()}</span>
                        {list.slice(0, 3).map((ev) => (
                          <span
                            key={ev.id}
                            className={`${styles.pill} ${ev.status === "attente" ? styles.pending : ""} ${ev.status === "annule" ? styles.cancelled : ""}`}
                            style={{ ["--c" as string]: color(ev.type) }}
                            title={`${ev.time ? `${ev.time} · ` : ""}${ev.name}`}
                          >
                            <span>
                              {ev.time && <strong>{ev.time} </strong>}
                              {ev.name}
                            </span>
                          </span>
                        ))}
                        {list.length > 3 && <span className={styles.more}>+{list.length - 3} autre{list.length > 4 ? "s" : ""}</span>}
                        {list.length > 0 && (
                          <span className={styles.dots} aria-hidden>
                            {list.slice(0, 4).map((ev) => (
                              <span key={ev.id} className={styles.dot} style={{ ["--c" as string]: color(ev.type) }} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className={styles.legend}>
                  {EVENT_TYPES.map((t) => (
                    <span key={t.key} className={styles.legendItem}>
                      <span className={styles.swatch} style={{ background: color(t.key) }} aria-hidden />
                      {t.short}
                    </span>
                  ))}
                  <span className={styles.legendItem}>Trait pointillé = en attente · barré = annulé</span>
                </div>
              </div>

              <section className={styles.dayPanel} aria-label="Événements du jour sélectionné">
                <div className={styles.dayHead}>
                  <h2 className={styles.dayTitle}>{longDate(selected)}</h2>
                  {canEdit && (
                    <Button variant="secondary" onClick={() => setEditing({ ev: null, date: selected })}>
                      <Plus size={14} aria-hidden /> Ajouter ce jour-là
                    </Button>
                  )}
                </div>
                {(dayMap.get(selected) ?? []).length === 0 ? (
                  <p className={styles.empty}>Aucun événement ce jour-là.</p>
                ) : (
                  cards(dayMap.get(selected)!)
                )}
              </section>
            </>
          )}

          {view === "month" && (
            <>
              {monthNav}
              {inRange(filtered, month.start, month.end).length === 0 ? (
                <EmptyState icon={CalendarDays} title="Aucun événement ce mois-ci" />
              ) : (
                cards(inRange(filtered, month.start, month.end))
              )}
            </>
          )}

          {view === "upcoming" &&
            (upcoming(filtered).length === 0 ? (
              <EmptyState icon={CalendarDays} title="Rien dans les 30 prochains jours" />
            ) : (
              cards(upcoming(filtered))
            ))}
        </>
      )}

      {editing && <EventModal ev={editing.ev} presetDate={editing.date} all={data} onClose={() => setEditing(null)} onSave={save} />}
    </>
  );
}
