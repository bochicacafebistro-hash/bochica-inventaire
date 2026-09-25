import { Clock, Pencil, Printer, Timer, Users, Utensils } from "lucide-react";
import { Button } from "@/ui/Button";
import { Markdown } from "@/ui/Markdown";
import { autoList } from "@/ui/mdParse";
import { Modal } from "@/ui/Modal";
import { recipeCatLabel, totalTime } from "../cuisine.logic";
import type { Recipe } from "../cuisine.types";
import styles from "../Cuisine.module.css";

export function RecipeView({ recipe: r, onClose, onEdit }: { recipe: Recipe; onClose: () => void; onEdit?: () => void }) {
  const total = totalTime(r);
  return (
    <Modal
      open
      title={r.name ?? ""}
      onClose={onClose}
      width={700}
      footer={
        <>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} aria-hidden /> Imprimer
          </Button>
          {onEdit && (
            <Button onClick={onEdit}>
              <Pencil size={16} aria-hidden /> Modifier
            </Button>
          )}
        </>
      }
    >
      {r.category && <div className={styles.sub}>{recipeCatLabel(r.category)}</div>}
      {r.description && <p className={styles.desc}>{r.description}</p>}
      <div className={styles.viewMeta}>
        {!!r.servings && (
          <div className={styles.viewMetaItem}>
            <div className={styles.metricLabel}>
              <Users size={12} aria-hidden /> Portions
            </div>
            <div className={styles.metricValue}>{r.servings}</div>
          </div>
        )}
        {!!r.prepTime && (
          <div className={styles.viewMetaItem}>
            <div className={styles.metricLabel}>
              <Clock size={12} aria-hidden /> Préparation
            </div>
            <div className={styles.metricValue}>{r.prepTime} min</div>
          </div>
        )}
        {!!r.cookTime && (
          <div className={styles.viewMetaItem}>
            <div className={styles.metricLabel}>
              <Utensils size={12} aria-hidden /> Cuisson
            </div>
            <div className={styles.metricValue}>{r.cookTime} min</div>
          </div>
        )}
        {total > 0 && (
          <div className={styles.viewMetaItem}>
            <div className={styles.metricLabel}>
              <Timer size={12} aria-hidden /> Total
            </div>
            <div className={styles.metricValue}>{total} min</div>
          </div>
        )}
      </div>
      <section className={styles.section}>
        <h3>Ingrédients</h3>
        {r.ingredients?.trim() ? <Markdown text={autoList(r.ingredients, "bullet")} /> : <p className={styles.empty}>Aucun ingrédient indiqué.</p>}
      </section>
      <section className={styles.section}>
        <h3>Étapes</h3>
        {r.steps?.trim() ? <Markdown text={autoList(r.steps, "numbered")} /> : <p className={styles.empty}>Aucune étape indiquée.</p>}
      </section>
      {r.tips?.trim() && (
        <section className={`${styles.section} ${styles.tips}`}>
          <h3>Astuces</h3>
          <Markdown text={r.tips} />
        </section>
      )}
    </Modal>
  );
}
