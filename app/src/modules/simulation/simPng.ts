/** Images PNG d'une simulation (équipe sans $ / admin interne) — même rendu que exportSimAsPNG(Admin) v1. */
import { todayISO } from "@/core/dates";
import { accent, esc, pngHeader, renderPng, secLabel, tint } from "@/modules/equipe/schedulePng";
import { fmtHours } from "@/modules/equipe/horaire.logic";
import { windowsLabel } from "@/modules/paie/paie.logic";
import { fmtMoney } from "@/ui/format";
import { computeScenario, effectiveOpenDays, gap } from "./sim.logic";
import type { PayrollSimulation } from "./sim.types";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const h = (n: number) => `${fmtHours(n) || "0"}h`;
export const simSlug = (name?: string) =>
  (name || "Simulation")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Simulation";

const head = (sim: PayrollSimulation, open: number[], dayMeta?: (d: number) => string) =>
  open
    .map((d) => {
      const svc = windowsLabel(sim.simulation?.serviceHours?.[d]);
      return `<div style="background:#ede3d2;padding:12px;text-align:center"><div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em">${DAYS[d]}</div>${svc !== "—" ? `<div style="font-size:10px;color:#666;margin-top:3px">🕐 ${svc}</div>` : ""}${dayMeta ? `<div style="font-size:10px;color:#666;margin-top:2px">${dayMeta(d)}</div>` : ""}</div>`;
    })
    .join("");

export async function exportSimTeamPng(sim: PayrollSimulation): Promise<string | null> {
  const cur = computeScenario(sim.simulation);
  const open = effectiveOpenDays(sim.simulation);
  const rows = cur.rows.filter((r) => open.some((d) => (r.daily[d]?.shifts.length ?? 0) > 0));
  if (!rows.length) return null;
  const html = `${pngHeader("Horaire proposé", sim.name || "Simulation", false)}
  <div style="display:grid;grid-template-columns:180px repeat(${open.length},1fr);gap:1px;background:#c8bca5;border:1px solid #c8bca5;border-radius:8px;overflow:hidden">
    <div style="background:#ede3d2;padding:12px;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Employé</div>
    ${head(sim, open)}
    ${rows
      .map((r) => {
        const sec = r.emp.section;
        return `<div style="background:#fff;padding:12px;border-left:4px solid ${accent(sec)};display:flex;flex-direction:column;justify-content:center;min-height:70px"><div style="font-size:15px;font-weight:700;line-height:1.2">${esc(r.emp.name ?? "")}</div><div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:3px">${secLabel(sec)}</div></div>
        ${open
          .map((d) => {
            const s = r.daily[d]?.shifts ?? [];
            return s.length
              ? `<div style="background:#fff;padding:8px;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;min-height:70px">${s.map((x) => `<div style="background:${tint(sec)};border-left:4px solid ${accent(sec)};padding:6px 12px;border-radius:8px;text-align:center;min-width:90px"><div style="font-size:15px;font-weight:700;white-space:nowrap">${x.start} → ${x.end}</div></div>`).join("")}</div>`
              : `<div style="background:#fff;padding:10px;display:flex;align-items:center;justify-content:center;min-height:70px"><div style="font-size:13px;color:#999;font-style:italic">Congé</div></div>`;
          })
          .join("")}`;
      })
      .join("")}
  </div>
  <div style="margin-top:24px;padding-top:14px;border-top:1px dashed #c8bca5;display:flex;justify-content:space-between;font-size:11px;color:#6e5f50"><div>Bochica Café Bistro</div><div>Affiché le ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</div></div>`;
  return renderPng(html, 1200, `Bochica_SimPaie_${simSlug(sim.name)}_${todayISO()}.png`);
}

