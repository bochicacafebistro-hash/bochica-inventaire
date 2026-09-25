import { useEffect, useState } from "react";
import { todayISO } from "./dates";

/**
 * Date du jour (AAAA-MM-JJ) qui change toute seule à minuit — la tablette
 * reste ouverte toute la nuit et les listes du jour doivent se réinitialiser.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = todayISO();
      setToday((cur) => (cur === t ? cur : t));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return today;
}
