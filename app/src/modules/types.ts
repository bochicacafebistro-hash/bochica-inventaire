import type { ComponentType, LazyExoticComponent } from "react";
import type { LucideIcon } from "lucide-react";
import type { Role } from "@/core/auth/roles";

/** Groupes de la barre latérale (mêmes que l'ancienne app). */
export type NavGroup =
  | "general"
  | "inventaire"
  | "rh"
  | "cuisine"
  | "finances"
  | "clients"
  | "employe";

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  general: "Général",
  inventaire: "Inventaire",
  rh: "RH & Horaires",
  cuisine: "Cuisine",
  finances: "Finances",
  clients: "Clients & Événements",
  employe: "Mon espace",
};

export const NAV_GROUP_LABELS_ES: Record<NavGroup, string> = {
  general: "General",
  inventaire: "Inventario",
  rh: "RR. HH. y horarios",
  cuisine: "Cocina",
  finances: "Finanzas",
  clients: "Clientes y eventos",
  employe: "Mi espacio",
};

interface ModuleBase {
  /** Identifiant unique, sert aussi d'URL : /<id> */
  id: string;
  label: string;
  /** Libellé espagnol (modules visibles par les employés). */
  labelEs?: string;
  icon: LucideIcon;
  group: NavGroup;
  /** Rôles qui voient ce module. */
  roles: Role[];
}

/** Module déjà réécrit en React. */
export interface MigratedModule extends ModuleBase {
  status: "migrated";
  page: LazyExoticComponent<ComponentType>;
}

/** Module encore dans l'ancienne app : la nouvelle affiche un lien vers elle. */
export interface LegacyModule extends ModuleBase {
  status: "legacy";
}

export type AppModule = MigratedModule | LegacyModule;
