/** Rôles stockés dans Firestore /users/{uid}.role (mêmes que l'ancienne app). */
export type Role = "global_admin" | "chef" | "employee";

export const ROLES: readonly Role[] = ["global_admin", "chef", "employee"];

export const ROLE_LABELS: Record<Role, string> = {
  global_admin: "Administrateur",
  chef: "Chef de cuisine",
  employee: "Employé",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/**
 * L'ancienne app se connecte avec un nom d'utilisateur (« Bochica ») traduit
 * en courriel interne. On accepte les deux : un courriel complet, ou un nom
 * d'utilisateur auquel on ajoute le domaine interne.
 */
const INTERNAL_EMAIL_DOMAIN = "bochica.app";

export function toLoginEmail(input: string): string {
  const v = input.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${INTERNAL_EMAIL_DOMAIN}`;
}
