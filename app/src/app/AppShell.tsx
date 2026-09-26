import { Suspense, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { Eye, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useAuth, useSessionUser, type PreviewRole } from "@/core/auth/AuthContext";
import { ROLE_LABELS, ROLE_LABELS_ES } from "@/core/auth/roles";
import { LANGS, useLang, useMessages, useSetLang, type Messages } from "@/core/i18n/i18n";
import { modulesForRole } from "@/modules/registry";
import { NAV_GROUP_LABELS, NAV_GROUP_LABELS_ES, type AppModule, type NavGroup } from "@/modules/types";
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

const fr = {
  nav: "Navigation principale",
  closeMenu: "Fermer le menu",
  openMenu: "Ouvrir le menu",
  theme: "Changer de thème",
  light: "Clair",
  dark: "Sombre",
  logout: "Déconnexion",
  language: "Langue",
  viewAs: "Voir l'app comme",
  asAdmin: "Admin (moi)",
  asChef: "Chef de cuisine",
  asEmployee: "Employé (tablette)",
  preview: "Aperçu",
  previewHint: "tu vois l'app comme ce rôle. Tes modifications sont réelles.",
  backToAdmin: "Revenir en admin",
};
const MESSAGES: Messages<typeof fr> = {
  fr,
  es: {
    nav: "Navegación principal",
    closeMenu: "Cerrar el menú",
    openMenu: "Abrir el menú",
    theme: "Cambiar el tema",
    light: "Claro",
    dark: "Oscuro",
    logout: "Cerrar sesión",
    language: "Idioma",
    viewAs: "Ver la app como",
    asAdmin: "Admin (yo)",
    asChef: "Jefe de cocina",
    asEmployee: "Empleado (tableta)",
    preview: "Vista previa",
    previewHint: "ves la app como este rol. Tus cambios son reales.",
    backToAdmin: "Volver a admin",
  },
};

export function AppShell() {
  const user = useSessionUser();
  const { logout, previewRole, setPreviewRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isRealAdmin = user.realRole === "global_admin";
  const changePreview = (r: PreviewRole | null) => {
    setPreviewRole(r);
    setMenuOpen(false);
    navigate("/");
  };
  const { theme, toggle } = useTheme();
  const m = useMessages(MESSAGES);
  const lang = useLang();
  const setLang = useSetLang();
  const es = lang === "es";
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
      <aside className={`${styles.sidebar} ${menuOpen ? styles.open : ""}`} aria-label={m.nav}>
        <div className={styles.brand}>
          <Link to="/" className={styles.logo}>
            BOCHI<span>CA</span>
          </Link>
          <button className={styles.closeBtn} onClick={() => setMenuOpen(false)} aria-label={m.closeMenu}>
            <X size={22} />
          </button>
        </div>

        <nav className={styles.nav}>
          {groups.map(([group, modules]) => (
            <div key={group} className={styles.group}>
              {group !== "general" && <div className={styles.groupLabel}>{(es ? NAV_GROUP_LABELS_ES : NAV_GROUP_LABELS)[group]}</div>}
              {modules.map((mod) => (
                <NavLink
                  key={mod.id}
                  to={`/${mod.id}`}
                  className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}
                >
                  <mod.icon size={16} aria-hidden />
                  <span className={styles.linkLabel}>{es && mod.labelEs ? mod.labelEs : mod.label}</span>
                  {mod.status === "legacy" && <span className={styles.legacyTag}>V1</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <div className={styles.user}>
            <div>{user.email}</div>
            <div className={styles.userRole}>{(es ? ROLE_LABELS_ES : ROLE_LABELS)[user.role]}</div>
          </div>
          {isRealAdmin && (
            <label className={styles.preview}>
              <span>
                <Eye size={12} aria-hidden /> {m.viewAs}
              </span>
              <select value={previewRole ?? ""} onChange={(e) => changePreview((e.target.value || null) as PreviewRole | null)}>
                <option value="">{m.asAdmin}</option>
                <option value="chef">{m.asChef}</option>
                <option value="employee">{m.asEmployee}</option>
              </select>
            </label>
          )}
          <div className={styles.langSwitch} role="group" aria-label={m.language}>
            {LANGS.map((l) => (
              <button key={l.value} aria-pressed={lang === l.value} onClick={() => setLang(l.value)} lang={l.value}>
                {l.label}
              </button>
            ))}
          </div>
          <div className={styles.footerActions}>
            <button className={styles.iconBtn} onClick={toggle} aria-label={m.theme}>
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? m.light : m.dark}
            </button>
            <button className={styles.iconBtn} onClick={() => void logout()}>
              <LogOut size={14} /> {m.logout}
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
          <button onClick={() => setMenuOpen(true)} aria-label={m.openMenu}>
            <Menu size={22} />
          </button>
          <span className={styles.logo}>
            BOCHI<span>CA</span>
          </span>
        </div>
        {previewRole && (
          <div className={styles.previewBar} role="status">
            <Eye size={16} aria-hidden />
            <span>
              <strong>
                {m.preview} : {(es ? ROLE_LABELS_ES : ROLE_LABELS)[previewRole]}
              </strong>{" "}
              — {m.previewHint}
            </span>
            <button onClick={() => changePreview(null)}>{m.backToAdmin}</button>
          </div>
        )}
        <main className={styles.main}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
