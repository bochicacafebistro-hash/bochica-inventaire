/**
 * Export PNG de l'horaire (version équipe sans $, version admin interne) —
 * même rendu que la v1 (exportScheduleAsPNG / exportScheduleAsPNGAdmin).
 * html2canvas est chargé seulement au clic.
 */
import { isoToDate } from "@/core/dates";
import { fmtMoney } from "@/ui/format";
import { fmtHours, type WeekRow } from "./horaire.logic";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const accent = (sec?: string) => (sec === "cuisine" ? "#BA7517" : (sec ?? "service") === "service" ? "#378ADD" : "#888780");
const tint = (sec?: string) => (sec === "cuisine" ? "rgba(186,117,23,.10)" : (sec ?? "service") === "service" ? "rgba(55,138,221,.08)" : "#f5f1e8");
const secLabel = (sec?: string) => (sec === "cuisine" ? "Cuisine" : (sec ?? "service") === "service" ? "Service" : "Autre");
const dayHead = (dk: string) => {
  const d = isoToDate(dk)!;
  return `${DOW[(d.getDay() + 6) % 7]}|${d.getDate()}/${d.getMonth() + 1}`;
};
const h = (n: number) => `${fmtHours(n) || "0"}h`;

function header(title: string, weekLabel: string, internal: boolean) {
  return `<div style="text-align:center;margin-bottom:22px;padding-bottom:16px;border-bottom:2px solid #0e0d0c">
    <div style="font-family:'Bebas Neue',Impact,sans-serif;font-size:42px;letter-spacing:.08em;line-height:1">BOCHICA</div>
    <div style="font-size:13px;color:#6e5f50;margin-top:2px">Restaurant Colombien</div>
    <div style="margin-top:8px"><span style="display:inline-block;height:3px;width:60px;background:#F7B32C"></span><span style="display:inline-block;height:3px;width:60px;background:#4a90e2"></span><span style="display:inline-block;height:3px;width:60px;background:#e74c3c"></span></div>
    <div style="font-size:26px;font-weight:700;margin-top:14px">${esc(title)}</div>
    <div style="font-size:14px;color:#444;margin-top:2px">${esc(weekLabel)}</div>
    ${internal ? `<div style="display:inline-block;margin-top:10px;padding:4px 12px;background:#9f1239;color:#fff;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;border-radius:4px">INTERNE — Ne pas partager</div>` : ""}
  </div>`;
}

async function render(html: string, width: number, filename: string) {
  const { default: html2canvas } = await import("html2canvas");
  const box = document.createElement("div");
  box.style.cssText = `position:fixed;left:-99999px;top:0;z-index:-1;background:#fdf6e7;padding:32px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0e0d0c;width:${width}px`;
  box.innerHTML = html;
  document.body.appendChild(box);
  try {
    await new Promise((r) => setTimeout(r, 100));
    const canvas = await html2canvas(box, { scale: 2, backgroundColor: "#fdf6e7", logging: false, useCORS: true });
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("image vide");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    box.remove();
  }
  return filename;
}

export interface PngInput {
  weekNum: number;
  weekLabel: string;
  monday: string;
  days: string[];
  rows: WeekRow[]; // employés visibles de la semaine
  dayHours: number[];
  dayCost: number[];
  totalHours: number;
  totalCost: number;
  ratio: number;
}

const worked = (r: WeekRow) => r.daily.some((d) => d.shift?.start && d.shift?.end);

/** Version équipe : heures seulement, employés sans aucun quart retirés. */
export async function exportTeamPng(p: PngInput): Promise<string | null> {
  const rows = p.rows.filter(worked);
  if (!rows.length) return null;
  const heads = p.days.map((dk) => dayHead(dk).split("|"));
  const html = `${header(`Horaire — Semaine ${p.weekNum}`, p.weekLabel, false)}
  <div style="display:grid;grid-template-columns:180px repeat(${p.days.length},1fr);gap:1px;background:#c8bca5;border:1px solid #c8bca5;border-radius:8px;overflow:hidden">
    <div style="background:#ede3d2;padding:12px;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Employé</div>
    ${heads.map(([dn, dd]) => `<div style="background:#ede3d2;padding:12px;text-align:center"><div style="font-size:11px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">${dn}</div><div style="font-size:18px;font-weight:700;margin-top:2px">${dd}</div></div>`).join("")}
    ${rows
      .map((r) => {
        const sec = r.emp.section;
        return `<div style="background:#fff;padding:12px;border-left:4px solid ${accent(sec)};display:flex;flex-direction:column;justify-content:center;min-height:70px">
          <div style="font-size:15px;font-weight:700;line-height:1.2">${esc(r.emp.name ?? "")}</div>
          <div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:3px">${secLabel(sec)}</div></div>
          ${r.daily
            .map((d) =>
              d.shift?.start && d.shift?.end
                ? `<div style="background:#fff;padding:8px;display:flex;align-items:center;justify-content:center;min-height:70px"><div style="background:${tint(sec)};border-left:4px solid ${accent(sec)};padding:8px 12px;border-radius:8px;text-align:center;min-width:90px"><div style="font-size:16px;font-weight:700;white-space:nowrap">${d.shift.start} → ${d.shift.end}</div></div></div>`
                : `<div style="background:#fff;padding:10px;display:flex;align-items:center;justify-content:center;min-height:70px"><div style="font-size:13px;color:#999;font-style:italic">Congé</div></div>`,
            )
            .join("")}`;
      })
      .join("")}
  </div>
  <div style="margin-top:24px;padding-top:14px;border-top:1px dashed #c8bca5;display:flex;justify-content:space-between;font-size:11px;color:#6e5f50">
    <div>Bochica Café Bistro</div><div>Affiché le ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</div></div>`;
  return render(html, 1200, `Bochica_Horaire_Sem${p.weekNum}_${p.monday}.png`);
}

