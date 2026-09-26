import { lazy } from "react";
import { CalendarClock, Sun, SunMedium, Users } from "lucide-react";
import type { AppModule } from "../types";

export const monHoraireModule: AppModule = {
  id: "mon-horaire",
  label: "Mon horaire",
  labelEs: "Mi horario",
  icon: CalendarClock,
  group: "employe",
  roles: ["employee"],
  status: "migrated",
  page: lazy(() => import("./MonHorairePage")),
};

export const demandeCongeModule: AppModule = {
  id: "demande-conge",
  label: "Demande de congé",
  labelEs: "Pedir descanso",
  icon: Sun,
  group: "employe",
  roles: ["employee"],
  status: "migrated",
  page: lazy(() => import("./DemandeCongePage")),
};

export const demandesCongeModule: AppModule = {
  id: "demandes-conge",
  label: "Demandes de congé",
  icon: SunMedium,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./DemandesCongePage")),
};

export const employesModule: AppModule = {
  id: "employes",
  label: "Employés & Horaires",
  icon: Users,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./EmployesPage")),
};
