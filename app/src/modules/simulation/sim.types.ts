/** Simulation paie (format v1) : payrollSimulations/{id}. Quarts par jour de semaine (0 = lundi). */
import type { ServiceWindow } from "@/modules/paie/paie.types";

export interface SimShift {
  start: string;
  end: string;
}

export interface SimEmployee {
  id: string;
  name?: string;
  section?: string;
  hourlyRate?: number;
  isSalaried?: boolean;
  fixedWeeklyHours?: number;
  role?: string;
  isFictional?: boolean;
  /** Clé = jour 0..6 ; un quart ou plusieurs (quart coupé). */
  shifts?: Record<string, SimShift | SimShift[]>;
}

export interface SimScenario {
  employees?: SimEmployee[];
  serviceHours?: Record<string, ServiceWindow | ServiceWindow[]>;
  tipShares?: { cuisine?: number; service?: number };
  totalTips?: number;
  openDays?: number[];
  salesRatio?: number;
}

export interface PayrollSimulation {
  id: string;
  name?: string;
  description?: string;
  baseWeekRef?: string;
  baseline?: SimScenario;
  simulation?: SimScenario;
  createdAt?: { seconds?: number; toDate?: () => Date } | number;
  updatedAt?: { seconds?: number } | number;
  createdBy?: string;
}
