// ═══════════════════════════════════════════════════════════════
// RH — Employés, Horaires, Couverture, Imports paie
// (Extrait de l'ancien pages-admin.js)
// ═══════════════════════════════════════════════════════════════

// ── Page Employés & Horaires ──────────────────────────
// Feuille de calcul : entrée/sortie par jour + taux horaire → coûts + ventes
// prévues (salaires / ratio) + ventes réelles + écart

// ═ Helpers ══════════════════════════════════════════════
function getWeekStart(offsetWeeks = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetWeeks * 7);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  d.setDate(diff); d.setHours(0, 0, 0, 0);
  return d;
}

// Numéro de semaine ISO 8601 (lundi = début, semaine 1 = première semaine avec un jeudi)
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // dimanche = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // ramène au jeudi de cette semaine ISO
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Heures travaillées d'un quart { start: "HH:MM", end: "HH:MM" }
// Retourne un nombre décimal (10.5 = 10h30). Gère les quarts qui chevauchent minuit.
function hoursFromShift(s) {
  if (!s || !s.start || !s.end) return 0;
  const [sh, sm] = String(s.start).split(":").map(Number);
  const [eh, em] = String(s.end).split(":").map(Number);
  if (isNaN(sh) || isNaN(eh)) return 0;
  let diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
  if (diff < 0) diff += 24 * 60; // quart qui passe minuit
  return diff / 60;
}

function fmtHours(h) {
  if (!h) return "";
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}

function dayKey(date) { return date.toISOString().slice(0, 10); }

// Options du dropdown heures : 00:00 → 23:30 par tranches de 30 min (48 options)
const SCHEDULE_TIME_OPTIONS = (() => {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
})();
function buildTimeOptions(selectedValue) {
  const sel = selectedValue || "";
  let html = `<option value="" ${sel === "" ? "selected" : ""}>—</option>`;
  for (const v of SCHEDULE_TIME_OPTIONS) {
    html += `<option value="${v}" ${v === sel ? "selected" : ""}>${v}</option>`;
  }
  return html;
}

// Navigation semaine
function changeScheduleWeek(delta) {
  scheduleWeekOffset += delta;
  renderPage();
}
function resetScheduleWeek() {
  scheduleWeekOffset = 0;
  renderPage();
}

