/**
 * Registre des modules — la liste de tout ce que l'app sait faire.
 *
 * Pour migrer un module : créer son dossier `modules/<id>/` (index.ts +
 * pages + données), l'importer ici et retirer sa ligne `legacy(...)`.
 * La navigation, les routes et les permissions se construisent toutes
 * à partir de cette liste.
 */
import {
  Calendar,
  CalendarCheck,
  ClipboardList,
  Clock,
  DollarSign,
  FileText,
  ListChecks,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  TrendingUp,
  Users,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/core/auth/roles";
import type { AppModule, LegacyModule, NavGroup } from "./types";
import { accueilModule } from "./accueil";
import { rapportsModule } from "./rapports";

const ADMIN: Role[] = ["global_admin"];
const ADMIN_CHEF: Role[] = ["global_admin", "chef"];
const ALL: Role[] = ["global_admin", "chef", "employee"];
const EMPLOYEE: Role[] = ["employee"];

function legacy(id: string, label: string, icon: LucideIcon, group: NavGroup, roles: Role[]): LegacyModule {
  return { id, label, icon, group, roles, status: "legacy" };
}

export const MODULES: AppModule[] = [
  accueilModule,

  // Inventaire
  legacy("inventaire", "Inventaire", Package, "inventaire", ALL),
  legacy("a-commander", "À commander", ShoppingCart, "inventaire", ADMIN),
  legacy("liste-ingredients", "Liste d'ingrédients", ShoppingCart, "inventaire", ADMIN_CHEF),
  legacy("fournisseurs", "Fournisseurs", Store, "inventaire", ADMIN),

  // RH & Horaires
  legacy("employes", "Employés & Horaires", Users, "rh", ADMIN),
  legacy("salaires", "Salaires & Pourboires", DollarSign, "rh", ADMIN),
  legacy("simulations", "Simulation paie", TrendingUp, "rh", ADMIN),
  legacy("demandes-conge", "Demandes de congé", Sun, "rh", ADMIN),
  legacy("taches", "Tâches", ClipboardList, "rh", ADMIN),
  legacy("taches-jour", "Tâches du jour", ListChecks, "rh", ADMIN),
  legacy("pointage", "Pointage", Clock, "rh", ALL),

  // Cuisine
  legacy("menu", "Menu", Utensils, "cuisine", ADMIN_CHEF),
  legacy("ingredients", "Ingrédients", Tag, "cuisine", ADMIN_CHEF),
  legacy("recettes", "Recettes", FileText, "cuisine", ADMIN_CHEF),

  // Finances
  legacy("depenses", "Dépenses & Revenus", Wallet, "finances", ADMIN),
  legacy("factures", "Factures", Receipt, "finances", ADMIN),
  legacy("taxes", "TPS/TVQ", ShieldCheck, "finances", ADMIN),
  rapportsModule,

  // Clients & Événements
  legacy("evenements", "Événements", Calendar, "clients", ADMIN_CHEF),
  legacy("soumissions", "Soumissions", Receipt, "clients", ADMIN),

  // Espace employé
  legacy("mon-horaire", "Mon horaire", CalendarCheck, "employe", EMPLOYEE),
  legacy("mes-taches", "Mes tâches", ListChecks, "employe", EMPLOYEE),
  legacy("demande-conge", "Demande de congé", Sun, "employe", EMPLOYEE),
  legacy("ouverture-fermeture", "Ouverture / Fermeture", ClipboardList, "employe", ALL),
];

export function modulesForRole(role: Role): AppModule[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function findModule(id: string): AppModule | undefined {
  return MODULES.find((m) => m.id === id);
}
