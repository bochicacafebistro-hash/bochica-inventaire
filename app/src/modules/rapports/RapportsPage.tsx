import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { LEGACY_APP_URL } from "@/core/firebase";
import { useChartTheme } from "@/ui/chartTheme";
import { LinkButton } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { fmtDec1, fmtInt, fmtMoney, fmtMoney0, fmtMoneyCompact } from "@/ui/format";
import {
  CHANNELS,
  categoriesRanking,
  channelSeries,
  filterReports,
  foldTail,
  monthLong,
  monthlySeries,
  paymentsRanking,
  pctDelta,
  recapRows,
  topItems,
  totals,
  yoyComparison,
  type PeriodFilter,
  type PeriodPreset,
  type Totals,
} from "./rapports.logic";
import { useMonthlyReports } from "./useMonthlyReports";
import { ChartCard } from "./components/ChartCard";
import { ChannelsChart, channelColor } from "./components/ChannelsChart";
import { Delta } from "./components/Delta";
import { MonthBarsChart } from "./components/MonthBarsChart";
import { RankedBarsChart } from "./components/RankedBarsChart";
import { ChannelsTable, MonthValuesTable, RankedTable, RecapTable, TopItemsTable } from "./components/Tables";
import styles from "./Rapports.module.css";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "3", label: "3 mois" },
  { value: "6", label: "6 mois" },
  { value: "12", label: "12 mois" },
  { value: "all", label: "Tout" },
  { value: "custom", label: "Personnalisé" },
];

const CUR = "Cette période";
const PREV = "Année précédente";
const fmtHours = (h: number) => `${fmtDec1(h)} h`;
const fmtHoursAxis = (h: number) => fmtInt(h);

