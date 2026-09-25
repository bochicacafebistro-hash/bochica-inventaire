import { useParams } from "react-router";
import { ExternalLink } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { LEGACY_APP_URL } from "@/core/firebase";
import { findModule } from "@/modules/registry";
import type { LegacyModule } from "@/modules/types";
import { LinkButton } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { useCommon, useLang } from "@/core/i18n/i18n";
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
  const c = useCommon();
  const lang = useLang();
  return (
    <>
      <PageHeader eyebrow={c.notMigrated} title={lang === "es" && module.labelEs ? module.labelEs : module.label} />
      <Card style={{ maxWidth: 560 }}>
        <p style={{ marginBottom: "var(--sp-4)", color: "var(--text2)" }}>{c.legacyText}</p>
        <LinkButton href={LEGACY_APP_URL} target="_blank" rel="noreferrer">
          {c.openLegacy} <ExternalLink size={14} />
        </LinkButton>
      </Card>
    </>
  );
}

export function NotFound() {
  const c = useCommon();
  return (
    <>
      <PageHeader eyebrow={c.notFoundEyebrow} title={c.notFoundTitle} />
      <p style={{ color: "var(--text2)" }}>{c.notFoundText}</p>
    </>
  );
}
