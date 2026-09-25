/** Rôles stockés dans Firestore /users/{uid}.role (mêmes que l'ancienne app). */
export type Role = "global_admin" | "chef" | "employee";

export const ROLES: readonly Role[] = ["global_admin", "chef", "employee"];

export const ROLE_LABELS: Record<Role, string> = {
  global_admin: "Administrateur",
  chef: "Chef de cuisine",
  employee: "Employé",
};

export const ROLE_LABELS_ES: Record<Role, string> = {
  global_admin: "Administrador",
  chef: "Jefe de cocina",
  employee: "Empleado",
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

/** Noms affichés de la v1 (AUTH_DISPLAY_NAMES) — utilisés pour « fait par », « décidé par ». */
const DISPLAY_NAMES: Record<string, string> = {
  "bochica@bochica.app": "Admin Bochica",
  "chef@bochica.app": "Chef de cuisine",
  "employe@bochica.app": "Employé",
};
export const displayName = (email: string) => DISPLAY_NAMES[email.toLowerCase()] ?? email;
