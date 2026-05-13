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

  // Prochains événements (5 max, dans les 60 prochains jours, hors annulés)
  const todayStr = now.toISOString().slice(0, 10);
  const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const upcomingEvents = (typeof events !== "undefined" ? events : [])
    .filter(e => e.date && e.date >= todayStr && e.date <= in60 && e.status !== "annule")
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      if (c !== 0) return c;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    })
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

  // Sparklines (séries 30 jours) pour les KPI cards
  const sparkRevs = buildSpark30d(revenues, new Date(now));
  const sparkExps = buildSpark30d(expenses, new Date(now));
  // Profit jour par jour = revenus - dépenses du jour
  const sparkProfit = sparkRevs.map((r, i) => r - sparkExps[i]);

  const userName = loggedInUser?.name || t("role_admin");

  // ─ Widget Aujourd'hui : employés en shift + événements + tâches dues + ratio ─
  const todayWidget = renderDashTodayWidget(now, todayStr);

  let h = `<div class="page">
    <div class="dash-greeting">
      <h2 class="dash-greeting__title">${icon("crown", 22)} ${t("dash_title")}</h2>
      <p class="dash-greeting__sub">${t("dash_welcome", { name: userName })}</p>
    </div>

    ${todayWidget}

    <!-- Stats principales avec comparaison -->
    <div class="dash-stats-grid">
      ${dashStatCard({
        icon: "wallet",
        label: t("dash_revenues_month"),
        value: fmtMoney(totalRevs),
        delta: revChange,
        deltaLabel: t("dash_vs_last_month"),
        color: "#7dbf66",
        positive: true,
        sparkData: sparkRevs,
        sparkId: "dash-spark-rev"
      })}
      ${dashStatCard({
        icon: "trending-down",
        label: t("dash_expenses_month"),
        value: fmtMoney(totalExps),
        delta: expChange,
        deltaLabel: t("dash_vs_last_month"),
        color: "#d9534f",
        positive: false,
        sparkData: sparkExps,
        sparkId: "dash-spark-exp"
      })}
      ${dashStatCard({
        icon: profit >= 0 ? "trending-up" : "trending-down",
        label: t("dash_profit_month"),
        value: fmtMoney(Math.abs(profit)) + (profit < 0 ? " (déficit)" : ""),
        delta: profitChange,
        deltaLabel: t("dash_vs_last_month"),
        color: profit >= 0 ? "#F7B32C" : "#d9534f",
        positive: true,
        sparkData: sparkProfit,
        sparkId: "dash-spark-profit"
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
      ${renderDashUpcomingEvents(upcomingEvents)}
      ${renderDashCriticalStock(criticalProducts)}
      ${renderDashOverdueTasks(overdueTasks)}
      ${renderDashTopExpenses(topExpenses)}
    </div>
  </div>`;

  return h;
}

// Carte stat avec delta % et flèche + sparkline optionnelle en arrière-plan
function dashStatCard({ icon: iconName, label, value, delta, deltaLabel, color, positive, sparkData = null, sparkId = null }) {
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
    deltaHtml = `<div class="dash-stat__delta text-muted">${deltaLabel}</div>`;
  }

  // Sparkline : canvas en arrière-plan (CSS positionne en absolu)
  const sparkHtml = (sparkData && sparkData.length > 0 && sparkId)
    ? `<canvas class="dash-stat-card__spark" id="${sparkId}" data-color="${color}" data-values='${JSON.stringify(sparkData)}'></canvas>`
    : "";

  return `<div class="dash-stat-card" style="border-left-color:${color}">
    ${sparkHtml}
    <div class="dash-stat__head">
      <span style="color:${color}">${icon(iconName, 16)}</span>
      <span class="dash-stat__label">${label}</span>
    </div>
    <div class="dash-stat__value" style="color:${color}">${value}</div>
    ${deltaHtml}
  </div>`;
}

// Construit une série de 30 jours pour les sparklines : somme par jour de
// `items` (revenus ou dépenses) avec champ `date` au format YYYY-MM-DD.
// Retourne un tableau de 30 nombres (du plus ancien au plus récent, jour J = aujourd'hui).
function buildSpark30d(items, now) {
  const series = new Array(30).fill(0);
  const todayMs = now.setHours(0, 0, 0, 0);
  items.forEach(it => {
    const d = it.dateStart || it.date;
    if (!d) return;
    const dt = new Date(d).setHours(0, 0, 0, 0);
    const diffDays = Math.floor((todayMs - dt) / 86400000);
    if (diffDays >= 0 && diffDays < 30) {
      series[29 - diffDays] += Number(it.amount || 0);
    }
  });
  return series;
}

