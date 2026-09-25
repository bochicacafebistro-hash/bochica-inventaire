import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useAuth, useSessionUser } from "@/core/auth/AuthContext";
import { ROLE_LABELS } from "@/core/auth/roles";
import { modulesForRole } from "@/modules/registry";
import { NAV_GROUP_LABELS, type AppModule, type NavGroup } from "@/modules/types";
import { Spinner } from "@/ui/Spinner";
import { useTheme } from "@/ui/useTheme";
import styles from "./AppShell.module.css";

function groupModules(modules: AppModule[]) {
  const groups = new Map<NavGroup, AppModule[]>();
  for (const m of modules) {
    const list = groups.get(m.group) ?? [];
    list.push(m);
    groups.set(m.group, list);
  }
  return [...groups.entries()];
}

export function AppShell() {
  const user = useSessionUser();
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const groups = groupModules(modulesForRole(user.role));

  // Ferme le menu mobile à chaque navigation
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setMenuOpen(false);
  }

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ""}`} aria-label="Navigation principale">
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            BOCHI<span>CA</span>
          </Link>
          <button className={styles.closeBtn} onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">
            <X size={22} />
          </button>
        </div>

        <nav className={styles.nav}>
          {groups.map(([group, modules]) => (
            <div key={group} className={styles.group}>
              {group !== "general" && <div className={styles.groupLabel}>{NAV_GROUP_LABELS[group]}</div>}
              {modules.map((m) => (
                <NavLink
                  key={m.id}
                  to={`/${m.id}`}
                  className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}
                >
                  <m.icon size={16} aria-hidden />
                  <span className={styles.linkLabel}>{m.label}</span>
                  {m.status === "legacy" && <span className={styles.legacyTag}>V1</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.user}>
            <div>{user.email}</div>
            <div className={styles.userRole}>{ROLE_LABELS[user.role]}</div>
          </div>
          <div className={styles.footerActions}>
            <button className={styles.iconBtn} onClick={toggle} aria-label="Changer de thème">
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Clair" : "Sombre"}
            </button>
            <button className={styles.iconBtn} onClick={() => void logout()}>
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        </div>
      </aside>

      <div
        className={`${styles.backdrop} ${menuOpen ? styles.open : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />

      <div>
        <div className={styles.topbar}>
          <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu">
            <Menu size={22} />
          </button>
          <span className={styles.logo}>
            BOCHI<span>CA</span>
          </span>
        </div>
        <main className={styles.main}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
