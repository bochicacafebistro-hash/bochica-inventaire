/**
 * Écritures de la page Salaires & Pourboires — même format que la v1
 * (payroll/{AAAA-Wnn} en fusion, settings/payroll, settings/schedule, expenses).
 */
import { deleteField } from "firebase/firestore";
import { useDataActions } from "@/core/data/useDataActions";
import { payrollWeekId } from "@/modules/pointage/punch.logic";
import type { ManualEmployee, PayrollSettings, PayrollWeekDoc, ServiceWindow } from "./paie.types";
import { DEFAULT_SHARES, normalizeWindows } from "./paie.logic";

const CLEAR_FLAGS = { autoFilled: deleteField(), autoFilledAt: deleteField(), autoFilledNoStart: deleteField(), markedAbsent: deleteField(), markedAbsentAt: deleteField() };
/** Montant saisi → nombre, ou suppression de la clé si vide / ≤ 0 (comme la v1). */
const amountOrDelete = (raw: string | number) => {
  const v = Number(raw);
  return !raw || Number.isNaN(v) || v <= 0 ? deleteField() : v;
};

export function usePayrollWrites(monday: string) {
  const a = useDataActions();
  const wid = payrollWeekId(monday);
  const put = (data: Record<string, unknown>) => a.setFixed("payroll", wid, { weekId: wid, weekStart: monday, updatedAt: Date.now(), ...data });

  return {
    wid,
    log: a.log,
    saveShift: (empId: string, dk: string, start: string, end: string) => put({ actualShifts: { [empId]: { [dk]: { start, end, ...CLEAR_FLAGS } } } }),
    clearShift: (empId: string, dk: string) => put({ actualShifts: { [empId]: { [dk]: deleteField() } } }),
    moveShift: async (empId: string, from: string, to: string, start: string, end: string) => {
      await put({ actualShifts: { [empId]: { [to]: { start, end, ...CLEAR_FLAGS }, [from]: deleteField() } } });
    },
    markAbsent: (empId: string, dk: string) => {
      const now = Date.now();
      return put({ actualShifts: { [empId]: { [dk]: { start: deleteField(), end: deleteField(), autoFilled: deleteField(), autoFilledAt: deleteField(), autoFilledNoStart: deleteField(), markedAbsent: true, markedAbsentAt: now } } } });
    },
    autoFill: (items: { empId: string; dk: string; start: string; end: string; noStart: boolean }[]) => {
      const now = Date.now();
      const shifts: Record<string, Record<string, unknown>> = {};
      for (const c of items) (shifts[c.empId] ??= {})[c.dk] = { start: c.start, end: c.end, autoFilled: true, autoFilledAt: now, ...(c.noStart ? { autoFilledNoStart: true } : {}) };
      return put({ actualShifts: shifts });
    },
    setTip: (dk: string, raw: string) => put({ tipsByDay: { [dk]: amountOrDelete(raw) } }),
    setNet: (dk: string, raw: string) => put({ netByDay: { [dk]: amountOrDelete(raw) } }),
    setBonus: (empId: string, raw: string) => put({ bonusByEmp: { [empId]: amountOrDelete(raw) } }),
    setOverride: (empId: string, v: string) => put({ sectionOverrides: { [empId]: ["cuisine", "service", "excluded"].includes(v) ? v : deleteField() } }),
    setHidden: (ids: string[]) => put({ hiddenEmps: ids }),
    resetWeek: () => put({ actualShifts: deleteField(), tipsByDay: deleteField(), netByDay: deleteField(), totalTips: deleteField() }),

    addExtra: async (week: PayrollWeekDoc | null, extra: Omit<ManualEmployee, "id" | "createdAt">, realIds: string[], sharedOrder: string[]) => {
      const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const existing = week?.manualEmployees ?? [];
      const nextOrder = week?.empOrder ? [...week.empOrder, id] : [...realIds, ...existing.map((e) => e.id), id];
      await put({ manualEmployees: [...existing, { ...extra, id, role: "Extra", isSalaried: false, shifts: {}, createdAt: Date.now() }], empOrder: nextOrder });
      if (sharedOrder.length) await a.setFixed("settings", "schedule", { weekOrder: { [monday]: [...sharedOrder, id] } });
      return id;
    },
    removeExtra: async (week: PayrollWeekDoc | null, id: string, sharedOrder: string[]) => {
      await put({
        manualEmployees: (week?.manualEmployees ?? []).filter((e) => e.id !== id),
        ...(week?.empOrder ? { empOrder: week.empOrder.filter((x) => x !== id) } : {}),
        actualShifts: { [id]: deleteField() },
        sectionOverrides: { [id]: deleteField() },
        bonusByEmp: { [id]: deleteField() },
      });
      if (sharedOrder.includes(id)) await a.setFixed("settings", "schedule", { weekOrder: { [monday]: sharedOrder.filter((x) => x !== id) } });
    },
    setOrder: (ids: string[]) => a.setFixed("settings", "schedule", { weekOrder: { [monday]: ids } }),

    /** Remplace toutes les plages (set sans fusion, comme la v1) en gardant la répartition. */
    saveServiceHours: (settings: PayrollSettings | null, draft: Record<number, ServiceWindow[]>) => {
      const next: Record<string, ServiceWindow | ServiceWindow[]> = {};
      for (let i = 0; i < 7; i++) {
        const w = normalizeWindows(draft[i]);
        if (w.length) next[i] = w.length === 1 ? w[0]! : w;
      }
      return a.replace("settings", "payroll", { tipShares: settings?.tipShares ?? DEFAULT_SHARES, defaultServiceHours: next, updatedAt: Date.now() });
    },
    saveShares: (cuisinePct: number) => a.setFixed("settings", "payroll", { tipShares: { cuisine: cuisinePct / 100, service: (100 - cuisinePct) / 100 }, updatedAt: Date.now() }),

    /** Verrouille : crée la dépense « Salaires sem. N » et bloque la semaine. */
    lock: async (amount: number, weekNum: number, label: string, lastDay: string) => {
      const description = `Salaires sem. ${weekNum} (${label})`;
      const expenseId = await a.create("expenses", {
        description,
        supplier: "",
        amount,
        tps: 0,
        tvq: 0,
        date: lastDay,
        category: "Salaires",
        type: "fixe",
        notes: `Auto-créé depuis Salaires & Pourboires (verrouillage paie semaine ${weekNum}). Modifie ici si tu ajustes le montant.`,
        payrollWeekId: wid,
        isFixedAuto: false,
      });
      await put({ locked: true, lockedAt: Date.now(), lockedAmount: amount, expenseId });
      return description;
    },
    unlock: async (expenseId?: string) => {
      if (expenseId) await a.remove("expenses", expenseId).catch(() => undefined); // déjà supprimée : on continue
      await put({ locked: false, lockedAt: deleteField(), lockedAmount: deleteField(), expenseId: deleteField() });
    },
  };
}
