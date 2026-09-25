/** Messages d'erreur Firebase Auth en français. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
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
