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
// IDEMPOTENT : si on est déjà abonné à la même semaine, on ne fait rien.
// Sinon on détache l'ancien listener et on crée un nouveau.
// Critique : appelé depuis renderPage qui est lui-même déclenché par le
// snapshot du listener → sans cette idempotence on crée une boucle infinie
// de connexions Listen/channel vers Firestore (cf. bug v3.4.3).
function subscribePayrollWeek() {
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  // Déjà abonné à cette semaine → no-op (évite la boucle infinie)
  if (_payrollSubscribedWid === wid && typeof _payrollUnsub === "function") {
    return;
  }
  // Détacher l'ancien listener si on change de semaine
  if (typeof _payrollUnsub === "function") {
    try { _payrollUnsub(); } catch (_) {}
    _payrollUnsub = null;
  }
  payrollWeekData = null;
  _payrollSubscribedWid = wid;
  _payrollUnsub = db.collection("payroll").doc(wid).onSnapshot(snap => {
    payrollWeekData = snap.exists ? snap.data() : null;
    if (isLoggedIn && activePage === "salaires") renderPage();
  }, err => {
    console.error("payroll listener error:", err);
    toast("Erreur connexion paie : " + (err.message || err.code || err), "error", 5000);
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

  // ─ Pré-calcul des pools journaliers ──────────────
  // Pour chaque jour, on calcule le pool cuisine/service du jour ET le total
  // d'heures éligibles par groupe ce jour-là. Le pourboire de chaque employé
  // est ensuite calculé jour par jour (plus juste : un employé absent un
  // jour ne touche rien du pool de ce jour-là).
  const dailyCalc = weekDays.map((d, k) => {
    const dk = dayKey(d);
    const dowIdx = visibleIdx[k];
    const dayTotal = Number(tipsByDay[dk]) || 0;
    const poolKitchenDay = dayTotal * (Number(tipShares.cuisine) || 0);
    const poolServiceDay = dayTotal * (Number(tipShares.service) || 0);
    const serviceWin = getServiceWindow(dowIdx);
    let totalKitchenHrsDay = 0;
    let totalServiceHrsDay = 0;
    for (const emp of employees) {
      const shift = getActualShift(emp.id, dk);
      const tipHrs = serviceWin ? intersectShiftHours(shift, serviceWin) : 0;
      if (tipGroupOf(emp) === "cuisine") totalKitchenHrsDay += tipHrs;
      else totalServiceHrsDay += tipHrs;
    }
    return { dk, dowIdx, serviceWin, dayTotal, poolKitchenDay, poolServiceDay, totalKitchenHrsDay, totalServiceHrsDay };
  });

  // ─ Calculs par employé ────────────────────────────
  const empRows = employees.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = tipGroupOf(emp);

    let totalHours = 0;
    let plannedHours = 0;
    let tipEligibleHours = 0;
    let tipShare = 0;
    const daily = weekDays.map((d, k) => {
      const dk = dayKey(d);
      const dowIdx = visibleIdx[k];
      const actualShift = getActualShift(emp.id, dk);
      const plannedShift = getPlannedShift(emp.id, dk);
      const serviceWin = dailyCalc[k].serviceWin;
      const hours = hoursFromShift(actualShift);
      const pHours = hoursFromShift(plannedShift);
      const tipHours = serviceWin ? intersectShiftHours(actualShift, serviceWin) : 0;
      const isOverride = hasActualOverride(emp.id, dk);
      const isDifferent = isOverride && !sameShift(actualShift, plannedShift);

      // Pourboire du jour pour cet employé (prorata journalier)
      const groupPool = group === "cuisine" ? dailyCalc[k].poolKitchenDay : dailyCalc[k].poolServiceDay;
      const groupTotalHrs = group === "cuisine" ? dailyCalc[k].totalKitchenHrsDay : dailyCalc[k].totalServiceHrsDay;
      const dayTip = (groupTotalHrs > 0 && tipHours > 0) ? (tipHours / groupTotalHrs) * groupPool : 0;

      totalHours += hours;
      plannedHours += pHours;
      tipEligibleHours += tipHours;
      tipShare += dayTip;
      return { dk, dowIdx, actualShift, plannedShift, hours, pHours, tipHours, dayTip, isOverride, isDifferent };
    });

    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    const gap = totalHours - plannedHours;
    const totalPay = grossWage + tipShare;
    return { emp, rate, isSal, fixedHours, group, daily, totalHours, plannedHours, gap, tipEligibleHours, tipShare, grossWage, totalPay };
  });

  // Totaux par groupe pour les hints des pools (somme des heures de la semaine)
  const totalCuisineHrs = empRows.filter(r => r.group === "cuisine").reduce((s, r) => s + r.tipEligibleHours, 0);
  const totalServiceHrs = empRows.filter(r => r.group === "service").reduce((s, r) => s + r.tipEligibleHours, 0);

  const sumGross = empRows.reduce((s, r) => s + r.grossWage, 0);
  const sumTips = empRows.reduce((s, r) => s + r.tipShare, 0);
  const sumTotal = empRows.reduce((s, r) => s + r.totalPay, 0);
  const sumActualHours = empRows.reduce((s, r) => s + r.totalHours, 0);
  const sumPlannedHours = empRows.reduce((s, r) => s + r.plannedHours, 0);

  // ─ Ratio salaires/ventes (utilise actualSales saisis dans Horaires) ─
  const actualSales = scheduleSettings.actualSales || {};
  const weekSales = weekDays.reduce((sum, d) => sum + (Number(actualSales[dayKey(d)]) || 0), 0);
  const salesRatio = weekSales > 0 ? (sumGross / weekSales) : 0;
  // Couleur du ratio : vert < 32%, jaune 32-40%, rouge > 40% (cibles typiques restaurant)
  const ratioCls = salesRatio === 0 ? "is-empty"
    : salesRatio < 0.32 ? "is-good"
    : salesRatio < 0.40 ? "is-warn"
    : "is-bad";

  // État verrouillage de la semaine
  const isLocked = !!payrollWeekData?.locked;

  // ─ HTML ───────────────────────────────────────────
  return `<div class="page ${isLocked ? "is-payroll-locked" : ""}">
    <div class="toolbar">
      <h2 class="page-title">${icon("dollar-sign", 22)} Salaires & Pourboires${isLocked ? ` <span class="payroll-locked-inline-badge">${icon("shield-check", 14)} Payée</span>` : ""}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="openServiceHoursModal()" title="Configurer les heures d'ouverture du service">${icon("clock", 14)} Heures de service</button>
        <button class="btn-secondary btn-sm" onclick="openTipSharesModal()" title="Modifier la répartition cuisine / service des pourboires">${icon("percent", 14)} Répartition</button>
      </div>
    </div>

    ${employees.length === 0 ? `
      <div class="empty"><div class="empty-state-icon">${icon("users", 36)}</div>Aucun employé enregistré. Ajoutez-en un dans Employés & Horaires pour commencer.</div>
    ` : `
      <!-- ══ Bannière d'info : auto-import du planifié ══ -->
      <div class="payroll-info-banner">
        ${icon("calendar", 16)}
        <div>
          <strong>Horaire planifié importé automatiquement</strong> depuis Employés & Horaires.
          Les valeurs s'actualisent à chaque modification du planifié. Modifie ici uniquement les <strong>écarts réels</strong> (employé arrivé tard, parti tôt, etc.) — tes ajustements sont sauvegardés sans toucher au planning d'origine.
        </div>
      </div>

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
          ${isLocked
            ? `<span class="payroll-locked-badge" title="Semaine verrouillée — édition bloquée">${icon("shield-check", 14)} Verrouillée</span>
               <button class="btn-secondary btn-sm" onclick="unlockPayrollWeek()" title="Permet à nouveau d'éditer cette semaine">${icon("refresh", 14)} Déverrouiller</button>`
            : `${(() => {
                 const shiftOverrides = Object.keys(payrollWeekData?.actualShifts || {}).reduce((sum, empId) => sum + Object.keys(payrollWeekData.actualShifts[empId] || {}).length, 0);
                 const tipDaysCount = Object.keys(payrollWeekData?.tipsByDay || {}).length;
                 const totalCount = shiftOverrides + tipDaysCount;
                 return `<button class="btn-secondary btn-sm" onclick="resetActualFromPlanned()" title="Effacer toutes tes saisies de la semaine (heures + pourboires). Le planning planifié n'est pas touché." ${totalCount === 0 ? "disabled" : ""}>${icon("refresh", 14)} Annuler mes saisies${totalCount > 0 ? ` <span class="payroll-modif-count">${totalCount}</span>` : ""}</button>`;
               })()}
               <button class="btn btn-primary btn-sm" onclick="lockPayrollWeek()" title="Verrouiller cette semaine et créer la dépense Salaires">${icon("shield-check", 14)} Verrouiller & payer</button>`}
        </div>
      </div>

      <!-- ══ Carte ratio salaires/ventes (utilise les ventes réelles d'Horaires) ══ -->
      <div class="card payroll-ratio-card payroll-ratio-card--${ratioCls}">
        <div class="payroll-ratio-head">
          <div>
            <h3 class="payroll-service-title">${icon("trending-up", 16)} Ratio salaires / ventes</h3>
            <div class="payroll-service-sub">
              ${weekSales > 0
                ? `Salaires bruts <strong>${fmtMoney(sumGross)}</strong> ÷ Ventes <strong>${fmtMoney(weekSales)}</strong>`
                : `Saisis les ventes réelles de la semaine dans <strong>Employés & Horaires</strong> pour voir le ratio`}
            </div>
          </div>
          <div class="payroll-ratio-value">
            ${weekSales > 0
              ? `<div class="payroll-ratio-pct">${(salesRatio * 100).toFixed(1)}<small>%</small></div>
                 <div class="payroll-ratio-target" title="Cible typique resto : < 32%">${salesRatio < 0.32 ? "✓ Sous la cible" : salesRatio < 0.40 ? "⚠ Au-dessus" : "⚠ Critique"}</div>`
              : `<div class="payroll-ratio-pct payroll-ratio-pct--empty">—</div>`}
          </div>
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
              <th class="schedule-th--summary payroll-th-tip" title="Pourboire total de la semaine">Pourboire (sem.)</th>
              <th class="schedule-th--summary">Total à payer</th>
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
                  // Pourboire du jour pour cet employé
                  const dayTipHint = d.dayTip > 0
                    ? `<div class="payroll-day-tip" title="Pourboire reçu ce jour (prorata)">${icon("dollar-sign", 9)} ${fmtMoney(d.dayTip)}</div>`
                    : "";
                  // Trois états visuels possibles :
                  // 1. d.isOverride && d.isDifferent → modifié manuellement (cellule jaune)
                  // 2. d.isOverride && !d.isDifferent → confirmé identique au planifié
                  // 3. !d.isOverride && d.plannedShift → hérité automatique du planifié
                  const isAutoFromPlanned = !d.isOverride && d.plannedShift && d.plannedShift.start;
                  const plannedHint = (d.plannedShift && d.plannedShift.start && d.plannedShift.end && d.isDifferent)
                    ? `<div class="payroll-planned-hint" title="Heure planifiée originale">${icon("calendar", 9)} Planifié : ${d.plannedShift.start}→${d.plannedShift.end}</div>`
                    : isAutoFromPlanned
                      ? `<div class="payroll-planned-hint payroll-planned-hint--auto" title="Importé automatiquement depuis Employés & Horaires">${icon("calendar", 9)} Auto-importé</div>`
                      : "";
                  const cellClasses = `schedule-td--cell payroll-td-cell ${filled ? "is-filled" : ""} ${d.isDifferent ? "is-modified" : ""} ${isAutoFromPlanned ? "is-auto" : ""}`;
                  return `<td class="${cellClasses}">
                    <input type="time" class="payroll-time-input" value="${startVal}" onchange="updateActualShift('${row.emp.id}','${d.dk}','start',this.value)" aria-label="${empName}, entrée réelle ${dayName}"/>
                  </td>
                  <td class="${cellClasses}">
                    <input type="time" class="payroll-time-input" value="${endVal}" onchange="updateActualShift('${row.emp.id}','${d.dk}','end',this.value)" aria-label="${empName}, sortie réelle ${dayName}"/>
                    ${tipHint}
                    ${dayTipHint}
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
                <td class="schedule-td--summary payroll-td-tip ${row.tipShare > 0 ? "has-tip" : ""}">
                  ${row.tipShare > 0
                    ? `<div class="payroll-tip-amount">${fmtMoney(row.tipShare)}</div>
                       <div class="payroll-tip-hours" title="Heures éligibles aux pourboires">${fmtHours(row.tipEligibleHours)}h ★</div>`
                    : "—"}
                </td>
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

      <!-- ══ Récap pourboires par employé (visible sans scroll horizontal) ══ -->
      <div class="card payroll-recap-card">
        <div class="payroll-recap-head">
          <h3 class="payroll-service-title">${icon("dollar-sign", 16)} Pourboires de la semaine par employé</h3>
          <div class="payroll-service-sub">Total au prorata des heures travaillées dans la fenêtre de service · Cuisine ${(tipShares.cuisine*100).toFixed(0)}% / Service+Admin ${(tipShares.service*100).toFixed(0)}%</div>
        </div>
        ${empRows.filter(r => r.tipEligibleHours > 0 || r.tipShare > 0).length === 0
          ? `<div class="empty" style="margin:var(--sp-4) 0">${icon("info", 24)}<br/>Saisis les heures réelles + un montant de pourboire par jour pour voir la répartition.</div>`
          : `<div class="payroll-recap-grid">
              ${empRows.map(row => {
                const isKitchen = row.group === "cuisine";
                const groupLabel = isKitchen ? "Cuisine" : "Service + Admin";
                const groupIcon = isKitchen ? "utensils" : "users";
                return `<div class="payroll-recap-card-emp ${isKitchen ? "is-kitchen" : "is-service"}">
                  <div class="payroll-recap-emp-name">${esc(row.emp.name || "")}</div>
                  <div class="payroll-recap-emp-group">${icon(groupIcon, 11)} ${groupLabel}</div>
                  <div class="payroll-recap-emp-amount">${fmtMoney(row.tipShare)}</div>
                  <div class="payroll-recap-emp-meta">
                    ${fmtHours(row.tipEligibleHours)}h éligibles · ${fmtHours(row.totalHours)}h travaillées
                  </div>
                </div>`;
              }).join("")}
            </div>
            <div class="payroll-recap-total">
              <span>${icon("dollar-sign", 14)} Total redistribué</span>
              <strong>${fmtMoney(sumTips)}</strong>
            </div>`}
      </div>

      <p class="payroll-legend">
        ${icon("info", 12)}
        <strong>Légende des cellules :</strong>
        <span class="payroll-legend-item"><span class="payroll-legend-swatch payroll-legend-swatch--auto"></span> Bleu pâle = importé du planifié</span>
        <span class="payroll-legend-item"><span class="payroll-legend-swatch payroll-legend-swatch--modified"></span> Jaune = modifié manuellement</span>
        <span class="payroll-legend-item">★ = heures éligibles aux pourboires (dans la fenêtre de service)</span>
      </p>
    `}
  </div>`;
}

// ═ Actions Firestore ════════════════════════════════════
// Toutes les écritures utilisent `set merge` avec objets imbriqués
// → Firestore fait un deep merge automatique des sous-clés
// → pour les suppressions, on utilise firebase.firestore.FieldValue.delete()
// → try/catch + toast pour rendre les erreurs visibles à l'utilisateur

// Met à jour un champ (start ou end) d'un shift réel pour la semaine courante.
// Si la valeur est vide, on stocke "" — pas une suppression complète du shift,
// car l'utilisateur peut vouloir saisir start avant end.
async function updateActualShift(empId, dk, field, value) {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    // Deep merge : seul le champ ciblé est mis à jour, les autres restent intacts
    const update = {
      weekId: wid,
      weekStart: dayKey(ws),
      updatedAt: Date.now(),
      actualShifts: {
        [empId]: {
          [dk]: {
            [field]: value || ""
          }
        }
      }
    };
    await ref.set(update, { merge: true });
  } catch (err) {
    console.error("updateActualShift failed:", err);
    toast("Erreur sauvegarde horaire : " + (err.message || err.code || err), "error", 5000);
  }
}

// Efface complètement le shift d'un employé pour un jour (les deux champs)
async function clearActualShift(empId, dk) {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    await ref.set({
      weekId: wid,
      weekStart: dayKey(ws),
      updatedAt: Date.now(),
      actualShifts: {
        [empId]: {
          [dk]: firebase.firestore.FieldValue.delete()
        }
      }
    }, { merge: true });
  } catch (err) {
    console.error("clearActualShift failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// Met à jour le pourboire reçu pour un jour donné.
// Si valeur vide ou <= 0 → suppression du jour (FieldValue.delete).
async function updateTipForDay(dk, value) {
  try {
    const v = Number(value);
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    const tipValue = (!value || isNaN(v) || v <= 0)
      ? firebase.firestore.FieldValue.delete()
      : v;
    await ref.set({
      weekId: wid,
      weekStart: dayKey(ws),
      updatedAt: Date.now(),
      tipsByDay: {
        [dk]: tipValue
      }
    }, { merge: true });
  } catch (err) {
    console.error("updateTipForDay failed:", err);
    toast("Erreur sauvegarde pourboire : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Modale : configurer les heures de service (config globale) ═
// Affiche les 7 jours avec un état Ouvert/Fermé clair + inputs heure début/fin.
// Les jours marqués fermés via Horaires (scheduleSettings.openDays) sont indiqués
// pour cohérence visuelle, mais on permet quand même de configurer (l'utilisateur
// peut vouloir préparer la config pour quand il rouvrira).
function openServiceHoursModal() {
  const cur = payrollSettings?.defaultServiceHours || {};
  const dayNamesLong = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];

  showModal(`<div class="modal" style="max-width:560px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} Heures de service</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Fenêtre où le restaurant <strong>sert les clients</strong> — c'est là que les pourboires sont gagnés.
      Coche un jour pour l'activer et choisis ses heures.
    </p>
    <div class="payroll-svc-modal-grid">
      ${[0,1,2,3,4,5,6].map(i => {
        const win = cur[i] || {};
        const startVal = win.start || "";
        const endVal = win.end || "";
        const isOpen = !!(startVal && endVal);
        const isOpenInSchedule = openDays.includes(i);
        const closedHint = !isOpenInSchedule ? `<span class="payroll-svc-modal-hint">(fermé dans Horaires)</span>` : "";
        return `<div class="payroll-svc-modal-row ${isOpen ? "is-open" : ""}" data-day="${i}">
          <label class="payroll-svc-modal-toggle">
            <input type="checkbox" id="svc-${i}-toggle" ${isOpen ? "checked" : ""} onchange="toggleServiceDay(${i}, this.checked)"/>
            <span class="payroll-svc-modal-day">${dayNamesLong[i]}</span>
            ${closedHint}
          </label>
          <div class="payroll-svc-modal-inputs" id="svc-${i}-inputs" style="display:${isOpen ? "flex" : "none"}">
            <input id="svc-${i}-start" type="time" value="${startVal || "13:00"}" aria-label="${dayNamesLong[i]} début"/>
            <span>→</span>
            <input id="svc-${i}-end" type="time" value="${endVal || "22:00"}" aria-label="${dayNamesLong[i]} fin"/>
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

// Active/désactive un jour : montre/cache les inputs et bascule l'état "is-open"
function toggleServiceDay(i, checked) {
  const inputs = document.getElementById(`svc-${i}-inputs`);
  const row = document.querySelector(`.payroll-svc-modal-row[data-day="${i}"]`);
  if (inputs) inputs.style.display = checked ? "flex" : "none";
  if (row) row.classList.toggle("is-open", checked);
}

async function saveServiceHours() {
  try {
    const next = {};
    for (let i = 0; i < 7; i++) {
      const toggleEl = document.getElementById(`svc-${i}-toggle`);
      const isChecked = !!(toggleEl && toggleEl.checked);
      if (!isChecked) continue;
      const start = document.getElementById(`svc-${i}-start`)?.value || "";
      const end = document.getElementById(`svc-${i}-end`)?.value || "";
      if (start && end) {
        next[i] = { start, end };
      }
    }
    // ⚠ Set sans merge sur defaultServiceHours pour REMPLACER complètement
    // (sinon les jours retirés resteraient car deep merge préserve les sous-clés).
    // On préserve tipShares en le réécrivant explicitement avec la valeur courante.
    const currentShares = payrollSettings?.tipShares || { cuisine: 0.25, service: 0.75 };
    await db.collection("settings").doc("payroll").set({
      tipShares: currentShares,
      defaultServiceHours: next,
      updatedAt: Date.now()
    });
    closeModal();
    toast("Heures de service enregistrées.", "success");
  } catch (err) {
    console.error("saveServiceHours failed:", err);
    toast("Erreur sauvegarde : " + (err.message || err.code || err), "error", 5000);
  }
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
  try {
    const cuisinePct = Number(document.getElementById("tip-cuisine-pct").value);
    const servicePct = Number(document.getElementById("tip-service-pct").value);
    if (isNaN(cuisinePct) || isNaN(servicePct) || cuisinePct < 0 || servicePct < 0) {
      return toast("Pourcentages invalides.", "error");
    }
    if (Math.abs(cuisinePct + servicePct - 100) > 0.5) {
      return toast("La somme doit être 100% (cuisine + service).", "error");
    }
    await db.collection("settings").doc("payroll").set({
      tipShares: { cuisine: cuisinePct / 100, service: servicePct / 100 },
      updatedAt: Date.now()
    }, { merge: true });
    closeModal();
    toast("Répartition enregistrée.", "success");
  } catch (err) {
    console.error("saveTipShares failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Action : effacer toutes les modifications manuelles et repartir du planifié ═
// Comme le planifié s'auto-importe quand il n'y a pas d'override, il suffit
// de supprimer entièrement actualShifts pour que les valeurs viennent à
// nouveau du planning d'origine (Employés & Horaires).
function resetActualFromPlanned() {
  const shiftOverrides = Object.keys(payrollWeekData?.actualShifts || {}).reduce(
    (sum, empId) => sum + Object.keys(payrollWeekData.actualShifts[empId] || {}).length, 0
  );
  const tipDaysCount = Object.keys(payrollWeekData?.tipsByDay || {}).length;
  const totalCount = shiftOverrides + tipDaysCount;

  if (totalCount === 0) {
    toast(
      "Aucune saisie à effacer. Les heures que tu vois viennent du planning planifié (page Employés & Horaires) — elles s'importent automatiquement.",
      "info",
      6000
    );
    return;
  }

  // Détail à afficher dans la confirmation
  const parts = [];
  if (shiftOverrides > 0) parts.push(`<strong>${shiftOverrides}</strong> ajustement${shiftOverrides > 1 ? "s" : ""} d'horaire`);
  if (tipDaysCount > 0) parts.push(`<strong>${tipDaysCount}</strong> jour${tipDaysCount > 1 ? "s" : ""} de pourboires saisis`);
  const detailLine = parts.join(" + ");

  openConfirm(
    "Annuler toutes les saisies de la semaine ?",
    `Cela va effacer ${detailLine} pour cette semaine.<br><br>
     ✓ Les heures repartiront automatiquement du <strong>planning planifié</strong> (Employés & Horaires).<br>
     ✓ Les pourboires journaliers seront <strong>remis à zéro</strong>.<br>
     ✓ Le <strong>planning planifié reste intact</strong> — il n'est jamais modifié depuis cette page.<br><br>
     Continuer ?`,
    doResetActualFromPlanned,
    true
  );
}

async function doResetActualFromPlanned() {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    // Effacer entièrement actualShifts ET tipsByDay
    // → les heures repassent sur le planifié via getActualShift (auto-import)
    // → les pourboires journaliers sont supprimés
    await db.collection("payroll").doc(wid).set({
      weekId: wid,
      weekStart: dayKey(ws),
      actualShifts: firebase.firestore.FieldValue.delete(),
      tipsByDay: firebase.firestore.FieldValue.delete(),
      // Nettoyer aussi l'éventuel ancien champ totalTips (rétrocompat)
      totalTips: firebase.firestore.FieldValue.delete(),
      updatedAt: Date.now()
    }, { merge: true });
    toast("Saisies effacées — heures repartent du planifié, pourboires remis à zéro.", "success", 4000);
  } catch (err) {
    console.error("doResetActualFromPlanned failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═ Verrouillage de la semaine + création auto de la dépense Salaires ═
// Calcule le sumGross actuel (sans pourboires — ceux-ci viennent des clients,
// pas une dépense employeur). Crée un doc dans /expenses lié à la semaine.
function _computeWeekGrossWage() {
  const weekStart = getWeekStart(payrollWeekOffset);
  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });

  let sumGross = 0;
  for (const emp of employees) {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    if (isSal) {
      sumGross += fixedHours * rate;
    } else {
      let totalHours = 0;
      for (const d of weekDays) {
        totalHours += hoursFromShift(getActualShift(emp.id, dayKey(d)));
      }
      sumGross += totalHours * rate;
    }
  }
  return { sumGross, weekStart, weekEnd: weekDays[weekDays.length - 1] || weekStart };
}

// Verrouille la semaine : crée la dépense Salaires + bloque les édits
function lockPayrollWeek() {
  const { sumGross, weekStart, weekEnd } = _computeWeekGrossWage();
  if (sumGross <= 0) {
    toast("Aucun salaire à verrouiller (le total est 0$). Saisis d'abord les heures.", "warning");
    return;
  }
  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));
  const startLabel = weekStart.toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" });
  openConfirm(
    "Verrouiller cette semaine ?",
    `Cette action va :<br>
     • Créer une dépense « <strong>Salaires sem. ${weekNum}</strong> » de <strong>${fmtMoney(sumGross)}</strong> dans Dépenses & Revenus<br>
     • <strong>Bloquer les modifications</strong> sur cette semaine de paie<br><br>
     Tu pourras déverrouiller plus tard si nécessaire. Continuer ?`,
    () => doLockPayrollWeek(sumGross, weekStart, weekEnd, weekNum, startLabel, endLabel),
    false
  );
}

async function doLockPayrollWeek(sumGross, weekStart, weekEnd, weekNum, startLabel, endLabel) {
  try {
    const wid = payrollWeekId(weekStart);
    const expenseRef = db.collection("expenses").doc();
    const description = `Salaires sem. ${weekNum} (${startLabel} – ${endLabel})`;

    // Date de la dépense : dimanche (fin de semaine)
    const expenseDate = dayKey(weekEnd);

    await expenseRef.set({
      id: expenseRef.id,
      description,
      supplier: "",
      amount: Number(sumGross.toFixed(2)),
      tps: 0,
      tvq: 0,
      date: expenseDate,
      category: "Salaires",
      type: "fixe",
      notes: `Auto-créé depuis Salaires & Pourboires (verrouillage paie semaine ${weekNum}). Modifie ici si tu ajustes le montant.`,
      payrollWeekId: wid,
      isFixedAuto: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    await db.collection("payroll").doc(wid).set({
      weekId: wid,
      weekStart: dayKey(weekStart),
      locked: true,
      lockedAt: Date.now(),
      lockedAmount: Number(sumGross.toFixed(2)),
      expenseId: expenseRef.id,
      updatedAt: Date.now()
    }, { merge: true });

    await addLog("—", "Paie verrouillée", `Semaine ${weekNum} · ${fmtMoney(sumGross)} → dépense ${expenseRef.id}`);
    toast(`Semaine ${weekNum} verrouillée. Dépense « ${description} » créée.`, "success", 5000);
  } catch (err) {
    console.error("doLockPayrollWeek failed:", err);
    toast("Erreur verrouillage : " + (err.message || err.code || err), "error", 5000);
  }
}

// Déverrouille la semaine : supprime la dépense liée + débloque les édits
function unlockPayrollWeek() {
  if (!payrollWeekData?.locked) {
    toast("Cette semaine n'est pas verrouillée.", "info");
    return;
  }
  const lockedAmount = payrollWeekData.lockedAmount || 0;
  openConfirm(
    "Déverrouiller cette semaine ?",
    `Cela va :<br>
     • <strong>Supprimer</strong> la dépense Salaires liée (${fmtMoney(lockedAmount)}) de Dépenses & Revenus<br>
     • Permettre à nouveau de modifier les heures et pourboires<br><br>
     Continuer ?`,
    doUnlockPayrollWeek,
    true
  );
}

async function doUnlockPayrollWeek() {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const expenseId = payrollWeekData?.expenseId;

    if (expenseId) {
      try {
        await db.collection("expenses").doc(expenseId).delete();
      } catch (delErr) {
        // Si la dépense a déjà été supprimée manuellement, on continue quand même
        console.warn("Dépense déjà supprimée ?", delErr);
      }
    }

    await db.collection("payroll").doc(wid).set({
      weekId: wid,
      weekStart: dayKey(ws),
      locked: false,
      lockedAt: firebase.firestore.FieldValue.delete(),
      lockedAmount: firebase.firestore.FieldValue.delete(),
      expenseId: firebase.firestore.FieldValue.delete(),
      updatedAt: Date.now()
    }, { merge: true });

    const weekNum = getISOWeek(new Date(ws.getTime() + 3 * 86400000));
    await addLog("—", "Paie déverrouillée", `Semaine ${weekNum} · dépense supprimée`);
    toast(`Semaine ${weekNum} déverrouillée.`, "success");
  } catch (err) {
    console.error("doUnlockPayrollWeek failed:", err);
    toast("Erreur déverrouillage : " + (err.message || err.code || err), "error", 5000);
  }
}
