import { lazy } from "react";
import { BookOpen, Tag, Utensils } from "lucide-react";
import type { AppModule } from "../types";

export const menuModule: AppModule = {
  id: "menu",
  label: "Menu",
  icon: Utensils,
  group: "cuisine",
  roles: ["global_admin", "chef"],
  status: "migrated",
  page: lazy(() => import("./MenuPage")),
};

export const ingredientsModule: AppModule = {
  id: "ingredients",
  label: "Ingrédients",
  icon: Tag,
  group: "cuisine",
  roles: ["global_admin", "chef"],
  status: "migrated",
  page: lazy(() => import("./IngredientsPage")),
};

export const recettesModule: AppModule = {
  id: "recettes",
  label: "Recettes",
  icon: BookOpen,
  group: "cuisine",
  roles: ["global_admin", "chef"],
  status: "migrated",
  page: lazy(() => import("./RecettesPage")),
};
