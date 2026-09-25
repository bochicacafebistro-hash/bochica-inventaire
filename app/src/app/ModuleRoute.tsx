import { useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { LEGACY_APP_URL } from "@/core/firebase";
import { findModule } from "@/modules/registry";
import type { LegacyModule } from "@/modules/types";
import { LinkButton } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { PageHeader } from "@/ui/PageHeader";

export function ModuleRoute() {
  const { moduleId = "" } = useParams();
  const user = useSessionUser();
  const mod = findModule(moduleId);

  if (!mod || !mod.roles.includes(user.role)) return <NotFound />;
  if (mod.status === "legacy") return <LegacyModulePage module={mod} />;
  const Page = mod.page;
  return <Page />;
}

function LegacyModulePage({ module }: { module: LegacyModule }) {
  return (
    <>
      <PageHeader eyebrow="Pas encore migré" title={module.label} />
      <Card style={{ maxWidth: 560 }}>
        <p style={{ marginBottom: "var(--sp-4)", color: "var(--text2)" }}>
          Ce module fonctionne encore dans l'application actuelle. Tes données sont les mêmes des deux côtés : ce que
          tu modifies là-bas apparaîtra ici une fois le module migré.
        </p>
        <LinkButton href={LEGACY_APP_URL} target="_blank" rel="noreferrer">
          Ouvrir dans l'app actuelle <ExternalLink size={14} />
        </LinkButton>
      </Card>
    </>
  );
}

export function NotFound() {
  return (
    <>
      <PageHeader eyebrow="Erreur 404" title="Page introuvable" />
      <p style={{ color: "var(--text2)" }}>Cette page n'existe pas ou tu n'y as pas accès.</p>
    </>
  );
}
