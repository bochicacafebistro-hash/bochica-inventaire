import { lazy } from "react";
import { Package, ShoppingCart } from "lucide-react";
import type { AppModule } from "../types";

export const inventaireModule: AppModule = {
  id: "inventaire",
  label: "Inventaire",
  labelEs: "Inventario",
  icon: Package,
  group: "inventaire",
  roles: ["global_admin", "chef", "employee"],
  status: "migrated",
  page: lazy(() => import("./InventairePage")),
};

export const aCommanderModule: AppModule = {
  id: "a-commander",
  label: "À commander",
  icon: ShoppingCart,
  group: "inventaire",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./ACommanderPage")),
};
