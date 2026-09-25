import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/ui/chartTheme";
import type { MonthPoint } from "../rapports.logic";
import { ChartTooltipBox } from "./ChartTooltip";

type NumKey = "revenue" | "tips" | "hours";
type PrevKey = "revenuePrev" | "tipsPrev" | "hoursPrev";

interface Props {
  data: MonthPoint[];
  valueKey: NumKey;
  prevKey: PrevKey;
  showPrev: boolean;
  currentLabel: string;
  prevLabel: string;
  format: (n: number) => string;
  formatAxis: (n: number) => string;
}

interface TipProps {
  active?: boolean;
  payload?: readonly { payload?: MonthPoint }[];
}

/** Colonnes mensuelles, avec colonne « année précédente » en gris si activée. */
export function MonthBarsChart({ data, valueKey, prevKey, showPrev, currentLabel, prevLabel, format, formatAxis }: Props) {
  const t = useChartTheme();
  const tick = { fill: t.axis, fontSize: 12 };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barGap={2} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: t.grid }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={formatAxis} width={56} />
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.5 }}
          content={(p: TipProps) => {
            const pt = p.active ? p.payload?.[0]?.payload : undefined;
            if (!pt) return null;
            const lines = [{ label: currentLabel, value: format(pt[valueKey]), color: t.series[0] }];
            if (showPrev && pt[prevKey] != null) {
              lines.push({ label: prevLabel, value: format(pt[prevKey] ?? 0), color: t.muted });
            }
            return <ChartTooltipBox title={pt.label} lines={lines} />;
          }}
        />
        {showPrev && (
          <Bar dataKey={prevKey} name={prevLabel} fill={t.muted} radius={[4, 4, 0, 0]} maxBarSize={24} />
        )}
        <Bar dataKey={valueKey} name={currentLabel} fill={t.series[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
