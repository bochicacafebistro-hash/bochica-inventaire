import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useTenant } from "@/core/tenant/TenantContext";
import { tenantDoc } from "./firestore";

interface DocState<T> {
  data: T | null; // null = document absent
  loading: boolean;
  error: Error | null;
}

/** Abonnement temps réel à un document du restaurant courant (ex. settings/sections). */
export function useDocument<T>(collectionName: string, id: string): DocState<T> {
  const tenant = useTenant();
  const [state, setState] = useState<DocState<T>>({ data: null, loading: true, error: null });
  useEffect(
    () =>
      onSnapshot(
        tenantDoc<T>(tenant, collectionName, id),
        (snap) => setState({ data: snap.exists() ? (snap.data() as T) : null, loading: false, error: null }),
        (error) => setState({ data: null, loading: false, error }),
      ),
    [tenant, collectionName, id],
  );
  return state;
}
