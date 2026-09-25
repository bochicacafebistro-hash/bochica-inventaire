import { useMemo } from "react";
import type { DocumentData } from "firebase/firestore";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useTenant } from "@/core/tenant/TenantContext";
import { createDoc, logAction, removeDoc, updateFields } from "./mutations";

/** Écritures liées au restaurant et à l'utilisateur courants. */
export function useDataActions() {
  const tenant = useTenant();
  const user = useSessionUser();
  return useMemo(
    () => ({
      create: (collection: string, data: DocumentData) => createDoc(tenant, collection, data),
      update: (collection: string, id: string, data: DocumentData) => updateFields(tenant, collection, id, data),
      remove: (collection: string, id: string) => removeDoc(tenant, collection, id),
      log: (subject: string, action: string, detail?: string) => logAction(tenant, user, { subject, action, detail }),
    }),
    [tenant, user],
  );
}
