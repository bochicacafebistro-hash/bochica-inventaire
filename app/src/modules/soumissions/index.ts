import { lazy } from "react";
import { Receipt } from "lucide-react";
import type { AppModule } from "../types";

export const soumissionsModule: AppModule = {
  id: "soumissions",
  label: "Soumissions",
  icon: Receipt,
  group: "clients",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./SoumissionsPage")),
};
