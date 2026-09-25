/**
 * Tâches du jour, ouverture/fermeture, Kanban — fonctions pures, mêmes
 * règles que la v1 (js/pages-ops.js, js/pages-secondaires.js).
 */
import type { ChecklistItem, DailyTask } from "./ops.types";

// ── Tâches du jour ────────────────────────────────────

export type Bucket = "recurrent" | "idle";
export const taskBucket = (t: Pick<DailyTask, "bucket">): Bucket => (t.bucket === "idle" ? "idle" : "recurrent");
export const isOnce = (t: Pick<DailyTask, "type">) => t.type === "once";

/** Heures multiples (≥ 1) ou null si tâche à passage unique (ancien format). */
export function taskTimes(t: Pick<DailyTask, "times">): string[] | null {
  const arr = Array.isArray(t.times) ? t.times.map((s) => (s || "").trim()) : null;
  return arr && arr.length ? arr : null;
}

export function isDoneToday(t: DailyTask, today: string): boolean {
  if (isOnce(t)) return !!t.done;
  return t.lastCompletedDate === today;
}

/** Récurrente : toujours ; ponctuelle : tant qu'elle n'est pas faite, ou faite aujourd'hui. */
export function showToday(t: DailyTask, today: string): boolean {
  if (isOnce(t)) return !t.done || t.doneDate === today;
  return true;
}

export interface Occurrence {
  idx: number;
  time: string;
  done: boolean;
  multi: boolean;
  count: number;
  by?: string;
}

export function occurrences(t: DailyTask, today: string): Occurrence[] {
  const times = taskTimes(t);
  if (times) {
    const ds = t.dayState && t.dayState.date === today ? t.dayState.done ?? {} : {};
    return times.map((time, idx) => {
      const v = ds[idx];
      return { idx, time, done: !!v, multi: true, count: times.length, by: typeof v === "string" ? v : undefined };
    });
  }
  const done = isDoneToday(t, today);
  const by = done ? (isOnce(t) ? t.doneBy : t.lastCompletedBy) ?? undefined : undefined;
  return [{ idx: 0, time: (t.time || "").trim(), done, multi: false, count: 1, by: by || undefined }];
}

export interface TaskUnit {
  task: DailyTask;
  occ: Occurrence;
}

/** Ordre chronologique : avec heure d'abord (croissant), récurrentes avant ponctuelles, puis sortOrder. */
export function compareUnits(a: TaskUnit, b: TaskUnit): number {
  const ta = a.occ.time;
  const tb = b.occ.time;
  if (ta && tb && ta !== tb) return ta < tb ? -1 : 1;
  if (ta && !tb) return -1;
  if (!ta && tb) return 1;
  const oa = isOnce(a.task) ? 1 : 0;
  const ob = isOnce(b.task) ? 1 : 0;
  if (oa !== ob) return oa - ob;
  return (a.task.sortOrder ?? 999) - (b.task.sortOrder ?? 999);
}

export function buildUnits(tasks: DailyTask[], today: string): TaskUnit[] {
  return tasks
    .filter((t) => showToday(t, today))
    .flatMap((task) => occurrences(task, today).map((occ) => ({ task, occ })))
    .sort(compareUnits);
}

