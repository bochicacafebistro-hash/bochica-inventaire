/**
 * Écritures Firestore — toujours via le tenant. Convention héritée de la v1 :
 * l'id du document est aussi copié dans le champ `id`.
 */
import { deleteDoc, serverTimestamp, setDoc, updateDoc, addDoc, type DocumentData } from "firebase/firestore";
import type { Tenant } from "@/core/tenant/tenant";
import type { SessionUser } from "@/core/auth/AuthContext";
import { tenantCollection, tenantDoc } from "./firestore";
import { newId } from "./ids";

export async function createDoc(tenant: Tenant, collectionName: string, data: DocumentData): Promise<string> {
  const id = newId();
  await setDoc(tenantDoc(tenant, collectionName, id), {
    ...data,
    id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return id;
}

export async function updateFields(tenant: Tenant, collectionName: string, id: string, data: DocumentData): Promise<void> {
  await updateDoc(tenantDoc(tenant, collectionName, id), { ...data, updatedAt: serverTimestamp() });
}

export async function removeDoc(tenant: Tenant, collectionName: string, id: string): Promise<void> {
  await deleteDoc(tenantDoc(tenant, collectionName, id));
}

/**
 * Journal des actions (collection `logs`, même format que la v1 :
 * productName = sujet de l'action, action, detail).
 */
export async function logAction(
  tenant: Tenant,
  user: SessionUser,
  entry: { subject: string; action: string; detail?: string },
): Promise<void> {
  try {
    await addDoc(tenantCollection(tenant, "logs"), {
      productName: entry.subject,
      action: entry.action,
      detail: entry.detail ?? "",
      ts: serverTimestamp(),
      role: user.role === "employee" ? "employé" : "admin",
      userName: user.email,
      userId: user.uid,
      source: "v2",
    });
  } catch (err) {
    // Le journal ne doit jamais bloquer l'action principale
    console.warn("Journal non écrit :", err);
  }
}
