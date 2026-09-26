import { lazy } from "react";
import { DollarSign } from "lucide-react";
import type { AppModule } from "../types";

export const salairesModule: AppModule = {
  id: "salaires",
  label: "Salaires & Pourboires",
  icon: DollarSign,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./SalairesPage")),
};