// ═ Rendu principal ══════════════════════════════════════
function renderEmployes() {
  const weekStart = getWeekStart(scheduleWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]); // jeudi = référence semaine ISO
  const weekLabel = `${weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  const ratio = Number(scheduleSettings.salesRatio) || 0.32;
  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0, 1, 2, 3, 4, 5, 6];
  // Indices de jours ouverts (0=Lun, 6=Dim)
  const visibleIdx = [0, 1, 2, 3, 4, 5, 6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);
  const nCols = visibleIdx.length;

  // Calculs par employé sur les jours ouverts uniquement
  // Les employés "salariés" ont un coût fixe hebdo réparti à parts égales sur les jours ouverts.
  // Les heures réelles (shifts) sont toujours calculées pour traçabilité.
  const dayTotalsHours = new Array(nCols).fill(0);
  const dayTotalsCost = new Array(nCols).fill(0);
  const nbOpenDays = nCols || 1;
  const empRows = employees.map(emp => {
    const shifts = emp.shifts || {};
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const weeklyFixedPay = isSal ? fixedHours * rate : null;
    const dailyFixedCost = isSal ? weeklyFixedPay / nbOpenDays : null;

    const daily = weekDays.map((d, col) => {
      const s = shifts[dayKey(d)];
      const hours = hoursFromShift(s);
      const cost = isSal ? dailyFixedCost : hours * rate;
      dayTotalsHours[col] += hours;
      dayTotalsCost[col] += cost;
      return { shift: s, hours, cost };
    });
    const totalHours = daily.reduce((sum, d) => sum + d.hours, 0);
    const totalPay = isSal ? weeklyFixedPay : totalHours * rate;
    return { emp, rate, isSal, fixedHours, daily, totalHours, totalPay };
  });

  const weekTotalHours = dayTotalsHours.reduce((a, b) => a + b, 0);
  const weekTotalCost = dayTotalsCost.reduce((a, b) => a + b, 0);

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">Employés & Horaires</h2>
      <button class="btn btn-primary" onclick="openEmployeeModal()">${icon("plus", 16)} ${t("emp_add")}</button>
    </div>

    ${employees.length === 0
      ? `<div class="empty"><div class="empty-state-icon">${icon("users", 36)}</div>Aucun employé enregistré. Ajoutez-en un pour commencer.</div>`
      : `
      <!-- ══ Sélecteur de semaine + ratio + boutons ══ -->
      <div class="schedule-header">
        <div class="schedule-nav">
          <button class="btn-icon-only" onclick="changeScheduleWeek(-1)" aria-label="Semaine précédente" title="Semaine précédente">${icon("chevron-left", 16)}</button>
          <div class="schedule-week-label">
            <div class="schedule-week-num">Semaine ${weekNum}</div>
            <div class="schedule-week-dates">${weekLabel}</div>
            ${scheduleWeekOffset !== 0 ? `<button class="schedule-today-btn" onclick="resetScheduleWeek()">Aujourd'hui</button>` : `<div class="schedule-today-tag">Cette semaine</div>`}
          </div>
          <button class="btn-icon-only" onclick="changeScheduleWeek(1)" aria-label="Semaine suivante" title="Semaine suivante">${icon("chevron-right", 16)}</button>
        </div>
        <div class="schedule-actions">
          <!-- Actions fréquentes (visibles pour tous les admins) -->
          <button class="btn-secondary btn-sm" onclick="openOpenDaysModal()" title="Choisir les jours d'ouverture">${icon("calendar", 14)} Jours ouverts</button>
          <button class="btn-secondary btn-sm" onclick="duplicateScheduleToNextWeek()" title="Copier cet horaire vers la semaine suivante">${icon("copy", 14)} Copier → S${weekNum + 1}</button>
          <div class="schedule-ratio-pill" title="Ratio salaires / ventes : les Ventes prévues sont recalculées instantanément">
            <span class="schedule-ratio-pill__label">${icon("trending-up", 14)} Ratio</span>
            <input id="sched-ratio" type="number" min="1" max="100" step="0.5" value="${(ratio * 100).toFixed(1)}" onchange="updateSalesRatio(this.value)" oninput="updateSalesRatioLive(this.value)" aria-label="Ratio salaires sur ventes"/>
            <span class="schedule-ratio-pill__unit">%</span>
          </div>
          ${userRole === "global_admin" ? `
            <!-- Actions avancées (rares) regroupées dans un menu ⋯ -->
            <div class="menu-wrap">
              <button class="btn-secondary btn-sm" onclick="toggleDrop('sched-adv')" aria-label="Actions avancées" title="Actions avancées">${icon("more-horizontal", 14)} Plus</button>
              <div class="dropdown" id="drop-sched-adv">
                <button onclick="applyPayrollConfigs();closeAllDrops()">${icon("dollar-sign", 14)} Appliquer salaires fixes</button>
                <button onclick="seedScheduleFromTemplate();closeAllDrops()">${icon("download", 14)} Importer horaire type</button>
              </div>
            </div>
          ` : ""}
        </div>
      </div>

      <!-- ══ Grille horaire ══ -->
      <div class="schedule-wrap card" style="padding:0;overflow-x:auto">
        <table class="schedule-table">
          <thead>
            <tr>
              <th class="schedule-th--emp">Employé</th>
              ${weekDays.map((d, k) => `<th class="schedule-th--day" colspan="2">
                <div class="schedule-day-name">${DAYS_FR[visibleIdx[k]]}</div>
                <div class="schedule-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              </th>`).join("")}
              <th class="schedule-th--summary">Heures</th>
              <th class="schedule-th--summary">Taux</th>
              <th class="schedule-th--summary">Total</th>
            </tr>
            <tr class="schedule-subheader">
              <th></th>
              ${weekDays.map(() => `<th class="schedule-th--entry">Entr</th><th class="schedule-th--exit">Sort</th>`).join("")}
              <th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            ${empRows.map((row, rowIdx) => {
              // Couleur unique par employé — palette de 8 couleurs cyclique via sortOrder (ou index)
              const EMP_COLORS = ["#4a90e2","#F7B32C","#e74c3c","#7dbf66","#8b5cf6","#f97316","#14b8a6","#ec4899"];
              const colorIdx = ((row.emp.sortOrder ?? rowIdx) % EMP_COLORS.length + EMP_COLORS.length) % EMP_COLORS.length;
              const empColor = EMP_COLORS[colorIdx];
              // Section : fallback sur "service" si pas encore définie (compat employés existants)
              const empSection = row.emp.section || "service";
              const sectionIcon = empSection === "cuisine" ? icon("utensils", 10) : empSection === "service" ? icon("users", 10) : "";
              const sectionLabel = empSection === "cuisine" ? "Cuisine" : empSection === "service" ? "Service" : "Autre";
              return `<tr class="schedule-emp-row" data-emp-id="${row.emp.id}" style="--emp-color:${empColor}"
                ondragover="empRowDragOver(event,'${row.emp.id}')"
                ondragleave="empRowDragLeave(event)"
                ondrop="empRowDrop(event,'${row.emp.id}')"
                ondragend="empRowDragEnd(event)">
              <td class="schedule-td--emp">
                <div class="schedule-emp-cell">
                  <span class="schedule-emp-grip" draggable="true" ondragstart="empRowDragStart(event,'${row.emp.id}')" aria-label="Glisser pour réordonner" title="Glisser pour réordonner">${icon("grip-vertical", 14)}</span>
                  <div class="schedule-emp-info">
                    <div class="schedule-emp-name">${esc(row.emp.name || "")}</div>
                    <div class="schedule-emp-meta">
                      <span class="schedule-emp-section schedule-emp-section--${empSection}">${sectionIcon}${sectionLabel}</span>
                      ${row.emp.role ? `<span class="schedule-emp-role">${esc(row.emp.role)}</span>` : ""}
                    </div>
                  </div>
                </div>
              </td>
              ${row.daily.map((d, k) => {
                const s = d.shift;
                const filled = s && s.start && s.end;
                const startVal = s?.start || "";
                const endVal = s?.end || "";
                const dk = dayKey(weekDays[k]);
                const empName = esc(row.emp.name || "");
                const dayName = DAYS_FR[visibleIdx[k]];
                return `<td class="schedule-td--cell ${filled ? "is-filled" : ""}">
                  <select class="schedule-time" onchange="updateShift('${row.emp.id}','${dk}','start',this.value)" aria-label="${empName}, entrée ${dayName}">${buildTimeOptions(startVal)}</select>
                </td>
                <td class="schedule-td--cell ${filled ? "is-filled" : ""}">
                  <select class="schedule-time" onchange="updateShift('${row.emp.id}','${dk}','end',this.value)" aria-label="${empName}, sortie ${dayName}">${buildTimeOptions(endVal)}</select>
                </td>`;
              }).join("")}
              <td class="schedule-td--summary">
                ${row.totalHours ? fmtHours(row.totalHours) : ""}
                ${row.isSal ? `<div class="schedule-fixed-hint" title="Heures fixes payées">${fmtHours(row.fixedHours)}h fixes</div>` : ""}
              </td>
              <td class="schedule-td--summary">
                ${row.rate ? row.rate : "—"}
                ${row.isSal ? `<span class="schedule-badge-fixed" title="Salaire fixe">FIXE</span>` : ""}
              </td>
              <td class="schedule-td--summary schedule-td--total">${row.totalPay ? fmtMoney(row.totalPay) : ""}</td>
            </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <!-- Ligne Heures / jour -->
            <tr class="schedule-tfoot-row">
              <td class="schedule-tfoot-label">Heures / jour</td>
              ${dayTotalsHours.map(h => `<td colspan="2" class="schedule-tfoot-val">${h ? fmtHours(h) : ""}</td>`).join("")}
              <td class="schedule-tfoot-val schedule-td--total" colspan="3">${fmtHours(weekTotalHours)} h</td>
            </tr>
            <!-- Ligne Mt / jour -->
            <tr class="schedule-tfoot-row">
              <td class="schedule-tfoot-label">Mt / jour</td>
              ${dayTotalsCost.map(c => `<td colspan="2" class="schedule-tfoot-val">${c ? fmtMoney(c) : ""}</td>`).join("")}
              <td class="schedule-tfoot-val schedule-td--total" colspan="3">${fmtMoney(weekTotalCost)}</td>
            </tr>
            <!-- Ligne Ventes prévues -->
            <tr class="schedule-tfoot-row schedule-tfoot-row--predicted">
              <td class="schedule-tfoot-label">Ventes prévues</td>
              ${dayTotalsCost.map(c => {
                const predicted = ratio > 0 ? c / ratio : 0;
                return `<td colspan="2" class="schedule-tfoot-val">${predicted ? fmtMoney(predicted) : ""}</td>`;
              }).join("")}
              <td class="schedule-tfoot-val schedule-td--total" colspan="3">${fmtMoney(ratio > 0 ? weekTotalCost / ratio : 0)}</td>
            </tr>
            <!-- Ligne Ventes réelles (input) -->
            <tr class="schedule-tfoot-row schedule-tfoot-row--actual">
              <td class="schedule-tfoot-label">Ventes réelles</td>
              ${weekDays.map((d, k) => {
                const dk = dayKey(d);
                const val = Number(scheduleSettings.actualSales?.[dk] || 0);
                const dayName = DAYS_FR[visibleIdx[k]];
                const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
                return `<td colspan="2" class="schedule-tfoot-val">
                  <input type="number" step="0.01" min="0" class="schedule-sales-input" placeholder="—" value="${val || ""}" onchange="updateActualSales('${dk}',this.value)" aria-label="Ventes réelles ${dayName} ${dateLabel}"/>
                </td>`;
              }).join("")}
              <td class="schedule-tfoot-val schedule-td--total" colspan="3">${(() => {
                const total = weekDays.reduce((sum, d) => sum + (Number(scheduleSettings.actualSales?.[dayKey(d)] || 0)), 0);
                return total ? fmtMoney(total) : "";
              })()}</td>
            </tr>
            <!-- Ligne Écart (mise en valeur — KPI critique) -->
            <tr class="schedule-tfoot-row schedule-tfoot-row--gap">
              <td class="schedule-tfoot-label"><span class="gap-label-inner">${icon("trending-up", 14)} Écart</span></td>
              ${weekDays.map((d, k) => {
                const dk = dayKey(d);
                const actual = Number(scheduleSettings.actualSales?.[dk] || 0);
                const predicted = ratio > 0 ? dayTotalsCost[k] / ratio : 0;
                const gap = actual - predicted;
                const cls = gap > 0 ? "is-positive" : gap < 0 ? "is-negative" : "";
                const arrow = gap > 0 ? "▲" : gap < 0 ? "▼" : "";
                const content = (actual || predicted) ? `<span class="gap-arrow">${arrow}</span>${fmtMoney(gap)}` : "";
                return `<td colspan="2" class="schedule-tfoot-val ${cls}">${content}</td>`;
              }).join("")}
              <td class="schedule-tfoot-val schedule-td--total" colspan="3">${(() => {
                const totalActual = weekDays.reduce((sum, d) => sum + (Number(scheduleSettings.actualSales?.[dayKey(d)] || 0)), 0);
                const totalPredicted = ratio > 0 ? weekTotalCost / ratio : 0;
                const gap = totalActual - totalPredicted;
                const cls = gap > 0 ? "is-positive" : gap < 0 ? "is-negative" : "";
                const arrow = gap > 0 ? "▲" : gap < 0 ? "▼" : "";
                const content = (totalActual || totalPredicted) ? `<span class="gap-arrow">${arrow}</span>${fmtMoney(gap)}` : "";
                return `<span class="${cls}">${content}</span>`;
              })()}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- ══ Graphique de couverture horaire ══ -->
      <div class="card coverage-card">
        <div class="coverage-header">
          <div>
            <h3 class="coverage-title">Couverture — employés sur le plancher</h3>
            <div class="coverage-subtitle">Nombre d'employés présents par heure, pour chaque jour de la semaine</div>
          </div>
          <div class="coverage-filter" role="tablist" aria-label="Filtrer par section">
            <button class="coverage-tab ${scheduleCoverageSection === "all" ? "is-active" : ""}" onclick="setCoverageSection('all')" role="tab" aria-selected="${scheduleCoverageSection === "all"}">Tous</button>
            <button class="coverage-tab ${scheduleCoverageSection === "service" ? "is-active" : ""}" onclick="setCoverageSection('service')" role="tab" aria-selected="${scheduleCoverageSection === "service"}">${icon("users", 12)} Service</button>
            <button class="coverage-tab ${scheduleCoverageSection === "cuisine" ? "is-active" : ""}" onclick="setCoverageSection('cuisine')" role="tab" aria-selected="${scheduleCoverageSection === "cuisine"}">${icon("utensils", 12)} Cuisine</button>
            <button class="coverage-tab ${scheduleCoverageSection === "other" ? "is-active" : ""}" onclick="setCoverageSection('other')" role="tab" aria-selected="${scheduleCoverageSection === "other"}">Autre</button>
          </div>
        </div>
        <div class="coverage-canvas-wrap">
          <canvas id="coverage-chart" height="280"></canvas>
        </div>
      </div>

      <!-- ══ Cartes équipe ══ -->
      <h3 class="section-title">Équipe</h3>
      <div class="card-grid">
        ${employees.map(emp => `<div class="card team-card">
          <div class="team-card__head">
            <div class="team-card__info">
              <div class="team-card__name">${icon("user", 14)} ${esc(emp.name || "")}</div>
              ${emp.role ? `<div class="team-card__role">${esc(emp.role)}</div>` : ""}
              ${emp.hourlyRate ? `<div class="team-card__rate">${icon("dollar-sign", 12)} ${emp.hourlyRate} $/h${emp.isSalaried ? ` · <span class="team-card__fixed">FIXE ${emp.fixedWeeklyHours}h</span>` : ""}</div>` : ""}
              ${emp.phone ? `<div class="team-card__contact">${icon("phone", 12)} ${esc(emp.phone)}</div>` : ""}
              ${emp.email ? `<div class="team-card__contact">${icon("mail", 12)} ${esc(emp.email)}</div>` : ""}
              ${emp.pin ? `<div class="team-card__pin">PIN : ${emp.pin}</div>` : ""}
            </div>
            <div class="menu-wrap"><button class="dots-btn" onclick="toggleDrop('emp${emp.id}')">${icon("more-vertical", 16)}</button>
            <div class="dropdown" id="drop-emp${emp.id}">
              <button onclick="openEmployeeModal('${emp.id}');closeAllDrops()">${icon("pencil", 14)} Modifier</button>
              <button onclick="duplicateItem('employees','${emp.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
              <div class="sep"></div>
              <button class="text-danger" onclick="askDelete('employees','${emp.id}','${esc(emp.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
            </div></div>
          </div>
        </div>`).join("")}
      </div>`}
  </div>`;
}

// ═ Actions sur la grille ═══════════════════════════════

// Met à jour un champ (start ou end) d'un quart.
// Si les deux sont vides → supprime l'entrée.
async function updateShift(empId, dk, field, value) {
  const emp = employees.find(e => e.id === empId); if (!emp) return;
  const shifts = { ...(emp.shifts || {}) };
  const current = shifts[dk] || {};
  const next = { ...current, [field]: value || "" };
  if (!next.start && !next.end) {
    delete shifts[dk];
  } else {
    shifts[dk] = next;
  }
  await db.collection("employees").doc(empId).update({ shifts });
}

async function removeShift(empId, dk) {
  const emp = employees.find(e => e.id === empId); if (!emp) return;
  const shifts = { ...(emp.shifts || {}) };
  delete shifts[dk];
  await db.collection("employees").doc(empId).update({ shifts });
}

// Met à jour le ratio salaires/ventes (en pourcentage, ex: 32)
// Optimistic update : on applique d'abord en local (instantané), puis on persiste.
async function updateSalesRatio(percentStr) {
  const pct = Number(percentStr);
  if (isNaN(pct) || pct <= 0 || pct > 100) return;
  const newRatio = pct / 100;
  // 1. Update locale immédiate → re-render instantané des ventes prévues + écart
  scheduleSettings = { ...scheduleSettings, salesRatio: newRatio };
  renderPage();
  // 2. Persistance Firestore en arrière-plan (le listener déclenchera un 2e render confirmatif,
  // idempotent car la valeur locale est déjà à jour)
  try {
    await db.collection("settings").doc("schedule").set({ salesRatio: newRatio }, { merge: true });
  } catch (err) {
    console.error("updateSalesRatio:", err);
    toast("Erreur sauvegarde ratio : " + (err.message || err), "error");
  }
}

// Rafraîchissement live pendant la saisie (oninput) — sans persister.
// Permet de voir instantanément l'impact sur les calculs sans attendre le blur/change.
// On ne re-render pas pour éviter de perdre le focus à chaque frappe : on met juste à jour
// les cellules de ventes prévues et écart en place.
function updateSalesRatioLive(percentStr) {
  const pct = Number(percentStr);
  if (isNaN(pct) || pct <= 0 || pct > 100) return;
  const newRatio = pct / 100;
  scheduleSettings.salesRatio = newRatio;
  // Mise à jour en place des cellules concernées (sans render complet pour garder le focus)
  const rows = document.querySelectorAll(".schedule-tfoot-row--predicted .schedule-tfoot-val, .schedule-tfoot-row--gap .schedule-tfoot-val");
  // On se contente ici d'un renderPage léger car il est rare que l'utilisateur tape rapidement.
  // renderPage re-crée l'input — on garde le focus manuellement :
  const activeId = document.activeElement?.id;
  renderPage();
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (_) {} }
  }
}

// Met à jour les ventes réelles pour un jour donné (clé YYYY-MM-DD)
async function updateActualSales(dk, value) {
  const v = Number(value);
  const actualSales = { ...(scheduleSettings.actualSales || {}) };
  if (!v || isNaN(v) || v <= 0) {
    delete actualSales[dk];
  } else {
    actualSales[dk] = v;
  }
  await db.collection("settings").doc("schedule").set({
    actualSales
  }, { merge: true });
}

// ═ Jours d'ouverture (réglage global) ═══════════════════
function openOpenDaysModal() {
  const current = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  showModal(`<div class="modal" style="max-width:400px">
    <div class="modal-header">
      <h3>${icon("calendar", 18)} Jours d'ouverture</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Cochez les jours où le restaurant est ouvert. Les jours décochés seront cachés de la grille horaire.
    </p>
    <div class="open-days-grid">
      ${DAYS_FR.map((d, i) => {
        const checked = current.includes(i) ? "checked" : "";
        const dayLabel = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][i];
        return `<label class="open-day-item">
          <input type="checkbox" data-day="${i}" ${checked} onchange="toggleOpenDay(${i}, this.checked)"/>
          <span class="open-day-label">${dayLabel}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">${t("close")}</button>
    </div>
  </div>`);
}

async function toggleOpenDay(dayIndex, checked) {
  const current = Array.isArray(scheduleSettings.openDays) ? [...scheduleSettings.openDays] : [0,1,2,3,4,5,6];
  let next;
  if (checked && !current.includes(dayIndex)) {
    next = [...current, dayIndex].sort((a, b) => a - b);
  } else if (!checked && current.includes(dayIndex)) {
    next = current.filter(d => d !== dayIndex);
  } else {
    return;
  }
  // Garde-fou : ne pas tout décocher
  if (next.length === 0) {
    toast("Au moins un jour doit rester ouvert.", "warning");
    const cb = document.querySelector(`.open-days-grid input[data-day="${dayIndex}"]`);
    if (cb) cb.checked = true;
    return;
  }
  await db.collection("settings").doc("schedule").set({ openDays: next }, { merge: true });
}

// ═ Duplication vers la semaine suivante ═════════════════
async function duplicateScheduleToNextWeek() {
  const weekStart = getWeekStart(scheduleWeekOffset);
  const curDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return dayKey(d);
  });
  const nextDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7 + i); return dayKey(d);
  });

  // Vérifier si la source a au moins un shift
  const hasSource = employees.some(emp => {
    const shifts = emp.shifts || {};
    return curDates.some(dk => shifts[dk] && shifts[dk].start);
  });
  if (!hasSource) {
    toast("La semaine actuelle est vide. Remplissez au moins un horaire avant de copier.", "warning");
    return;
  }

  // Vérifier si la cible contient déjà des données
  const nextHasData = employees.some(emp => {
    const shifts = emp.shifts || {};
    return nextDates.some(dk => shifts[dk] && shifts[dk].start);
  });

  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));
  const nextWeekNum = weekNum + 1;

  const doCopy = async () => {
    const batch = db.batch();
    for (const emp of employees) {
      const shifts = { ...(emp.shifts || {}) };
      let changed = false;
      curDates.forEach((curDk, i) => {
        const src = shifts[curDk];
        const tgtDk = nextDates[i];
        if (src && src.start && src.end) {
          shifts[tgtDk] = { start: src.start, end: src.end };
          changed = true;
        } else {
          // source vide → on efface aussi la cible pour que les deux semaines soient identiques
          if (shifts[tgtDk]) { delete shifts[tgtDk]; changed = true; }
        }
      });
      if (changed) batch.update(db.collection("employees").doc(emp.id), { shifts });
    }
    await batch.commit();
    await addLog("—", "Horaire copié", `Semaine ${weekNum} → Semaine ${nextWeekNum}`);
    // Naviguer vers la semaine suivante pour voir le résultat
    scheduleWeekOffset += 1;
    renderPage();
  };

  if (nextHasData) {
    openConfirm(
      "Écraser la semaine suivante ?",
      `La semaine ${nextWeekNum} contient déjà des horaires. Les copier va les <strong>remplacer</strong>. Continuer ?`,
      doCopy,
      true
    );
  } else {
    await doCopy();
  }
}

