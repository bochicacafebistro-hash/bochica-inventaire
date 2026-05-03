// ═══════════════════════════════════════════════════════════════
// SALAIRES & POURBOIRES — page de paie hebdomadaire
// ───────────────────────────────────────────────────────────────
// Permet de saisir les heures RÉELLES travaillées par chaque employé
// (qui peuvent différer de l'horaire planifié) et de calculer salaires
// + répartition au prorata des pourboires selon les heures effectuées
// pendant les heures de service du restaurant.
//
// Règles métier :
//   • Cuisine (section="cuisine") = 25% du pool de pourboires (par défaut)
//   • Service + Autre (section="service" ou "other") = 75% du pool
//   • Le prorata se fait sur les heures dans la fenêtre de service
//     du jour (ex: 13h–22h), pas sur les heures totales (ménage avant/après
//     n'est pas comptabilisé pour les pourboires mais l'est pour le salaire).
//
// Données :
//   • settings/payroll       — tipShares + defaultServiceHours (config globale)
//   • payroll/{weekId}       — actualShifts + tipsByDay (un doc par semaine ISO)
// ═══════════════════════════════════════════════════════════════

// ═ Helpers internes ═════════════════════════════════════

// ID de semaine ISO au format "YYYY-Wnn" (ex: "2026-W18")
function payrollWeekId(weekStart) {
  const thursday = new Date(weekStart);
  thursday.setDate(thursday.getDate() + 3); // jeudi pour stabilité ISO
  const wn = getISOWeek(thursday);
  return `${thursday.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}

// Intersection en heures entre un shift {start,end} et une fenêtre de service {start,end}
// Gère les chevauchements de minuit. Retourne 0 si pas d'intersection.
function intersectShiftHours(shift, serviceWin) {
  if (!shift || !shift.start || !shift.end) return 0;
  if (!serviceWin || !serviceWin.start || !serviceWin.end) return 0;
  let sStart = parseTimeToFloat(shift.start);
  let sEnd = parseTimeToFloat(shift.end);
  let wStart = parseTimeToFloat(serviceWin.start);
  let wEnd = parseTimeToFloat(serviceWin.end);
  if (sStart == null || sEnd == null || wStart == null || wEnd == null) return 0;
  if (sEnd <= sStart) sEnd += 24;
  if (wEnd <= wStart) wEnd += 24;
  const start = Math.max(sStart, wStart);
  const end = Math.min(sEnd, wEnd);
  return Math.max(0, end - start);
}

// Récupère le shift réel d'un employé pour un jour donné.
// Tombe en fallback sur le planifié si pas encore de saisie réelle.
function getActualShift(empId, dk) {
  const actual = (payrollWeekData?.actualShifts || {})[empId];
  if (actual && actual[dk]) return actual[dk];
  // Fallback : copie du planifié
  const emp = employees.find(e => e.id === empId);
  if (!emp) return null;
  return (emp.shifts || {})[dk] || null;
}

// Indique si l'employé a une saisie réelle explicite (vs fallback planifié)
function hasActualOverride(empId, dk) {
  const actual = (payrollWeekData?.actualShifts || {})[empId];
  return !!(actual && actual[dk]);
}

// Récupère le shift planifié d'un employé pour un jour donné
function getPlannedShift(empId, dk) {
  const emp = employees.find(e => e.id === empId);
  if (!emp) return null;
  return (emp.shifts || {})[dk] || null;
}

// Récupère la fenêtre de service pour un jour de la semaine (0=Lun ... 6=Dim).
// Utilise UNIQUEMENT settings/payroll.defaultServiceHours — config globale,
// modifiable n'importe quand via la modale.
function getServiceWindow(dowIdx) {
  const def = (payrollSettings?.defaultServiceHours || {})[dowIdx];
  if (def && def.start && def.end) return def;
  return null;
}

// Section "tipGroup" d'un employé : "cuisine" ou "service".
// "service" et "other" partagent le même pool 75%.
function tipGroupOf(emp) {
  return (emp.section || "service") === "cuisine" ? "cuisine" : "service";
}

// Compare deux shifts {start,end} pour savoir s'ils sont identiques
function sameShift(a, b) {
  const aStart = a?.start || "";
  const aEnd = a?.end || "";
  const bStart = b?.start || "";
  const bEnd = b?.end || "";
  return aStart === bStart && aEnd === bEnd;
}

// ═ Navigation semaine ═══════════════════════════════════
function changePayrollWeek(delta) {
  payrollWeekOffset += delta;
  subscribePayrollWeek();
  renderPage();
}
function resetPayrollWeek() {
  payrollWeekOffset = 0;
  subscribePayrollWeek();
  renderPage();
}

// ═ Listener Firestore sur le doc de la semaine courante ═
function subscribePayrollWeek() {
  if (typeof _payrollUnsub === "function") {
    try { _payrollUnsub(); } catch (_) {}
  }
  payrollWeekData = null;
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  _payrollUnsub = db.collection("payroll").doc(wid).onSnapshot(snap => {
    payrollWeekData = snap.exists ? snap.data() : null;
    if (isLoggedIn && activePage === "salaires") renderPage();
  });
}

// ═ Rendu principal ══════════════════════════════════════
function renderSalaires() {
  const weekStart = getWeekStart(payrollWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]);
  const weekLabel = `${weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  // Jours ouverts hérités du module Horaires
  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);

  // Pourcentages cuisine / service (par défaut 25/75)
  const tipShares = payrollSettings?.tipShares || { cuisine: 0.25, service: 0.75 };

  // Pourboires par jour + total auto-calculé
  const tipsByDay = payrollWeekData?.tipsByDay || {};
  // Rétrocompat : si l'ancien champ totalTips existe et tipsByDay est vide
  const legacyTotal = Number(payrollWeekData?.totalTips) || 0;
  const totalTips = weekDays.reduce((s, d) => s + (Number(tipsByDay[dayKey(d)]) || 0), 0)
    || legacyTotal;
  const poolCuisine = totalTips * (Number(tipShares.cuisine) || 0);
  const poolService = totalTips * (Number(tipShares.service) || 0);

  // ─ Calculs par employé ────────────────────────────
  const empRows = employees.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = tipGroupOf(emp);

    let totalHours = 0;
    let plannedHours = 0;
    let tipEligibleHours = 0;
    const daily = weekDays.map((d, k) => {
      const dk = dayKey(d);
      const dowIdx = visibleIdx[k];
      const actualShift = getActualShift(emp.id, dk);
      const plannedShift = getPlannedShift(emp.id, dk);
      const serviceWin = getServiceWindow(dowIdx);
      const hours = hoursFromShift(actualShift);
      const pHours = hoursFromShift(plannedShift);
      const tipHours = serviceWin ? intersectShiftHours(actualShift, serviceWin) : 0;
      const isOverride = hasActualOverride(emp.id, dk);
      const isDifferent = isOverride && !sameShift(actualShift, plannedShift);
      totalHours += hours;
      plannedHours += pHours;
      tipEligibleHours += tipHours;
      return { dk, dowIdx, actualShift, plannedShift, hours, pHours, tipHours, isOverride, isDifferent };
    });

    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    const gap = totalHours - plannedHours;
    return { emp, rate, isSal, fixedHours, group, daily, totalHours, plannedHours, gap, tipEligibleHours, grossWage };
  });

  // Totaux par groupe pour le prorata
  const totalCuisineHrs = empRows.filter(r => r.group === "cuisine").reduce((s, r) => s + r.tipEligibleHours, 0);
  const totalServiceHrs = empRows.filter(r => r.group === "service").reduce((s, r) => s + r.tipEligibleHours, 0);

  // Attribution prorata
  empRows.forEach(r => {
    if (r.group === "cuisine") {
      r.tipShare = totalCuisineHrs > 0 ? (r.tipEligibleHours / totalCuisineHrs) * poolCuisine : 0;
    } else {
      r.tipShare = totalServiceHrs > 0 ? (r.tipEligibleHours / totalServiceHrs) * poolService : 0;
    }
    r.totalPay = r.grossWage + r.tipShare;
  });

  const sumGross = empRows.reduce((s, r) => s + r.grossWage, 0);
  const sumTips = empRows.reduce((s, r) => s + r.tipShare, 0);
  const sumTotal = empRows.reduce((s, r) => s + r.totalPay, 0);
  const sumActualHours = empRows.reduce((s, r) => s + r.totalHours, 0);
  const sumPlannedHours = empRows.reduce((s, r) => s + r.plannedHours, 0);

  // ─ HTML ───────────────────────────────────────────
  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("dollar-sign", 22)} Salaires & Pourboires</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="openServiceHoursModal()" title="Configurer les heures d'ouverture du service">${icon("clock", 14)} Heures de service</button>
        <button class="btn-secondary btn-sm" onclick="openTipSharesModal()" title="Répartition cuisine/service">${icon("percent", 14)} Répartition</button>
      </div>
    </div>

    ${employees.length === 0 ? `
      <div class="empty"><div class="empty-state-icon">${icon("users", 36)}</div>Aucun employé enregistré. Ajoutez-en un dans Employés & Horaires pour commencer.</div>
    ` : `
      <!-- ══ Sélecteur de semaine + actions ══ -->
      <div class="schedule-header">
        <div class="schedule-nav">
          <button class="btn-icon-only" onclick="changePayrollWeek(-1)" aria-label="Semaine précédente" title="Semaine précédente">${icon("chevron-left", 16)}</button>
          <div class="schedule-week-label">
            <div class="schedule-week-num">Semaine ${weekNum}</div>
            <div class="schedule-week-dates">${weekLabel}</div>
            ${payrollWeekOffset !== 0
              ? `<button class="schedule-today-btn" onclick="resetPayrollWeek()">Aujourd'hui</button>`
              : `<div class="schedule-today-tag">Cette semaine</div>`}
          </div>
          <button class="btn-icon-only" onclick="changePayrollWeek(1)" aria-label="Semaine suivante" title="Semaine suivante">${icon("chevron-right", 16)}</button>
        </div>
        <div class="schedule-actions">
          <button class="btn-secondary btn-sm" onclick="duplicatePayrollToNextWeek()" title="Copier les heures réelles et pourboires vers la semaine suivante">${icon("copy", 14)} Copier → S${weekNum + 1}</button>
          <button class="btn-secondary btn-sm" onclick="resetActualFromPlanned()" title="Réinitialiser les heures réelles depuis l'horaire planifié">${icon("refresh", 14)} Reprendre du planifié</button>
        </div>
      </div>

      <!-- ══ Pourboires par jour + total auto + pools ══ -->
      <div class="card payroll-tips-card">
        <div class="payroll-tips-head">
          <div>
            <h3 class="payroll-service-title">${icon("dollar-sign", 16)} Pourboires de la semaine</h3>
            <div class="payroll-service-sub">Saisis le montant reçu chaque jour — le total est calculé automatiquement</div>
          </div>
          <div class="payroll-tips-total">
            <div class="payroll-tips-total__label">Total semaine</div>
            <div class="payroll-tips-total__amount">${fmtMoney(totalTips)}</div>
          </div>
        </div>
        <div class="payroll-tips-grid">
          ${weekDays.map((d, k) => {
            const dk = dayKey(d);
            const dowIdx = visibleIdx[k];
            const val = Number(tipsByDay[dk] || 0);
            return `<div class="payroll-tips-day">
              <div class="payroll-tips-day__name">${DAYS_FR[dowIdx]} <span class="payroll-tips-day__date">${d.getDate()}/${d.getMonth() + 1}</span></div>
              <div class="payroll-tips-day__input">
                <input type="number" min="0" step="0.01" placeholder="0.00" value="${val || ""}" onchange="updateTipForDay('${dk}',this.value)" aria-label="Pourboires ${DAYS_FR[dowIdx]} ${d.getDate()}/${d.getMonth() + 1}"/>
                <span>$</span>
              </div>
            </div>`;
          }).join("")}
        </div>
        <div class="payroll-tips-pools">
          <div class="payroll-tips-pool payroll-tips-pool--kitchen">
            <div class="payroll-tips-pool__label">${icon("utensils", 12)} Pool Cuisine (${(tipShares.cuisine * 100).toFixed(0)}%)</div>
            <div class="payroll-tips-pool__amount">${fmtMoney(poolCuisine)}</div>
            <div class="payroll-tips-pool__hint">${fmtHours(totalCuisineHrs)}h éligibles</div>
          </div>
          <div class="payroll-tips-pool payroll-tips-pool--service">
            <div class="payroll-tips-pool__label">${icon("users", 12)} Pool Service + Admin (${(tipShares.service * 100).toFixed(0)}%)</div>
            <div class="payroll-tips-pool__amount">${fmtMoney(poolService)}</div>
            <div class="payroll-tips-pool__hint">${fmtHours(totalServiceHrs)}h éligibles</div>
          </div>
        </div>
      </div>

      <!-- ══ Tableau heures réelles + planifiées + salaires + pourboires ══ -->
      <div class="card payroll-table-wrap" style="padding:0;overflow-x:auto">
        <table class="schedule-table payroll-table">
          <thead>
            <tr>
              <th class="schedule-th--emp">Employé</th>
              ${weekDays.map((d, k) => {
                const dowIdx = visibleIdx[k];
                const sw = getServiceWindow(dowIdx);
                const swLabel = sw ? `${sw.start}–${sw.end}` : "—";
                return `<th class="schedule-th--day" colspan="2">
                  <div class="schedule-day-name">${DAYS_FR[dowIdx]}</div>
                  <div class="schedule-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
                  <div class="payroll-th-service" title="Fenêtre de service">${swLabel}</div>
                </th>`;
              }).join("")}
              <th class="schedule-th--summary">Réel / Planif</th>
              <th class="schedule-th--summary">Écart</th>
              <th class="schedule-th--summary">Salaire</th>
              <th class="schedule-th--summary">Pourboire</th>
              <th class="schedule-th--summary">Total</th>
            </tr>
            <tr class="schedule-subheader">
              <th></th>
              ${weekDays.map(() => `<th class="schedule-th--entry">Entrée</th><th class="schedule-th--exit">Sortie</th>`).join("")}
              <th></th><th></th><th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            ${empRows.map(row => {
              const groupBadge = row.group === "cuisine"
                ? `<span class="payroll-group-badge payroll-group-badge--kitchen" title="Pool cuisine ${(tipShares.cuisine*100).toFixed(0)}%">${icon("utensils", 10)} ${(tipShares.cuisine*100).toFixed(0)}%</span>`
                : `<span class="payroll-group-badge payroll-group-badge--service" title="Pool service ${(tipShares.service*100).toFixed(0)}%">${icon("users", 10)} ${(tipShares.service*100).toFixed(0)}%</span>`;
              const gapCls = row.gap > 0.01 ? "is-positive" : row.gap < -0.01 ? "is-negative" : "";
              const gapArrow = row.gap > 0.01 ? "▲" : row.gap < -0.01 ? "▼" : "";
              return `<tr class="schedule-emp-row" data-emp-id="${row.emp.id}">
                <td class="schedule-td--emp">
                  <div class="schedule-emp-cell">
                    <div class="schedule-emp-info">
                      <div class="schedule-emp-name">${esc(row.emp.name || "")}</div>
                      <div class="schedule-emp-meta">
                        ${groupBadge}
                        ${row.rate ? `<span class="schedule-emp-role">${row.rate.toFixed(2)}$/h${row.isSal ? " · FIXE" : ""}</span>` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                ${row.daily.map((d, k) => {
                  const filled = d.actualShift && d.actualShift.start && d.actualShift.end;
                  const startVal = d.actualShift?.start || "";
                  const endVal = d.actualShift?.end || "";
                  const empName = esc(row.emp.name || "");
                  const dayName = DAYS_FR[visibleIdx[k]];
                  const tipHint = (d.tipHours > 0 && Math.abs(d.tipHours - d.hours) > 0.01)
                    ? `<span class="payroll-tip-hint" title="${fmtHours(d.tipHours)}h dans la fenêtre service">★${fmtHours(d.tipHours)}</span>`
                    : "";
                  // Affichage du planifié sous l'input quand différent du réel
                  const plannedHint = (d.plannedShift && d.plannedShift.start && d.plannedShift.end && d.isDifferent)
                    ? `<div class="payroll-planned-hint" title="Heure planifiée">${icon("calendar", 9)} ${d.plannedShift.start}→${d.plannedShift.end}</div>`
                    : (!filled && d.plannedShift && d.plannedShift.start)
                      ? `<div class="payroll-planned-hint payroll-planned-hint--fallback" title="Valeur héritée du planifié">${icon("calendar", 9)} P:${d.plannedShift.start}→${d.plannedShift.end}</div>`
                      : "";
                  return `<td class="schedule-td--cell payroll-td-cell ${filled ? "is-filled" : ""} ${d.isDifferent ? "is-modified" : ""}">
                    <input type="time" class="payroll-time-input" value="${startVal}" onchange="updateActualShift('${row.emp.id}','${d.dk}','start',this.value)" aria-label="${empName}, entrée réelle ${dayName}"/>
                  </td>
                  <td class="schedule-td--cell payroll-td-cell ${filled ? "is-filled" : ""} ${d.isDifferent ? "is-modified" : ""}">
                    <input type="time" class="payroll-time-input" value="${endVal}" onchange="updateActualShift('${row.emp.id}','${d.dk}','end',this.value)" aria-label="${empName}, sortie réelle ${dayName}"/>
                    ${tipHint}
                    ${plannedHint}
                  </td>`;
                }).join("")}
                <td class="schedule-td--summary">
                  <div class="payroll-hours-cell">
                    <span class="payroll-hours-actual">${row.totalHours ? fmtHours(row.totalHours) : "0"}h</span>
                    <span class="payroll-hours-sep">/</span>
                    <span class="payroll-hours-planned" title="Heures planifiées">${row.plannedHours ? fmtHours(row.plannedHours) : "0"}h</span>
                  </div>
                  ${row.tipEligibleHours > 0 && Math.abs(row.tipEligibleHours - row.totalHours) > 0.01
                    ? `<div class="schedule-fixed-hint" title="Heures éligibles aux pourboires">★ ${fmtHours(row.tipEligibleHours)}h</div>`
                    : ""}
                </td>
                <td class="schedule-td--summary payroll-gap-cell ${gapCls}">
                  ${row.gap !== 0 || row.totalHours || row.plannedHours
                    ? `<span class="payroll-gap-arrow">${gapArrow}</span>${(row.gap >= 0 ? "+" : "")}${fmtHours(row.gap)}h`
                    : "—"}
                </td>
                <td class="schedule-td--summary">${row.grossWage ? fmtMoney(row.grossWage) : "—"}</td>
                <td class="schedule-td--summary">${row.tipShare ? fmtMoney(row.tipShare) : "—"}</td>
                <td class="schedule-td--summary schedule-td--total">${row.totalPay ? fmtMoney(row.totalPay) : ""}</td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr class="schedule-tfoot-row schedule-tfoot-row--predicted">
              <td class="schedule-tfoot-label">Totaux semaine</td>
              <td colspan="${weekDays.length * 2}" class="schedule-tfoot-val" style="text-align:right;color:var(--text3);font-style:italic">
                ${empRows.length} employé${empRows.length > 1 ? "s" : ""}
              </td>
              <td class="schedule-tfoot-val">
                <div class="payroll-hours-cell">
                  <span class="payroll-hours-actual">${fmtHours(sumActualHours)}h</span>
                  <span class="payroll-hours-sep">/</span>
                  <span class="payroll-hours-planned">${fmtHours(sumPlannedHours)}h</span>
                </div>
              </td>
              <td class="schedule-tfoot-val payroll-gap-cell ${(sumActualHours - sumPlannedHours) > 0.01 ? "is-positive" : (sumActualHours - sumPlannedHours) < -0.01 ? "is-negative" : ""}">
                ${(sumActualHours || sumPlannedHours)
                  ? `${((sumActualHours - sumPlannedHours) >= 0 ? "+" : "")}${fmtHours(sumActualHours - sumPlannedHours)}h`
                  : "—"}
              </td>
              <td class="schedule-tfoot-val">${fmtMoney(sumGross)}</td>
              <td class="schedule-tfoot-val">${fmtMoney(sumTips)}</td>
              <td class="schedule-tfoot-val schedule-td--total">${fmtMoney(sumTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="payroll-legend">
        ${icon("info", 12)} Les <strong>heures réelles</strong> peuvent différer de l'horaire <strong>planifié</strong>.
        Le badge ★ indique les heures éligibles aux pourboires (dans la fenêtre de service).
        Une cellule <strong>jaune</strong> indique une heure modifiée par rapport au planifié.
      </p>
    `}
  </div>`;
}

// ═ Actions Firestore ════════════════════════════════════

// Met à jour un shift réel (start ou end) pour la semaine courante
async function updateActualShift(empId, dk, field, value) {
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  const ref = db.collection("payroll").doc(wid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const actualShifts = { ...(data.actualShifts || {}) };
  const empShifts = { ...(actualShifts[empId] || {}) };
  const current = empShifts[dk] || {};
  const next = { ...current, [field]: value || "" };
  if (!next.start && !next.end) {
    delete empShifts[dk];
  } else {
    empShifts[dk] = next;
  }
  if (Object.keys(empShifts).length === 0) {
    delete actualShifts[empId];
  } else {
    actualShifts[empId] = empShifts;
  }
  await ref.set({
    weekId: wid,
    weekStart: dayKey(ws),
    actualShifts,
    updatedAt: Date.now(),
    ...(snap.exists ? {} : { createdAt: Date.now() })
  }, { merge: true });
}

// Met à jour le pourboire reçu pour un jour donné
async function updateTipForDay(dk, value) {
  const v = Number(value);
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  const ref = db.collection("payroll").doc(wid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const tipsByDay = { ...(data.tipsByDay || {}) };
  if (isNaN(v) || v <= 0) {
    delete tipsByDay[dk];
  } else {
    tipsByDay[dk] = v;
  }
  await ref.set({
    weekId: wid,
    weekStart: dayKey(ws),
    tipsByDay,
    updatedAt: Date.now(),
    ...(snap.exists ? {} : { createdAt: Date.now() })
  }, { merge: true });
}

// ═ Modale : configurer les heures de service (config globale) ═
function openServiceHoursModal() {
  const cur = payrollSettings?.defaultServiceHours || {};
  const dayNamesLong = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  showModal(`<div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} Heures de service</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Définis la fenêtre où le restaurant <strong>sert les clients</strong> (donc où les pourboires sont gagnés).
      Cette config s'applique à <strong>toutes les semaines</strong> et peut être modifiée à tout moment.
      Laisse vide un jour pour le marquer comme fermé.
    </p>
    <div class="payroll-svc-modal-grid">
      ${[0,1,2,3,4,5,6].map(i => {
        const win = cur[i] || {};
        const startVal = win.start || "";
        const endVal = win.end || "";
        return `<div class="payroll-svc-modal-row">
          <div class="payroll-svc-modal-day">${dayNamesLong[i]}</div>
          <div class="payroll-svc-modal-inputs">
            <input id="svc-${i}-start" type="time" value="${startVal}" aria-label="${dayNamesLong[i]} début"/>
            <span>→</span>
            <input id="svc-${i}-end" type="time" value="${endVal}" aria-label="${dayNamesLong[i]} fin"/>
            <button type="button" class="btn-icon-only btn-sm" onclick="clearServiceDay(${i})" aria-label="Effacer ${dayNamesLong[i]}" title="Marquer comme fermé">${icon("x", 14)}</button>
          </div>
        </div>`;
      }).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveServiceHours()">${t("save")}</button>
    </div>
  </div>`);
}

function clearServiceDay(i) {
  const s = document.getElementById(`svc-${i}-start`);
  const e = document.getElementById(`svc-${i}-end`);
  if (s) s.value = "";
  if (e) e.value = "";
}

async function saveServiceHours() {
  const next = {};
  for (let i = 0; i < 7; i++) {
    const start = document.getElementById(`svc-${i}-start`)?.value || "";
    const end = document.getElementById(`svc-${i}-end`)?.value || "";
    if (start && end) {
      next[i] = { start, end };
    }
  }
  await db.collection("settings").doc("payroll").set({
    defaultServiceHours: next
  }, { merge: true });
  closeModal();
  toast("Heures de service enregistrées.", "success");
}

// ═ Modale : répartition cuisine/service (%) ═════════════
function openTipSharesModal() {
  const cur = payrollSettings?.tipShares || { cuisine: 0.25, service: 0.75 };
  showModal(`<div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>${icon("percent", 18)} Répartition des pourboires</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Les pourboires sont répartis en deux pools selon la section de l'employé.
      La somme doit faire <strong>100%</strong>.
    </p>
    <label>${icon("utensils", 12)} Pool Cuisine (%)
      <input id="tip-cuisine-pct" type="number" min="0" max="100" step="1"
        value="${(cur.cuisine * 100).toFixed(0)}"
        oninput="document.getElementById('tip-service-pct').value = (100 - Number(this.value || 0))"/>
    </label>
    <label>${icon("users", 12)} Pool Service + Admin (%)
      <input id="tip-service-pct" type="number" min="0" max="100" step="1"
        value="${(cur.service * 100).toFixed(0)}"
        oninput="document.getElementById('tip-cuisine-pct').value = (100 - Number(this.value || 0))"/>
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveTipShares()">${t("save")}</button>
    </div>
  </div>`);
}

async function saveTipShares() {
  const cuisinePct = Number(document.getElementById("tip-cuisine-pct").value);
  const servicePct = Number(document.getElementById("tip-service-pct").value);
  if (isNaN(cuisinePct) || isNaN(servicePct) || cuisinePct < 0 || servicePct < 0) {
    return toast("Pourcentages invalides.", "error");
  }
  if (Math.abs(cuisinePct + servicePct - 100) > 0.5) {
    return toast("La somme doit être 100% (cuisine + service).", "error");
  }
  await db.collection("settings").doc("payroll").set({
    tipShares: { cuisine: cuisinePct / 100, service: servicePct / 100 }
  }, { merge: true });
  closeModal();
  toast("Répartition enregistrée.", "success");
}

// ═ Action : reprendre l'horaire planifié comme valeurs réelles ═
function resetActualFromPlanned() {
  openConfirm(
    "Reprendre l'horaire planifié ?",
    "Cela va <strong>remplacer</strong> toutes les heures réelles de cette semaine par les heures planifiées dans Employés & Horaires. Les modifications saisies ici seront perdues. Continuer ?",
    doResetActualFromPlanned,
    true
  );
}

async function doResetActualFromPlanned() {
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return dayKey(d);
  });

  const actualShifts = {};
  for (const emp of employees) {
    const planned = emp.shifts || {};
    const empCopy = {};
    weekDays.forEach(dk => {
      const s = planned[dk];
      if (s && s.start && s.end) {
        empCopy[dk] = { start: s.start, end: s.end };
      }
    });
    if (Object.keys(empCopy).length) actualShifts[emp.id] = empCopy;
  }

  const ref = db.collection("payroll").doc(wid);
  const snap = await ref.get();
  await ref.set({
    weekId: wid,
    weekStart: dayKey(ws),
    actualShifts,
    updatedAt: Date.now(),
    ...(snap.exists ? {} : { createdAt: Date.now() })
  }, { merge: true });
  toast("Horaires réels réinitialisés depuis le planifié.", "success");
}

// ═ Action : copier la semaine courante vers la semaine suivante ═
function duplicatePayrollToNextWeek() {
  const ws = getWeekStart(payrollWeekOffset);
  const weekNum = getISOWeek(new Date(ws.getTime() + 3 * 86400000));
  const nextWeekNum = weekNum + 1;

  // Vérifier si la source a au moins une donnée
  const hasSource = !!payrollWeekData &&
    (Object.keys(payrollWeekData.actualShifts || {}).length > 0
     || Object.keys(payrollWeekData.tipsByDay || {}).length > 0);
  if (!hasSource) {
    toast("La semaine actuelle est vide. Saisis au moins un horaire ou un pourboire avant de copier.", "warning");
    return;
  }

  // Vérifier la semaine suivante (lecture directe)
  const nextWs = new Date(ws); nextWs.setDate(nextWs.getDate() + 7);
  const nextWid = payrollWeekId(nextWs);

  db.collection("payroll").doc(nextWid).get().then(nextSnap => {
    const nextData = nextSnap.exists ? nextSnap.data() : null;
    const nextHasData = nextData && (
      Object.keys(nextData.actualShifts || {}).length > 0
      || Object.keys(nextData.tipsByDay || {}).length > 0
    );
    const action = () => doDuplicatePayrollToNextWeek(ws, nextWs, nextWid);
    if (nextHasData) {
      openConfirm(
        "Écraser la semaine suivante ?",
        `La semaine ${nextWeekNum} contient déjà des données. Les copier va les <strong>remplacer</strong>. Continuer ?`,
        action,
        true
      );
    } else {
      action();
    }
  });
}

async function doDuplicatePayrollToNextWeek(ws, nextWs, nextWid) {
  const curDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return dayKey(d);
  });
  const nextDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nextWs); d.setDate(d.getDate() + i); return dayKey(d);
  });

  // Remappe les clés de jour : "2026-04-29" → "2026-05-06" (même position dans la semaine)
  const remapByDay = (obj) => {
    const out = {};
    curDates.forEach((cur, i) => {
      if (obj[cur] !== undefined) out[nextDates[i]] = obj[cur];
    });
    return out;
  };

  const curShifts = payrollWeekData?.actualShifts || {};
  const newActualShifts = {};
  Object.keys(curShifts).forEach(empId => {
    const remapped = remapByDay(curShifts[empId]);
    if (Object.keys(remapped).length) newActualShifts[empId] = remapped;
  });

  const newTipsByDay = remapByDay(payrollWeekData?.tipsByDay || {});

  await db.collection("payroll").doc(nextWid).set({
    weekId: nextWid,
    weekStart: dayKey(nextWs),
    actualShifts: newActualShifts,
    tipsByDay: newTipsByDay,
    updatedAt: Date.now(),
    createdAt: Date.now()
  });

  // Naviguer vers la semaine suivante pour voir le résultat
  payrollWeekOffset += 1;
  subscribePayrollWeek();
  renderPage();
  toast(`Semaine copiée vers ${nextWid}.`, "success");
}