export default function RapportsPage() {
  const { reports, loading, error } = useMonthlyReports();
  const [filter, setFilter] = useState<PeriodFilter>({ preset: "12" });
  const [compareYoy, setCompareYoy] = useState(true);
  const t = useChartTheme();

  const view = useMemo(() => {
    const selected = filterReports(reports, filter);
    return {
      selected,
      totals: totals(selected),
      yoy: yoyComparison(selected, reports),
      months: monthlySeries(selected, reports),
      channels: channelSeries(selected),
      payments: foldTail(paymentsRanking(selected), 7),
      categories: foldTail(categoriesRanking(selected), 10),
      items: topItems(selected, 15),
      recap: recapRows(selected, reports),
    };
  }, [reports, filter]);

  if (loading) return <Spinner label="Chargement des rapports…" />;

  if (error) {
    return (
      <>
        <PageHeader eyebrow="Finances" title="Rapports mensuels" />
        <Card className={styles.empty}>
          <p>Impossible de lire les rapports : {error.message}</p>
        </Card>
      </>
    );
  }

  if (reports.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Finances" title="Rapports mensuels" />
        <Card className={styles.empty}>
          <p>
            Aucun rapport importé pour l'instant. L'import des rapports Cluster se fait encore dans l'app actuelle
            (bouton « Importer seed »).
          </p>
          <LinkButton href={LEGACY_APP_URL} target="_blank" rel="noreferrer">
            Ouvrir l'app actuelle <ExternalLink size={14} />
          </LinkButton>
        </Card>
      </>
    );
  }

  const first = reports[0]!.period;
  const last = reports[reports.length - 1]!.period;
  const showPrev = compareYoy && view.yoy !== null;
  const monthLegend = [
    ...(showPrev ? [{ label: PREV, color: t.muted }] : []),
    { label: CUR, color: t.series[0]! },
  ];

  function setPreset(preset: PeriodPreset) {
    setFilter((f) => (preset === "custom" ? { preset, start: f.start ?? first, end: f.end ?? last } : { preset }));
  }

  return (
    <>
      <PageHeader
        eyebrow="Finances"
        title="Rapports mensuels"
      />

      {/* ── Filtres (s'appliquent à tout ce qui suit) ── */}
      <div className={styles.filters}>
        <div className={styles.segmented} role="group" aria-label="Période">
          {PRESETS.map((p) => (
            <button key={p.value} aria-pressed={filter.preset === p.value} onClick={() => setPreset(p.value)}>
              {p.label}
            </button>
          ))}
        </div>
        {filter.preset === "custom" && (
          <div className={styles.range}>
            <label>
              <span className="visually-hidden">Début</span>
              <input
                type="month"
                className={styles.monthInput}
                min={first}
                max={last}
                value={filter.start ?? first}
                onChange={(e) => setFilter((f) => ({ ...f, start: e.target.value }))}
              />
            </label>
            →
            <label>
              <span className="visually-hidden">Fin</span>
              <input
                type="month"
                className={styles.monthInput}
                min={first}
                max={last}
                value={filter.end ?? last}
                onChange={(e) => setFilter((f) => ({ ...f, end: e.target.value }))}
              />
            </label>
          </div>
        )}
        <label className={styles.toggle}>
          <input type="checkbox" checked={compareYoy} onChange={(e) => setCompareYoy(e.target.checked)} />
          Comparer à l'année précédente
        </label>
        <span className={styles.count}>
          {view.selected.length > 0
            ? `${monthLong(view.selected[0]!.period)} → ${monthLong(view.selected[view.selected.length - 1]!.period)} · ${view.selected.length} mois`
            : "Aucun mois dans cette période"}
        </span>
      </div>

      {compareYoy && view.yoy === null && view.selected.length > 0 && (
        <p className={styles.note} style={{ marginTop: "-12px", marginBottom: "var(--sp-4)" }}>
          Aucun rapport de l'année précédente pour ces mois — comparaison indisponible.
        </p>
      )}

      {/* ── KPI ── */}
      <div className={styles.kpis}>
        <Kpi label="Ventes totales" value={fmtMoney0(view.totals.revenue)} metric="revenue" yoy={showPrev ? view.yoy : null} format={fmtMoney0} />
        <Kpi label="Reçus" value={fmtInt(view.totals.receipts)} metric="receipts" yoy={showPrev ? view.yoy : null} format={fmtInt} />
        <Kpi label="Clients servis" value={fmtInt(view.totals.clients)} metric="clients" yoy={showPrev ? view.yoy : null} format={fmtInt} />
        <Kpi label="Reçu moyen" value={fmtMoney(view.totals.avgReceipt)} metric="avgReceipt" yoy={showPrev ? view.yoy : null} format={fmtMoney} />
        <Kpi label="Pourboires" value={fmtMoney0(view.totals.tips)} metric="tips" yoy={showPrev ? view.yoy : null} format={fmtMoney0} />
        <Kpi label="Heures travaillées" value={fmtHours(view.totals.hours)} metric="hours" yoy={showPrev ? view.yoy : null} format={fmtHours} neutral />
      </div>

      {view.selected.length > 0 && (
        <div className={styles.grid}>
          <ChartCard
            full
            title="Ventes par mois"
            subtitle="Total avec taxes"
            legend={monthLegend}
            height={300}
            chart={
              <MonthBarsChart
                data={view.months}
                valueKey="revenue"
                prevKey="revenuePrev"
                showPrev={showPrev}
                currentLabel={CUR}
                prevLabel={PREV}
                format={fmtMoney0}
                formatAxis={fmtMoneyCompact}
              />
            }
            table={<MonthValuesTable data={view.months} valueKey="revenue" prevKey="revenuePrev" showPrev={showPrev} format={fmtMoney0} />}
          />

          <ChartCard
            title="Pourboires par mois"
            legend={monthLegend}
            chart={
              <MonthBarsChart
                data={view.months}
                valueKey="tips"
                prevKey="tipsPrev"
                showPrev={showPrev}
                currentLabel={CUR}
                prevLabel={PREV}
                format={fmtMoney0}
                formatAxis={fmtMoneyCompact}
              />
            }
            table={<MonthValuesTable data={view.months} valueKey="tips" prevKey="tipsPrev" showPrev={showPrev} format={fmtMoney0} />}
          />

          <ChartCard
            title="Heures travaillées par mois"
            subtitle="Mois vide = heures absentes du rapport"
            legend={monthLegend}
            chart={
              <MonthBarsChart
                data={view.months}
                valueKey="hours"
                prevKey="hoursPrev"
                showPrev={showPrev}
                currentLabel={CUR}
                prevLabel={PREV}
                format={fmtHours}
                formatAxis={fmtHoursAxis}
              />
            }
            table={
              <MonthValuesTable data={view.months} valueKey="hours" prevKey="hoursPrev" showPrev={showPrev} format={fmtHours} upIsGood={false} />
            }
          />

          <ChartCard
            full
            title="Ventes par canal"
            subtitle="Total avec taxes, par mois"
            legend={view.channels.active.map((k) => ({
              label: CHANNELS.find((c) => c.key === k)!.label,
              color: channelColor(t.series, k),
            }))}
            height={300}
            chart={<ChannelsChart rows={view.channels.rows} active={view.channels.active} />}
            table={<ChannelsTable rows={view.channels.rows} active={view.channels.active} />}
          />

          <ChartCard
            title="Modes de paiement"
            subtitle="Montant facturé sur la période (sans pourboires)"
            height={Math.max(160, view.payments.length * 34)}
            chart={<RankedBarsChart rows={view.payments} share />}
            table={<RankedTable rows={view.payments} />}
          />

          <ChartCard
            title="Ventes par catégorie"
            subtitle="Total sur la période"
            height={Math.max(160, view.categories.length * 30)}
            chart={<RankedBarsChart rows={view.categories} share />}
            table={<RankedTable rows={view.categories} qtyLabel="Articles" />}
          />

          <section className={`${styles.card} ${styles.full}`} aria-label="Top 15 produits">
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Top 15 produits</h2>
                <div className={styles.cardSub}>Quantités vendues sur la période</div>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <TopItemsTable rows={view.items} />
            </div>
          </section>

          <section className={`${styles.card} ${styles.full}`} aria-label="Récapitulatif mois par mois">
            <div className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Récapitulatif mois par mois</h2>
                <div className={styles.cardSub}>Tous les indicateurs côte à côte</div>
              </div>
            </div>
            <div className={styles.tableWrap}>
              <RecapTable rows={view.recap} showYoy={showPrev} />
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function Kpi({
  label,
  value,
  metric,
  yoy,
  format,
  neutral,
}: {
  label: string;
  value: string;
  metric: keyof Totals;
  yoy: ReturnType<typeof yoyComparison>;
  format: (n: number) => string;
  neutral?: boolean;
}) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {yoy && (
        <div className={styles.kpiDelta}>
          {yoy.previous[metric] > 0 ? (
            <>
              <Delta value={pctDelta(yoy.current[metric], yoy.previous[metric])} upIsGood={!neutral} />
              <span>
                {yoy.comparableMonths === 1 ? "sur 1 mois comparable" : `sur ${yoy.comparableMonths} mois comparables`} :{" "}
                {format(yoy.current[metric])} vs {format(yoy.previous[metric])}
              </span>
            </>
          ) : (
            <span>Pas de donnée l'an dernier pour comparer</span>
          )}
        </div>
      )}
    </div>
  );
}
