import { useEffect, useState } from "react";
import type { QueryConstraint } from "firebase/firestore";
import { useTenant } from "@/core/tenant/TenantContext";
import { watchCollection, type WithId } from "./firestore";

interface CollectionState<T> {
  data: WithId<T>[];
  loading: boolean;
  error: Error | null;
}

/**
 * Hook temps réel sur une collection du restaurant courant.
 * Les contraintes doivent être stables (useMemo) pour éviter de se réabonner.
 */
const NO_CONSTRAINTS: QueryConstraint[] = [];

export function useCollection<T>(
  name: string,
  constraints: QueryConstraint[] = NO_CONSTRAINTS,
): CollectionState<T> {
  const tenant = useTenant();
  const [state, setState] = useState<CollectionState<T>>({ data: [], loading: true, error: null });

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    return watchCollection<T>(
      tenant,
      name,
      (data) => setState({ data, loading: false, error: null }),
      (error) => setState({ data: [], loading: false, error }),
      ...constraints,
    );
  }, [tenant, name, constraints]);

  return state;
}
