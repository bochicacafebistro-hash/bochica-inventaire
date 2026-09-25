/** Collections « opérations » (format v1). */

/** /dailyTasks — tâches du jour définies par l'admin, cochées par l'équipe. */
export interface DailyTask {
  id: string;
  title?: string;
  type?: "recurring" | "once" | string;
  bucket?: "recurrent" | "idle" | string;
  time?: string; // heure unique (ancien format, 1re heure)
  times?: string[] | null; // plusieurs passages par jour
  note?: string;
  sortOrder?: number;
  // ponctuelle
  done?: boolean;
  doneAt?: number | null;
  doneDate?: string | null;
  doneBy?: string | null;
  // récurrente mono
  lastCompletedDate?: string | null;
  lastCompletedBy?: string | null;
  // récurrente multi
  dayState?: { date?: string; done?: Record<string, string | boolean> } | null;
}

/** Élément d'une liste d'ouverture / fermeture (settings/openClose). */
export interface ChecklistItem {
  id: string;
  text: string;
  section: "cuisine" | "service";
}

/** /tasks — tâches Kanban (admin). */
export interface KanbanTask {
  id: string;
  title?: string;
  description?: string;
  status?: string; // « À faire » | « En cours » | « Complété »
  priority?: "basse" | "moyenne" | "haute" | string;
  assignedTo?: string;
  dueDate?: string;
}
