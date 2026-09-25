import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/ui/chartTheme";
import { fmtMoney0, fmtMoneyCompact } from "@/ui/format";
import { CHANNELS, type ChannelKey, type ChannelRow } from "../rapports.logic";
import { ChartTooltipBox } from "./ChartTooltip";

interface TipProps {
  active?: boolean;
  payload?: readonly { payload?: ChannelRow }[];
}

/** Couleur fixe par canal (l'index dans CHANNELS), jamais selon le rang. */
export function channelColor(series: string[], key: ChannelKey): string {
  const i = CHANNELS.findIndex((c) => c.key === key);
  return series[i] ?? series[0]!;
}

export function ChannelsChart({ rows, active }: { rows: ChannelRow[]; active: ChannelKey[] }) {
  const t = useChartTheme();
  const tick = { fill: t.axis, fontSize: 12 };
  const top = active[active.length - 1];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="25%">
        <CartesianGrid vertical={false} stroke={t.grid} />
        <XAxis dataKey="label" tick={tick} axisLine={{ stroke: t.grid }} tickLine={false} interval="preserveStartEnd" />
        <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={fmtMoneyCompact} width={56} />
        <Tooltip
          cursor={{ fill: t.grid, opacity: 0.5 }}
          content={(p: TipProps) => {
            const row = p.active ? p.payload?.[0]?.payload : undefined;
            if (!row) return null;
            const lines = [...active]
              .reverse()
              .map((k) => ({
                label: CHANNELS.find((c) => c.key === k)!.label,
                value: fmtMoney0(row[k]),
                color: channelColor(t.series, k),
              }));
            const total = active.reduce((s, k) => s + row[k], 0);
            return <ChartTooltipBox title={`${row.label} · ${fmtMoney0(total)}`} lines={lines} />;
          }}
        />
        {active.map((k) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="canaux"
            fill={channelColor(t.series, k)}
            stroke={t.surface}
            strokeWidth={1}
            radius={k === top ? [4, 4, 0, 0] : 0}
            maxBarSize={32}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
