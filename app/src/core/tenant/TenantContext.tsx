import { createContext, useContext, type ReactNode } from "react";
import { BOCHICA_TENANT, type Tenant } from "./tenant";

const TenantContext = createContext<Tenant>(BOCHICA_TENANT);

/**
 * Pour l'instant un seul restaurant. Plus tard, le tenant viendra du
 * profil de l'utilisateur (users/{uid}.restaurantId) ou du sous-domaine.
 */
export function TenantProvider({ tenant = BOCHICA_TENANT, children }: { tenant?: Tenant; children: ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

export function useTenant(): Tenant {
  return useContext(TenantContext);
}
