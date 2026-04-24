// ═══════════════════════════════════════════════════════════════
// DASHBOARD — Tableau de bord, Taxes TPS/TVQ, Frais fixes auto
// (Extrait de l'ancien pages-admin.js)
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════
// FRAIS FIXES AUTOMATIQUES
// ══════════════════════════════════════════════════════

async function autoApplyFixedExpenses() {
  if (!isAdmin) return;
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const firstOfMonth = `${currentMonthKey}-01`;

  // Vérifier si déjà appliqué ce mois-ci
  const alreadyApplied = expenses.some(e =>
    e.isFixedAuto && e.date && e.date.startsWith(currentMonthKey)
  );
  if (alreadyApplied) return;

  // Copier tous les templates de frais fixes
  const templates = fixedExpenseTemplates;
  if (!templates.length) return;

  const batch = db.batch();
  templates.forEach(tpl => {
    const nid = genId();
    const ref = db.collection("expenses").doc(nid);
    batch.set(ref, {
      id: nid,
      supplier: tpl.supplier || "",
      description: tpl.supplier || tpl.description || "",
      amount: tpl.amount || 0,
      tps: tpl.tps || 0,
      tvq: tpl.tvq || 0,
      category: tpl.category || "",
      date: firstOfMonth,
      notes: tpl.notes || "",
      isFixedAuto: true
    });
  });
  await batch.commit();
}

// ═══════════════════════════════════════════════════════════════
// HELPERS DE PÉRIODE — Pour comparaisons et calculs TPS/TVQ
// ═══════════════════════════════════════════════════════════════

// Retourne {start, end} en YYYY-MM-DD pour le mois donné
function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

// Retourne {start, end} pour la semaine ISO contenant la date donnée
function getWeekRange(d) {
  const date = new Date(d);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10)
  };
}

// Calcul TPS/TVQ pour une période donnée
function computeTaxesForPeriod(startDate, endDate) {
  const revs = revenues.filter(r => {
    const d = r.dateStart || r.date;
    return d && d >= startDate && d <= endDate;
  });
  const exps = expenses.filter(e => e.date && e.date >= startDate && e.date <= endDate);
  const tpsCollected = revs.reduce((s, r) => s + Number(r.tps || 0), 0);
  const tvqCollected = revs.reduce((s, r) => s + Number(r.tvq || 0), 0);
  const tpsPaid = exps.reduce((s, e) => s + Number(e.tps || 0), 0);
  const tvqPaid = exps.reduce((s, e) => s + Number(e.tvq || 0), 0);
  return {
    tpsCollected, tvqCollected, tpsPaid, tvqPaid,
    tpsToRemit: tpsCollected - tpsPaid,
    tvqToRemit: tvqCollected - tvqPaid
  };
}

// Retourne le trimestre fiscal courant : { quarter, year, startDate, endDate, dueDate }
// Au Québec : Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
// Échéance : 1 mois après fin du trimestre
function getCurrentQuarter() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const quarter = Math.floor(month / 3) + 1; // 1, 2, 3 ou 4
  const qStartMonth = (quarter - 1) * 3;
  const qEndMonth = qStartMonth + 2;
  const startDate = new Date(year, qStartMonth, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, qEndMonth + 1, 0).toISOString().slice(0, 10);
  // Échéance : dernier jour du mois suivant la fin du trimestre
  const dueMonth = qEndMonth + 1;
  const dueYear = dueMonth > 11 ? year + 1 : year;
  const dueMonthAdj = dueMonth > 11 ? dueMonth - 12 : dueMonth;
  const dueDate = new Date(dueYear, dueMonthAdj + 1, 0).toISOString().slice(0, 10);
  return { quarter, year, startDate, endDate, dueDate };
}

// Pourcentage de variation entre 2 valeurs
function pctChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

// ═══════════════════════════════════════════════════════════════
// PAGE DASHBOARD — Tableau de bord exécutif (admin)
// ═══════════════════════════════════════════════════════════════

