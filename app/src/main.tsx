import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AuthProvider } from "@/core/auth/AuthContext";
import { TenantProvider } from "@/core/tenant/TenantContext";
import { router } from "@/app/router";
import "@/ui/global.css";

// Applique le thème sauvegardé avant le premier rendu (évite un flash)
try {
  const saved = localStorage.getItem("bochica-theme");
  const dark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {
  /* stockage indisponible */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TenantProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </TenantProvider>
  </StrictMode>,
);