// Initialise les sparklines Chart.js dans les KPI cards
function initDashSparklines() {
  if (typeof Chart === "undefined") return;
  document.querySelectorAll(".dash-stat-card__spark").forEach(canvas => {
    let data;
    try { data = JSON.parse(canvas.dataset.values || "[]"); } catch (_) { return; }
    if (!data.length) return;
    const color = canvas.dataset.color || "var(--accent)";
    // Détruire instance précédente si présente (data attribute)
    if (canvas._sparkInstance) {
      try { canvas._sparkInstance.destroy(); } catch (_) {}
    }
    canvas._sparkInstance = new Chart(canvas, {
      type: "line",
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: color,
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.35,
          fill: {
            target: "origin",
            above: color.startsWith("var(") ? color : color
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false, beginAtZero: true }
        },
        elements: {
          line: {
            borderJoinStyle: "round"
          }
        }
      }
    });
    // Forcer un fond très transparent pour l'aire (le CSS gère l'opacité globale)
    canvas._sparkInstance.data.datasets[0].backgroundColor = (() => {
      // On laisse Chart.js utiliser couleur de borderColor mais à 30% via filter
      return color;
    })();
  });
}

// ═ Widget Aujourd'hui : vue d'ensemble de la journée en cours ════════════
function renderDashTodayWidget(now, todayStr) {
  // Date formatée en français québécois
  const dayName = now.toLocaleDateString("fr-CA", { weekday: "long" });
  const dateLong = now.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  // Capitaliser le jour
  const dayDisplay = dayName.charAt(0).toUpperCase() + dayName.slice(1);

  // Employés en shift aujourd'hui (depuis employees.shifts indexés par date YYYY-MM-DD)
  const shiftsToday = (typeof employees !== "undefined" ? employees : [])
    .map(emp => {
      const s = (emp.shifts || {})[todayStr];
      if (!s || !s.start) return null;
      return { name: emp.name || "—", start: s.start, end: s.end || "", section: emp.section || "service" };
    })
    .filter(Boolean)
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""));

  // Calcul du début/fin de semaine ISO (lundi → dimanche, en cours)
  const weekStartDate = getWeekStartForDashboard(now);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate); d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const weekStartStr = weekDates[0];
  const weekEndStr = weekDates[6];

  // Événements de la SEMAINE en cours (lundi → dimanche, non annulés)
  // Inclut les spectacles, réservations, soirées karaoké, internes, fériés
  const eventsWeek = (typeof events !== "undefined" ? events : [])
    .filter(e => e.date && e.date >= weekStartStr && e.date <= weekEndStr && e.status !== "annule")
    .sort((a, b) => {
      const c = (a.date || "").localeCompare(b.date || "");
      if (c !== 0) return c;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });

  // Tâches dues aujourd'hui (non complétées)
  const tasksToday = (typeof tasks !== "undefined" ? tasks : [])
    .filter(tk => tk.status !== "Complété" && tk.dueDate === todayStr)
    .slice(0, 5);
  let weekGross = 0;
  let weekSales = 0;
  if (typeof employees !== "undefined") {
    employees.forEach(emp => {
      const rate = Number(emp.hourlyRate) || 0;
      if (emp.isSalaried) {
        weekGross += (Number(emp.fixedWeeklyHours) || 0) * rate;
      } else {
        weekDates.forEach(dk => {
          const s = (emp.shifts || {})[dk];
          if (s && s.start && s.end) {
            const [sh, sm] = String(s.start).split(":").map(Number);
            const [eh, em] = String(s.end).split(":").map(Number);
            let diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
            if (diff < 0) diff += 24 * 60;
            weekGross += (diff / 60) * rate;
          }
        });
      }
    });
  }
  const actualSales = (typeof scheduleSettings !== "undefined" && scheduleSettings.actualSales) || {};
  weekDates.forEach(dk => { weekSales += Number(actualSales[dk] || 0); });
  const ratio = weekSales > 0 ? (weekGross / weekSales) * 100 : 0;
  const ratioCls = weekSales === 0 ? "is-empty"
    : ratio < 32 ? "is-good"
    : ratio < 40 ? "is-warn"
    : "is-bad";

  // Couleurs par section pour les pills employés
  const sectionColor = (sec) => sec === "cuisine" ? "#7dbf66" : sec === "service" ? "#4a90e2" : "#94a3b8";

  return `<div class="dash-today-widget">
    <div class="dash-today-widget__head">
      <div>
        <h2 class="dash-today-widget__date">${dayDisplay}<small>${dateLong}</small></h2>
      </div>
      <div class="dash-today-widget__ratio">
        <div class="dash-today-widget__ratio-pct ${ratioCls}">
          ${weekSales > 0 ? ratio.toFixed(1) + "<small>%</small>" : "—"}
        </div>
        <div class="dash-today-widget__ratio-label">Ratio salaires/ventes (sem.)</div>
      </div>
    </div>
    <div class="dash-today-widget__grid">
      <!-- Employés en shift aujourd'hui -->
      <div class="dash-today-block">
        <div class="dash-today-block__title">${icon("users", 12)} En shift aujourd'hui (${shiftsToday.length})</div>
        <div class="dash-today-block__list">
          ${shiftsToday.length === 0
            ? `<div class="dash-today-empty">Aucun shift planifié</div>`
            : shiftsToday.slice(0, 5).map(s => `<div class="dash-today-item">
                <span style="width:6px;height:6px;border-radius:50%;background:${sectionColor(s.section)};flex-shrink:0"></span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.name)}</span>
                <span class="dash-today-item__time">${s.start}${s.end ? "–" + s.end : ""}</span>
              </div>`).join("")
              + (shiftsToday.length > 5 ? `<div class="dash-today-empty">+ ${shiftsToday.length - 5} autres</div>` : "")
          }
        </div>
      </div>

      <!-- Événements de la semaine -->
      <div class="dash-today-block">
        <div class="dash-today-block__title">${icon("calendar", 12)} Événements cette semaine (${eventsWeek.length})</div>
        <div class="dash-today-block__list">
          ${eventsWeek.length === 0
            ? `<div class="dash-today-empty">Aucun événement cette semaine</div>`
            : eventsWeek.slice(0, 6).map(e => {
                // Label jour court : "Lun 12", "Aujourd'hui", "Demain"
                let dayLabel = "";
                if (e.date === todayStr) {
                  dayLabel = "Auj.";
                } else {
                  const ed = new Date(e.date + "T00:00:00");
                  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
                  if (e.date === tomorrow.toISOString().slice(0, 10)) {
                    dayLabel = "Demain";
                  } else {
                    const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
                    dayLabel = `${days[ed.getDay()]} ${ed.getDate()}`;
                  }
                }
                const isToday = e.date === todayStr;
                return `<div class="dash-today-item ${isToday ? "is-today" : ""}" onclick="navTo('evenements')" style="cursor:pointer">
                  <span class="dash-today-item__day">${dayLabel}</span>
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${esc(e.name || "Sans nom")}</span>
                  ${e.time ? `<span class="dash-today-item__time">${e.time}</span>` : ""}
                </div>`;
              }).join("")
              + (eventsWeek.length > 6 ? `<div class="dash-today-empty">+ ${eventsWeek.length - 6} autres…</div>` : "")
          }
        </div>
      </div>

      <!-- Tâches dues aujourd'hui -->
      <div class="dash-today-block">
        <div class="dash-today-block__title">${icon("clipboard", 12)} Tâches dues (${tasksToday.length})</div>
        <div class="dash-today-block__list">
          ${tasksToday.length === 0
            ? `<div class="dash-today-empty">Tout est à jour ✨</div>`
            : tasksToday.map(tk => `<div class="dash-today-item" onclick="navTo('taches')" style="cursor:pointer">
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(tk.title || "Sans titre")}</span>
                ${tk.priority === "haute" ? `<span class="dash-today-item__time" style="color:var(--status-red, #d9534f)">URGENT</span>` : ""}
              </div>`).join("")
          }
        </div>
      </div>
    </div>
  </div>`;
}

