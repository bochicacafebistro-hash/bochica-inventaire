import { useState, type ReactNode } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import styles from "../Rapports.module.css";

export interface LegendEntry {
  label: string;
  color: string;
  kind?: "box" | "line";
}

interface Props {
  title: string;
  subtitle?: string;
  legend?: LegendEntry[];
  full?: boolean;
  /** Le graphique */
  chart: ReactNode;
  /** Vue tableau équivalente (accessibilité + lecture exacte des valeurs) */
  table: ReactNode;
  /** Hauteur totale de la zone graphique (axes inclus) */
  height?: number;
}

export function ChartCard({ title, subtitle, legend, full, chart, table, height = 280 }: Props) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <section className={`${styles.card} ${full ? styles.full : ""}`} aria-label={title}>
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>{title}</h2>
          {subtitle && <div className={styles.cardSub}>{subtitle}</div>}
        </div>
        <div className={styles.viewSwitch} role="group" aria-label="Affichage">
          <button aria-pressed={view === "chart"} onClick={() => setView("chart")} title="Graphique">
            <ChartColumn size={16} aria-hidden />
            <span className="visually-hidden">Graphique</span>
          </button>
          <button aria-pressed={view === "table"} onClick={() => setView("table")} title="Tableau">
            <Table2 size={16} aria-hidden />
            <span className="visually-hidden">Tableau</span>
          </button>
        </div>
      </div>

      {view === "chart" ? (
        <>
          {legend && legend.length > 1 && (
            <div className={styles.legend}>
              {legend.map((l) => (
                <span key={l.label} className={styles.legendItem}>
                  <span
                    className={l.kind === "line" ? styles.swatchLine : styles.swatch}
                    style={{ background: l.color }}
                    aria-hidden
                  />
                  {l.label}
                </span>
              ))}
            </div>
          )}
          <div style={{ height }}>{chart}</div>
        </>
      ) : (
        <div className={styles.tableWrap}>{table}</div>
      )}
    </section>
  );
}
