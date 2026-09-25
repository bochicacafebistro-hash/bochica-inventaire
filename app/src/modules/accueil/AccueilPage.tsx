import { useSessionUser } from "@/core/auth/AuthContext";
import { ROLE_LABELS } from "@/core/auth/roles";
import { useCollection } from "@/core/data/useCollection";
import { useTenant } from "@/core/tenant/TenantContext";
import { modulesForRole } from "@/modules/registry";
import { Card } from "@/ui/Card";
import { PageHeader } from "@/ui/PageHeader";
import styles from "./AccueilPage.module.css";

export default function AccueilPage() {
  const user = useSessionUser();
  const tenant = useTenant();
  const modules = modulesForRole(user.role);
  const migrated = modules.filter((m) => m.status === "migrated").length;
  const pct = Math.round((migrated / modules.length) * 100);

  // Preuve de connexion Firestore : lecture temps réel de l'inventaire
  const products = useCollection<{ archived?: boolean }>("products");
  const activeProducts = products.data.filter((p) => !p.archived).length;

  return (
    <>
      <PageHeader eyebrow={tenant.name} title="Bienvenue" />

      <div className={styles.grid}>
        <Card>
          <div className={styles.statLabel}>Connecté en tant que</div>
          <div className={styles.statValue}>{ROLE_LABELS[user.role]}</div>
          <div className={styles.statHint}>{user.email}</div>
        </Card>

        <Card>
          <div className={styles.statLabel}>Produits en inventaire</div>
          <div className={styles.statValue}>{products.loading ? "…" : activeProducts}</div>
          <div className={`${styles.statHint} ${products.error ? styles.error : ""}`}>
            {products.error ? `Lecture impossible : ${products.error.message}` : "Lecture Firestore en temps réel"}
          </div>
        </Card>

        <Card>
          <div className={styles.statLabel}>Migration vers la v2</div>
          <div className={styles.statValue}>
            {migrated} / {modules.length}
          </div>
          <div className={styles.statHint}>modules réécrits en React</div>
          <div
            className={styles.bar}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la migration"
          >
            <div className={styles.barFill} style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </Card>
      </div>

      <h2 className={styles.sectionTitle}>Modules</h2>
      <ul className={styles.list}>
        {modules.map((m) => (
          <li key={m.id} className={styles.item}>
            <span className={`${styles.dot} ${m.status === "migrated" ? styles.dotDone : ""}`} aria-hidden />
            <m.icon size={14} aria-hidden />
            {m.label}
            <span className="visually-hidden">{m.status === "migrated" ? "(migré)" : "(app actuelle)"}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