function renderDashboard() {
  const now = new Date();
  const curMonth = getMonthRange(now.getFullYear(), now.getMonth());
  const prevMonth = getMonthRange(now.getFullYear(), now.getMonth() - 1);

  // Calculs du mois courant
  const monthRevs = revenues.filter(r => {
    const d = r.dateStart || r.date;
    return d && d >= curMonth.start && d <= curMonth.end;
  });
  const monthExps = expenses.filter(e => e.date && e.date >= curMonth.start && e.date <= curMonth.end);
  const totalRevs = monthRevs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalExps = monthExps.reduce((s, e) => s + Number(e.amount || 0), 0);
  const profit = totalRevs - totalExps;

  // Calculs du mois précédent
  const prevRevs = revenues.filter(r => {
    const d = r.dateStart || r.date;
    return d && d >= prevMonth.start && d <= prevMonth.end;
  });
  const prevExps = expenses.filter(e => e.date && e.date >= prevMonth.start && e.date <= prevMonth.end);
  const totalPrevRevs = prevRevs.reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPrevExps = prevExps.reduce((s, e) => s + Number(e.amount || 0), 0);
  const prevProfit = totalPrevRevs - totalPrevExps;

  // Variations %
  const revChange = pctChange(totalRevs, totalPrevRevs);
  const expChange = pctChange(totalExps, totalPrevExps);
  const profitChange = pctChange(profit, prevProfit);

  // Stock critique
  const criticalProducts = products.filter(p => !p.archived && getStatus(p) === "red")
    .sort((a, b) => getCurrentStock(a) - getCurrentStock(b))
    .slice(0, 5);

  // Tâches en retard
  const today = now.toISOString().slice(0, 10);
  const overdueTasks = tasks.filter(tk => tk.status !== "Complété" && tk.dueDate && tk.dueDate < today)
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
    .slice(0, 5);

  // Top 3 dépenses du mois
  const topExpenses = [...monthExps]
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5);

  // Marge moyenne du menu
  const itemsWithRecipe = menuItems.filter(m => Array.isArray(m.recipe) && m.recipe.length > 0 && m.price > 0);
  const avgMargin = itemsWithRecipe.length > 0
    ? itemsWithRecipe.reduce((s, m) => {
        const fc = computeRecipeFoodCost(m.recipe);
        return s + ((m.price - fc) / m.price) * 100;
      }, 0) / itemsWithRecipe.length
    : 0;

  // Trimestre fiscal
  const q = getCurrentQuarter();
  const taxes = computeTaxesForPeriod(q.startDate, q.endDate);
  const daysToDeadline = Math.ceil((new Date(q.dueDate) - now) / (1000 * 60 * 60 * 24));

  const userName = loggedInUser?.name || t("role_admin");

  let h = `<div class="page">
    <div class="dash-greeting">
      <h2 class="dash-greeting__title">${icon("crown", 22)} ${t("dash_title")}</h2>
      <p class="dash-greeting__sub">${t("dash_welcome", { name: userName })}</p>
    </div>

    <!-- Stats principales avec comparaison -->
    <div class="dash-stats-grid">
      ${dashStatCard({
        icon: "wallet",
        label: t("dash_revenues_month"),
        value: fmtMoney(totalRevs),
        delta: revChange,
        deltaLabel: t("dash_vs_last_month"),
        color: "var(--status-green)",
        positive: true
      })}
      ${dashStatCard({
        icon: "trending-down",
        label: t("dash_expenses_month"),
        value: fmtMoney(totalExps),
        delta: expChange,
        deltaLabel: t("dash_vs_last_month"),
        color: "var(--status-red)",
        positive: false
      })}
      ${dashStatCard({
        icon: profit >= 0 ? "trending-up" : "trending-down",
        label: t("dash_profit_month"),
        value: fmtMoney(Math.abs(profit)) + (profit < 0 ? " (déficit)" : ""),
        delta: profitChange,
        deltaLabel: t("dash_vs_last_month"),
        color: profit >= 0 ? "var(--accent)" : "var(--status-red)",
        positive: true
      })}
      ${itemsWithRecipe.length > 0 ? dashStatCard({
        icon: "utensils",
        label: t("dash_avg_margin"),
        value: avgMargin.toFixed(1) + "%",
        delta: null,
        deltaLabel: `${itemsWithRecipe.length} ${t("rec_total_items").toLowerCase()}`,
        color: avgMargin >= 70 ? "var(--status-green)" : avgMargin >= 50 ? "var(--status-yellow)" : "var(--status-red)",
        positive: true
      }) : ""}
    </div>

    <!-- Grille principale en 2 colonnes -->
    <div class="dash-grid">
      ${renderDashTaxCard(q, taxes, daysToDeadline)}
      ${renderDashCriticalStock(criticalProducts)}
      ${renderDashOverdueTasks(overdueTasks)}
      ${renderDashTopExpenses(topExpenses)}
    </div>
  </div>`;

  return h;
}

