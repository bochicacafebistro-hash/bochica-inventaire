/**
 * Registre des modules — la liste de tout ce que l'app sait faire.
 *
 * Pour migrer un module : créer son dossier `modules/<id>/` (index.ts +
 * pages + données), l'importer ici et retirer sa ligne `legacy(...)`.
 * La navigation, les routes et les permissions se construisent toutes
 * à partir de cette liste.
 */
import {
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/core/auth/roles";
import type { AppModule, LegacyModule, NavGroup } from "./types";
import { accueilModule } from "./accueil";
import { rapportsModule } from "./rapports";
import { fournisseursModule } from "./fournisseurs";
import { aCommanderModule, inventaireModule } from "./inventaire";
import { listeIngredientsModule } from "./liste-ingredients";
import { ingredientsModule, menuModule, recettesModule } from "./cuisine";
import { evenementsModule } from "./evenements";
import { soumissionsModule } from "./soumissions";
import { depensesModule, facturesModule, taxesModule } from "./finances";
import { mesTachesModule, ouvertureFermetureModule, tachesJourModule, tachesModule } from "./operations";
import { demandeCongeModule, demandesCongeModule, monHoraireModule } from "./equipe";

const ADMIN: Role[] = ["global_admin"];
const ALL: Role[] = ["global_admin", "chef", "employee"];

function legacy(id: string, label: string, icon: LucideIcon, group: NavGroup, roles: Role[], labelEs?: string): LegacyModule {
  return { id, label, labelEs, icon, group, roles, status: "legacy" };
}

export const MODULES: AppModule[] = [
  accueilModule,

  // Inventaire
  inventaireModule,
  aCommanderModule,
  listeIngredientsModule,
  fournisseursModule,

  // RH & Horaires
  legacy("employes", "Employés & Horaires", Users, "rh", ADMIN),
  legacy("salaires", "Salaires & Pourboires", DollarSign, "rh", ADMIN),
  legacy("simulations", "Simulation paie", TrendingUp, "rh", ADMIN),
  demandesCongeModule,
  tachesModule,
  tachesJourModule,
  legacy("pointage", "Pointage", Clock, "rh", ALL, "Fichaje"),

  // Cuisine
  menuModule,
  ingredientsModule,
  recettesModule,

  // Finances
  depensesModule,
  facturesModule,
  taxesModule,
  rapportsModule,

  // Clients & Événements
  evenementsModule,
  soumissionsModule,

  // Espace employé
  monHoraireModule,
  mesTachesModule,
  demandeCongeModule,
  ouvertureFermetureModule,
];

export function modulesForRole(role: Role): AppModule[] {
  return MODULES.filter((m) => m.roles.includes(role));
}

export function findModule(id: string): AppModule | undefined {
  return MODULES.find((m) => m.id === id);
}
