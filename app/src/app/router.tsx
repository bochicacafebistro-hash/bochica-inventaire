import { createBrowserRouter, Navigate } from "react-router";
import { useAuth } from "@/core/auth/AuthContext";
import { Spinner } from "@/ui/Spinner";
import { AppShell } from "./AppShell";
import { LoginPage } from "./LoginPage";
import { ModuleRoute, NotFound } from "./ModuleRoute";

/** Porte d'entrée : chargement → connexion → application. */
function AuthGate() {
  const { state } = useAuth();
  if (state.status === "loading") return <Spinner label="Vérification de la session…" />;
  if (state.status === "signedOut") return <LoginPage />;
  return <AppShell />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AuthGate />,
    children: [
      { index: true, element: <Navigate to="/accueil" replace /> },
      { path: ":moduleId", element: <ModuleRoute /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
