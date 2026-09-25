import { addDays, todayISO } from "@/core/dates";
import { normalize } from "@/core/text";

/** Types et statuts : mêmes codes que la v1. */
export const EVENT_TYPES = [
  { key: "reservation", label: "Réservation privée", short: "Réservation" },
  { key: "karaoke", label: "Soirée karaoké", short: "Karaoké" },
  { key: "spectacle", label: "Soirée spectacle", short: "Spectacle" },
  { key: "hors_bochica", label: "Événement hors Bochica", short: "Hors Bochica" },
  { key: "ferie", label: "Journée fériée / fermeture", short: "Férié" },
  { key: "interne", label: "Événement interne", short: "Interne" },
] as const;

export type EventType = (typeof EVENT_TYPES)[number]["key"];

export const EVENT_STATUSES = [
  { key: "confirme", label: "Confirmé" },
  { key: "attente", label: "En attente" },
  { key: "annule", label: "Annulé" },
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number]["key"];

export interface BEvent {
  id: string;
  name?: string;
  date?: string; // AAAA-MM-JJ
  time?: string; // HH:MM
  type?: string;
  status?: string;
  capacity?: number | null;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  notes?: string;
}

/** Index du type dans la palette (couleur fixe par type). « special » (ancien) → interne. */
export function typeIndex(type?: string): number {
  const i = EVENT_TYPES.findIndex((t) => t.key === type);
  return i < 0 ? EVENT_TYPES.length - 1 : i;
}
export const typeLabel = (t?: string) => (t === "special" ? "Soirée spéciale" : (EVENT_TYPES.find((x) => x.key === t)?.label ?? "—"));
export const typeShort = (t?: string) => (t === "special" ? "Spécial" : (EVENT_TYPES.find((x) => x.key === t)?.short ?? "—"));
export const statusLabel = (s?: string) => EVENT_STATUSES.find((x) => x.key === s)?.label ?? "Confirmé";

const byDateTime = (a: BEvent, b: BEvent) =>
  (a.date ?? "").localeCompare(b.date ?? "") || (a.time || "99:99").localeCompare(b.time || "99:99");

export function filterEvents(list: BEvent[], type: string, query: string): BEvent[] {
  const q = normalize(query);
  return list
    .filter((e) => type === "all" || e.type === type)
    .filter((e) => !q || normalize(`${e.name ?? ""} ${e.contactName ?? ""} ${e.notes ?? ""}`).includes(q))
    .sort(byDateTime);
}

export function inRange(list: BEvent[], start: string, end: string): BEvent[] {
  return list.filter((e) => !!e.date && e.date >= start && e.date <= end).sort(byDateTime);
}

export function upcoming(list: BEvent[], days = 30, today = todayISO()): BEvent[] {
  return inRange(list, today, addDays(today, days));
}

export function byDate(list: BEvent[]): Map<string, BEvent[]> {
  const m = new Map<string, BEvent[]>();
  for (const e of [...list].sort(byDateTime)) {
    if (!e.date) continue;
    m.set(e.date, [...(m.get(e.date) ?? []), e]);
  }
  return m;
}

export interface EventDraft {
  name: string;
  date: string;
  time: string;
  type: EventType;
  status: EventStatus;
  capacity: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  notes: string;
}

export function toDraft(e: BEvent | null, presetDate?: string): EventDraft {
  return {
    name: e?.name ?? "",
    date: e?.date ?? presetDate ?? todayISO(),
    time: e?.time ?? "",
    type: (EVENT_TYPES.some((t) => t.key === e?.type) ? e!.type : "reservation") as EventType,
    status: (EVENT_STATUSES.some((s) => s.key === e?.status) ? e!.status : "confirme") as EventStatus,
    capacity: e?.capacity != null ? String(e.capacity) : "",
    contactName: e?.contactName ?? "",
    contactPhone: e?.contactPhone ?? "",
    contactEmail: e?.contactEmail ?? "",
    notes: e?.notes ?? "",
  };
}

export type DraftErrors = Partial<Record<keyof EventDraft, string>>;

export function validate(d: EventDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.name.trim()) e.name = "Le nom est obligatoire.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.date = "Choisis une date.";
  if (d.capacity.trim() && !(Number(d.capacity) >= 0)) e.capacity = "Nombre positif.";
  if (d.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.contactEmail.trim())) e.contactEmail = "Courriel invalide.";
  return e;
}

/** Champs Firestore (mêmes que la v1 ; capacité vide = null). */
export function toFields(d: EventDraft) {
  return {
    name: d.name.trim(),
    date: d.date,
    time: d.time || "",
    type: d.type,
    status: d.status,
    capacity: d.capacity.trim() === "" ? null : Math.max(0, Math.floor(Number(d.capacity) || 0)),
    contactName: d.contactName.trim(),
    contactPhone: d.contactPhone.trim(),
    contactEmail: d.contactEmail.trim(),
    notes: d.notes.trim(),
  };
}

/** Autres événements confirmés/en attente le même jour (avertissement de conflit). */
export function sameDayOthers(list: BEvent[], date: string, exceptId?: string): BEvent[] {
  return list
    .filter((e) => e.date === date && e.id !== exceptId && e.status !== "annule")
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));
}
