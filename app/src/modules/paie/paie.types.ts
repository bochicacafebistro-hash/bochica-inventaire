/** Paie (format v1) : payroll/{AAAA-Wnn} et settings/payroll. */
import type { PaidEmployee, Shift } from "@/modules/equipe/equipe.types";
import type { ActualShift } from "@/modules/pointage/punch.logic";

export interface ServiceWindow {
  start: string;
  end: string;
}

export interface PayrollSettings {
  tipShares?: { cuisine?: number; service?: number };
  /** Clé = jour (0 = lundi … 6 = dimanche) ; une plage ou plusieurs (service coupé). */
  defaultServiceHours?: Record<string, ServiceWindow | ServiceWindow[]>;
}

/** Employé ponctuel ajouté à une seule semaine (payroll/{semaine}.manualEmployees). */
export interface ManualEmployee {
  id: string;
  name?: string;
  section?: string;
  hourlyRate?: number;
  role?: string;
  isSalaried?: boolean;
  shifts?: Record<string, Shift>;
  createdAt?: number;
}

export interface PayrollWeekDoc {
  weekId?: string;
  weekStart?: string;
  actualShifts?: Record<string, Record<string, ActualShift>>;
  tipsByDay?: Record<string, number>;
  netByDay?: Record<string, number>;
  totalTips?: number; // ancien champ (avant la saisie par jour)
  bonusByEmp?: Record<string, number>;
  sectionOverrides?: Record<string, "cuisine" | "service" | "excluded" | string>;
  manualEmployees?: ManualEmployee[];
  empOrder?: string[]; // ancien ordre propre à la paie
  hiddenEmps?: string[];
  locked?: boolean;
  lockedAt?: number;
  lockedAmount?: number;
  expenseId?: string;
}

/** Ligne de paie : employé (fiche + rémunération) ou extra de la semaine. */
export interface PayrollPerson extends PaidEmployee {
  isManual: boolean;
}
