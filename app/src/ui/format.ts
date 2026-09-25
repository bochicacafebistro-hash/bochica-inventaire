/** Formats nombres/monnaie en français canadien. */
const money = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });
const money0 = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 1 });
const compact = new Intl.NumberFormat("fr-CA", { notation: "compact", maximumFractionDigits: 1 });

export const fmtMoney = (n: number) => money.format(n || 0);
export const fmtMoney0 = (n: number) => money0.format(n || 0);
export const fmtInt = (n: number) => int.format(n || 0);
export const fmtDec1 = (n: number) => dec1.format(n || 0);
/** 47 236 → « 47,2 k $ » (axes de graphiques). */
export const fmtMoneyCompact = (n: number) => `${compact.format(n || 0)} $`;
export const fmtPct = (n: number) => `${n > 0 ? "+" : ""}${dec1.format(n)} %`;