// Carte stat avec delta % et flèche
function dashStatCard({ icon: iconName, label, value, delta, deltaLabel, color, positive }) {
  let deltaHtml = "";
  if (delta !== null && delta !== undefined && Number.isFinite(delta) && Math.abs(delta) >= 0.1) {
    const isUp = delta > 0;
    const isGood = positive ? isUp : !isUp;
    const arrowIcon = isUp ? "trending-up" : "trending-down";
    const deltaColor = isGood ? "var(--status-green)" : "var(--status-red)";
    deltaHtml = `<div class="dash-stat__delta" style="color:${deltaColor}">
      ${icon(arrowIcon, 12)} ${isUp ? "+" : ""}${delta.toFixed(1)}% <span style="color:var(--text3);font-weight:400">${deltaLabel}</span>
    </div>`;
  } else if (deltaLabel) {
    deltaHtml = `<div class="dash-stat__delta" style="color:var(--text3)">${deltaLabel}</div>`;
  }

  return `<div class="dash-stat-card" style="border-left-color:${color}">
    <div class="dash-stat__head">
      <span style="color:${color}">${icon(iconName, 16)}</span>
      <span class="dash-stat__label">${label}</span>
    </div>
    <div class="dash-stat__value" style="color:${color}">${value}</div>
    ${deltaHtml}
  </div>`;
}

function renderDashTaxCard(q, taxes, daysToDeadline) {
  const totalToRemit = taxes.tpsToRemit + taxes.tvqToRemit;
  let urgencyClass = "dash-card--ok";
  let urgencyIcon = "shield-check";
  let dueLabel = "";
  if (daysToDeadline < 0) {
    urgencyClass = "dash-card--danger";
    urgencyIcon = "alert";
    dueLabel = `<strong style="color:var(--status-red)">${t("dash_overdue")} (${Math.abs(daysToDeadline)} ${t("rec_minutes") === "min" ? "j" : "d"})</strong>`;
  } else if (daysToDeadline <= 15) {
    urgencyClass = "dash-card--warn";
    urgencyIcon = "alert";
    dueLabel = `<strong style="color:var(--status-yellow)">${t("dash_due_in", { n: daysToDeadline })}</strong>`;
  } else {
    dueLabel = `<span style="color:var(--text3)">${t("dash_due_in", { n: daysToDeadline })}</span>`;
  }

  return `<div class="dash-card ${urgencyClass}">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon(urgencyIcon, 16)} ${t("tax_card_title")}</h3>
      <button class="btn-icon-only" onclick="navTo('depenses')" aria-label="${t("dash_view_more")}" title="${t("dash_view_more")}">${icon("arrow-right", 14)}</button>
    </div>
    <div class="dash-tax-info">
      <div class="dash-tax-period">
        ${t("tax_quarter")} ${q.quarter} · ${q.year}<br/>
        <small style="color:var(--text3)">${t("tax_due_date")} ${q.dueDate}</small><br/>
        ${dueLabel}
      </div>
      <div class="dash-tax-amount">
        <div class="dash-tax-label">${t("tax_to_remit")}</div>
        <div class="dash-tax-value" style="color:${totalToRemit > 0 ? 'var(--accent)' : 'var(--status-green)'}">${fmtMoney(Math.abs(totalToRemit))}</div>
        ${totalToRemit < 0 ? `<small style="color:var(--status-green)">${t("tax_credit_to_recover")}</small>` : ""}
      </div>
    </div>
    <div class="dash-tax-breakdown">
      <div>TPS : ${fmtMoney(taxes.tpsToRemit)}</div>
      <div>TVQ : ${fmtMoney(taxes.tvqToRemit)}</div>
    </div>
  </div>`;
}

