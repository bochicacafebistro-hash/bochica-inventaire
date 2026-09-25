/**
 * Restaurant (« tenant ») courant.
 *
 * Toute lecture/écriture Firestore passe par le tenant, jamais par un
 * nom de collection en dur. Ça permet de vendre l'app à plusieurs
 * restaurants plus tard sans réécrire les modules.
 *
 * - layout "root"   : collections à la racine (`products`, `payroll`…) —
 *                     c'est la structure actuelle de Bochica, partagée
 *                     avec l'ancienne app pendant la migration.
 * - layout "nested" : `restaurants/{id}/products`… — la structure cible
 *                     multi-restaurant. On bascule Bochica dessus une
 *                     fois tous les modules migrés.
 */
export type TenantLayout = "root" | "nested";

export interface Tenant {
  id: string;
  name: string;
  layout: TenantLayout;
}

export const BOCHICA_TENANT: Tenant = {
  id: "bochica",
  name: "Bochica Café Bistro",
  layout: "root",
};

/** Segments de chemin Firestore pour une collection du tenant. */
export function tenantPath(tenant: Tenant, collectionName: string, ...rest: string[]): [string, ...string[]] {
  return tenant.layout === "root"
    ? [collectionName, ...rest]
    : ["restaurants", tenant.id, collectionName, ...rest];
}