// ═ Réordonner les employés (drag & drop) ═══════════════
let _empDragId = null;

function empRowDragStart(e, id) {
  _empDragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  }
  const tr = document.querySelector(`tr[data-emp-id="${id}"]`);
  setTimeout(() => tr && tr.classList.add("schedule-row--dragging"), 0);
}

function empRowDragOver(e, id) {
  if (_empDragId === null || id === _empDragId) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const tr = document.querySelector(`tr[data-emp-id="${id}"]`);
  if (!tr) return;
  tr.classList.add("schedule-row--drag-over");
  const rect = tr.getBoundingClientRect();
  const before = (e.clientY - rect.top) < rect.height / 2;
  tr.classList.toggle("schedule-row--drop-before", before);
  tr.classList.toggle("schedule-row--drop-after", !before);
}

function empRowDragLeave(e) {
  const tr = e.currentTarget;
  if (!tr) return;
  const related = e.relatedTarget;
  if (related && tr.contains(related)) return;
  tr.classList.remove("schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after");
}

function empRowDragEnd() {
  document.querySelectorAll("tr[data-emp-id]").forEach(tr =>
    tr.classList.remove("schedule-row--dragging", "schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after")
  );
  _empDragId = null;
}

async function empRowDrop(e, targetId) {
  e.preventDefault();
  const srcId = _empDragId;
  const tr = document.querySelector(`tr[data-emp-id="${targetId}"]`);
  const dropBefore = tr && tr.classList.contains("schedule-row--drop-before");
  empRowDragEnd();
  if (!srcId || srcId === targetId) return;

  // Recomposer l'ordre des IDs
  const ids = employees.map(emp => emp.id);
  const srcIdx = ids.indexOf(srcId);
  const tgtIdx = ids.indexOf(targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  ids.splice(srcIdx, 1);
  let insertAt = tgtIdx;
  if (srcIdx < tgtIdx) insertAt -= 1;
  if (!dropBefore) insertAt += 1;
  insertAt = Math.max(0, Math.min(insertAt, ids.length));
  ids.splice(insertAt, 0, srcId);

  // Batch update Firestore
  const batch = db.batch();
  ids.forEach((id, i) => batch.update(db.collection("employees").doc(id), { sortOrder: i }));
  await batch.commit();
}

function openEmployeeModal(id) {
  const emp = id ? employees.find(x => x.id === id) : null;
  showModal(`<div class="modal">
    <div class="modal-header"><h3>${emp ? t("edit") : t("add")} ${t("emp_add").toLowerCase()}</h3><button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button></div>
    <label>${t("emp_field_name")}<input id="e-name" value="${esc(emp?.name || "")}"/></label>
    <label>${t("emp_field_role")}
      <select id="e-role-type" onchange="document.getElementById('e-role').value = this.options[this.selectedIndex].dataset.label || this.value">
        <option value="employee" ${(emp?.role || "").toLowerCase().includes("admin") ? "" : "selected"} data-label="${esc(emp?.role || t("role_employee"))}">${t("role_employee")}</option>
        <option value="admin" ${(emp?.role || "").toLowerCase().includes("admin") ? "selected" : ""} data-label="${(emp?.role || "").toLowerCase().includes("admin") ? esc(emp.role) : "Admin"}">${t("role_admin")}</option>
      </select>
    </label>
    <label>${t("emp_field_role")} <span style="font-weight:400;color:var(--text3);font-size:11px">(détail)</span>
      <input id="e-role" value="${esc(emp?.role || "")}" placeholder="ex: Serveur, Cuisinier, Manager..."/>
    </label>
    <label>Section
      <select id="e-section">
        <option value="service"  ${(emp?.section || "service") === "service"  ? "selected" : ""}>Service à la clientèle</option>
        <option value="cuisine"  ${emp?.section === "cuisine"  ? "selected" : ""}>Cuisine</option>
        <option value="other"    ${emp?.section === "other"    ? "selected" : ""}>Autre</option>
      </select>
      <span class="field-hint">${icon("info", 11)} Utilisée pour le graphique de couverture horaire.</span>
    </label>
    <div class="form-row">
      <label>${t("emp_field_phone")}<input id="e-phone" value="${esc(emp?.phone || "")}"/></label>
      <label>${t("emp_field_email")}<input id="e-email" value="${esc(emp?.email || "")}"/></label>
    </div>
    <label>Taux horaire ($/h)
      <input id="e-hourly-rate" type="number" min="0" step="0.25" value="${emp?.hourlyRate || ""}" placeholder="ex: 17.50"/>
      <span class="field-hint">${icon("info", 11)} Utilisé pour calculer les coûts dans l'horaire de la semaine.</span>
    </label>
    <label class="emp-salaried-toggle">
      <input type="checkbox" id="e-is-salaried" ${emp?.isSalaried ? "checked" : ""} onchange="document.getElementById('e-salaried-fields').style.display = this.checked ? 'block' : 'none'"/>
      <span>Employé salarié (montant fixe hebdomadaire)</span>
    </label>
    <div id="e-salaried-fields" style="display:${emp?.isSalaried ? "block" : "none"}">
      <label>Heures hebdo fixes
        <input id="e-fixed-hours" type="number" min="0" step="0.5" value="${emp?.fixedWeeklyHours || ""}" placeholder="ex: 35"/>
        <span class="field-hint">${icon("info", 11)} Salaire hebdo = heures fixes × taux horaire. Réparti automatiquement sur les jours d'ouverture. Les shifts saisis ne modifient plus le coût (les heures réelles restent affichées pour traçabilité).</span>
      </label>
    </div>
    <label>${t("emp_field_pin")} (4 chiffres)
      <input id="e-pin" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" value="${esc(emp?.pin || "")}" placeholder="${t("optional")}"/>
      <span class="field-hint">${icon("info", 11)} L'employé pourra se connecter avec ce PIN. Doit être unique. Si rôle "Admin", aura accès à tout.</span>
    </label>
    <label>${t("notes_field")}<textarea id="e-notes" style="height:60px">${esc(emp?.notes || "")}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveEmployee('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

async function saveEmployee(id) {
  const name = document.getElementById("e-name").value.trim();
  if (!name) return toast(t("err_enter_name"), "error");
  const pin = document.getElementById("e-pin").value.trim();
  // Validation PIN : 4 chiffres si fourni
  if (pin && !/^\d{4}$/.test(pin)) {
    return toast(getUILang() === "es" ? "El PIN debe ser de 4 dígitos." : "Le PIN doit être 4 chiffres.", "error");
  }
  // Vérifier unicité du PIN (sauf pour cet employé)
  if (pin) {
    const conflict = employees.find(e => e.id !== id && e.pin && String(e.pin).trim() === pin);
    if (conflict) {
      return toast(getUILang() === "es"
        ? `Este PIN ya está usado por ${conflict.name}.`
        : `Ce PIN est déjà utilisé par ${conflict.name}.`, "error");
    }
  }
  const data = {
    name,
    role: document.getElementById("e-role").value,
    section: document.getElementById("e-section").value || "service",
    phone: document.getElementById("e-phone").value,
    email: document.getElementById("e-email").value,
    hourlyRate: Number(document.getElementById("e-hourly-rate").value) || 0,
    isSalaried: document.getElementById("e-is-salaried").checked,
    fixedWeeklyHours: Number(document.getElementById("e-fixed-hours").value) || 0,
    pin,
    notes: document.getElementById("e-notes").value
  };
  if (id) await db.collection("employees").doc(id).update(data);
  else {
    const nid = genId();
    // sortOrder : placer le nouvel employé à la fin de la liste
    const maxSort = employees.reduce((m, e) => Math.max(m, e.sortOrder || 0), 0);
    await db.collection("employees").doc(nid).set({
      ...data, id: nid, shifts: {}, sortOrder: maxSort + 1
    });
  }
  closeModal();
}

// ══════════════════════════════════════════════════════
// GRAPHIQUE DE COUVERTURE — nombre d'employés présents par heure/jour
// ══════════════════════════════════════════════════════

function setCoverageSection(section) {
  scheduleCoverageSection = section;
  renderPage();
}

// Convertit "HH:MM" en float : "10:30" → 10.5
function parseTimeToFloat(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (isNaN(h)) return null;
  return h + (Number(m) || 0) / 60;
}

// Calcule le nombre d'employés présents à l'heure H du jour J
// (H est un entier représentant l'heure. Présence = [start, end) dans cette heure.)
function countCoverageAtHour(H, dk, sectionFilter) {
  let count = 0;
  for (const emp of employees) {
    if (sectionFilter !== "all") {
      const empSection = emp.section || "service";
      if (empSection !== sectionFilter) continue;
    }
    const s = (emp.shifts || {})[dk];
    if (!s || !s.start || !s.end) continue;
    let start = parseTimeToFloat(s.start);
    let end = parseTimeToFloat(s.end);
    if (start == null || end == null) continue;
    // Quart qui passe minuit → étendre la fin
    if (end <= start) end += 24;
    // L'employé est compté pour l'heure H si start ≤ H < end (ou avec passage minuit : H+24)
    if (H >= start && H < end) count++;
    else if (H + 24 >= start && H + 24 < end) count++; // cas edge passage minuit
  }
  return count;
}

// Construit et affiche le graphique (appelé après chaque render de la page Horaires)
function initCoverageChart() {
  const canvas = document.getElementById("coverage-chart");
  if (!canvas) return;
  if (typeof Chart === "undefined") {
    canvas.parentNode.innerHTML = `<div class="empty" style="padding:var(--sp-5)">Chargement du graphique...</div>`;
    return;
  }

  // Détruire l'instance précédente (évite les fuites mémoire + superposition)
  if (_coverageChartInstance) {
    try { _coverageChartInstance.destroy(); } catch (_) {}
    _coverageChartInstance = null;
  }

  const weekStart = getWeekStart(scheduleWeekOffset || 0);
  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));

  // Déterminer la plage X dynamique : min start → max end parmi tous les shifts
  // (après filtre section) sur les jours ouverts de la semaine.
  let minH = 24, maxH = 0;
  const daySection = scheduleCoverageSection;
  let anyShift = false;
  visibleIdx.forEach(i => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const dk = d.toISOString().slice(0, 10);
    for (const emp of employees) {
      if (daySection !== "all") {
        const empSection = emp.section || "service";
        if (empSection !== daySection) continue;
      }
      const s = (emp.shifts || {})[dk];
      if (!s || !s.start || !s.end) continue;
      const sh = parseTimeToFloat(s.start);
      let eh = parseTimeToFloat(s.end);
      if (sh == null || eh == null) continue;
      if (eh <= sh) eh += 24;
      minH = Math.min(minH, Math.floor(sh));
      maxH = Math.max(maxH, Math.ceil(eh));
      anyShift = true;
    }
  });

  // Aucune donnée → placeholder sympa
  if (!anyShift) {
    const wrap = canvas.parentNode;
    wrap.innerHTML = `<div class="empty coverage-empty">
      <div class="empty-state-icon">${icon("bar-chart", 36)}</div>
      Aucun quart saisi pour cette semaine ${daySection !== "all" ? `(section ${daySection})` : ""}.<br>
      <span style="font-size:13px;color:var(--text3)">Ajoutez des horaires ci-dessus pour voir le graphique.</span>
    </div>`;
    return;
  }

  // Labels heures (entiers) de minH à maxH exclus : "12h", "13h"...
  const labels = [];
  for (let h = minH; h < maxH; h++) {
    labels.push((h % 24) + "h");
  }

  // Datasets : un par jour ouvert
  const DAY_COLORS = {
    0: "#8b5cf6", // Lun - violet
    1: "#14b8a6", // Mar - teal
    2: "#4a90e2", // Mer - bleu
    3: "#e74c3c", // Jeu - rouge
    4: "#F7B32C", // Ven - jaune
    5: "#7dbf66", // Sam - vert
    6: "#f97316"  // Dim - orange
  };
  const datasets = visibleIdx.map(i => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i);
    const dk = d.toISOString().slice(0, 10);
    const data = [];
    for (let h = minH; h < maxH; h++) {
      data.push(countCoverageAtHour(h, dk, daySection));
    }
    const color = DAY_COLORS[i];
    return {
      label: DAYS_FR[i],
      data,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 0,
      borderRadius: 3,
      barPercentage: 0.85,
      categoryPercentage: 0.85
    };
  });

  // Couleurs du thème (dark / light)
  const textColor   = darkMode ? "rgba(245,241,232,.72)" : "rgba(14,13,12,.72)";
  const gridColor   = darkMode ? "rgba(245,241,232,.08)" : "rgba(14,13,12,.08)";
  const tooltipBg   = darkMode ? "#25201d" : "#ffffff";
  const tooltipText = darkMode ? "#f5f1e8" : "#0e0d0c";

  _coverageChartInstance = new Chart(canvas, {
    type: "bar",
    data: { labels, datasets },
    options: {
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
            pointStyle: "rectRounded",
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
          titleFont: { size: 13, weight: 700 },
          bodyFont: { size: 12 },
          callbacks: {
            label: ctx => `${ctx.dataset.label} : ${ctx.parsed.y} employé${ctx.parsed.y > 1 ? "s" : ""}`
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: "Heure", color: textColor, font: { size: 11, weight: 600 } },
          grid: { display: false },
          ticks: { color: textColor, font: { family: "Inter, sans-serif", size: 11 } }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Employés", color: textColor, font: { size: 11, weight: 600 } },
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: "Inter, sans-serif", size: 11 },
            stepSize: 1,
            precision: 0
          }
        }
      }
    }
  });
}

// ══════════════════════════════════════════════════════
// IMPORT HORAIRE TYPE — remplit la semaine affichée avec un modèle fixe
// (utilisé pour éviter la saisie manuelle initiale)
// ══════════════════════════════════════════════════════

// Configuration des employés (optionnel : champs à jour sur la fiche en plus des shifts)
// Utilisée par seedScheduleFromTemplate pour appliquer salaire fixe, taux, etc.
const BOCHICA_SCHEDULE_TEMPLATE = [
  { name: "Manu",    wed: [10, 21], thu: [15, 21], fri: [10, 19], sat: [11, 19], sun: null },
  { name: "Sergio",  wed: [11, 15], thu: null,     fri: [17, 22], sat: [14, 23], sun: [11, 21] },
  { name: "Nancy",   wed: null,     thu: null,     fri: null,     sat: null,     sun: [13, 18] },
  { name: "Martha",  wed: null,     thu: null,     fri: null,     sat: [13, 23], sun: [13, 21] },
  { name: "Paula",   wed: null,     thu: null,     fri: [17, 22], sat: [13, 22], sun: [13, 20] },
  { name: "Samanta", wed: [12, 21], thu: [17, 21], fri: [13, 21], sat: [13, 23], sun: [12, 21] },
  { name: "Daniel",  wed: null,     thu: null,     fri: null,     sat: null,     sun: null },
  { name: "Alvaro",  wed: [17, 21], thu: [17, 21], fri: [12, 20], sat: [12, 15], sun: null,
    // Alvaro est salarié : 35h fixes × 23$ = 805$/semaine, soit 161$/jour sur 5 jours
    config: { isSalaried: true, fixedWeeklyHours: 35, hourlyRate: 23 } },
  { name: "Junior",  wed: [12, 15], thu: null,     fri: null,     sat: null,     sun: null },
  { name: "Vincent", wed: null,     thu: null,     fri: null,     sat: null,     sun: null },
  { name: "Samia",   wed: null,     thu: null,     fri: [12, 15], sat: [12, 16], sun: null }
];

// Applique uniquement les configs de paie (isSalaried, fixedWeeklyHours, hourlyRate)
// pour les employés qui ont un champ `config` dans le template.
// Ne touche PAS aux shifts — safe à cliquer à tout moment.
async function applyPayrollConfigs() {
  const toApply = BOCHICA_SCHEDULE_TEMPLATE.filter(r => r.config);
  if (toApply.length === 0) {
    toast("Aucune config de paie à appliquer.", "info");
    return;
  }
  const batch = db.batch();
  const applied = [], notFound = [];
  for (const row of toApply) {
    const emp = employees.find(e => (e.name || "").trim().toLowerCase() === row.name.toLowerCase());
    if (!emp) { notFound.push(row.name); continue; }
    batch.update(db.collection("employees").doc(emp.id), row.config);
    applied.push(`${row.name} (${row.config.fixedWeeklyHours}h × ${row.config.hourlyRate}$ = ${row.config.fixedWeeklyHours * row.config.hourlyRate}$/sem)`);
  }
  if (applied.length === 0) {
    toast(`Aucun employé trouvé. Manquent : ${notFound.join(", ")}`, "warning", 5000);
    return;
  }
  await batch.commit();
  await addLog("—", "Salaires fixes configurés", applied.join(" · "));
  let msg = `Salaires fixes appliqués à ${applied.length} employé(s).`;
  if (notFound.length) msg += ` Non trouvés : ${notFound.join(", ")}`;
  toast(msg, notFound.length ? "warning" : "success", 5000);
}

function seedScheduleFromTemplate() {
  const weekStart = getWeekStart(scheduleWeekOffset || 0);
  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));
  const msg = `Cette action va <strong>remplir l'horaire de la semaine ${weekNum}</strong> avec le modèle Bochica (11 employés, Mer→Dim).<br><br>Les shifts existants sur les jours Mer-Dim de cette semaine seront <strong>écrasés</strong>. Continuer ?`;
  openConfirm("Importer l'horaire type ?", msg, doSeedScheduleFromTemplate, false);
}

async function doSeedScheduleFromTemplate() {
  const weekStart = getWeekStart(scheduleWeekOffset || 0);
  const dk = off => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + off);
    return d.toISOString().slice(0, 10);
  };
  const dayOffset = { wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const fmtTime = h => h == null ? null : `${String(h).padStart(2, "0")}:00`;

  // Garantir que Mer-Dim soient marqués ouverts
  await db.collection("settings").doc("schedule").set(
    { openDays: [2, 3, 4, 5, 6] },
    { merge: true }
  );

  let updated = 0, skipped = 0, created = 0;
  let maxSort = employees.reduce((m, e) => Math.max(m, e.sortOrder || 0), 0);
  const notFound = [];

  for (const row of BOCHICA_SCHEDULE_TEMPLATE) {
    let emp = employees.find(e => (e.name || "").trim().toLowerCase() === row.name.toLowerCase());
    const baseShifts = emp ? { ...(emp.shifts || {}) } : {};
    for (const day of ["wed", "thu", "fri", "sat", "sun"]) {
      const key = dk(dayOffset[day]);
      const val = row[day];
      if (val && val[0] != null && val[1] != null) {
        baseShifts[key] = { start: fmtTime(val[0]), end: fmtTime(val[1]) };
      } else {
        delete baseShifts[key];
      }
    }
    // Champs additionnels du template (salaire fixe, taux, etc.)
    const extraConfig = row.config || {};

    if (emp) {
      const updatePayload = { shifts: baseShifts, ...extraConfig };
      await db.collection("employees").doc(emp.id).update(updatePayload);
      updated++;
    } else {
      // Employé absent : créer automatiquement
      maxSort++;
      const nid = genId();
      await db.collection("employees").doc(nid).set({
        id: nid,
        name: row.name,
        role: "",
        phone: "",
        email: "",
        hourlyRate: 0,
        pin: "",
        notes: "",
        shifts: baseShifts,
        sortOrder: maxSort,
        ...extraConfig // applique isSalaried, fixedWeeklyHours, hourlyRate si spécifiés
      });
      notFound.push(row.name);
      created++;
    }
  }

  await addLog("—", "Horaire importé", `Semaine ${weekNum} · ${updated} maj · ${created} créés`);

  let result = `Horaire de la semaine ${weekNum} importé · ${updated} mis à jour`;
  if (created > 0) result += ` · ${created} créé(s)`;
  toast(result, "success", 5000);
}
