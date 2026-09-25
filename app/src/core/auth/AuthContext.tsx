import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/core/firebase";
import { isRole, toLoginEmail, type Role } from "./roles";

export interface SessionUser {
  uid: string;
  email: string;
  role: Role;
}

type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; error?: string }
  | { status: "signedIn"; user: SessionUser };

interface AuthApi {
  state: AuthState;
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

  const api = useMemo<AuthApi>(
    () => ({
      state,
      login: async (usernameOrEmail, password) => {
        await signInWithEmailAndPassword(auth, toLoginEmail(usernameOrEmail), password);
      },
      logout: () => signOut(auth),
    }),
    [state],
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
