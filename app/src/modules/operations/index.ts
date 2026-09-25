import { lazy } from "react";
import { ClipboardCheck, KanbanSquare, ListChecks } from "lucide-react";
import type { AppModule } from "../types";

export const tachesModule: AppModule = {
  id: "taches",
  label: "Tâches",
  labelEs: "Tareas",
  icon: KanbanSquare,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./TachesPage")),
};

export const tachesJourModule: AppModule = {
  id: "taches-jour",
  label: "Tâches du jour",
  labelEs: "Tareas del día",
  icon: ListChecks,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./TachesJourPage")),
};

export const mesTachesModule: AppModule = {
  id: "mes-taches",
  label: "Tâches",
  labelEs: "Tareas",
  icon: ListChecks,
  group: "employe",
  roles: ["employee"],
  status: "migrated",
  page: lazy(() => import("./MesTachesPage")),
};

export const ouvertureFermetureModule: AppModule = {
  id: "ouverture-fermeture",
  label: "Ouverture / Fermeture",
  labelEs: "Apertura / Cierre",
  icon: ClipboardCheck,
  group: "employe",
  roles: ["global_admin", "employee"],
  status: "migrated",
  page: lazy(() => import("./OuvertureFermeturePage")),
};

