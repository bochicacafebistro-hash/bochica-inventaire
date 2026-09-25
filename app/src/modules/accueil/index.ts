import { lazy } from "react";
import { House } from "lucide-react";
import type { AppModule } from "../types";

export const accueilModule: AppModule = {
  id: "accueil",
  label: "Accueil",
  labelEs: "Inicio",
  icon: House,
  group: "general",
  roles: ["global_admin", "chef", "employee"],
  status: "migrated",
  page: lazy(() => import("./AccueilPage")),
};
