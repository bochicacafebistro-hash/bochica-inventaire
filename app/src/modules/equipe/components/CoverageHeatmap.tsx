import { useMemo, useState } from "react";
import { isoToDate } from "@/core/dates";
import { Segmented } from "@/ui/Segmented";
import type { Employee } from "../equipe.types";
import { coverageAt, coverageRange } from "../horaire.logic";
import styles from "../Horaire.module.css";

type Sec = "all" | "service" | "cuisine" | "other";
const SECS: { value: Sec; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "service", label: "Service" },
  { value: "cuisine", label: "Cuisine" },
  { value: "other", label: "Autre" },
];

/**
 * Couverture : employés présents par heure et par jour. Carte de chaleur
 * (une seule teinte, plus foncé = plus de monde) avec le nombre écrit dans
 * chaque case — lisible sans la couleur, et c'est déjà un tableau.
 * (La v1 affichait 7 séries de barres superposées, difficiles à lire.)
 */
export function CoverageHeatmap({ emps, days }: { emps: Employee[]; days: string[] }) {
  const [sec, setSec] = useState<Sec>("all");
  const [from, to] = useMemo(() => coverageRange(emps, days), [emps, days]);
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const grid = useMemo(() => days.map((dk) => hours.map((h) => coverageAt(emps, dk, h, sec))), [emps, days, sec, from, to]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...grid.flat());

  return (
    <section className={styles.card} aria-label="Couverture par heure">
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Couverture — employés sur le plancher</h2>
          <div className={styles.hint}>Nombre d'employés présents à chaque heure</div>
        </div>
        <Segmented label="Section" value={sec} options={SECS} onChange={setSec} />
      </div>
      <div className={styles.heatWrap}>
        <table className={styles.heat}>
          <thead>
            <tr>
              <th scope="col">
                <span className="visually-hidden">Jour</span>
              </th>
              {hours.map((h) => (
                <th key={h} scope="col">
                  {h % 24}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((dk, r) => (
              <tr key={dk}>
                <th scope="row">{isoToDate(dk)!.toLocaleDateString("fr-CA", { weekday: "short" }).replace(".", "")}</th>
                {grid[r]!.map((n, c) => (
                  <td key={c} style={{ "--a": n / max } as React.CSSProperties} className={n === 0 ? styles.heatZero : n / max > 0.55 ? styles.heatDark : undefined} title={`${n} employé(s) à ${hours[c]! % 24} h`}>
                    {n || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