function renderDashCriticalStock(critical) {
  if (critical.length === 0) {
    return `<div class="dash-card dash-card--ok">
      <div class="dash-card__head">
        <h3 class="dash-card__title">${icon("package", 16)} ${t("dash_critical_stock")}</h3>
      </div>
      <div class="dash-empty">${t("dash_no_critical")}</div>
    </div>`;
  }
  return `<div class="dash-card dash-card--danger">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon("alert", 16)} ${t("dash_critical_stock")}</h3>
      <button class="btn-icon-only" onclick="navTo('rapport')" aria-label="${t("dash_view_all")}" title="${t("dash_view_all")}">${icon("arrow-right", 14)}</button>
    </div>
    <ul class="dash-list">
      ${critical.map(p => `<li class="dash-list__item">
        <span class="dash-list__name">${esc(p.name || "?")}</span>
        <span class="dash-list__value" style="color:var(--status-red);font-weight:700">${getCurrentStock(p)} / ${p.minimum || 0}</span>
      </li>`).join("")}
    </ul>
  </div>`;
}

function renderDashOverdueTasks(overdue) {
  if (overdue.length === 0) {
    return `<div class="dash-card dash-card--ok">
      <div class="dash-card__head">
        <h3 class="dash-card__title">${icon("clipboard", 16)} ${t("dash_overdue_tasks")}</h3>
      </div>
      <div class="dash-empty">${t("dash_no_overdue")}</div>
    </div>`;
  }
  return `<div class="dash-card dash-card--warn">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon("alert", 16)} ${t("dash_overdue_tasks")}</h3>
      <button class="btn-icon-only" onclick="navTo('taches')" aria-label="${t("dash_view_all")}" title="${t("dash_view_all")}">${icon("arrow-right", 14)}</button>
    </div>
    <ul class="dash-list">
      ${overdue.map(tk => `<li class="dash-list__item">
        <span class="dash-list__name">${esc(tk.title || "?")}</span>
        <span class="dash-list__value" style="color:var(--status-red);font-size:11px">${tk.dueDate}</span>
      </li>`).join("")}
    </ul>
  </div>`;
}

