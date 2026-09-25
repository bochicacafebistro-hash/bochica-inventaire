import { lazy } from "react";
import { FileText, ShieldCheck, Wallet } from "lucide-react";
import type { AppModule } from "../types";

export const depensesModule: AppModule = {
  id: "depenses",
  label: "Dépenses & Revenus",
  icon: Wallet,
  group: "finances",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./DepensesPage")),
};

export const facturesModule: AppModule = {
  id: "factures",
  label: "Factures",
  icon: FileText,
  group: "finances",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./FacturesPage")),
};

export const taxesModule: AppModule = {
  id: "taxes",
  label: "TPS/TVQ",
  icon: ShieldCheck,
  group: "finances",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./TaxesPage")),
};
