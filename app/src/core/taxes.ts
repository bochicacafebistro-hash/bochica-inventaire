/** Taxes du Québec (mêmes taux que la v1, config.js). */
export const TPS_RATE = 0.05;
export const TVQ_RATE = 0.09975;

export interface TaxBreakdown {
  preTax: number;
  tps: number;
  tvq: number;
  total: number;
}

/** Montant avant taxes → TPS, TVQ, total (sans arrondi intermédiaire, comme la v1). */
export function withTaxes(preTax: number): TaxBreakdown {
  const tps = preTax * TPS_RATE;
  const tvq = preTax * TVQ_RATE;
  return { preTax, tps, tvq, total: preTax + tps + tvq };
}
