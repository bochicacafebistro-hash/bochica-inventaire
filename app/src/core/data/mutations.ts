/**
 * Écritures Firestore — toujours via le tenant. Convention héritée de la v1 :
 * l'id du document est aussi copié dans le champ `id`.
 */
import { addDoc, deleteDoc, serverTimestamp, setDoc, updateDoc, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "@/core/firebase";
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

/** Plusieurs mises à jour d'un coup (tout ou rien), par paquets de 450. */
export async function updateMany(
  tenant: Tenant,
  collectionName: string,
  updates: { id: string; data: DocumentData }[],
): Promise<void> {
  for (let i = 0; i < updates.length; i += 450) {
    const batch = writeBatch(db);
    for (const u of updates.slice(i, i + 450)) {
      batch.update(tenantDoc(tenant, collectionName, u.id), { ...u.data, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  }
}

/** Écrit un document à id fixe (ex. settings/sections), fusionné par défaut. */
export async function setFixedDoc(tenant: Tenant, collectionName: string, id: string, data: DocumentData, merge = true) {
  await setDoc(tenantDoc(tenant, collectionName, id), data, { merge });
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
      role: (user.realRole ?? user.role) === "employee" ? "employé" : "admin", // aperçu admin : on journalise le vrai rôle
      userName: user.email,
      userId: user.uid,
      source: "v2",
    });
  } catch (err) {
    // Le journal ne doit jamais bloquer l'action principale
    console.warn("Journal non écrit :", err);
  }
}
