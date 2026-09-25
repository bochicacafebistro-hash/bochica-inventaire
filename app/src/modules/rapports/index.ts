import { lazy } from "react";
import { ChartColumn } from "lucide-react";
import type { AppModule } from "../types";

export const rapportsModule: AppModule = {
  id: "rapports",
  label: "Rapports mensuels",
  icon: ChartColumn,
  group: "finances",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./RapportsPage")),
};
