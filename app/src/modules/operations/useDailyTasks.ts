import { useMemo } from "react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { displayName } from "@/core/auth/roles";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { fill, useMessages } from "@/core/i18n/i18n";
import { useToday } from "@/core/useToday";
import { useToast } from "@/ui/Toast";
import { buildUnits, togglePatch, type TaskUnit } from "./ops.logic";
import { OPS_MESSAGES } from "./ops.messages";
import type { DailyTask } from "./ops.types";

/** Tâches du jour + action « cocher » (partagé : accueil employé, page Tâches). */
export function useDailyTasks() {
  const q = useCollection<DailyTask>("dailyTasks");
  const today = useToday();
  const user = useSessionUser();
  const actions = useDataActions();
  const toast = useToast();
  const m = useMessages(OPS_MESSAGES);
  const units = useMemo(() => buildUnits(q.data, today), [q.data, today]);

  async function toggle(u: TaskUnit) {
    try {
      await actions.update("dailyTasks", u.task.id, togglePatch(u.task, u.occ, today, displayName(user.email)));
    } catch (err) {
      toast(fill(m.toggleError, { msg: (err as Error).message }), "error");
    }
  }
  return { ...q, today, units, toggle };
}
