import { Link } from "react-router";
import { displayName } from "@/core/auth/roles";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useTenant } from "@/core/tenant/TenantContext";
import { EmployeeHome } from "@/modules/equipe/EmployeeHome";
import { modulesForRole } from "@/modules/registry";
import { PageHeader } from "@/ui/PageHeader";
import { AdminDashboard } from "./AdminDashboard";
import styles from "./AccueilPage.module.css";

/** Accueil : tableau de bord (admin), raccourcis (chef), espace employé (tablette). */
export default function AccueilPage() {
  const user = useSessionUser();
  if (user.role === "employee") return <EmployeeHome />;
  if (user.role === "global_admin") return <AdminDashboard />;
  return <ChefHome />;
}

function ChefHome() {
  const user = useSessionUser();
  const tenant = useTenant();
  const modules = modulesForRole(user.role).filter((m) => m.id !== "accueil");
  return (
    <>
      <PageHeader eyebrow={tenant.name} title={`Bonjour, ${displayName(user.email)}`} />
      <ul className={styles.shortcuts}>
        {modules.map((m) => (
          <li key={m.id}>
            <Link to={`/${m.id}`} className={styles.shortcut}>
              <m.icon size={22} aria-hidden />
              {m.label}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
