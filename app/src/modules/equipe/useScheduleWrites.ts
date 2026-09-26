import { deleteField } from "firebase/firestore";
import { useDataActions } from "@/core/data/useDataActions";
import type { Employee, Shift } from "./equipe.types";
import type { UndoEntry } from "./useUndo";

type Leave = { type?: string; note?: string; createdAt?: number };
const val = <T,>(v: T | null | undefined) => (v == null ? deleteField() : { ...v });

/**
 * Écritures de l'horaire, chacune avec son « annuler ». Les quarts et congés
 * sont modifiés champ par champ (`shifts.<jour>`), jamais en réécrivant tout
 * l'objet : deux admins qui modifient des jours différents ne s'écrasent plus.
 */
export function useScheduleWrites(push: (e: UndoEntry) => void) {
  const actions = useDataActions();
  const upd = (id: string, data: Record<string, unknown>) => actions.update("employees", id, data);

  return {
    /** Écrit/supprime plusieurs jours d'un coup (null = supprimer). */
    async setShifts(emp: Employee, changes: Record<string, Shift | null>, label: string) {
      const data: Record<string, unknown> = {};
      const undo: Record<string, unknown> = {};
      for (const [dk, s] of Object.entries(changes)) {
        data[`shifts.${dk}`] = s ? { start: s.start, end: s.end } : deleteField();
        undo[`shifts.${dk}`] = val(emp.shifts?.[dk]);
      }
      await upd(emp.id, data);
      push({ label, restore: () => upd(emp.id, undo) });
    },

    /** Congé manuel sur plusieurs jours ; les quarts présents ces jours-là sont retirés. */
    async addTimeOff(emp: Employee, days: string[], leave: Leave) {
      const data: Record<string, unknown> = {};
      const undo: Record<string, unknown> = {};
      let removed = 0;
      for (const dk of days) {
        data[`timeOff.${dk}`] = leave;
        undo[`timeOff.${dk}`] = val(emp.timeOff?.[dk] as Leave | undefined);
        const s = emp.shifts?.[dk];
        if (s?.start && s?.end) {
          data[`shifts.${dk}`] = deleteField();
          undo[`shifts.${dk}`] = { ...s };
          removed++;
        }
      }
      await upd(emp.id, data);
      push({ label: `Congé de ${emp.name} (${days.length} j)`, restore: () => upd(emp.id, undo) });
      return removed;
    },

    async setTimeOff(emp: Employee, dk: string, leave: Leave | null, label: string) {
      const prev = emp.timeOff?.[dk] as Leave | undefined;
      await upd(emp.id, { [`timeOff.${dk}`]: leave ?? deleteField() });
      push({ label, restore: () => upd(emp.id, { [`timeOff.${dk}`]: val(prev) }) });
    },

    /** Paramètres de l'horaire (settings/schedule), fusionnés. */
    async setSchedule(data: Record<string, unknown>, undoData?: Record<string, unknown>, label?: string) {
      await actions.setFixed("settings", "schedule", data);
      if (undoData && label) push({ label, restore: () => actions.setFixed("settings", "schedule", undoData) });
    },

    log: actions.log,
  };
}
