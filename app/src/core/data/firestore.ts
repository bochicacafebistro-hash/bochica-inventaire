/**
 * Couche d'accès aux données — le SEUL endroit qui connaît la forme des
 * chemins Firestore. Les modules appellent ces helpers avec le tenant et
 * reçoivent des données typées.
 */
import {
  collection,
  doc,
  onSnapshot,
  type CollectionReference,
  type DocumentData,
  type DocumentReference,
  type QueryConstraint,
  query,
} from "firebase/firestore";
import { db } from "@/core/firebase";
import { tenantPath, type Tenant } from "@/core/tenant/tenant";

export function tenantCollection<T = DocumentData>(tenant: Tenant, name: string): CollectionReference<T> {
  const [first, ...rest] = tenantPath(tenant, name);
  return collection(db, first, ...rest) as CollectionReference<T>;
}

export function tenantDoc<T = DocumentData>(tenant: Tenant, name: string, id: string): DocumentReference<T> {
  const [first, ...rest] = tenantPath(tenant, name, id);
  return doc(db, first, ...rest) as DocumentReference<T>;
}

export type WithId<T> = T & { id: string };

/** Abonnement temps réel à une collection du tenant. Retourne la fonction de désabonnement. */
export function watchCollection<T>(
  tenant: Tenant,
  name: string,
  onData: (rows: WithId<T>[]) => void,
  onError: (err: Error) => void,
  ...constraints: QueryConstraint[]
): () => void {
  const ref = tenantCollection<T>(tenant, name);
  return onSnapshot(
    constraints.length ? query(ref, ...constraints) : ref,
    (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }))),
    onError,
  );
}