function renderDashTopExpenses(top) {
  if (top.length === 0) {
    return `<div class="dash-card">
      <div class="dash-card__head">
        <h3 class="dash-card__title">${icon("trending-down", 16)} ${t("dash_top_expenses")}</h3>
      </div>
      <div class="dash-empty">${t("dash_no_expenses")}</div>
    </div>`;
  }
  return `<div class="dash-card">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon("trending-down", 16)} ${t("dash_top_expenses")}</h3>
      <button class="btn-icon-only" onclick="navTo('depenses')" aria-label="${t("dash_view_all")}" title="${t("dash_view_all")}">${icon("arrow-right", 14)}</button>
    </div>
    <ul class="dash-list">
      ${top.map(e => `<li class="dash-list__item">
        <span class="dash-list__name">${esc(e.description || "?")}<br/><small style="color:var(--text3);font-size:10px">${e.supplier ? esc(e.supplier) + " · " : ""}${e.date || ""}</small></span>
        <span class="dash-list__value" style="color:var(--status-red);font-weight:700">${fmtMoney(e.amount)}</span>
      </li>`).join("")}
    </ul>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// COMPARAISON PÉRIODE — Cartes stats avec delta % à intégrer
// dans la page Dépenses (utiliser à côté des stats existantes)
// ═══════════════════════════════════════════════════════════════

// Génère un mini-badge avec flèche selon variation % (positive ou négative)
function periodCompareBadge(delta, positive = true) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.1) return "";
  const isUp = delta > 0;
  const isGood = positive ? isUp : !isUp;
  const arrow = isUp ? "trending-up" : "trending-down";
  const color = isGood ? "var(--status-green)" : "var(--status-red)";
  return `<span class="icon-inline" style="color:${color};font-size:11px;font-weight:700;margin-left:6px">${icon(arrow, 11)} ${isUp ? "+" : ""}${delta.toFixed(1)}%</span>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE TPS/TVQ — Détail trimestre + historique des remises
// ═══════════════════════════════════════════════════════════════

let activeTaxQuarter = null; // { quarter, year } ou null = trimestre courant

function renderTaxes() {
  const q = activeTaxQuarter || getCurrentQuarter();
  const taxes = computeTaxesForPeriod(q.startDate, q.endDate);

  // Liste des trimestres précédents (4 derniers)
  const now = new Date();
  const quarters = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i * 3, 1);
    const qNum = Math.floor(d.getMonth() / 3) + 1;
    const qStartMonth = (qNum - 1) * 3;
    const startDate = new Date(d.getFullYear(), qStartMonth, 1).toISOString().slice(0, 10);
    const endDate = new Date(d.getFullYear(), qStartMonth + 3, 0).toISOString().slice(0, 10);
    quarters.push({ quarter: qNum, year: d.getFullYear(), startDate, endDate });
  }

  let h = `<div class="page">
    <div class="toolbar">
      <div>
        <h2 style="font-size:18px">${icon("shield-check", 18)} ${t("tax_card_title")}</h2>
        <p style="font-size:13px;color:var(--text3);margin-top:2px">Calcul automatique TPS/TVQ par trimestre</p>
      </div>
    </div>

    <!-- Sélecteur de trimestre -->
    <div class="section-tabs section-tabs--scroll" style="margin-bottom:16px">
      ${quarters.map(qq => `<button class="sec-btn ${qq.quarter === q.quarter && qq.year === q.year ? "active" : ""}" onclick="setActiveTaxQuarter(${qq.quarter}, ${qq.year})">${t("tax_quarter")} ${qq.quarter} · ${qq.year}</button>`).join("")}
    </div>

    <!-- Carte récapitulative -->
    <div class="card" style="margin-bottom:16px">
      <h3 style="font-family:var(--font-heading);font-size:18px;margin:0 0 14px;letter-spacing:-.3px">${t("tax_quarter")} ${q.quarter} ${q.year}</h3>

      <table style="margin-bottom:14px">
        <thead><tr>
          <th></th>
          <th style="text-align:right">${t("tax_collected")}</th>
          <th style="text-align:right">${t("tax_paid")}</th>
          <th style="text-align:right">${t("tax_to_remit")}</th>
        </tr></thead>
        <tbody>
          <tr>
            <td><strong>TPS (5%)</strong></td>
            <td style="text-align:right;color:var(--status-green)">${fmtMoney(taxes.tpsCollected)}</td>
            <td style="text-align:right;color:var(--status-red)">${fmtMoney(taxes.tpsPaid)}</td>
            <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent)">${fmtMoney(taxes.tpsToRemit)}</td>
          </tr>
          <tr>
            <td><strong>TVQ (9.975%)</strong></td>
            <td style="text-align:right;color:var(--status-green)">${fmtMoney(taxes.tvqCollected)}</td>
            <td style="text-align:right;color:var(--status-red)">${fmtMoney(taxes.tvqPaid)}</td>
            <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent)">${fmtMoney(taxes.tvqToRemit)}</td>
          </tr>
          <tr style="background:var(--surface2)">
            <td><strong>Total</strong></td>
            <td style="text-align:right;font-weight:700">${fmtMoney(taxes.tpsCollected + taxes.tvqCollected)}</td>
            <td style="text-align:right;font-weight:700">${fmtMoney(taxes.tpsPaid + taxes.tvqPaid)}</td>
            <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent);font-size:18px">${fmtMoney(taxes.tpsToRemit + taxes.tvqToRemit)}</td>
          </tr>
        </tbody>
      </table>

      <div style="background:var(--surface2);padding:12px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px">${t("tax_due_date")}</div>
          <div style="font-family:var(--font-heading);font-size:16px;font-weight:700">${q.dueDate}</div>
        </div>
        <button class="btn btn-primary" onclick="markTaxRemitted('${q.year}-Q${q.quarter}', ${taxes.tpsToRemit + taxes.tvqToRemit})">
          ${icon("check", 14)} ${t("tax_mark_paid")}
        </button>
      </div>
    </div>

    <!-- Détail revenus & dépenses du trimestre -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">
      <div class="card">
        <h4 style="font-family:var(--font-heading);font-size:14px;margin:0 0 8px;color:var(--status-green)">${icon("trending-up", 14)} ${t("exp_revenues")}</h4>
        <div style="font-size:13px;color:var(--text2)">
          ${revenues.filter(r => { const d = r.dateStart || r.date; return d && d >= q.startDate && d <= q.endDate; }).length} entrées · ${fmtMoney(revenues.filter(r => { const d = r.dateStart || r.date; return d && d >= q.startDate && d <= q.endDate; }).reduce((s, r) => s + Number(r.amount || 0), 0))}
        </div>
      </div>
      <div class="card">
        <h4 style="font-family:var(--font-heading);font-size:14px;margin:0 0 8px;color:var(--status-red)">${icon("trending-down", 14)} ${t("exp_expenses_pre_tax")}</h4>
        <div style="font-size:13px;color:var(--text2)">
          ${expenses.filter(e => e.date && e.date >= q.startDate && e.date <= q.endDate).length} entrées · ${fmtMoney(expenses.filter(e => e.date && e.date >= q.startDate && e.date <= q.endDate).reduce((s, e) => s + Number(e.amount || 0), 0))}
        </div>
      </div>
    </div>
  </div>`;
  return h;
}

