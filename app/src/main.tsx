import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AuthProvider } from "@/core/auth/AuthContext";
import { TenantProvider } from "@/core/tenant/TenantContext";
import { LangProvider } from "@/core/i18n/i18n";
import { router } from "@/app/router";
import { ConfirmProvider } from "@/ui/Confirm";
import { ToastProvider } from "@/ui/Toast";
import "@/ui/global.css";

// Applique le thème sauvegardé avant le premier rendu (évite un flash)
try {
  const saved = localStorage.getItem("bochica-theme");
  const dark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  if (localStorage.getItem("bochica-ui-lang") === "es") document.documentElement.lang = "es";
} catch {
  /* stockage indisponible */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LangProvider>
      <TenantProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <RouterProvider router={router} />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </TenantProvider>
    </LangProvider>
  </StrictMode>,
);
