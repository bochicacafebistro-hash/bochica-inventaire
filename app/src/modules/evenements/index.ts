import { lazy } from "react";
import { Calendar } from "lucide-react";
import type { AppModule } from "../types";

export const evenementsModule: AppModule = {
  id: "evenements",
  label: "Événements",
  icon: Calendar,
  group: "clients",
  roles: ["global_admin", "chef"],
  status: "migrated",
  page: lazy(() => import("./EvenementsPage")),
};
