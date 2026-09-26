/**
 * Registre des modules — la liste de tout ce que l'app sait faire.
 *
 * Pour ajouter un module : créer son dossier `modules/<id>/` (index.ts +
 * pages + données) et l'importer ici. (Tous les modules de la v1 sont
 * migrés depuis le 26 sept. 2026 ; le type LegacyModule reste disponible
 * pour renvoyer vers une page externe si besoin.)
 * La navigation, les routes et les permissions se construisent toutes
 * à partir de cette liste.
 */
import type { Role } from "@/core/auth/roles";
import type { AppModule } from "./types";
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
import { pointageModule } from "./pointage";
import { salairesModule } from "./paie";
import { simulationModule } from "./simulation";
import { demandeCongeModule, demandesCongeModule, employesModule, monHoraireModule } from "./equipe";

export const MODULES: AppModule[] = [
  accueilModule,

  // Inventaire
  inventaireModule,
  aCommanderModule,
  listeIngredientsModule,
  fournisseursModule,

  // RH & Horaires
  employesModule,
  salairesModule,
  simulationModule,
  demandesCongeModule,
  tachesModule,
  tachesJourModule,
  pointageModule,

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
