/** Employés, horaires et congés (format v1). ⚠ Aucune rémunération ici (/employeesComp). */

export interface Shift {
  start?: string;
  end?: string;
}

export interface Employee {
  id: string;
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
  notes?: string;
  noTips?: boolean; // exclu du partage des pourboires
  archivedAt?: number;
  section?: "cuisine" | "service" | string;
  pin?: string | number;
  archived?: boolean;
  sortOrder?: number;
  shifts?: Record<string, Shift>; // clé AAAA-MM-JJ
  timeOff?: Record<string, { type?: string; note?: string }>;
}

export interface LeaveRequest {
  id: string;
  empId?: string;
  empName?: string;
  type?: string; // vacances | maladie | personnel | sans_solde
  kind?: "full" | "partial" | string;
  dates?: string[];
  partial?: { dk: string; mode: "late" | "early" | string; time: string } | null;
  status?: "pending" | "approved" | "rejected" | string;
  autoApproved?: boolean;
  reason?: string;
  requestedAt?: number;
  decidedAt?: number | null;
  decidedBy?: string | null;
}

/** /employeesComp/{empId} — rémunération, lisible par l'admin seulement. */
export interface RateStep {
  rate: number;
  from: string; // AAAA-MM-JJ
}
export interface EmployeeComp {
  id: string;
  hourlyRate?: number; // taux en vigueur aujourd'hui (dérivé de l'historique)
  rateHistory?: RateStep[];
  isSalaried?: boolean;
  fixedWeeklyHours?: number;
}

/** Employé + rémunération fusionnée (vue admin). */
export interface PaidEmployee extends Employee {
  hourlyRate: number;
  rateHistory: RateStep[];
  isSalaried: boolean;
  fixedWeeklyHours: number;
}

export interface ScheduleSettings {
  salesRatio?: number; // ratio salaires / ventes (0,32 = 32 %)
  openDays?: number[]; // 0 = lundi … 6 = dimanche
  weekOrder?: Record<string, string[]>;
  weekHidden?: Record<string, string[]>;
}
