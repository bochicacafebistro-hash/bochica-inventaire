// ═══════════════════════════════════════════════════════════════
// RAPPORTS MENSUELS — Visualisations comparatives multi-mois
// ───────────────────────────────────────────────────────────────
// Affiche les données des PDFs Cluster (ventes, paiements, top
// catégories/articles, heures, corrections) sous forme de graphiques
// comparatifs entre mois.
//
// Source des données : collection Firestore `monthlyReports`, peuplée
// soit via le bouton « Importer les rapports seed » (depuis le seed JS
// pré-parsé), soit manuellement (futur : import PDF côté client).
//
// Schéma par doc :
//   id = "YYYY-MM"
//   { period, year, month, summary {...}, channels {...}, payments [...],
//     total_tips, grand_total_with_tips, top_categories [...], top_items [...],
//     total_hours, corrections {...}, discounts_summary {...}, source_file }
// ═══════════════════════════════════════════════════════════════

// Couleurs cohérentes pour les graphiques (palette Bochica + tricolore)
const REPORT_COLORS = {
  primary: "#F7B32C",
  secondary: "#4a90e2",
  tertiary: "#e74c3c",
  green: "#7dbf66",
  purple: "#8b5cf6",
  orange: "#f97316",
  teal: "#14b8a6",
  pink: "#ec4899",
};
const REPORT_COLOR_PALETTE = Object.values(REPORT_COLORS);

// État local des charts (pour cleanup avant re-création)
let _reportChartInstances = {};

// ═ Helpers ══════════════════════════════════════════════

function fmtMonthLabel(period) {
  // "2026-04" → "Avr 26"
  if (!period) return "—";
  const [y, m] = period.split("-").map(Number);
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
  return `${months[m - 1] || "?"} ${String(y).slice(2)}`;
}

function fmtMonthLong(period) {
  if (!period) return "—";
  const [y, m] = period.split("-").map(Number);
  const months = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  return `${months[m - 1] || "?"} ${y}`;
}

// Filtre les rapports selon reportsViewPeriod (3/6/12/all/custom)
function getFilteredReports() {
  const all = [...(monthlyReports || [])].sort((a, b) => (a.period || "").localeCompare(b.period || ""));
  if (reportsViewPeriod === "all") return all;
  if (reportsViewPeriod === "custom") {
    if (!reportsCustomStart || !reportsCustomEnd) return all;
    return all.filter(r => r.period >= reportsCustomStart && r.period <= reportsCustomEnd);
  }
  const n = Number(reportsViewPeriod);
  if (!n || n === 0) return all;
  return all.slice(-n);
}

// Retourne le rapport de l'année précédente pour un mois donné (ou null).
// Ex: "2026-04" → cherche "2025-04"
function getReportForPrevYear(period) {
  if (!period) return null;
  const [y, m] = period.split("-");
  const prevPeriod = `${Number(y) - 1}-${m}`;
  return (monthlyReports || []).find(r => r.period === prevPeriod) || null;
}

// Pour une liste de rapports, retourne la liste correspondante de l'année précédente
// (même mois année-1). Garde la même taille (null si pas trouvé).
function getYoYReports(reports) {
  return reports.map(r => getReportForPrevYear(r.period));
}

