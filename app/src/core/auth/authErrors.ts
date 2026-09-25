const ES: Record<string, string> = {
  bad: "Usuario o contraseña incorrectos.",
  many: "Demasiados intentos. Vuelve a intentarlo en unos minutos.",
  network: "Sin conexión de red.",
  disabled: "Esta cuenta está desactivada.",
  other: "No se pudo iniciar sesión. Inténtalo de nuevo.",
};

/** Messages d'erreur Firebase Auth (français par défaut, espagnol si demandé). */
export function authErrorMessage(err: unknown, lang: "fr" | "es" = "fr"): string {
  const code = (err as { code?: string })?.code ?? "";
  if (lang === "es") {
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(code)) return ES.bad!;
    if (code === "auth/too-many-requests") return ES.many!;
    if (code === "auth/network-request-failed") return ES.network!;
    if (code === "auth/user-disabled") return ES.disabled!;
    return ES.other!;
  }
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Nom d'utilisateur ou mot de passe incorrect.";
    case "auth/too-many-requests":
      return "Trop de tentatives. Réessaie dans quelques minutes.";
    case "auth/network-request-failed":
      return "Pas de connexion réseau.";
    case "auth/user-disabled":
      return "Ce compte est désactivé.";
    default:
      return "Connexion impossible. Réessaie.";
  }
}
