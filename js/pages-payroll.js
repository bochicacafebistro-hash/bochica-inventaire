// ═══════════════════════════════════════════════════════════════
// SALAIRES & POURBOIRES — page de paie hebdomadaire
// ───────────────────────────────────────────────────────────────
// Permet de saisir les heures RÉELLES travaillées par chaque employé
// (qui peuvent différer de l'horaire planifié) et de calculer salaires
// + répartition au prorata des pourboires selon les heures effectuées
// pendant les heures de service du restaurant.
//
// Règles métier :
//   • Cuisine (section="cuisine") = 25% du pool de pourboires
//   • Service + Autre (section="service" ou "other") = 75% du pool
//   • Le prorata se fait sur les heures dans la fenêtre de service
//     du jour (ex: 13h–22h), pas sur les heures totales (ménage avant/après
//     n'est pas comptabilisé pour les pourboires mais l'est pour le salaire).
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
  // Aligner les fenêtres sur la même journée logique
  // (si l'une commence après minuit, on translate)
  const start = Math.max(sStart, wStart);
  const end = Math.min(sEnd, wEnd);
  return Math.max(0, end - start);
}

// Récupère le shift réel d'un employé pour un jour donné.
// Tombe en fallback sur le planifié si pas encore de doc payroll pour cette semaine.
function getActualShift(empId, dk) {
  const actual = (payrollWeekData?.actualShifts || {})[empId];
  if (actual && actual[dk]) return actual[dk];
  // Fallback : copie du planifié
  const emp = employees.find(e => e.id === empId);
  if (!emp) return null;
  return (emp.shifts || {})[dk] || null;
}

// Récupère la fenêtre de service pour un jour donné.
// Cherche dans le doc semaine, sinon dans defaultServiceHours, sinon null (= jour fermé).
function getServiceWindow(dk, dayOfWeekIdx) {
  const direct = (payrollWeekData?.serviceHours || {})[dk];
  if (direct && direct.start && direct.end) return direct;
  if (direct && direct.closed) return null;
  // Fallback : valeur par défaut pour ce jour de la semaine
  const def = (payrollSettings?.defaultServiceHours || {})[dayOfWeekIdx];
  if (def && def.start && def.end) return def;
  return null;
}

