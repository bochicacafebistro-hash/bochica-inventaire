/**
 * Soumissions — calculs repris à l'identique de js/pages-quotes.js (v1).
 */
import { addDays, isoToDate, monthName, todayISO } from "@/core/dates";
import { withTaxes } from "@/core/taxes";
import { normalize } from "@/core/text";
import type { CustomLine, PackageOption, Quote, QuoteTemplate, RoomRental } from "./soumissions.types";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);

export const QUOTE_STATUSES = [
  { key: "brouillon", label: "Brouillon" },
  { key: "envoyee", label: "Envoyée" },
  { key: "acceptee", label: "Acceptée" },
  { key: "refusee", label: "Refusée" },
  { key: "expiree", label: "Expirée" },
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number]["key"];

export const QUOTE_VENUES = [
  { key: "bochica", label: "Au restaurant Bochica" },
  { key: "client", label: "Chez le client" },
  { key: "autre", label: "Autre lieu" },
] as const;

export const ACCENTS = [
  { key: "yellow", label: "Jaune", hex: "#F7B32C" },
  { key: "red", label: "Rouge", hex: "#e74c3c" },
  { key: "blue", label: "Bleu", hex: "#4a90e2" },
  { key: "green", label: "Vert", hex: "#7dbf66" },
] as const;

export const statusLabel = (s?: string) => QUOTE_STATUSES.find((x) => x.key === s)?.label ?? "Brouillon";
export const venueLabel = (v?: string) => QUOTE_VENUES.find((x) => x.key === v)?.label ?? "—";
export const accentHex = (c?: string) => ACCENTS.find((a) => a.key === c)?.hex ?? ACCENTS[0].hex;
export const optionLetter = (i: number) => String.fromCharCode(65 + (i % 26));

/** Forfaits par défaut (v1, config.js) — proposés si la collection est vide. */
export const DEFAULT_TEMPLATES: QuoteTemplate[] = [
  {
    id: "forfait-essentiel",
    name: "L'Essentiel",
    label: "Forfait Un",
    pricePerPerson: 22,
    accentColor: "yellow",
    entree: "1 empanada au bœuf ou au poulet par personne",
    plat: "Arepa classique ou végé",
    boisson: "Une boisson gazeuse colombienne ou autre",
    beerPrice: 7,
    dessertPrice: 6,
    sortOrder: 0,
  },
  {
    id: "forfait-gourmand",
    name: "Le Gourmand",
    label: "Forfait Deux",
    pricePerPerson: 27,
    accentColor: "red",
    entree: "1 empanada au bœuf ou au poulet par personne",
    plat: "Bol Bogota, Bol Medellin, Bol végé, Salchipapas ou Bochica Burger",
    boisson: "Une boisson gazeuse colombienne ou autre",
    beerPrice: 7,
    dessertPrice: 6,
    sortOrder: 1,
  },
];

// ── Lecture rétrocompatible ───────────────────────────

/** Toujours un tableau d'options (nouveau format `packageOptions[]` ou ancien format à plat). */
export function getOptions(q: Quote): PackageOption[] {
  const norm = (o: Partial<PackageOption>, i: number): PackageOption => ({
    id: o.id || `opt-${i}`,
    packageId: o.packageId ?? "",
    packageSnapshot: o.packageSnapshot ?? null,
    beerAddon: !!o.beerAddon,
    dessertAddon: !!o.dessertAddon,
    customLines: Array.isArray(o.customLines) ? o.customLines : [],
    depositAmount: Math.max(0, num(o.depositAmount)),
    depositPaid: !!o.depositPaid,
  });
  if (Array.isArray(q.packageOptions) && q.packageOptions.length > 0) return q.packageOptions.map(norm);
  if (q.packageId || q.packageSnapshot) {
    return [
      norm(
        {
          id: "legacy",
          packageId: q.packageId,
          packageSnapshot: q.packageSnapshot,
          beerAddon: q.beerAddon,
          dessertAddon: q.dessertAddon,
          customLines: q.customLines,
          depositAmount: q.depositAmount,
          depositPaid: q.depositPaid,
        },
        0,
      ),
    ];
  }
  return [];
}

