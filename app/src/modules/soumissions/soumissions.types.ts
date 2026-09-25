/** Collections `quotes` et `quoteTemplates` (format v1, y compris les champs hérités). */
export type AccentColor = "yellow" | "red" | "blue" | "green";

export interface QuoteTemplate {
  id: string;
  name?: string;
  label?: string;
  pricePerPerson?: number;
  accentColor?: AccentColor | string;
  entree?: string;
  plat?: string;
  boisson?: string;
  beerPrice?: number;
  dessertPrice?: number;
  sortOrder?: number;
}

export interface CustomLine {
  description: string;
  amount: number;
}

export interface PackageOption {
  id: string;
  packageId: string;
  packageSnapshot: QuoteTemplate | null;
  beerAddon: boolean;
  dessertAddon: boolean;
  customLines: CustomLine[];
  depositAmount: number;
  depositPaid: boolean;
}

export interface RoomRental {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  price: number; // avant taxes
}

export interface Quote {
  id: string;
  quoteNumber?: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  eventAddress?: string;
  guestCount?: number;
  validUntil?: string;
  notes?: string;
  status?: string;
  packageOptions?: Partial<PackageOption>[];
  roomRentals?: Partial<RoomRental>[];
  // Champs hérités (anciennes soumissions à un seul forfait)
  packageId?: string;
  packageSnapshot?: QuoteTemplate | null;
  beerAddon?: boolean;
  dessertAddon?: boolean;
  customLines?: CustomLine[];
  depositAmount?: number;
  depositPaid?: boolean;
}
