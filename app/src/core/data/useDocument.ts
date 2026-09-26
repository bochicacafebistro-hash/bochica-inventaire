import { useEffect, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useTenant } from "@/core/tenant/TenantContext";
import { tenantDoc } from "./firestore";

interface DocState<T> {
  data: T | null; // null = document absent
  loading: boolean;
  error: Error | null;
}

/**
 * Abonnement temps réel à un document du restaurant courant (ex. settings/sections).
 * ⚠ Quand l'id change (ex. semaine suivante), on repasse en « chargement » et on
 * n'expose JAMAIS les données de l'ancien document : une page qui écrirait en se
 * fiant à ces données périmées écraserait le mauvais document (incident du
 * 26 sept. 2026 dans Salaires & Pourboires).
 */
export function useDocument<T>(collectionName: string, id: string): DocState<T> {
  const tenant = useTenant();
  const key = `${tenant.id}/${collectionName}/${id}`;
  const [state, setState] = useState<DocState<T> & { key: string }>({ key, data: null, loading: true, error: null });
  useEffect(
    () =>
      onSnapshot(
        tenantDoc<T>(tenant, collectionName, id),
        (snap) => setState({ key, data: snap.exists() ? (snap.data() as T) : null, loading: false, error: null }),
        (error) => setState({ key, data: null, loading: false, error }),
      ),
    [tenant, collectionName, id, key],
  );
  if (state.key !== key) return { data: null, loading: true, error: null };
  return { data: state.data, loading: state.loading, error: state.error };
}
