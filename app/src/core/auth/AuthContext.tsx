import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/core/firebase";
import { isRole, toLoginEmail, type Role } from "./roles";

export interface SessionUser {
  uid: string;
  email: string;
  /** Rôle affiché (en mode aperçu : le rôle prévisualisé). */
  role: Role;
  /** Vrai rôle du compte (identique à `role` hors aperçu). */
  realRole?: Role;
}

/** Rôles que l'admin peut prévisualiser (mode aperçu, comme la v1 v3.28). */
export type PreviewRole = "chef" | "employee";
const PREVIEW_KEY = "bochica-preview-role";

/** Rôle affiché : l'aperçu ne s'applique qu'au vrai admin (un chef ou un employé ne peut jamais changer de rôle). */
export function withPreview(user: SessionUser, preview: PreviewRole | null): SessionUser {
  const real = user.realRole ?? user.role;
  return { ...user, role: real === "global_admin" && preview ? preview : real, realRole: real };
}

type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; error?: string }
  | { status: "signedIn"; user: SessionUser };

interface AuthApi {
  state: AuthState;
  /** Aperçu admin : voir l'app comme le chef ou la tablette employé, sans changer de compte. */
  previewRole: PreviewRole | null;
  setPreviewRole: (r: PreviewRole | null) => void;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthApi | null>(null);

async function loadProfile(fbUser: User): Promise<SessionUser> {
  // /users/{uid} reste global (hors tenant) : c'est lui qui dira plus tard
  // à quel restaurant l'utilisateur appartient.
  const snap = await getDoc(doc(db, "users", fbUser.uid));
  const role = snap.exists() ? snap.data().role : undefined;
  if (!isRole(role)) {
    throw new Error(
      snap.exists()
        ? `Rôle inconnu ou invalide : « ${String(role)} ».`
        : "Ton compte existe mais n'a pas de rôle attribué. Contacte l'administrateur.",
    );
  }
  return { uid: fbUser.uid, email: fbUser.email ?? "", role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [previewRole, setPreview] = useState<PreviewRole | null>(() => {
    try {
      const v = sessionStorage.getItem(PREVIEW_KEY);
      return v === "chef" || v === "employee" ? v : null;
    } catch {
      return null;
    }
  });
  const setPreviewRole = (r: PreviewRole | null) => {
    setPreview(r);
    try {
      if (r) sessionStorage.setItem(PREVIEW_KEY, r);
      else sessionStorage.removeItem(PREVIEW_KEY);
    } catch {
      /* stockage indisponible : l'aperçu dure jusqu'au rechargement */
    }
  };

  useEffect(
    () =>
      onAuthStateChanged(auth, async (fbUser) => {
        if (!fbUser) {
          setState((s) => (s.status === "signedOut" ? s : { status: "signedOut" }));
          return;
        }
        try {
          setState({ status: "signedIn", user: await loadProfile(fbUser) });
        } catch (err) {
          await signOut(auth).catch(() => {});
          setState({ status: "signedOut", error: (err as Error).message });
        }
      }),
    [],
  );

  // L'aperçu n'est permis qu'au vrai admin ; il n'élargit jamais les droits :
  // les écritures passent toujours par le vrai compte et les règles Firestore.
  const effective = useMemo<AuthState>(() => {
    if (state.status !== "signedIn") return state;
    return { status: "signedIn", user: withPreview(state.user, previewRole) };
  }, [state, previewRole]);

  const api = useMemo<AuthApi>(
    () => ({
      state: effective,
      previewRole: effective.status === "signedIn" && effective.user.realRole === "global_admin" ? previewRole : null,
      setPreviewRole,
      login: async (usernameOrEmail, password) => {
        await signInWithEmailAndPassword(auth, toLoginEmail(usernameOrEmail), password);
      },
      logout: async () => {
        setPreviewRole(null);
        await signOut(auth);
      },
    }),
    [effective, previewRole], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}

/** Utilisateur connecté — à utiliser seulement sous une route protégée. */
export function useSessionUser(): SessionUser {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("Aucun utilisateur connecté");
  return state.user;
}
