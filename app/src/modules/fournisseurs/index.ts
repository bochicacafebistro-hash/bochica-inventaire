import { lazy } from "react";
import { Store } from "lucide-react";
import type { AppModule } from "../types";

export const fournisseursModule: AppModule = {
  id: "fournisseurs",
  label: "Fournisseurs",
  icon: Store,
  group: "inventaire",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./FournisseursPage")),
};