export async function exportSimAdminPng(sim: PayrollSimulation): Promise<string | null> {
  const cur = computeScenario(sim.simulation);
  const base = computeScenario(sim.baseline);
  const open = effectiveOpenDays(sim.simulation);
  const ratio = Number(sim.simulation?.salesRatio) || 0.32;
  const rows = cur.rows.filter((r) => open.some((d) => (r.daily[d]?.shifts.length ?? 0) > 0));
  if (!rows.length) return null;
  const g = gap(cur.totals.total, base.totals.total).diff;
  const gColor = Math.abs(g) < 0.005 ? "#666" : g > 0 ? "#9f1239" : "#1f7a1f";
  const now = new Date();
  const kpi = (label: string, value: string, extra = "") => `<div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;font-weight:600">${label}</div><div style="font-size:22px;font-weight:800;margin-top:4px">${value}</div>${extra}</div>`;
  const html = `${pngHeader("Simulation paie — ADMIN", sim.name || "Simulation", true)}
  <div style="display:grid;grid-template-columns:200px repeat(${open.length},1fr) 150px;gap:1px;background:#c8bca5;border:1px solid #c8bca5;border-radius:8px;overflow:hidden">
    <div style="background:#ede3d2;padding:12px;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Employé · Taux</div>
    ${head(sim, open, (d) => `${h(cur.dayHours[d]!)} · ${fmtMoney(cur.dayCost[d]!)}`)}
    <div style="background:#ede3d2;padding:12px;text-align:center;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Total emp.</div>
    ${rows
      .map((r) => {
        const sec = r.emp.section;
        return `<div style="background:#fff;padding:12px;border-left:4px solid ${accent(sec)};display:flex;flex-direction:column;justify-content:center;min-height:84px"><div style="font-size:15px;font-weight:700;line-height:1.2">${esc(r.emp.name ?? "")}</div><div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:3px">${secLabel(sec)}${r.emp.isFictional ? " · FICTIF" : ""}</div><div style="font-size:12px;margin-top:3px;font-weight:600">${fmtMoney(r.rate)}/h${r.isSal ? " · FIXE" : ""}</div></div>
        ${open
          .map((d) => {
            const day = r.daily[d];
            const s = day?.shifts ?? [];
            return s.length
              ? `<div style="background:#fff;padding:8px;display:flex;flex-direction:column;gap:4px;align-items:center;justify-content:center;min-height:84px">${s.map((x) => `<div style="background:${tint(sec)};border-left:4px solid ${accent(sec)};padding:6px 12px;border-radius:8px;text-align:center;min-width:100px"><div style="font-size:14px;font-weight:700;white-space:nowrap">${x.start} → ${x.end}</div></div>`).join("")}<div style="font-size:11px;color:#444">${h(day!.hours)} · ${fmtMoney(day!.cost)}</div></div>`
              : `<div style="background:#fff;padding:10px;display:flex;align-items:center;justify-content:center;min-height:84px"><div style="font-size:13px;color:#999;font-style:italic">Congé</div></div>`;
          })
          .join("")}
        <div style="background:#fff;padding:10px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:84px"><div style="font-size:13px;font-weight:700">${h(r.totalHours)}</div><div style="font-size:12px;margin-top:2px">Sal. ${fmtMoney(r.grossWage)}</div><div style="font-size:12px;color:#1f7a1f;margin-top:1px">Pourb. ${fmtMoney(r.tipShare)}</div><div style="font-size:14px;font-weight:800;color:${accent(sec)};margin-top:3px">${fmtMoney(r.totalPay)}</div></div>`;
      })
      .join("")}
  </div>
  <div style="margin-top:18px;padding:16px;background:#fff;border:1.5px solid #c8bca5;border-radius:10px"><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:16px;text-align:center">
    ${kpi("Heures totales", h(cur.totals.hours))}
    ${kpi("Masse salariale", fmtMoney(cur.totals.gross))}
    ${kpi("Pourboires distr.", fmtMoney(cur.totals.tips))}
    ${kpi("Total à payer", fmtMoney(cur.totals.total), `<div style="font-size:11px;font-weight:700;color:${gColor};margin-top:2px">${Math.abs(g) < 0.005 ? "= réel" : `${g > 0 ? "+" : "−"}${fmtMoney(Math.abs(g))} vs réel`}</div>`)}
    ${kpi("Ventes prévues", fmtMoney(ratio > 0 ? cur.totals.gross / ratio : 0), `<div style="font-size:10px;color:#666;margin-top:2px">cible ${(ratio * 100).toFixed(1).replace(".", ",")} %</div>`)}
  </div></div>
  <div style="margin-top:18px;padding-top:14px;border-top:1px dashed #c8bca5;display:flex;justify-content:space-between;font-size:11px;color:#6e5f50"><div>Bochica Café Bistro — Document interne admin (simulation hypothétique)</div><div>Généré le ${now.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} à ${now.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</div></div>`;
  return renderPng(html, 1400, `Bochica_SimPaieAdmin_${simSlug(sim.name)}_${todayISO()}.png`);
}
