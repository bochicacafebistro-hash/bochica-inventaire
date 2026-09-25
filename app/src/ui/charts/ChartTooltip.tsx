import styles from "./charts.module.css";

export interface TooltipLine {
  label: string;
  value: string;
  color?: string;
}

export function ChartTooltipBox({ title, lines }: { title: string; lines: TooltipLine[] }) {
  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>{title}</div>
      {lines.map((l) => (
        <div key={l.label} className={styles.tooltipRow}>
          {l.color && <span className={styles.swatch} style={{ background: l.color }} aria-hidden />}
          {l.label}
          <strong>{l.value}</strong>
        </div>
      ))}
    </div>
  );
}
