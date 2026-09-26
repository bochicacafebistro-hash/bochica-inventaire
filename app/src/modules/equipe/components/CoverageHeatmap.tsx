import { useMemo, useState } from "react";
import { isoToDate } from "@/core/dates";
import { Segmented } from "@/ui/Segmented";
import type { Employee } from "../equipe.types";
import { coverageAt, coverageRange } from "../horaire.logic";
import styles from "../Horaire.module.css";

export type CoverageSection = "all" | "service" | "cuisine" | "other";
const SECS: { value: CoverageSection; label: string }[] = [
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
 * Générique : sert à l'horaire (jours datés) et à la simulation (jours de semaine).
 */
export function CoverageGrid<K extends string | number>({
  rows,
  range,
  count,
  subtitle = "Nombre d'employés présents à chaque heure",
}: {
  rows: { key: K; label: string }[];
  range: [number, number];
  count: (key: K, hour: number, sec: CoverageSection) => number;
  subtitle?: string;
}) {
  const [sec, setSec] = useState<CoverageSection>("all");
  const [from, to] = range;
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const grid = rows.map((r) => hours.map((h) => count(r.key, h, sec)));
  const max = Math.max(1, ...grid.flat());

  return (
    <section className={styles.card} aria-label="Couverture par heure">
      <div className={styles.cardHead}>
        <div>
          <h2 className={styles.cardTitle}>Couverture — employés sur le plancher</h2>
          <div className={styles.hint}>{subtitle}</div>
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
            {rows.map((row, r) => (
              <tr key={String(row.key)}>
                <th scope="row">{row.label}</th>
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

export function CoverageHeatmap({ emps, days }: { emps: Employee[]; days: string[] }) {
  const range = useMemo(() => coverageRange(emps, days), [emps, days]);
  const rows = days.map((dk) => ({ key: dk, label: isoToDate(dk)!.toLocaleDateString("fr-CA", { weekday: "short" }).replace(".", "") }));
  return <CoverageGrid rows={rows} range={range} count={(dk, h, sec) => coverageAt(emps, dk, h, sec)} />;
}
