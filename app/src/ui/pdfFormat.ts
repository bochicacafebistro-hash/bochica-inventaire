/** 1234.5 → « 1 234,50 $ » (espaces simples : les polices PDF standard n'ont pas l'espace fine). */
export function pdfMoney(n: number): string {
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const grouped = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n < 0 ? "-" : ""}${grouped},${dec} $`;
}