// Section "tipGroup" d'un employé : "cuisine" ou "service".
// Les sections "service" ET "other" partagent le même pool 75%.
function tipGroupOf(emp) {
  return (emp.section || "service") === "cuisine" ? "cuisine" : "service";
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
// Appelé à chaque changement d'offset de semaine
function subscribePayrollWeek() {
  if (typeof _payrollUnsub === "function") {
    try { _payrollUnsub(); } catch (_) {}
  }
  // Réinitialiser pour éviter d'afficher brièvement les données de la semaine précédente
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
  const totalTips = Number(payrollWeekData?.totalTips) || 0;
  const poolCuisine = totalTips * (Number(tipShares.cuisine) || 0);
  const poolService = totalTips * (Number(tipShares.service) || 0);

  // ─ Calculs par employé ────────────────────────────
  const empRows = employees.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = tipGroupOf(emp);

    let totalHours = 0;
    let tipEligibleHours = 0;
    const daily = weekDays.map((d, k) => {
      const dk = dayKey(d);
      const dowIdx = visibleIdx[k];
      const shift = getActualShift(emp.id, dk);
      const serviceWin = getServiceWindow(dk, dowIdx);
      const hours = hoursFromShift(shift);
      const tipHours = serviceWin ? intersectShiftHours(shift, serviceWin) : 0;
      totalHours += hours;
      tipEligibleHours += tipHours;
      return { dk, dowIdx, shift, hours, tipHours };
    });

    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    return { emp, rate, isSal, fixedHours, group, daily, totalHours, tipEligibleHours, grossWage };
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

  // ─ HTML ───────────────────────────────────────────
  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("dollar-sign", 22)} Salaires & Pourboires</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="openTipSharesModal()" title="Répartition cuisine/service">${icon("percent", 14)} Répartition</button>
        <button class="btn-secondary btn-sm" onclick="resetActualFromPlanned()" title="Réinitialiser les heures réelles depuis l'horaire planifié">${icon("refresh", 14)} Reprendre du planifié</button>
      </div>
    </div>

    ${employees.length === 0 ? `
      <div class="empty"><div class="empty-state-icon">${icon("users", 36)}</div>Aucun employé enregistré. Ajoutez-en un dans Employés & Horaires pour commencer.</div>
    ` : `
      <!-- ══ Sélecteur de semaine ══ -->
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
      </div>

      <!-- ══ Heures de service du resto (par jour) ══ -->
      <div class="card payroll-service-card">
        <div class="payroll-service-head">
          <div>
            <h3 class="payroll-service-title">${icon("clock", 16)} Heures de service</h3>
            <div class="payroll-service-sub">Fenêtre où les pourboires sont gagnés (avant/après n'entre pas dans le prorata)</div>
          </div>
        </div>
        <div class="payroll-service-grid">
          ${weekDays.map((d, k) => {
            const dk = dayKey(d);
            const dowIdx = visibleIdx[k];
            const win = getServiceWindow(dk, dowIdx);
            const startVal = win?.start || "";
            const endVal = win?.end || "";
            return `<div class="payroll-service-day ${win ? "is-open" : "is-closed"}">
              <div class="payroll-service-day__name">${DAYS_FR[dowIdx]} <span class="payroll-service-day__date">${d.getDate()}/${d.getMonth() + 1}</span></div>
              <div class="payroll-service-day__inputs">
                <select class="schedule-time" aria-label="Début service ${DAYS_FR[dowIdx]}" onchange="updateServiceWindow('${dk}','start',this.value)">${buildTimeOptions(startVal)}</select>
                <span class="payroll-service-day__sep">→</span>
                <select class="schedule-time" aria-label="Fin service ${DAYS_FR[dowIdx]}" onchange="updateServiceWindow('${dk}','end',this.value)">${buildTimeOptions(endVal)}</select>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>

      <!-- ══ Total des pourboires de la semaine ══ -->
      <div class="card payroll-tips-card">
        <div class="payroll-tips-head">
          <div>
            <h3 class="payroll-service-title">${icon("dollar-sign", 16)} Pourboires de la semaine</h3>
            <div class="payroll-service-sub">Cuisine ${(tipShares.cuisine * 100).toFixed(0)}% · Service + Admin ${(tipShares.service * 100).toFixed(0)}%</div>
          </div>
          <div class="payroll-tips-input">
            <label for="payroll-total-tips">Total reçu</label>
            <input id="payroll-total-tips" type="number" min="0" step="0.01" placeholder="0.00" value="${totalTips || ""}" onchange="updateTotalTips(this.value)" />
            <span class="payroll-tips-input__currency">$</span>
          </div>
        </div>
        <div class="payroll-tips-pools">
          <div class="payroll-tips-pool payroll-tips-pool--kitchen">
            <div class="payroll-tips-pool__label">${icon("utensils", 12)} Pool Cuisine</div>
            <div class="payroll-tips-pool__amount">${fmtMoney(poolCuisine)}</div>
            <div class="payroll-tips-pool__hint">${fmtHours(totalCuisineHrs)}h éligibles</div>
          </div>
          <div class="payroll-tips-pool payroll-tips-pool--service">
            <div class="payroll-tips-pool__label">${icon("users", 12)} Pool Service + Admin</div>
            <div class="payroll-tips-pool__amount">${fmtMoney(poolService)}</div>
            <div class="payroll-tips-pool__hint">${fmtHours(totalServiceHrs)}h éligibles</div>
          </div>
        </div>
      </div>

      <!-- ══ Tableau heures réelles + salaires + pourboires ══ -->
      <div class="card payroll-table-wrap" style="padding:0;overflow-x:auto">
        <table class="schedule-table payroll-table">
          <thead>
            <tr>
              <th class="schedule-th--emp">Employé</th>
              ${weekDays.map((d, k) => `<th class="schedule-th--day" colspan="2">
                <div class="schedule-day-name">${DAYS_FR[visibleIdx[k]]}</div>
                <div class="schedule-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              </th>`).join("")}
              <th class="schedule-th--summary">Heures</th>
              <th class="schedule-th--summary">Salaire</th>
              <th class="schedule-th--summary">Pourboire</th>
              <th class="schedule-th--summary">Total</th>
            </tr>
            <tr class="schedule-subheader">
              <th></th>
              ${weekDays.map(() => `<th class="schedule-th--entry">Entr</th><th class="schedule-th--exit">Sort</th>`).join("")}
              <th></th><th></th><th></th><th></th>
            </tr>
          </thead>
          <tbody>
            ${empRows.map(row => {
              const empSection = row.emp.section || "service";
              const groupBadge = row.group === "cuisine"
                ? `<span class="payroll-group-badge payroll-group-badge--kitchen" title="Pool cuisine ${(tipShares.cuisine*100).toFixed(0)}%">${icon("utensils", 10)} 25%</span>`
                : `<span class="payroll-group-badge payroll-group-badge--service" title="Pool service ${(tipShares.service*100).toFixed(0)}%">${icon("users", 10)} 75%</span>`;
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
                  const filled = d.shift && d.shift.start && d.shift.end;
                  const startVal = d.shift?.start || "";
                  const endVal = d.shift?.end || "";
                  const empName = esc(row.emp.name || "");
                  const dayName = DAYS_FR[visibleIdx[k]];
                  const tipBadge = (d.tipHours > 0 && d.tipHours < d.hours)
                    ? ` <span class="payroll-tip-hint" title="${fmtHours(d.tipHours)}h dans la fenêtre service">★${fmtHours(d.tipHours)}</span>`
                    : "";
                  return `<td class="schedule-td--cell ${filled ? "is-filled" : ""}">
                    <select class="schedule-time" onchange="updateActualShift('${row.emp.id}','${d.dk}','start',this.value)" aria-label="${empName}, entrée réelle ${dayName}">${buildTimeOptions(startVal)}</select>
                  </td>
                  <td class="schedule-td--cell ${filled ? "is-filled" : ""}">
                    <select class="schedule-time" onchange="updateActualShift('${row.emp.id}','${d.dk}','end',this.value)" aria-label="${empName}, sortie réelle ${dayName}">${buildTimeOptions(endVal)}</select>
                    ${tipBadge}
                  </td>`;
                }).join("")}
                <td class="schedule-td--summary">
                  ${row.totalHours ? fmtHours(row.totalHours) : ""}
                  ${row.tipEligibleHours > 0 && row.tipEligibleHours !== row.totalHours
                    ? `<div class="schedule-fixed-hint" title="Heures éligibles aux pourboires">★ ${fmtHours(row.tipEligibleHours)}h</div>`
                    : ""}
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
              <td class="schedule-tfoot-val">${fmtHours(empRows.reduce((s, r) => s + r.totalHours, 0))} h</td>
              <td class="schedule-tfoot-val">${fmtMoney(sumGross)}</td>
              <td class="schedule-tfoot-val">${fmtMoney(sumTips)}</td>
              <td class="schedule-tfoot-val schedule-td--total">${fmtMoney(sumTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p class="payroll-legend">
        ${icon("info", 12)} L'horaire affiché est <strong>indépendant</strong> de l'horaire planifié dans Employés & Horaires.
        Modifiez les heures réelles ici pour refléter ce qui s'est passé. Le badge ★ indique les heures éligibles aux pourboires (dans la fenêtre de service).
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

  // Lecture du doc actuel pour merge propre
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

// Met à jour la fenêtre de service pour un jour de la semaine courante
async function updateServiceWindow(dk, field, value) {
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  const ref = db.collection("payroll").doc(wid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() : {};
  const serviceHours = { ...(data.serviceHours || {}) };
  const current = serviceHours[dk] || {};
  const next = { ...current, [field]: value || "" };
  if (!next.start && !next.end) {
    delete serviceHours[dk];
  } else {
    serviceHours[dk] = next;
  }
  await ref.set({
    weekId: wid,
    weekStart: dayKey(ws),
    serviceHours,
    updatedAt: Date.now(),
    ...(snap.exists ? {} : { createdAt: Date.now() })
  }, { merge: true });
}

// Met à jour le total des pourboires pour la semaine courante
async function updateTotalTips(value) {
  const v = Number(value);
  const ws = getWeekStart(payrollWeekOffset);
  const wid = payrollWeekId(ws);
  const ref = db.collection("payroll").doc(wid);
  const snap = await ref.get();
  await ref.set({
    weekId: wid,
    weekStart: dayKey(ws),
    totalTips: isNaN(v) || v < 0 ? 0 : v,
    updatedAt: Date.now(),
    ...(snap.exists ? {} : { createdAt: Date.now() })
  }, { merge: true });
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
