import { fmtDec1, fmtInt, fmtMoney, fmtMoney0 } from "@/ui/format";
import { CHANNELS, monthLong, type ChannelKey, type ChannelRow, type MonthPoint, type RankedRow, type RecapRow } from "../rapports.logic";
import styles from "../Rapports.module.css";
import { Delta } from "./Delta";

export function MonthValuesTable({
  data,
  valueKey,
  prevKey,
  showPrev,
  format,
  upIsGood = true,
}: {
  data: MonthPoint[];
  valueKey: "revenue" | "tips" | "hours";
  prevKey: "revenuePrev" | "tipsPrev" | "hoursPrev";
  showPrev: boolean;
  format: (n: number) => string;
  upIsGood?: boolean;
}) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Mois</th>
          <th>Valeur</th>
          {showPrev && <th>Année préc.</th>}
          {showPrev && <th>Écart</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((d) => {
          const prev = d[prevKey];
          return (
            <tr key={d.period}>
              <td>{monthLong(d.period)}</td>
              <td className={styles.strong}>{format(d[valueKey])}</td>
              {showPrev && <td className={styles.dim}>{prev == null ? "—" : format(prev)}</td>}
              {showPrev && (
                <td>
                  <Delta value={prev ? ((d[valueKey] - prev) / prev) * 100 : null} upIsGood={upIsGood} />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function ChannelsTable({ rows, active }: { rows: ChannelRow[]; active: ChannelKey[] }) {
  const cols = CHANNELS.filter((c) => active.includes(c.key));
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Mois</th>
          {cols.map((c) => (
            <th key={c.key}>{c.label}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.period}>
            <td>{monthLong(r.period)}</td>
            {cols.map((c) => (
              <td key={c.key}>{fmtMoney0(r[c.key])}</td>
            ))}
            <td className={styles.strong}>{fmtMoney0(cols.reduce((s, c) => s + r[c.key], 0))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RankedTable({ rows, qtyLabel = "Transactions" }: { rows: RankedRow[]; qtyLabel?: string }) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Nom</th>
          <th>{qtyLabel}</th>
          <th>Montant</th>
          <th>Part</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td>{r.name}</td>
            <td>{fmtInt(r.qty)}</td>
            <td className={styles.strong}>{fmtMoney0(r.total)}</td>
            <td className={styles.dim}>{sum > 0 ? `${fmtDec1((r.total / sum) * 100)} %` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function TopItemsTable({ rows }: { rows: RankedRow[] }) {
  if (rows.length === 0) return <p className={styles.dim}>Aucun article dans la période sélectionnée.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>#</th>
          <th style={{ textAlign: "left" }}>Article</th>
          <th>Quantité</th>
          <th>Ventes</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.name}>
            <td className={styles.rank}>{i + 1}</td>
            <td style={{ textAlign: "left" }} className={styles.strong}>
              {r.name}
            </td>
            <td>{fmtInt(r.qty)}</td>
            <td>{r.total > 0 ? fmtMoney0(r.total) : <span className={styles.dim}>—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RecapTable({ rows, showYoy }: { rows: RecapRow[]; showYoy: boolean }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Mois</th>
          <th>Reçus</th>
          <th>Clients</th>
          <th>Reçu moy.</th>
          <th>Ventes nettes</th>
          <th>TPS+TVQ</th>
          <th>Total</th>
          <th>vs mois préc.</th>
          {showYoy && <th>Total A-1</th>}
          {showYoy && <th>vs A-1</th>}
          <th>Pourboires</th>
          <th>Heures</th>
          <th>Corrections</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.period}>
            <td className={styles.strong}>{monthLong(r.period)}</td>
            <td>{fmtInt(r.receipts)}</td>
            <td>{fmtInt(r.clients)}</td>
            <td>{fmtMoney(r.avgReceipt)}</td>
            <td>{fmtMoney0(r.salesNet)}</td>
            <td>{fmtMoney0(r.taxes)}</td>
            <td className={styles.strong}>{fmtMoney0(r.total)}</td>
            <td>
              <Delta value={r.deltaPrevMonth} />
            </td>
            {showYoy && <td className={styles.dim}>{r.totalPrevYear == null ? "—" : fmtMoney0(r.totalPrevYear)}</td>}
            {showYoy && (
              <td>
                <Delta value={r.deltaYoy} />
              </td>
            )}
            <td>{fmtMoney0(r.tips)}</td>
            <td>{r.hours > 0 ? `${fmtDec1(r.hours)} h` : <span className={styles.dim}>—</span>}</td>
            <td className={styles.dim}>{fmtMoney0(r.corrections)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