export function getRooms(q: Quote): RoomRental[] {
  if (!Array.isArray(q.roomRentals)) return [];
  return q.roomRentals.map((r, i) => ({
    id: r.id || `room-${i}`,
    date: r.date || "",
    startTime: r.startTime || "",
    endTime: r.endTime || "",
    description: r.description || "",
    price: Math.max(0, num(r.price)),
  }));
}

/** Forfait figé dans la soumission, sinon le forfait actuel. */
export function templateOf(opt: PackageOption, templates: QuoteTemplate[]): QuoteTemplate {
  return opt.packageSnapshot ?? templates.find((t) => t.id === opt.packageId) ?? { id: "" };
}

// ── Calculs ───────────────────────────────────────────

export interface OptionTotals {
  subtotal: number;
  beerSubtotal: number;
  dessertSubtotal: number;
  customSubtotal: number;
  preTaxTotal: number;
  tps: number;
  tvq: number;
  total: number;
  deposit: number;
  balance: number;
}

export function optionTotals(opt: PackageOption, guestCount: number | undefined, tpl: QuoteTemplate): OptionTotals {
  const guests = Math.max(0, num(guestCount));
  const subtotal = guests * num(tpl.pricePerPerson);
  const beerSubtotal = opt.beerAddon ? guests * num(tpl.beerPrice) : 0;
  const dessertSubtotal = opt.dessertAddon ? guests * num(tpl.dessertPrice) : 0;
  const customSubtotal = opt.customLines.reduce((s, l) => s + num(l.amount), 0);
  const preTaxTotal = subtotal + beerSubtotal + dessertSubtotal + customSubtotal;
  const { tps, tvq, total } = withTaxes(preTaxTotal);
  const deposit = Math.max(0, num(opt.depositAmount));
  const balance = Math.max(0, total - (opt.depositPaid ? deposit : 0));
  return { subtotal, beerSubtotal, dessertSubtotal, customSubtotal, preTaxTotal, tps, tvq, total, deposit, balance };
}

export const roomTotals = (r: RoomRental) => withTaxes(Math.max(0, num(r.price)));

export interface Range {
  min: number;
  max: number;
  count: number;
}

const range = (values: number[]): Range =>
  values.length ? { min: Math.min(...values), max: Math.max(...values), count: values.length } : { min: 0, max: 0, count: 0 };

export function optionsRange(q: Quote, templates: QuoteTemplate[]): Range {
  return range(getOptions(q).map((o) => optionTotals(o, q.guestCount, templateOf(o, templates)).total));
}

export function roomsRange(q: Quote): Range {
  return range(getRooms(q).map((r) => roomTotals(r).total));
}

/** Montant affiché sur la carte : forfaits s'il y en a, sinon salles. */
export function headlineRange(q: Quote, templates: QuoteTemplate[]): Range {
  const o = optionsRange(q, templates);
  return o.count > 0 ? o : roomsRange(q);
}

// ── Numérotation, statut ──────────────────────────────