// Calcule l'écart % entre deux valeurs (null si pas de référence)
function pctDelta(curr, prev) {
  if (prev == null || prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// Formate un écart % en HTML stylé (vert/rouge/—)
function fmtPctDelta(pct, opts = {}) {
  if (pct == null) return `<span class="reports-delta-na">—</span>`;
  const isUp = pct > 0.5;
  const isDown = pct < -0.5;
  const positiveIsBad = !!opts.positiveIsBad;
  const cls = !isUp && !isDown ? "is-zero"
    : isUp ? (positiveIsBad ? "is-negative" : "is-positive")
    : (positiveIsBad ? "is-positive" : "is-negative");
  const arrow = !isUp && !isDown ? "—" : (isUp ? "▲" : "▼");
  const sign = isUp ? "+" : "";
  return `<span class="reports-delta ${cls}">${arrow} ${sign}${pct.toFixed(1)}%</span>`;
}

// Détruit toutes les instances Chart.js connues
function destroyAllReportCharts() {
  Object.keys(_reportChartInstances).forEach(k => {
    try { _reportChartInstances[k].destroy(); } catch (_) {}
  });
  _reportChartInstances = {};
}

// ═ Rendu principal ══════════════════════════════════════

function renderRapports() {
  const reports = getFilteredReports();
  const totalReports = (monthlyReports || []).length;

  // Rapports correspondants année précédente (pour YoY)
  const yoyReports = getYoYReports(reports);
  const yoyAvailable = yoyReports.some(r => r != null);

  // KPI agrégés sur la période sélectionnée
  const totalRevenue = reports.reduce((s, r) => s + (Number(r.summary?.total_with_tax) || 0), 0);
  const totalReceipts = reports.reduce((s, r) => s + (Number(r.summary?.receipts) || 0), 0);
  const totalClients = reports.reduce((s, r) => s + (Number(r.summary?.clients) || 0), 0);
  const totalTips = reports.reduce((s, r) => s + (Number(r.total_tips) || 0), 0);
  const totalHours = reports.reduce((s, r) => s + (Number(r.total_hours) || 0), 0);
  const avgReceipt = totalReceipts > 0 ? (totalRevenue / totalReceipts) : 0;

  // KPI agrégés année précédente (somme uniquement des mois disponibles en YoY)
  const yoyTotals = { revenue: 0, receipts: 0, clients: 0, tips: 0, hours: 0 };
  yoyReports.forEach(r => {
    if (!r) return;
    yoyTotals.revenue += Number(r.summary?.total_with_tax) || 0;
    yoyTotals.receipts += Number(r.summary?.receipts) || 0;
    yoyTotals.clients += Number(r.summary?.clients) || 0;
    yoyTotals.tips += Number(r.total_tips) || 0;
    yoyTotals.hours += Number(r.total_hours) || 0;
  });
  const yoyAvgReceipt = yoyTotals.receipts > 0 ? (yoyTotals.revenue / yoyTotals.receipts) : 0;

  // Listes des mois disponibles pour les date pickers custom
  const allPeriods = (monthlyReports || []).map(r => r.period).sort();
  const minPeriod = allPeriods[0] || "";
  const maxPeriod = allPeriods[allPeriods.length - 1] || "";

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("bar-chart", 22)} Rapports mensuels</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="openReportsImportModal()" title="Importer les rapports pré-parsés">${icon("download", 14)} Importer seed</button>
      </div>
    </div>

    <!-- Sélecteur de période + toggle YoY -->
    <div class="reports-controls">
      <div class="reports-period-tabs">
        <div class="reports-period-tabs__label">${icon("calendar", 14)} Période :</div>
        ${[
          { v: 3, l: "3 mois" },
          { v: 6, l: "6 mois" },
          { v: 12, l: "12 mois" },
          { v: "all", l: "Tout" },
          { v: "custom", l: "Personnalisé" }
        ].map(p => `<button class="reports-period-tab ${String(reportsViewPeriod) === String(p.v) ? "is-active" : ""}" onclick="setReportsPeriod('${p.v}')">${p.l}</button>`).join("")}
        <span class="reports-period-tabs__count">${reports.length}/${totalReports} rapports</span>
      </div>
      ${reportsViewPeriod === "custom" ? `
        <div class="reports-custom-range">
          <label class="reports-custom-range__field">
            <span>Début</span>
            <input type="month" value="${reportsCustomStart || minPeriod}" min="${minPeriod}" max="${maxPeriod}" onchange="setReportsCustomRange('start', this.value)"/>
          </label>
          <span class="reports-custom-range__sep">→</span>
          <label class="reports-custom-range__field">
            <span>Fin</span>
            <input type="month" value="${reportsCustomEnd || maxPeriod}" min="${minPeriod}" max="${maxPeriod}" onchange="setReportsCustomRange('end', this.value)"/>
          </label>
        </div>
      ` : ""}
      <label class="reports-yoy-toggle" title="Compare chaque mois avec le même mois de l'année précédente">
        <input type="checkbox" ${reportsCompareYoY ? "checked" : ""} onchange="toggleReportsYoY(this.checked)"/>
        <span>${icon("trending-up", 14)} Vs année précédente</span>
        ${reportsCompareYoY && !yoyAvailable ? `<span class="reports-yoy-warn" title="Aucun rapport de l'année précédente trouvé pour les mois sélectionnés">${icon("alert", 12)}</span>` : ""}
      </label>
    </div>

    ${totalReports === 0 ? renderEmptyState({
      kind: "default",
      title: "Aucun rapport importé",
      subtitle: "Importe les rapports mensuels Cluster pré-parsés pour voir l'évolution de tes ventes, paiements, top produits et heures travaillées d'un mois à l'autre.",
      cta: { label: "Importer les rapports", icon: "download", onClick: "openReportsImportModal()" },
      hint: "8 mois pré-parsés disponibles"
    }) : `

    <!-- KPI agrégés -->
    <div class="reports-kpi-row">
      ${reportsKpi("Ventes totales", fmtMoney(totalRevenue), "wallet", "#7dbf66", reportsCompareYoY && yoyAvailable ? pctDelta(totalRevenue, yoyTotals.revenue) : null)}
      ${reportsKpi("Reçus", totalReceipts.toLocaleString("fr-CA"), "receipt", "#4a90e2", reportsCompareYoY && yoyAvailable ? pctDelta(totalReceipts, yoyTotals.receipts) : null)}
      ${reportsKpi("Clients servis", totalClients.toLocaleString("fr-CA"), "users", "#8b5cf6", reportsCompareYoY && yoyAvailable ? pctDelta(totalClients, yoyTotals.clients) : null)}
      ${reportsKpi("Reçu moyen", fmtMoney(avgReceipt), "trending-up", "#F7B32C", reportsCompareYoY && yoyAvailable ? pctDelta(avgReceipt, yoyAvgReceipt) : null)}
      ${reportsKpi("Pourboires", fmtMoney(totalTips), "dollar-sign", "#e74c3c", reportsCompareYoY && yoyAvailable ? pctDelta(totalTips, yoyTotals.tips) : null)}
      ${reportsKpi("Heures travaillées", fmtHours(totalHours) + " h", "clock", "#14b8a6", reportsCompareYoY && yoyAvailable ? pctDelta(totalHours, yoyTotals.hours) : null)}
    </div>

    <!-- Graphique 1 : Évolution des ventes (barres + ligne pourboires) -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("trending-up", 16)} Évolution des ventes</h3>
          <div class="reports-chart-card__sub">Ventes nettes (barres) · Pourboires (ligne) par mois</div>
        </div>
      </div>
      <div class="reports-chart-wrap" style="height:280px">
        <canvas id="reports-chart-sales"></canvas>
      </div>
    </div>

    <!-- Graphique 2 : Ventes par canal (barres empilées) -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("layers", 16)} Ventes par canal</h3>
          <div class="reports-chart-card__sub">Tables / Comptoir / Emporter / Livraison / Ramassage</div>
        </div>
      </div>
      <div class="reports-chart-wrap" style="height:280px">
        <canvas id="reports-chart-channels"></canvas>
      </div>
    </div>

    <!-- Graphique 3 : Modes de paiement (barres groupées) -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("dollar-sign", 16)} Modes de paiement</h3>
          <div class="reports-chart-card__sub">Montant facturé par mode (INT/MAS/VIS/Comptant/etc.)</div>
        </div>
      </div>
      <div class="reports-chart-wrap" style="height:280px">
        <canvas id="reports-chart-payments"></canvas>
      </div>
    </div>

    <!-- Graphique 4 : Top catégories (doughnut + tableau) -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("pie-chart", 16)} Top catégories — agrégé sur la période</h3>
          <div class="reports-chart-card__sub">Total $ par catégorie sur les ${reports.length} mois sélectionnés</div>
        </div>
      </div>
      <div class="reports-chart-wrap" style="height:320px">
        <canvas id="reports-chart-categories"></canvas>
      </div>
    </div>

    <!-- Graphique 5 : Top produits (tableau comparatif) -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("package", 16)} Top 15 produits — agrégé sur la période</h3>
          <div class="reports-chart-card__sub">Quantité et ventes $ cumulées par article</div>
        </div>
      </div>
      ${renderTopProductsTable(reports)}
    </div>

    <!-- Tableau comparatif global -->
    <div class="card reports-chart-card">
      <div class="reports-chart-card__head">
        <div>
          <h3 class="reports-chart-card__title">${icon("table", 16)} Tableau récapitulatif mois par mois</h3>
          <div class="reports-chart-card__sub">Tous les indicateurs côte à côte avec écart vs mois précédent</div>
        </div>
      </div>
      ${renderMonthlyComparisonTable(reports)}
    </div>

    `}
  </div>`;
}

// KPI tuile (réutilise le style des KPI du dashboard via .dash-stat-card)
// Si yoyDelta est fourni (non null), affiche l'écart % vs même période YoY
function reportsKpi(label, value, iconName, color, yoyDelta = null) {
  return `<div class="dash-stat-card" style="border-left-color:${color}">
    <div class="dash-stat__head">
      <span style="color:${color}">${icon(iconName, 16)}</span>
      <span class="dash-stat__label">${label}</span>
    </div>
    <div class="dash-stat__value" style="color:${color}">${value}</div>
    ${yoyDelta != null ? `<div class="dash-stat__delta">${fmtPctDelta(yoyDelta)} vs ${reportsViewPeriod === "custom" ? "même période A-1" : "A-1"}</div>` : ""}
  </div>`;
}

// ═ Tableau top produits ═════════════════════════════════
function renderTopProductsTable(reports) {
  // Agréger par nom de produit
  const agg = new Map();
  reports.forEach(r => {
    (r.top_items || []).forEach(item => {
      const cur = agg.get(item.name) || { name: item.name, qty: 0, total: 0 };
      cur.qty += Number(item.qty) || 0;
      cur.total += Number(item.total) || 0;
      agg.set(item.name, cur);
    });
  });
  const sorted = [...agg.values()].sort((a, b) => b.qty - a.qty).slice(0, 15);
  if (sorted.length === 0) {
    return `<div class="empty" style="padding:var(--sp-4)">Aucun article dans la période sélectionnée.</div>`;
  }
  return `<div style="overflow-x:auto">
    <table class="sim-compare-table" style="margin-top:var(--sp-3)">
      <thead><tr>
        <th>#</th>
        <th>Article</th>
        <th style="text-align:right">Quantité</th>
        <th style="text-align:right">Ventes</th>
      </tr></thead>
      <tbody>
        ${sorted.map((item, i) => `<tr>
          <td>${i + 1}</td>
          <td style="text-align:left"><strong>${esc(item.name)}</strong></td>
          <td style="text-align:right;font-family:var(--font-mono)">${item.qty.toLocaleString("fr-CA")}</td>
          <td style="text-align:right;font-family:var(--font-mono)">${fmtMoney(item.total)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  </div>`;
}

// ═ Tableau comparatif mois par mois ═════════════════════
function renderMonthlyComparisonTable(reports) {
  const rows = reports.map((r, i) => {
    const prev = i > 0 ? reports[i - 1] : null;
    const yoy = reportsCompareYoY ? getReportForPrevYear(r.period) : null;
    const totalSales = Number(r.summary?.total_with_tax) || 0;
    const prevSales = prev ? (Number(prev.summary?.total_with_tax) || 0) : 0;
    const yoySales = yoy ? (Number(yoy.summary?.total_with_tax) || 0) : null;
    const deltaPct = pctDelta(totalSales, prevSales);
    const yoyDeltaPct = yoy ? pctDelta(totalSales, yoySales) : null;
    return { r, yoy, deltaPct, yoyDeltaPct, yoySales };
  });
  return `<div style="overflow-x:auto">
    <table class="sim-compare-table" style="margin-top:var(--sp-3);font-size:11px">
      <thead><tr>
        <th style="text-align:left">Mois</th>
        <th style="text-align:right">Reçus</th>
        <th style="text-align:right">Clients</th>
        <th style="text-align:right">Reçu moy.</th>
        <th style="text-align:right">Ventes nettes</th>
        <th style="text-align:right">TPS+TVQ</th>
        <th style="text-align:right">Total</th>
        <th style="text-align:right">Δ vs prev.</th>
        ${reportsCompareYoY ? `<th style="text-align:right" class="reports-yoy-col">Total A-1</th><th style="text-align:right" class="reports-yoy-col">Δ YoY</th>` : ""}
        <th style="text-align:right">Pourboires</th>
        <th style="text-align:right">Heures</th>
        <th style="text-align:right">Corrections</th>
      </tr></thead>
      <tbody>
        ${rows.map(({ r, yoy, deltaPct, yoyDeltaPct, yoySales }) => {
          const s = r.summary || {};
          return `<tr>
            <td style="text-align:left"><strong>${fmtMonthLong(r.period)}</strong></td>
            <td style="text-align:right;font-family:var(--font-mono)">${(s.receipts || 0).toLocaleString("fr-CA")}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${(s.clients || 0).toLocaleString("fr-CA")}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${fmtMoney(s.avg_receipt || 0)}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${fmtMoney(s.sales_net || 0)}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${fmtMoney((s.tps || 0) + (s.tvq || 0))}</td>
            <td style="text-align:right;font-family:var(--font-mono);font-weight:700">${fmtMoney(s.total_with_tax || 0)}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${fmtPctDelta(deltaPct)}</td>
            ${reportsCompareYoY ? `
              <td style="text-align:right;font-family:var(--font-mono);color:var(--text3)" class="reports-yoy-col">${yoy ? fmtMoney(yoySales) : "—"}</td>
              <td style="text-align:right;font-family:var(--font-mono)" class="reports-yoy-col">${fmtPctDelta(yoyDeltaPct)}</td>
            ` : ""}
            <td style="text-align:right;font-family:var(--font-mono)">${fmtMoney(r.total_tips || 0)}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${fmtHours(r.total_hours || 0)} h</td>
            <td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">${fmtMoney(r.corrections?.total_amount || 0)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

// ═ Init des graphiques (appelé après render) ═══════════
function initReportsCharts() {
  if (typeof Chart === "undefined") return;
  destroyAllReportCharts();
  const reports = getFilteredReports();
  if (reports.length === 0) return;
  const labels = reports.map(r => fmtMonthLabel(r.period));
  const textColor = darkMode ? "rgba(245,241,232,.72)" : "rgba(14,13,12,.72)";
  const gridColor = darkMode ? "rgba(245,241,232,.08)" : "rgba(14,13,12,.08)";

  // ─ Chart 1 : Ventes + Pourboires (combo bars + line) ─
  const ctxSales = document.getElementById("reports-chart-sales");
  if (ctxSales) {
    const yoyReports = reportsCompareYoY ? getYoYReports(reports) : null;
    const datasets = [
      {
        type: "bar",
        label: "Ventes totales",
        data: reports.map(r => Number(r.summary?.total_with_tax) || 0),
        backgroundColor: REPORT_COLORS.green,
        borderRadius: 4,
        yAxisID: "y"
      }
    ];
    // Ajout du dataset YoY si activé
    if (yoyReports && yoyReports.some(r => r != null)) {
      datasets.push({
        type: "bar",
        label: "Ventes A-1",
        data: yoyReports.map(r => r ? (Number(r.summary?.total_with_tax) || 0) : null),
        backgroundColor: REPORT_COLORS.green + "55",  // 33% opacity
        borderColor: REPORT_COLORS.green,
        borderWidth: 1,
        borderDash: [4, 3],
        borderRadius: 4,
        yAxisID: "y"
      });
    }
    datasets.push({
      type: "line",
      label: "Pourboires",
      data: reports.map(r => Number(r.total_tips) || 0),
      borderColor: REPORT_COLORS.primary,
      backgroundColor: REPORT_COLORS.primary,
      borderWidth: 2.5,
      tension: 0.3,
      pointRadius: 4,
      yAxisID: "y1"
    });
    if (yoyReports && yoyReports.some(r => r != null && r.total_tips)) {
      datasets.push({
        type: "line",
        label: "Pourboires A-1",
        data: yoyReports.map(r => r ? (Number(r.total_tips) || 0) : null),
        borderColor: REPORT_COLORS.primary,
        backgroundColor: "transparent",
        borderWidth: 1.5,
        borderDash: [4, 3],
        tension: 0.3,
        pointRadius: 3,
        yAxisID: "y1"
      });
    }
    _reportChartInstances.sales = new Chart(ctxSales, {
      data: { labels, datasets },
      options: chartCommonOptions(textColor, gridColor, {
        scales: {
          y: { position: "left", title: { display: true, text: "Ventes ($)", color: textColor }, ticks: { color: textColor, callback: v => v.toLocaleString("fr-CA") }, grid: { color: gridColor } },
          y1: { position: "right", title: { display: true, text: "Pourboires ($)", color: textColor }, ticks: { color: textColor }, grid: { drawOnChartArea: false } },
          x: { ticks: { color: textColor }, grid: { display: false } }
        }
      })
    });
  }

  // ─ Chart 2 : Ventes par canal (barres empilées) ─
  const ctxChannels = document.getElementById("reports-chart-channels");
  if (ctxChannels) {
    const channelDefs = [
      { key: "tables", label: "Tables", color: REPORT_COLORS.secondary },
      { key: "comptoir", label: "Comptoir", color: REPORT_COLORS.primary },
      { key: "emporter", label: "Emporter", color: REPORT_COLORS.green },
      { key: "el_livraison", label: "Livraison", color: REPORT_COLORS.tertiary },
      { key: "el_ramassage", label: "Ramassage", color: REPORT_COLORS.purple },
      { key: "el_comptoir", label: "E-L. Comptoir", color: REPORT_COLORS.orange }
    ];
    _reportChartInstances.channels = new Chart(ctxChannels, {
      type: "bar",
      data: {
        labels,
        datasets: channelDefs.map(c => ({
          label: c.label,
          data: reports.map(r => Number(r.channels?.[c.key]?.total_with_tax || r.channels?.[c.key]?.sales_net) || 0),
          backgroundColor: c.color,
          borderRadius: 3
        }))
      },
      options: chartCommonOptions(textColor, gridColor, {
        scales: {
          x: { stacked: true, ticks: { color: textColor }, grid: { display: false } },
          y: { stacked: true, ticks: { color: textColor, callback: v => "$" + v.toLocaleString("fr-CA") }, grid: { color: gridColor } }
        }
      })
    });
  }

  // ─ Chart 3 : Modes de paiement (barres groupées) ─
  const ctxPayments = document.getElementById("reports-chart-payments");
  if (ctxPayments) {
    // Agréger tous les types présents
    const allTypes = new Set();
    reports.forEach(r => (r.payments || []).forEach(p => { if (p.type && p.type !== "?") allTypes.add(p.type); }));
    const typeColors = {
      INT: REPORT_COLORS.secondary,
      MAS: REPORT_COLORS.tertiary,
      VIS: REPORT_COLORS.primary,
      CAS: REPORT_COLORS.green,
      COM: "#94a3b8",
      UBE: "#000000",
      DOO: "#ff6b6b",
      CRE: REPORT_COLORS.purple,
      AME: REPORT_COLORS.teal,
      GIF: REPORT_COLORS.pink,
      CAR: REPORT_COLORS.orange
    };
    const datasets = [...allTypes].sort().map(type => ({
      label: type,
      data: reports.map(r => {
        const p = (r.payments || []).find(x => x.type === type);
        return p ? Number(p.amount) || 0 : 0;
      }),
      backgroundColor: typeColors[type] || "#94a3b8",
      borderRadius: 3
    }));
    _reportChartInstances.payments = new Chart(ctxPayments, {
      type: "bar",
      data: { labels, datasets },
      options: chartCommonOptions(textColor, gridColor, {
        scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor, callback: v => "$" + v.toLocaleString("fr-CA") }, grid: { color: gridColor } }
        }
      })
    });
  }

  // ─ Chart 4 : Top catégories agrégées (doughnut) ─
  const ctxCats = document.getElementById("reports-chart-categories");
  if (ctxCats) {
    const agg = new Map();
    reports.forEach(r => {
      (r.top_categories || []).forEach(c => {
        // Normaliser le nom (insensible à la casse pour fusionner "Bière"/"biere" etc.)
        const key = (c.name || "").toUpperCase().trim();
        const cur = agg.get(key) || { name: c.name, total: 0 };
        cur.total += Number(c.total) || 0;
        agg.set(key, cur);
      });
    });
    const sorted = [...agg.values()].sort((a, b) => b.total - a.total).slice(0, 12);
    _reportChartInstances.categories = new Chart(ctxCats, {
      type: "doughnut",
      data: {
        labels: sorted.map(c => c.name),
        datasets: [{
          data: sorted.map(c => c.total),
          backgroundColor: REPORT_COLOR_PALETTE.concat(REPORT_COLOR_PALETTE),
          borderColor: darkMode ? "#1c1815" : "#ffffff",
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: textColor, font: { size: 11 }, padding: 8, boxWidth: 14 }
          },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.label} : ${fmtMoney(ctx.parsed)}`
            }
          }
        }
      }
    });
  }
}

// Options communes Chart.js (légende + tooltip stylés)
function chartCommonOptions(textColor, gridColor, override = {}) {
  const tooltipBg = darkMode ? "#25201d" : "#ffffff";
  const tooltipText = darkMode ? "#f5f1e8" : "#0e0d0c";
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: "top",
        labels: {
          color: textColor,
          font: { family: "Inter, sans-serif", size: 12, weight: 500 },
          usePointStyle: true,
          padding: 14
        }
      },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: gridColor,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y !== undefined ? ctx.parsed.y : ctx.parsed;
            return `${ctx.dataset.label} : ${fmtMoney(v)}`;
          }
        }
      }
    },
    ...override
  };
}

// ═ Actions ═════════════════════════════════════════════
function setReportsPeriod(p) {
  if (p === "all") reportsViewPeriod = "all";
  else if (p === "custom") {
    reportsViewPeriod = "custom";
    // Initialiser les bornes au range complet si pas encore défini
    const all = (monthlyReports || []).map(r => r.period).sort();
    if (!reportsCustomStart) reportsCustomStart = all[0] || "";
    if (!reportsCustomEnd) reportsCustomEnd = all[all.length - 1] || "";
  } else {
    reportsViewPeriod = Number(p);
  }
  renderPage();
}

function setReportsCustomRange(which, value) {
  if (which === "start") reportsCustomStart = value;
  else if (which === "end") reportsCustomEnd = value;
  // Garantir start <= end
  if (reportsCustomStart && reportsCustomEnd && reportsCustomStart > reportsCustomEnd) {
    const tmp = reportsCustomStart;
    reportsCustomStart = reportsCustomEnd;
    reportsCustomEnd = tmp;
  }
  renderPage();
}

function toggleReportsYoY(checked) {
  reportsCompareYoY = !!checked;
  renderPage();
}

// ═ Import seed ═════════════════════════════════════════

function openReportsImportModal() {
  const seed = (typeof window !== "undefined" && window.BOCHICA_MONTHLY_REPORTS_SEED) || [];
  if (!seed.length) {
    return toast("Aucun seed disponible. Vérifie que monthly-reports-seed.js est chargé.", "error");
  }
  const existing = (monthlyReports || []).length;
  showModal(`<div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h3>${icon("download", 18)} Importer les rapports</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;line-height:1.55;margin-bottom:16px">
      <strong>${seed.length} rapports mensuels</strong> pré-parsés depuis les PDFs Cluster sont prêts à être importés dans Firestore.
    </p>
    <ul style="font-size:12px;color:var(--text2);margin-bottom:18px;padding-left:18px;line-height:1.6">
      ${seed.map(r => `<li><strong>${fmtMonthLong(r.period)}</strong> · ${(r.summary?.receipts || 0).toLocaleString("fr-CA")} reçus · ${fmtMoney(r.summary?.total_with_tax || 0)}</li>`).join("")}
    </ul>
    ${existing > 0 ? `<div class="payroll-info-banner" style="margin:0 0 14px">
      ${icon("info", 14)}
      <div>${existing} rapport${existing > 1 ? "s" : ""} déjà importé${existing > 1 ? "s" : ""}. L'import va <strong>écraser</strong> les valeurs existantes pour les mêmes périodes.</div>
    </div>` : ""}
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="importReportsSeed()">${icon("download", 14)} Importer ${seed.length} rapports</button>
    </div>
  </div>`);
}

async function importReportsSeed() {
  const seed = (typeof window !== "undefined" && window.BOCHICA_MONTHLY_REPORTS_SEED) || [];
  if (!seed.length) return toast("Aucune donnée à importer.", "error");
  closeModal();
  toast(`Import de ${seed.length} rapports en cours…`, "info", 2000);
  try {
    const batch = db.batch();
    seed.forEach(r => {
      const ref = db.collection("monthlyReports").doc(r.period);
      batch.set(ref, {
        ...r,
        importedAt: firebase.firestore.FieldValue.serverTimestamp(),
        importedBy: (loggedInUser?.id) || "—"
      });
    });
    await batch.commit();
    toast(`✓ ${seed.length} rapports importés avec succès !`, "success");
    await addLog("—", "Rapports importés", `${seed.length} rapports mensuels seed`);
  } catch (err) {
    console.error("importReportsSeed:", err);
    toast("Erreur import : " + (err.message || err), "error", 6000);
  }
}