// Helper : début de la semaine ISO (lundi) — duplique getWeekStart de pages-hr.js
// pour éviter une dépendance sur le scheduleWeekOffset (ici on veut toujours
// la semaine courante).
function getWeekStartForDashboard(d) {
  const dd = new Date(d);
  const day = dd.getDay();
  const diff = dd.getDate() - day + (day === 0 ? -6 : 1);
  dd.setDate(diff); dd.setHours(0, 0, 0, 0);
  return dd;
}

function renderDashTaxCard(q, taxes, daysToDeadline) {
  const totalToRemit = taxes.tpsToRemit + taxes.tvqToRemit;
  let urgencyClass = "dash-card--ok";
  let urgencyIcon = "shield-check";
  let dueLabel = "";
  if (daysToDeadline < 0) {
    urgencyClass = "dash-card--danger";
    urgencyIcon = "alert";
    dueLabel = `<strong class="text-danger">${t("dash_overdue")} (${Math.abs(daysToDeadline)} ${t("rec_minutes") === "min" ? "j" : "d"})</strong>`;
  } else if (daysToDeadline <= 15) {
    urgencyClass = "dash-card--warn";
    urgencyIcon = "alert";
    dueLabel = `<strong class="text-warning">${t("dash_due_in", { n: daysToDeadline })}</strong>`;
  } else {
    dueLabel = `<span class="text-muted">${t("dash_due_in", { n: daysToDeadline })}</span>`;
  }

  return `<div class="dash-card ${urgencyClass}">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon(urgencyIcon, 16)} ${t("tax_card_title")}</h3>
      <button class="btn-icon-only" onclick="navTo('depenses')" aria-label="${t("dash_view_more")}" title="${t("dash_view_more")}">${icon("arrow-right", 14)}</button>
    </div>
    <div class="dash-tax-info">
      <div class="dash-tax-period">
        ${t("tax_quarter")} ${q.quarter} · ${q.year}<br/>
        <small class="text-muted">${t("tax_due_date")} ${q.dueDate}</small><br/>
        ${dueLabel}
      </div>
      <div class="dash-tax-amount">
        <div class="dash-tax-label">${t("tax_to_remit")}</div>
        <div class="dash-tax-value" style="color:${totalToRemit > 0 ? 'var(--accent)' : 'var(--status-green)'}">${fmtMoney(Math.abs(totalToRemit))}</div>
        ${totalToRemit < 0 ? `<small class="text-success">${t("tax_credit_to_recover")}</small>` : ""}
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

function renderDashUpcomingEvents(upcoming) {
  if (!upcoming || upcoming.length === 0) {
    return `<div class="dash-card dash-card--ok">
      <div class="dash-card__head">
        <h3 class="dash-card__title">${icon("calendar", 16)} Prochains événements</h3>
        <button class="btn-icon-only" onclick="navTo('evenements')" aria-label="Voir le calendrier" title="Voir le calendrier">${icon("arrow-right", 14)}</button>
      </div>
      <div class="dash-empty">Aucun événement à venir dans les 60 prochains jours.</div>
    </div>`;
  }
  return `<div class="dash-card">
    <div class="dash-card__head">
      <h3 class="dash-card__title">${icon("calendar", 16)} Prochains événements</h3>
      <button class="btn-icon-only" onclick="navTo('evenements')" aria-label="Voir le calendrier" title="Voir le calendrier">${icon("arrow-right", 14)}</button>
    </div>
    <ul class="dash-list">
      ${upcoming.map(e => {
        const typ = e.type || "interne";
        const status = e.status || "confirme";
        const rel = typeof formatRelativeDate === "function" ? formatRelativeDate(e.date) : e.date;
        const typLabel = typeof tEventTypeShort === "function" ? tEventTypeShort(typ) : typ;
        return `<li class="dash-list__item">
          <span class="dash-list__name">
            <span class="ev-type-pill ev-type-pill--${typ}" style="margin-right:6px;font-size:10px">${typLabel}</span>
            ${esc(e.name || "?")}
            <br/><small style="color:var(--text3);font-size:10px">${rel}${e.time ? " · " + esc(e.time) : ""}${e.capacity ? " · " + esc(String(e.capacity)) + " pers." : ""}${status === "attente" ? " · <em>en attente</em>" : ""}</small>
          </span>
          <span class="dash-list__value" style="color:var(--text3);font-size:11px">${e.date || ""}</span>
        </li>`;
      }).join("")}
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
          <th class="text-right">${t("tax_collected")}</th>
          <th class="text-right">${t("tax_paid")}</th>
          <th class="text-right">${t("tax_to_remit")}</th>
        </tr></thead>
        <tbody>
          <tr>
            <td><strong>TPS (5%)</strong></td>
            <td class="text-right text-success">${fmtMoney(taxes.tpsCollected)}</td>
            <td class="text-right text-danger">${fmtMoney(taxes.tpsPaid)}</td>
            <td style="text-align:right;font-family:var(--font-heading);font-weight:700;font-style:italic;color:var(--accent)">${fmtMoney(taxes.tpsToRemit)}</td>
          </tr>
          <tr>
            <td><strong>TVQ (9.975%)</strong></td>
            <td class="text-right text-success">${fmtMoney(taxes.tvqCollected)}</td>
            <td class="text-right text-danger">${fmtMoney(taxes.tvqPaid)}</td>
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