/** AAAA-NNN : prochain numéro de l'année (v1). */
export function nextQuoteNumber(quotes: Quote[], year = new Date().getFullYear()): string {
  const prefix = `${year}-`;
  const max = quotes
    .map((q) => q.quoteNumber ?? "")
    .filter((n) => n.startsWith(prefix))
    .reduce((m, n) => Math.max(m, parseInt(n.match(/-(\d+)$/)?.[1] ?? "0", 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/** « Expirée » affichée automatiquement quand la validité est dépassée (sans modifier le statut enregistré). */
export function isPastDue(q: Quote, today = todayISO()): boolean {
  return !!q.validUntil && q.validUntil < today && !["acceptee", "refusee", "expiree"].includes(q.status ?? "brouillon");
}

export function filterQuotes(list: Quote[], status: string, query: string): Quote[] {
  const q = normalize(query);
  return list
    .filter((x) => status === "all" || (x.status ?? "brouillon") === status)
    .filter(
      (x) =>
        !q ||
        normalize(`${x.quoteNumber ?? ""} ${x.clientName ?? ""} ${x.clientCompany ?? ""} ${x.clientEmail ?? ""} ${x.clientPhone ?? ""}`).includes(q),
    )
    .sort((a, b) => (b.quoteNumber ?? "").localeCompare(a.quoteNumber ?? ""));
}

/** « 23 juin 2026 » */
export function shortDate(iso: string): string {
  const d = isoToDate(iso);
  return d ? `${d.getDate()} ${monthName(d.getMonth())} ${d.getFullYear()}` : iso;
}

export function roomLabel(r: RoomRental): string {
  return [r.date ? shortDate(r.date) : "", [r.startTime, r.endTime].filter(Boolean).join("–")].filter(Boolean).join(" · ");
}

// ── Formulaire ────────────────────────────────────────

export interface OptionDraft {
  key: string;
  packageId: string;
  beerAddon: boolean;
  beerPrice: string;
  dessertAddon: boolean;
  dessertPrice: string;
  customLines: { key: string; description: string; amount: string }[];
  depositAmount: string;
  depositPaid: boolean;
}

export interface RoomDraft {
  key: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  price: string;
}

export interface QuoteDraft {
  clientName: string;
  clientCompany: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  eventAddress: string;
  guestCount: string;
  validUntil: string;
  status: string;
  notes: string;
  options: OptionDraft[];
  rooms: RoomDraft[];
}

let k = 0;
export const newKey = (p: string) => `${p}-${Date.now().toString(36)}${(++k).toString(36)}`;

export function newOptionDraft(tpl?: QuoteTemplate): OptionDraft {
  return {
    key: newKey("opt"),
    packageId: tpl?.id ?? "",
    beerAddon: false,
    beerPrice: String(tpl?.beerPrice ?? 7),
    dessertAddon: false,
    dessertPrice: String(tpl?.dessertPrice ?? 6),
    customLines: [],
    depositAmount: "",
    depositPaid: false,
  };
}

export const newRoomDraft = (): RoomDraft => ({ key: newKey("room"), date: "", startTime: "", endTime: "", description: "", price: "" });

export function toDraft(q: Quote | null, templates: QuoteTemplate[], today = todayISO()): QuoteDraft {
  const options = q
    ? getOptions(q).map((o) => {
        const tpl = templateOf(o, templates);
        return {
          key: o.id,
          packageId: o.packageId,
          beerAddon: o.beerAddon,
          beerPrice: String(o.packageSnapshot?.beerPrice ?? tpl.beerPrice ?? 7),
          dessertAddon: o.dessertAddon,
          dessertPrice: String(o.packageSnapshot?.dessertPrice ?? tpl.dessertPrice ?? 6),
          customLines: o.customLines.map((l) => ({ key: newKey("line"), description: l.description, amount: String(l.amount) })),
          depositAmount: o.depositAmount ? String(o.depositAmount) : "",
          depositPaid: o.depositPaid,
        };
      })
    : [newOptionDraft(templates[0])];
  return {
    clientName: q?.clientName ?? "",
    clientCompany: q?.clientCompany ?? "",
    clientPhone: q?.clientPhone ?? "",
    clientEmail: q?.clientEmail ?? "",
    eventDate: q?.eventDate ?? "",
    eventTime: q?.eventTime ?? "",
    eventVenue: q?.eventVenue ?? "bochica",
    eventAddress: q?.eventAddress ?? "",
    guestCount: q?.guestCount != null ? String(q.guestCount) : "",
    validUntil: q?.validUntil ?? addDays(today, 30),
    status: q?.status ?? "brouillon",
    notes: q?.notes ?? "",
    options,
    rooms: q ? getRooms(q).map((r) => ({ ...r, key: r.id, price: r.price ? String(r.price) : "" })) : [],
  };
}

/** Option du formulaire → option enregistrée (forfait figé avec les prix saisis). */
export function draftToOption(o: OptionDraft, templates: QuoteTemplate[]): PackageOption | null {
  const tpl = templates.find((t) => t.id === o.packageId);
  if (!tpl) return null;
  const customLines: CustomLine[] = o.customLines
    .filter((l) => l.description.trim() || num(l.amount) !== 0)
    .map((l) => ({ description: l.description.trim(), amount: num(l.amount) }));
  return {
    id: o.key,
    packageId: tpl.id,
    packageSnapshot: {
      id: tpl.id,
      name: tpl.name ?? "",
      label: tpl.label ?? "",
      pricePerPerson: num(tpl.pricePerPerson),
      accentColor: tpl.accentColor || "yellow",
      entree: tpl.entree ?? "",
      plat: tpl.plat ?? "",
      boisson: tpl.boisson ?? "",
      beerPrice: Math.max(0, num(o.beerPrice)),
      dessertPrice: Math.max(0, num(o.dessertPrice)),
    },
    beerAddon: o.beerAddon,
    dessertAddon: o.dessertAddon,
    customLines,
    depositAmount: Math.max(0, num(o.depositAmount)),
    depositPaid: o.depositPaid,
  };
}

export type QuoteErrors = Partial<Record<"clientName" | "guestCount" | "clientEmail" | "options", string>>;

export function validateQuote(d: QuoteDraft, templates: QuoteTemplate[]): QuoteErrors {
  const e: QuoteErrors = {};
  if (!d.clientName.trim()) e.clientName = "Le nom du client est obligatoire.";
  if (!(Math.floor(num(d.guestCount)) >= 1)) e.guestCount = "Au moins 1 personne.";
  if (d.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.clientEmail.trim())) e.clientEmail = "Courriel invalide.";
  const rooms = d.rooms.filter((r) => num(r.price) > 0 || r.date || r.description.trim());
  if (d.options.length === 0 && rooms.length === 0) e.options = "Ajoute au moins une option de forfait ou de salle.";
  else if (d.options.some((o) => !templates.some((t) => t.id === o.packageId))) e.options = "Chaque option doit avoir un forfait sélectionné.";
  return e;
}

/** Données Firestore (mêmes champs que la v1, champs hérités = 1re option). */
export function toFields(d: QuoteDraft, templates: QuoteTemplate[]) {
  const packageOptions = d.options.map((o) => draftToOption(o, templates)).filter((o): o is PackageOption => !!o);
  const roomRentals: RoomRental[] = d.rooms
    .map((r) => ({
      id: r.key,
      date: r.date,
      startTime: r.startTime,
      endTime: r.endTime,
      description: r.description.trim(),
      price: Math.max(0, num(r.price)),
    }))
    .filter((r) => r.price > 0 || r.date || r.description);
  const first = packageOptions[0];
  return {
    clientName: d.clientName.trim(),
    clientCompany: d.clientCompany.trim(),
    clientPhone: d.clientPhone.trim(),
    clientEmail: d.clientEmail.trim(),
    eventDate: d.eventDate,
    eventTime: d.eventTime,
    eventVenue: d.eventVenue,
    eventAddress: d.eventAddress.trim(),
    guestCount: Math.max(0, Math.floor(num(d.guestCount))),
    packageOptions,
    roomRentals,
    packageId: first?.packageId ?? null,
    packageSnapshot: first?.packageSnapshot ?? null,
    beerAddon: first?.beerAddon ?? false,
    dessertAddon: first?.dessertAddon ?? false,
    customLines: first?.customLines ?? [],
    depositAmount: first?.depositAmount ?? 0,
    depositPaid: first?.depositPaid ?? false,
    validUntil: d.validUntil,
    notes: d.notes.trim(),
    status: d.status,
  };
}

export function describeOptions(f: ReturnType<typeof toFields>): string {
  const parts = f.packageOptions.map((o) => o.packageSnapshot?.name ?? "");
  if (f.roomRentals.length) parts.push(`Location de salle (${f.roomRentals.length})`);
  return parts.filter(Boolean).join(" + ") || "—";
}
