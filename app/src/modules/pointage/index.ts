import { lazy } from "react";
import { Clock } from "lucide-react";
import type { AppModule } from "../types";

export const pointageModule: AppModule = {
  id: "pointage",
  label: "Pointage",
  labelEs: "Fichaje",
  icon: Clock,
  group: "rh",
  roles: ["global_admin", "chef", "employee"],
  status: "migrated",
  page: lazy(() => import("./PointagePage")),
};
