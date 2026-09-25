import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/ui/chartTheme";
import { fmtMoney0 } from "@/ui/format";
import type { RankedRow } from "../rapports.logic";
import { ChartTooltipBox } from "./ChartTooltip";

interface TipProps {
  active?: boolean;
  payload?: readonly { payload?: RankedRow }[];
}

/** Barres horizontales classées (une seule série → une seule couleur). */
export function RankedBarsChart({ rows, share }: { rows: RankedRow[]; share?: boolean }) {
  const t = useChartTheme();
  const sum = rows.reduce((s, r) => s + r.total, 0);
  const label = (v: unknown) => {
    const n = Number(v) || 0;
    return share && sum > 0 ? `${fmtMoney0(n)} · ${Math.round((n / sum) * 100)} %` : fmtMoney0(n);
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 128, bottom: 0, left: 0 }} barCategoryGap="22%">
        <XAxis type="number" hide domain={[0, "dataMax"]} />
        <YAxis
          type="category"
          dataKey="name"
          width={130}
          tick={{ fill: t.ink2, fontSize: 12 }}
          axisLine={{ stroke: t.grid }}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.5 }}
          content={(p: TipProps) => {
            const row = p.active ? p.payload?.[0]?.payload : undefined;
            if (!row) return null;
            return <ChartTooltipBox title={row.name} lines={[{ label: "Total", value: label(row.total) }]} />;
          }}
        />
        <Bar dataKey="total" fill={t.series[0]} radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList dataKey="total" position="right" formatter={label} fill={t.ink2} fontSize={12} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
