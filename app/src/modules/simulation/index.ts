import { lazy } from "react";
import { TrendingUp } from "lucide-react";
import type { AppModule } from "../types";

export const simulationModule: AppModule = {
  id: "simulations",
  label: "Simulation paie",
  icon: TrendingUp,
  group: "rh",
  roles: ["global_admin"],
  status: "migrated",
  page: lazy(() => import("./SimulationPage")),
};
