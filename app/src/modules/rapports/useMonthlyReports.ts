import { useMemo } from "react";
import { useCollection } from "@/core/data/useCollection";
import { sortReports } from "./rapports.logic";
import type { MonthlyReport } from "./rapports.types";

/** Rapports mensuels du restaurant courant, triés du plus ancien au plus récent. */
export function useMonthlyReports() {
  const { data, loading, error } = useCollection<MonthlyReport>("monthlyReports");
  const reports = useMemo(
    () => sortReports(data.map((d) => ({ ...d, period: d.period || d.id }))),
    [data],
  );
  return { reports, loading, error };
}