/** Version admin : taux, coût par quart, totaux, ventes prévues. */
export async function exportAdminPng(p: PngInput): Promise<string | null> {
  const rows = p.rows.filter(worked);
  if (!rows.length) return null;
  const hidden = p.rows.length - rows.length;
  const expected = p.ratio > 0 ? p.totalCost / p.ratio : 0;
  const heads = p.days.map((dk) => dayHead(dk).split("|"));
  const now = new Date();
  const html = `${header(`Horaire ADMIN — Semaine ${p.weekNum}`, p.weekLabel, true)}
  <div style="display:grid;grid-template-columns:200px repeat(${p.days.length},1fr) 130px;gap:1px;background:#c8bca5;border:1px solid #c8bca5;border-radius:8px;overflow:hidden">
    <div style="background:#ede3d2;padding:12px;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Employé · Taux</div>
    ${heads.map(([dn, dd], k) => `<div style="background:#ede3d2;padding:12px;text-align:center"><div style="font-size:11px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">${dn}</div><div style="font-size:18px;font-weight:700;margin-top:2px">${dd}</div><div style="font-size:10px;color:#666;margin-top:2px">${h(p.dayHours[k]!)} · ${fmtMoney(p.dayCost[k]!)}</div></div>`).join("")}
    <div style="background:#ede3d2;padding:12px;text-align:center;font-size:12px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.05em">Total emp.</div>
    ${rows
      .map((r) => {
        const sec = r.emp.section;
        return `<div style="background:#fff;padding:12px;border-left:4px solid ${accent(sec)};display:flex;flex-direction:column;justify-content:center;min-height:80px">
          <div style="font-size:15px;font-weight:700;line-height:1.2">${esc(r.emp.name ?? "")}</div>
          <div style="font-size:11px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:.05em;margin-top:3px">${secLabel(sec)}</div>
          <div style="font-size:12px;margin-top:3px;font-weight:600">${fmtMoney(r.rate)}/h${r.emp.isSalaried ? " · FIXE" : ""}</div></div>
          ${r.daily
            .map((d) =>
              d.shift?.start && d.shift?.end
                ? `<div style="background:#fff;padding:8px;display:flex;align-items:center;justify-content:center;min-height:80px"><div style="background:${tint(sec)};border-left:4px solid ${accent(sec)};padding:8px 12px;border-radius:8px;text-align:center;min-width:100px"><div style="font-size:14px;font-weight:700;white-space:nowrap">${d.shift.start} → ${d.shift.end}</div><div style="font-size:11px;color:#444;margin-top:3px">${h(d.hours)} · ${fmtMoney(d.cost)}</div></div></div>`
                : `<div style="background:#fff;padding:10px;display:flex;align-items:center;justify-content:center;min-height:80px"><div style="font-size:13px;color:#999;font-style:italic">Congé</div></div>`,
            )
            .join("")}
          <div style="background:#fff;padding:10px;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:80px"><div style="font-size:13px;font-weight:700">${h(r.totalHours)}</div><div style="font-size:14px;font-weight:800;color:${accent(sec)};margin-top:3px">${fmtMoney(r.totalPay)}</div></div>`;
      })
      .join("")}
  </div>
  <div style="margin-top:18px;padding:16px;background:#fff;border:1.5px solid #c8bca5;border-radius:10px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center">
      <div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Heures totales</div><div style="font-size:22px;font-weight:800;margin-top:4px">${h(p.totalHours)}</div></div>
      <div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Masse salariale</div><div style="font-size:22px;font-weight:800;margin-top:4px">${fmtMoney(p.totalCost)}</div></div>
      <div><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em;font-weight:600">Ventes prévues</div><div style="font-size:22px;font-weight:800;margin-top:4px">${fmtMoney(expected)}</div><div style="font-size:10px;color:#666;margin-top:2px">cible ${(p.ratio * 100).toFixed(1).replace(".", ",")} %</div></div>
    </div>
    ${hidden > 0 ? `<div style="margin-top:14px;padding-top:12px;border-top:1px dashed #c8bca5;font-size:11px;color:#6e5f50;text-align:center;font-style:italic">${hidden} employé(s) en congé toute la semaine non affiché(s)</div>` : ""}
  </div>
  <div style="margin-top:18px;padding-top:14px;border-top:1px dashed #c8bca5;display:flex;justify-content:space-between;font-size:11px;color:#6e5f50">
    <div>Bochica Café Bistro — Document interne admin</div><div>Généré le ${now.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} à ${now.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</div></div>`;
  return render(html, 1400, `Bochica_HoraireAdmin_Sem${p.weekNum}_${p.monday}.png`);
}
