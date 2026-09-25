import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtMoney0, fmtMoneyCompact } from "@/ui/format";
import { ChartTooltipBox } from "./ChartTooltip";
import { useChartTheme } from "../chartTheme";

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
}

interface TipProps {
  active?: boolean;
  payload?: readonly { payload?: Record<string, unknown> }[];
}

/** Colonnes groupées sur un seul axe ($). La légende est affichée par ChartCard. */
export function ColumnsChart({
  data,
  series,
  labelKey = "label",
  format = fmtMoney0,
  extraTooltip,
}: {
  data: Record<string, unknown>[];
  series: ColumnSeries[];
  labelKey?: string;
  format?: (n: number) => string;
  extraTooltip?: (row: Record<string, unknown>) => { label: string; value: string } | null;
}) {
  const t = useChartTheme();
  const tick = { fill: t.axis, fontSize: 12 };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey={labelKey} tick={tick} axisLine={{ stroke: t.grid }} tickLine={false} />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={fmtMoneyCompact} width={56} />
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.5 }}
          content={(p: TipProps) => {
            const row = p.active ? p.payload?.[0]?.payload : undefined;
            if (!row) return null;
            const lines: { label: string; value: string; color?: string }[] = series.map((s) => ({
              label: s.label,
              value: format(Number(row[s.key]) || 0),
              color: s.color,
            }));
            const extra = extraTooltip?.(row);
            if (extra) lines.push(extra);
            return <ChartTooltipBox title={String(row[labelKey])} lines={lines} />;
          }}
        />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={24} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
