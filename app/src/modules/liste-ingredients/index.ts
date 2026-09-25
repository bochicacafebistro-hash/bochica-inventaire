import { lazy } from "react";
import { ShoppingBasket } from "lucide-react";
import type { AppModule } from "../types";

export const listeIngredientsModule: AppModule = {
  id: "liste-ingredients",
  label: "Liste d'ingrédients",
  icon: ShoppingBasket,
  group: "inventaire",
  roles: ["global_admin", "chef"],
  status: "migrated",
  page: lazy(() => import("./ListePage")),
};
