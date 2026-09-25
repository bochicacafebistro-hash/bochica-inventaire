import { useMemo } from "react";
import type { DocumentData } from "firebase/firestore";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useTenant } from "@/core/tenant/TenantContext";
import { createDoc, logAction, removeDoc, setFixedDoc, updateFields, updateMany } from "./mutations";

/** Écritures liées au restaurant et à l'utilisateur courants. */
export function useDataActions() {
  const tenant = useTenant();
  const user = useSessionUser();
  return useMemo(
    () => ({
      create: (collection: string, data: DocumentData) => createDoc(tenant, collection, data),
      update: (collection: string, id: string, data: DocumentData) => updateFields(tenant, collection, id, data),
      remove: (collection: string, id: string) => removeDoc(tenant, collection, id),
      updateMany: (collection: string, updates: { id: string; data: DocumentData }[]) =>
        updateMany(tenant, collection, updates),
      setFixed: (collection: string, id: string, data: DocumentData) => setFixedDoc(tenant, collection, id, data),
      log: (subject: string, action: string, detail?: string) => logAction(tenant, user, { subject, action, detail }),
    }),
    [tenant, user],
  );
}