function setActiveTaxQuarter(quarter, year) {
  // Calculer startDate/endDate/dueDate
  const qStartMonth = (quarter - 1) * 3;
  const startDate = new Date(year, qStartMonth, 1).toISOString().slice(0, 10);
  const endDate = new Date(year, qStartMonth + 3, 0).toISOString().slice(0, 10);
  const dueMonth = qStartMonth + 3;
  const dueYear = dueMonth > 11 ? year + 1 : year;
  const dueMonthAdj = dueMonth > 11 ? dueMonth - 12 : dueMonth;
  const dueDate = new Date(dueYear, dueMonthAdj + 1, 0).toISOString().slice(0, 10);
  activeTaxQuarter = { quarter, year, startDate, endDate, dueDate };
  renderPage();
}

async function markTaxRemitted(periodKey, amount) {
  if (!confirm(getUILang() === "es"
    ? `¿Marcar las taxes ${periodKey} como pagadas (${fmtMoney(amount)})?`
    : `Marquer les taxes ${periodKey} comme remises (${fmtMoney(amount)}) ?`)) return;
  const id = `tax_${periodKey}_${Date.now()}`;
  await db.collection("taxRemittances").doc(id).set({
    id,
    period: periodKey,
    amount,
    paidAt: new Date().toISOString().slice(0, 10),
    by: loggedInUser?.name || "Admin"
  });
  toast(getUILang() === "es" ? "Taxes marcadas como pagadas." : "Taxes marquées comme remises.", "success");
}
