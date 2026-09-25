import { Briefcase, Flag, MapPin, Mic, Music, Users, type LucideIcon } from "lucide-react";
import { typeIndex } from "./evenements.logic";

const ICONS: LucideIcon[] = [Users, Mic, Music, MapPin, Flag, Briefcase];

export function TypeIcon({ type, size = 12 }: { type?: string; size?: number }) {
  const Icon = ICONS[typeIndex(type)]!;
  return <Icon size={size} aria-hidden />;
}

/** Couleur d'identité du type (palette validée, voir ui/chartTheme). */
export function typeColor(series: string[], type?: string): string {
  return series[typeIndex(type)] ?? series[0]!;
}