/** Tri de la page admin : récurrentes puis ponctuelles, puis sortOrder. */
export function sortForAdmin(tasks: DailyTask[]): DailyTask[] {
  return [...tasks].sort((a, b) => (isOnce(a) ? 1 : 0) - (isOnce(b) ? 1 : 0) || (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
}

/** Champs à écrire pour cocher / décocher un passage (seuls champs autorisés aux employés). */
export function togglePatch(t: DailyTask, occ: Occurrence, today: string, who: string): Record<string, unknown> {
  const now = Date.now();
  if (occ.multi) {
    const cur = t.dayState && t.dayState.date === today ? { ...(t.dayState.done ?? {}) } : {};
    if (cur[occ.idx]) delete cur[occ.idx];
    else cur[occ.idx] = who || true;
    return { dayState: { date: today, done: cur } };
  }
  if (isOnce(t)) {
    return occ.done
      ? { done: false, doneAt: null, doneDate: null, doneBy: null }
      : { done: true, doneAt: now, doneDate: today, doneBy: who };
  }
  return occ.done ? { lastCompletedDate: null, lastCompletedBy: null } : { lastCompletedDate: today, lastCompletedBy: who };
}

export interface DailyTaskDraft {
  title: string;
  bucket: Bucket;
  once: boolean;
  times: string; // saisie libre
  note: string;
}

export function toDailyDraft(t: DailyTask | null): DailyTaskDraft {
  const times = t ? taskTimes(t) : null;
  return {
    title: t?.title ?? "",
    bucket: taskBucket(t ?? {}),
    once: t ? isOnce(t) : false,
    times: times ? times.filter(Boolean).join(", ") : (t?.time ?? "").trim(),
    note: t?.note ?? "",
  };
}

/**
 * Champs enregistrés (modèle v1) : ponctuelle → une seule heure dans `time`,
 * pas de `times` ; récurrente → `times` = toutes les heures, `time` = la 1re.
 */
export function dailyFields(d: DailyTaskDraft, rawTimes: string[]) {
  const type = d.once ? "once" : "recurring";
  const parsedTimes = [...new Set(rawTimes)].sort(); // ordre chronologique, sans doublon
  return {
    title: d.title.trim(),
    type,
    bucket: d.bucket,
    time: parsedTimes[0] ?? "",
    note: d.note.trim(),
    times: d.once ? null : parsedTimes,
  };
}

export const nextSortOrder = (list: { sortOrder?: number }[]) => list.reduce((m, t) => Math.max(m, t.sortOrder ?? 0), -1) + 1;

// ── Ouverture / fermeture ─────────────────────────────

/** Identifiant stable dérivé d'un texte (anciens éléments sans id) — identique à la v1. */
export function slugId(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return `i${(h >>> 0).toString(36)}`;
}

export function normalizeList(arr: unknown): ChecklistItem[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it): ChecklistItem => {
      if (typeof it === "string") return { id: slugId(it), text: it, section: "cuisine" };
      const o = (it ?? {}) as { id?: string; text?: string; section?: string };
      return { id: o.id || slugId(o.text ?? ""), text: o.text ?? "", section: o.section === "service" ? "service" : "cuisine" };
    })
    .filter((it) => it.text);
}

/**
 * Reconstruit une section depuis le texte (une ligne = un élément) en gardant
 * l'id d'un élément au texte identique (les cases déjà cochées aujourd'hui
 * restent cochées) — même logique que saveOpenClose (v1).
 */
export function buildSection(raw: string, section: ChecklistItem["section"], existing: ChecklistItem[], used: Set<string>, newId: () => string): ChecklistItem[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => {
      const m =
        existing.find((it) => it.section === section && it.text === text && !used.has(it.id)) ??
        existing.find((it) => it.text === text && !used.has(it.id));
      if (m) used.add(m.id);
      return { id: m ? m.id : newId(), text, section };
    });
}

export const sectionText = (items: ChecklistItem[], section: ChecklistItem["section"]) =>
  items
    .filter((it) => it.section === section)
    .map((it) => it.text)
    .join("\n");

// ── Kanban ────────────────────────────────────────────

export const TASK_COLS = ["À faire", "En cours", "Complété"] as const;
/** Colonne suivante (comme cycleTaskStatus v1 : statut inconnu → « À faire »). */
export const nextStatus = (s?: string) => TASK_COLS[(TASK_COLS.indexOf(s as (typeof TASK_COLS)[number]) + 1) % TASK_COLS.length]!;
export const PRIORITIES = [
  { key: "basse", label: "Basse" },
  { key: "moyenne", label: "Moyenne" },
  { key: "haute", label: "Haute" },
] as const;
