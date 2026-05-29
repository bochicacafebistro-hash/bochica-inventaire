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

// Options du dropdown heures de paie : 00:00 → 23:45 par tranches de 15 min
// (96 options). Granularité plus fine que la grille Horaires (30 min) parce
// que la paie réelle peut tomber sur le quart d'heure (ex. arrivée 13:15,
// départ 22:45). On reste sur un <select> plutôt que <input type="time">
// car le picker natif rend l'édition pénible (clic-glisse sur les chiffres,
// pas de scroll molette sur certains navigateurs).
const PAYROLL_TIME_OPTIONS_15 = (() => {
  const arr = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return arr;
})();

// Construit le HTML des <option> pour un select de paie.
// Si selectedValue n'est pas dans la liste (ex. punch à la minute près
// comme 09:32), on l'insère quand même en tête pour préserver la valeur
// exacte — sans label "(saisie libre)" qui surchargeait le tableau (v3.21.0).
function buildPayrollTimeOptions(selectedValue) {
  const sel = selectedValue || "";
  let html = `<option value="" ${sel === "" ? "selected" : ""}>—</option>`;
  const hasSel = sel === "" || PAYROLL_TIME_OPTIONS_15.includes(sel);
  if (!hasSel) {
    html += `<option value="${sel}" selected>${sel}</option>`;
  }
  for (const v of PAYROLL_TIME_OPTIONS_15) {
    html += `<option value="${v}" ${v === sel ? "selected" : ""}>${v}</option>`;
  }
  return html;
}

// ═ Employés ad-hoc + ordre (v3.15.0, multiplicateurs retirés v3.15.2) ══════════
// Tout est stocké dans le doc payroll/{weekId} :
//   • manualEmployees[]   — extras de la semaine ({id, name, section, hourlyRate})
//   • empOrder[]          — ordre d'affichage (IDs réels + manuels)
// Note : tipMultipliers{} (introduit en v3.15.0) a été retiré en v3.15.2 car
// jugé peu utile dans la pratique. Le calcul est revenu au prorata simple des
// heures éligibles. Les anciennes valeurs en BD sont simplement ignorées.
// Les shifts des extras sont stockés DANS actualShifts[id][dk] comme les vrais
// employés — ça permet de réutiliser tel quel getActualShift/updateActualShift.

// ID drag & drop courant (local au module pour ne pas entrer en conflit avec
// celui de pages-hr.js : _empDragId)
let _payrollDragId = null;

// Liste des employés "ad-hoc" stockés dans la semaine courante
function getManualEmployees() {
  return Array.isArray(payrollWeekData?.manualEmployees) ? payrollWeekData.manualEmployees : [];
}

// Liste fusionnée employés réels + extras + tri par empOrder.
// Si empOrder est absent ou incomplet, fallback sur l'ordre "réels d'abord
// (par sortOrder), puis extras dans leur ordre d'insertion".
function getAllPayrollEmployees() {
  const manual = getManualEmployees();
  const all = [...employees, ...manual];
  const order = Array.isArray(payrollWeekData?.empOrder) ? payrollWeekData.empOrder : [];
  if (order.length === 0) return all;
  // Tri stable : on respecte l'ordre déclaré pour ceux qui sont dans order,
  // les autres (nouveaux employés/extras pas encore ordonnés) vont à la fin.
  const indexOf = id => {
    const i = order.indexOf(id);
    return i === -1 ? Infinity : i;
  };
  return all.slice().sort((a, b) => {
    const ai = indexOf(a.id);
    const bi = indexOf(b.id);
    if (ai !== bi) return ai - bi;
    return 0;
  });
}

// Indique si une ligne est un employé "ad-hoc" (pas dans la liste principale)
function isManualEmployee(emp) {
  if (!emp) return false;
  return getManualEmployees().some(m => m.id === emp.id);
}

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
//
// ⚠ Changement v3.17.3 : PLUS de fallback sur le shift planifié.
// Le tableau Salaires & Pourboires reste vide jusqu'à ce qu'une saisie
// explicite (via la page Pointage ou via l'éditeur manuel) ne le remplisse.
// Raison : l'auto-import créait un conflit visuel entre les heures théoriques
// du planning et les heures réelles pointées — l'admin ne pouvait plus
// distinguer une cellule auto-importée d'une vraie heure pointée.
// Pour comparer aux heures planifiées, on utilise toujours getPlannedShift()
// dans la colonne "Réel / Planif" (les deux côtes-à-côte).
function getActualShift(empId, dk) {
  const actual = (payrollWeekData?.actualShifts || {})[empId];
  if (actual && actual[dk]) return actual[dk];
  return null;
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

// v3.18.0 — Override de section par semaine
// L'admin peut, dans le tableau Salaires, dire « cette semaine, traite Marie
// comme cuisine » (alors qu'elle est en service par défaut) ou « exclu du
// pool cette semaine ». Stocké dans payroll/{weekId}.sectionOverrides[empId].
// Valeurs possibles : "cuisine", "service", "excluded".
// L'absence de clé = pas d'override, on retombe sur emp.section via tipGroupOf.
function getSectionOverride(empId) {
  const m = payrollWeekData?.sectionOverrides || {};
  const v = m[empId];
  if (v === "cuisine" || v === "service" || v === "excluded") return v;
  return null; // pas d'override
}

// Groupe effectif de cet employé pour la semaine courante.
// Retourne "cuisine" | "service" | "excluded".
// "excluded" → l'employé ne reçoit aucun pourboire et ses heures ne comptent
// pas dans le pool (utile pour un gérant qui ne touche pas aux pourboires,
// ou un cas particulier ponctuel).
function getEffectiveTipGroup(emp) {
  const override = getSectionOverride(emp.id);
  if (override === "excluded") return "excluded";
  if (override === "cuisine") return "cuisine";
  if (override === "service") return "service";
  return tipGroupOf(emp);
}

// True si cet employé a un override actif pour la semaine courante.
function hasSectionOverride(empId) {
  return getSectionOverride(empId) !== null;
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

// ═ Détection d'anomalies (v3.19.0) ═════════════════════
// Scanne les empRows et signale les situations probablement liées à un
// oubli ou une erreur. Retourne [] si la semaine est verrouillée (les
// anomalies passées ont déjà été traitées au moment du verrou).
//
// 3 types d'alertes :
//   • "missing-exit"          → entrée pointée mais pas sortie sur un jour passé
//   • "long-shift"            → shift > 14 h (probable oubli de pointer sortie)
//   • "scheduled-not-punched" → planifié mais aucun pointage sur un jour passé
//
// La logique évite les faux positifs :
//   • Aujourd'hui n'est jamais flaggué pour "missing-exit" (l'employé peut
//     encore être en service)
//   • Le futur n'est jamais flaggué (rien d'anormal d'avoir un horaire prévu
//     sans pointage avant la date)
function detectPayrollAnomalies(empRows, isLocked) {
  if (isLocked) return [];

  const alerts = [];
  const todayDk = dayKey(new Date());

  for (const row of empRows) {
    for (const d of row.daily) {
      const isPast = d.dk < todayDk;

      // 1. Entrée sans sortie sur jour passé → oubli de pointage sortie
      if (isPast && d.actualShift?.start && !d.actualShift?.end) {
        alerts.push({
          type: "missing-exit",
          severity: "warning",
          empId: row.emp.id,
          empName: row.emp.name || "",
          dk: d.dk,
          dayLabel: _formatAlertDayLabel(d.dk),
          message: `Entrée pointée à ${d.actualShift.start} mais pas de sortie`
        });
      }

      // 2. Shift > 14 h → probablement oubli de pointer sortie ou erreur de saisie
      if (d.actualShift?.start && d.actualShift?.end && d.hours > 14) {
        alerts.push({
          type: "long-shift",
          severity: "warning",
          empId: row.emp.id,
          empName: row.emp.name || "",
          dk: d.dk,
          dayLabel: _formatAlertDayLabel(d.dk),
          message: `Shift de ${fmtHours(d.hours)} h (${d.actualShift.start} → ${d.actualShift.end}) — vérifier`
        });
      }

      // 3. Planifié mais pas pointé sur jour passé → no-show ou oubli de pointer entrée
      if (isPast && !d.actualShift?.start && !d.actualShift?.end && d.plannedShift?.start && d.plannedShift?.end) {
        alerts.push({
          type: "scheduled-not-punched",
          severity: "info",
          empId: row.emp.id,
          empName: row.emp.name || "",
          dk: d.dk,
          dayLabel: _formatAlertDayLabel(d.dk),
          message: `Planifié ${d.plannedShift.start} → ${d.plannedShift.end} mais aucun pointage`
        });
      }
    }
  }

  return alerts;
}

// Format "Mar 26/5" pour les alertes — court et clair
function _formatAlertDayLabel(dk) {
  const [y, m, d] = dk.split("-").map(Number);
  if (!y || !m || !d) return dk;
  const date = new Date(y, m - 1, d);
  return `${DAYS_FR[(date.getDay() + 6) % 7]} ${d}/${m}`;
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

  // ─ Liste fusionnée employés réels + extras de la semaine ─────
  // Les extras (manualEmployees) sont stockés dans payroll/{weekId}, jamais
  // dans la collection employees principale. Ils sont totalement transparents
  // pour le reste du calcul (mêmes shifts, mêmes pools).
  const allEmps = getAllPayrollEmployees();

  // ─ Pré-calcul des pools journaliers ──────────────
  // Pour chaque jour, on calcule le pool cuisine/service du jour ET le total
  // d'heures éligibles par groupe ce jour-là. Le pourboire de chaque employé
  // est ensuite calculé jour par jour (plus juste : un employé absent un
  // jour ne touche rien du pool de ce jour-là). Prorata simple des heures.
  //
  // v3.18.0 : on utilise getEffectiveTipGroup() qui respecte les overrides
  // de section pour cette semaine. Les employés "excluded" ne contribuent pas
  // au pool et ne reçoivent rien.
  const dailyCalc = weekDays.map((d, k) => {
    const dk = dayKey(d);
    const dowIdx = visibleIdx[k];
    const dayTotal = Number(tipsByDay[dk]) || 0;
    const poolKitchenDay = dayTotal * (Number(tipShares.cuisine) || 0);
    const poolServiceDay = dayTotal * (Number(tipShares.service) || 0);
    const serviceWin = getServiceWindow(dowIdx);
    let totalKitchenHrsDay = 0;
    let totalServiceHrsDay = 0;
    for (const emp of allEmps) {
      const group = getEffectiveTipGroup(emp);
      if (group === "excluded") continue; // pas dans le pool cette semaine
      const shift = getActualShift(emp.id, dk);
      const tipHrs = serviceWin ? intersectShiftHours(shift, serviceWin) : 0;
      if (group === "cuisine") totalKitchenHrsDay += tipHrs;
      else totalServiceHrsDay += tipHrs;
    }
    return { dk, dowIdx, serviceWin, dayTotal, poolKitchenDay, poolServiceDay, totalKitchenHrsDay, totalServiceHrsDay };
  });

  // ─ Calculs par employé ────────────────────────────
  const empRows = allEmps.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = getEffectiveTipGroup(emp); // override de semaine pris en compte
    const groupOverride = getSectionOverride(emp.id); // null si pas d'override
    const isManual = isManualEmployee(emp);

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

      // Pourboire du jour pour cet employé (prorata journalier simple).
      // Si exclu du pool cette semaine → dayTip = 0 d'office.
      let dayTip = 0;
      if (group !== "excluded") {
        const groupPool = group === "cuisine" ? dailyCalc[k].poolKitchenDay : dailyCalc[k].poolServiceDay;
        const groupTotalHrs = group === "cuisine" ? dailyCalc[k].totalKitchenHrsDay : dailyCalc[k].totalServiceHrsDay;
        dayTip = (groupTotalHrs > 0 && tipHours > 0) ? (tipHours / groupTotalHrs) * groupPool : 0;
      }

      totalHours += hours;
      plannedHours += pHours;
      tipEligibleHours += tipHours;
      tipShare += dayTip;
      return { dk, dowIdx, actualShift, plannedShift, hours, pHours, tipHours, dayTip, isOverride, isDifferent };
    });

    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    const gap = totalHours - plannedHours;
    const totalPay = grossWage + tipShare;
    return { emp, rate, isSal, fixedHours, group, groupOverride, isManual, daily, totalHours, plannedHours, gap, tipEligibleHours, tipShare, grossWage, totalPay };
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

  // ─ Détection d'anomalies (v3.19.0) ────────────────
  const alerts = detectPayrollAnomalies(empRows, isLocked);
  const alertsByType = {
    "missing-exit": alerts.filter(a => a.type === "missing-exit"),
    "long-shift": alerts.filter(a => a.type === "long-shift"),
    "scheduled-not-punched": alerts.filter(a => a.type === "scheduled-not-punched")
  };
  const warningCount = alerts.filter(a => a.severity === "warning").length;
  const infoCount = alerts.filter(a => a.severity === "info").length;

  // ─ HTML ───────────────────────────────────────────
  return `<div class="page page--wide ${isLocked ? "is-payroll-locked" : ""}">
    <div class="toolbar">
      <h2 class="page-title">${icon("dollar-sign", 22)} Salaires & Pourboires${isLocked ? ` <span class="payroll-locked-inline-badge">${icon("shield-check", 14)} Payée</span>` : ""}</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="generatePayrollPDF()" title="Générer un rapport PDF complet de la semaine courante" ${allEmps.length === 0 ? "disabled" : ""}>${icon("download", 14)} PDF 1 sem</button>
        <button class="btn-secondary btn-sm" onclick="generateBiWeeklyPDF()" title="Générer un rapport PDF couvrant cette semaine ET la précédente (paie aux 2 semaines)" ${allEmps.length === 0 ? "disabled" : ""}>${icon("download", 14)} PDF 2 sem</button>
        <button class="btn-secondary btn-sm" onclick="openAddExtraModal()" title="Ajouter un employé ponctuel à cette semaine seulement (ex: remplaçant, extra)" ${isLocked ? "disabled" : ""}>${icon("plus", 14)} Ajouter un extra</button>
        <button class="btn-secondary btn-sm" onclick="openServiceHoursModal()" title="Configurer les heures d'ouverture du service">${icon("clock", 14)} Heures de service</button>
        <button class="btn-secondary btn-sm" onclick="openTipSharesModal()" title="Modifier la répartition cuisine / service des pourboires">${icon("percent", 14)} Répartition</button>
      </div>
    </div>

    ${allEmps.length === 0 ? `
      <div class="empty"><div class="empty-state-icon">${icon("users", 36)}</div>Aucun employé enregistré. Ajoutez-en un dans <strong>Employés & Horaires</strong> ou clique sur <strong>« + Ajouter un extra »</strong> ci-dessous pour quelqu'un d'occasionnel.
        <div style="margin-top:16px">
          <button class="btn btn-primary btn-sm" onclick="openAddExtraModal()" ${isLocked ? "disabled" : ""}>${icon("plus", 14)} Ajouter un extra</button>
        </div>
      </div>
    ` : `
      <!-- ══ Bannière d'info : source des heures (v3.17.3) ══ -->
      <div class="payroll-info-banner">
        ${icon("clock", 16)}
        <div>
          Les cellules se remplissent avec les <strong>pointages</strong> (page <strong>Pointage</strong>) ou la <strong>saisie manuelle</strong> de l'admin. L'horaire planifié n'est plus auto-importé — il s'affiche en <strong>petite référence grise sous chaque cellule vide</strong> pour repérer qui devait travailler mais n'a pas encore pointé. Fond bleuté = employé prévu sans pointage. Colonne « Réel / Planif » à droite pour la comparaison.
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

      ${alerts.length > 0 ? `
      <!-- ══ Bannière d'alertes (v3.19.0) ══════════════ -->
      <div class="card payroll-alerts-card ${warningCount > 0 ? "has-warnings" : "has-info-only"}">
        <div class="payroll-alerts-head">
          ${icon(warningCount > 0 ? "alert" : "info", 18)}
          <div>
            <h3 class="payroll-alerts-title">
              ${alerts.length} ${alerts.length > 1 ? "anomalies détectées" : "anomalie détectée"} cette semaine
            </h3>
            <div class="payroll-alerts-subtitle">
              ${warningCount > 0 ? `<strong>${warningCount}</strong> à vérifier` : ""}
              ${warningCount > 0 && infoCount > 0 ? ` · ` : ""}
              ${infoCount > 0 ? `<strong>${infoCount}</strong> à titre informatif` : ""}
            </div>
          </div>
        </div>
        <div class="payroll-alerts-list">
          ${alertsByType["missing-exit"].length > 0 ? `
            <div class="payroll-alerts-group">
              <div class="payroll-alerts-group-head">
                ${icon("log-out", 14)} Sortie manquante (${alertsByType["missing-exit"].length})
              </div>
              ${alertsByType["missing-exit"].map(a => `
                <div class="payroll-alert payroll-alert--warning">
                  <span class="payroll-alert-day">${a.dayLabel}</span>
                  <strong class="payroll-alert-emp">${esc(a.empName)}</strong>
                  <span class="payroll-alert-msg">${esc(a.message)}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}
          ${alertsByType["long-shift"].length > 0 ? `
            <div class="payroll-alerts-group">
              <div class="payroll-alerts-group-head">
                ${icon("clock", 14)} Shift suspicieusement long (${alertsByType["long-shift"].length})
              </div>
              ${alertsByType["long-shift"].map(a => `
                <div class="payroll-alert payroll-alert--warning">
                  <span class="payroll-alert-day">${a.dayLabel}</span>
                  <strong class="payroll-alert-emp">${esc(a.empName)}</strong>
                  <span class="payroll-alert-msg">${esc(a.message)}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}
          ${alertsByType["scheduled-not-punched"].length > 0 ? `
            <div class="payroll-alerts-group">
              <div class="payroll-alerts-group-head">
                ${icon("calendar", 14)} Planifié sans pointage (${alertsByType["scheduled-not-punched"].length})
              </div>
              ${alertsByType["scheduled-not-punched"].map(a => `
                <div class="payroll-alert payroll-alert--info">
                  <span class="payroll-alert-day">${a.dayLabel}</span>
                  <strong class="payroll-alert-emp">${esc(a.empName)}</strong>
                  <span class="payroll-alert-msg">${esc(a.message)}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <p class="payroll-alerts-footer">
          ${icon("info", 11)} Les alertes disparaissent automatiquement dès que tu corriges la saisie dans le tableau ci-dessous.
        </p>
      </div>
      ` : ""}

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

      <!-- ══ Grille empgrid Salaires & Pourboires (v3.27.0) ══ -->
      <div class="schedule-empgrid payroll-empgrid" style="--n-days:${weekDays.length};">
        <!-- Header -->
        <div class="schedule-empgrid-header">
          <div class="schedule-empgrid-emp-head">Employé · Section</div>
          ${weekDays.map((d, k) => {
            const dowIdx = visibleIdx[k];
            const sw = getServiceWindow(dowIdx);
            const swLabel = sw ? `${sw.start}–${sw.end}` : "—";
            const count = empRows.filter(r => r.daily[k]?.actualShift?.start && r.daily[k]?.actualShift?.end).length;
            return `<div class="schedule-empgrid-day-head">
              <div class="schedule-empgrid-day-name">${DAYS_FR[dowIdx]}</div>
              <div class="schedule-empgrid-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              <div class="schedule-empgrid-day-count">${count} pers · service ${swLabel}</div>
            </div>`;
          }).join("")}
          <div class="schedule-empgrid-total-head">Totaux</div>
        </div>

        <!-- Body -->
        ${empRows.map((row, rowIdx) => {
          const hasNoHours = !row.totalHours;
          const isOverridden = !!row.groupOverride;
          const selValue = row.groupOverride || "auto";
          const groupClass = row.group === "cuisine" ? "is-kitchen"
                          : row.group === "service" ? "is-service"
                          : "is-excluded";
          const gapCls = row.gap > 0.01 ? "is-positive" : row.gap < -0.01 ? "is-negative" : "";
          const gapArrow = row.gap > 0.01 ? "▲" : row.gap < -0.01 ? "▼" : "";
          return `<div class="schedule-empgrid-row payroll-empgrid-row ${row.isManual ? "is-manual-emp" : ""} ${hasNoHours ? "is-no-hours" : ""}" data-emp-id="${row.emp.id}"
            ${isLocked ? "" : `ondragover="payrollRowDragOver(event,'${row.emp.id}')"
            ondragleave="payrollRowDragLeave(event)"
            ondrop="payrollRowDrop(event,'${row.emp.id}')"
            ondragend="payrollRowDragEnd(event)"`}>
            <!-- Cellule employé : drag + nom + EXTRA + section + rate + trash -->
            <div class="schedule-empgrid-emp payroll-empgrid-emp ${groupClass}">
              <div class="payroll-empgrid-emp-row">
                ${isLocked ? "" : `<span class="payroll-drag-handle" draggable="true" ondragstart="payrollRowDragStart(event,'${row.emp.id}')" aria-label="Glisser pour réordonner" title="Glisser pour réordonner">${icon("grip-vertical", 12)}</span>`}
                <span class="schedule-empgrid-emp-name">${esc(row.emp.name || "")}</span>
                ${row.isManual ? `<span class="payroll-manual-badge">EXTRA</span>` : ""}
                ${row.isManual && !isLocked ? `<button class="payroll-manual-del" onclick="removeManualEmployee('${row.emp.id}')" title="Retirer cet extra" aria-label="Retirer cet extra">${icon("trash", 11)}</button>` : ""}
              </div>
              <div class="payroll-empgrid-emp-meta">
                <select class="payroll-section-select ${groupClass} ${isOverridden ? "is-overridden" : ""}"
                  onchange="updateSectionOverride('${row.emp.id}', this.value)"
                  ${isLocked ? "disabled" : ""}
                  title="${isOverridden ? "⚠ Section dérogée pour cette semaine" : "Section pour les pourboires"}"
                  aria-label="Section ${esc(row.emp.name || "")}">
                  <option value="auto" ${selValue === "auto" ? "selected" : ""}>Auto (${tipGroupOf(row.emp) === "cuisine" ? "Cuisine" : "Service"})</option>
                  <option value="cuisine" ${selValue === "cuisine" ? "selected" : ""}>Cuisine ${(tipShares.cuisine*100).toFixed(0)}%</option>
                  <option value="service" ${selValue === "service" ? "selected" : ""}>Service ${(tipShares.service*100).toFixed(0)}%</option>
                  <option value="excluded" ${selValue === "excluded" ? "selected" : ""}>Exclu</option>
                </select>
                ${row.rate ? `<span class="payroll-empgrid-rate">${row.rate.toFixed(2)} $/h${row.isSal ? " · FIXE" : ""}</span>` : ""}
              </div>
            </div>
            <!-- Cellules par jour : shift card ou Congé -->
            ${row.daily.map((d, k) => {
              const filled = d.actualShift && d.actualShift.start && d.actualShift.end;
              const dk = d.dk;
              const empName = esc(row.emp.name || "");
              const dayName = DAYS_FR[visibleIdx[k]];
              if (!filled) {
                // Aucun pointage — afficher Congé avec hint du planifié si applicable
                const plannedHint = d.plannedShift?.start && d.plannedShift?.end
                  ? `${d.plannedShift.start} → ${d.plannedShift.end}`
                  : "";
                const offLabel = plannedHint ? plannedHint : "Congé";
                const offSub = plannedHint ? "Pas pointé" : (isLocked ? "—" : "+ Saisir");
                return `<div class="schedule-empgrid-cell schedule-empgrid-cell--empty ${plannedHint ? "is-scheduled-empty" : ""}"
                    data-day-key="${dk}"
                    ${isLocked ? "" : `ondragover="payrollShiftDragOver(event,'${dk}')"
                    ondragleave="payrollShiftDragLeave(event)"
                    ondrop="payrollShiftDrop(event,'${row.emp.id}','${dk}')"`}>
                  <div class="shift-card shift-card--off"
                      ${isLocked ? "" : `onclick="openPayrollShiftModal('${row.emp.id}','${dk}')"`}
                      title="${plannedHint ? `Prévu à l'horaire : ${plannedHint}` : "Aucun pointage"}">
                    <div class="shift-off-label">${offLabel}</div>
                    <div class="shift-off-add">${offSub}</div>
                  </div>
                </div>`;
              }
              const dayTipPart = d.dayTip > 0
                ? `<div class="shift-card-tip" title="Pourboire reçu ce jour">+${fmtMoney(d.dayTip)}</div>`
                : "";
              const cellTitle = d.isDifferent
                ? `Modifié — planifié : ${d.plannedShift?.start || "—"}→${d.plannedShift?.end || "—"}`
                : "";
              return `<div class="schedule-empgrid-cell ${d.isDifferent ? "is-modified" : ""}"
                  data-day-key="${dk}"
                  title="${cellTitle}"
                  ${isLocked ? "" : `ondragover="payrollShiftDragOver(event,'${dk}')"
                  ondragleave="payrollShiftDragLeave(event)"
                  ondrop="payrollShiftDrop(event,'${row.emp.id}','${dk}')"`}>
                <div class="shift-card shift-card--compact ${groupClass}"
                    ${isLocked ? "" : `draggable="true"
                    data-emp-id="${row.emp.id}"
                    data-from-day="${dk}"
                    ondragstart="payrollShiftDragStart(event,'${row.emp.id}','${dk}')"
                    ondragend="payrollShiftDragEnd(event)"
                    onclick="openPayrollShiftModal('${row.emp.id}','${dk}')"`}
                    title="Cliquer pour modifier · Glisser pour déplacer">
                  <div class="shift-card-time">${d.actualShift.start} → ${d.actualShift.end}</div>
                  <div class="shift-card-meta">
                    <span>${fmtHours(d.hours)}h</span>
                    ${dayTipPart || `<span class="shift-card-cost">${d.tipHours > 0 ? fmtHours(d.tipHours) + "h★" : ""}</span>`}
                  </div>
                </div>
              </div>`;
            }).join("")}
            <!-- Cellule totaux (Hrs réel/planif + Écart + Salaire + Pourb + Total) -->
            <div class="schedule-empgrid-total payroll-empgrid-total">
              <div class="payroll-empgrid-total-row">
                <span class="payroll-empgrid-total-lbl">Hrs</span>
                <span class="payroll-empgrid-total-val">
                  ${row.totalHours ? fmtHours(row.totalHours) : "0"}<small>/${row.plannedHours ? fmtHours(row.plannedHours) : "0"}</small>
                </span>
              </div>
              <div class="payroll-empgrid-total-row">
                <span class="payroll-empgrid-total-lbl">Écart</span>
                <span class="payroll-empgrid-total-val ${gapCls}">${Math.abs(row.gap) < 0.01
                  ? (row.totalHours || row.plannedHours ? `=` : "—")
                  : `${gapArrow}${(row.gap > 0 ? "+" : "")}${fmtHours(row.gap)}h`}</span>
              </div>
              <div class="payroll-empgrid-total-row">
                <span class="payroll-empgrid-total-lbl">Sal</span>
                <span class="payroll-empgrid-total-val">${row.grossWage ? fmtMoney(row.grossWage) : "—"}</span>
              </div>
              <div class="payroll-empgrid-total-row">
                <span class="payroll-empgrid-total-lbl">Pourb</span>
                <span class="payroll-empgrid-total-val payroll-empgrid-total-val--tip">${row.tipShare > 0 ? fmtMoney(row.tipShare) : "—"}</span>
              </div>
              <div class="payroll-empgrid-total-row payroll-empgrid-total-row--final">
                <span class="payroll-empgrid-total-lbl">Total</span>
                <span class="payroll-empgrid-total-val payroll-empgrid-total-val--final">${row.totalPay ? fmtMoney(row.totalPay) : "—"}</span>
              </div>
            </div>
          </div>`;
        }).join("")}
      </div>

      <!-- ══ Panneau totaux (mêmes colonnes que la grille du haut) ══ -->
      <div class="schedule-totals-panel payroll-totals-panel" style="--n-days:${weekDays.length};">
        <div class="schedule-totals-grid">
          <div class="schedule-totals-label">Totaux semaine</div>
          <div class="schedule-totals-val schedule-totals-val--summary" style="grid-column:span ${weekDays.length}; text-align:left; font-style:italic; color:var(--text3); justify-content:flex-start">
            ${empRows.length} employé${empRows.length > 1 ? "s" : ""} ·
            ${fmtHours(sumActualHours)}h pointées / ${fmtHours(sumPlannedHours)}h planifiées
            · Écart ${(sumActualHours - sumPlannedHours) > 0 ? "+" : ""}${fmtHours(sumActualHours - sumPlannedHours)}h
            · Salaires ${fmtMoney(sumGross)} · Pourboires ${fmtMoney(sumTips)}
          </div>
          <div class="schedule-totals-val schedule-totals-val--total">${fmtMoney(sumTotal)}</div>
        </div>
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
                // Bonus $/h en pourboire : combien le tip ajoute au taux horaire effectif.
                // Basé sur totalHours (heures travaillées) plutôt que tipEligibleHours
                // (heures dans la fenêtre de service) — répond à la question
                // « ce pourboire représente combien de plus par heure de travail ? ».
                const tipPerHour = row.totalHours > 0 ? (row.tipShare / row.totalHours) : 0;
                // Taux effectif horaire pour info (taux contractuel + boost pourboire)
                const effectiveRate = row.rate + tipPerHour;
                return `<div class="payroll-recap-card-emp ${isKitchen ? "is-kitchen" : "is-service"}">
                  <div class="payroll-recap-emp-name">${esc(row.emp.name || "")}</div>
                  <div class="payroll-recap-emp-group">${icon(groupIcon, 11)} ${groupLabel}</div>
                  <div class="payroll-recap-emp-amount">${fmtMoney(row.tipShare)}</div>
                  ${tipPerHour > 0 ? `
                    <div class="payroll-recap-emp-boost" title="Bonus moyen par heure travaillée — ce que le pourboire ajoute au taux horaire de ${esc(row.emp.name || "")}">
                      <span class="payroll-recap-emp-boost__plus">+</span>
                      <span class="payroll-recap-emp-boost__amount">${fmtMoney(tipPerHour)}</span>
                      <span class="payroll-recap-emp-boost__unit">/h</span>
                    </div>
                    ${row.rate > 0 ? `<div class="payroll-recap-emp-effective" title="Taux horaire effectif : taux contractuel + bonus pourboire">
                      Effectif : ${fmtMoney(effectiveRate)}/h <span class="payroll-recap-emp-effective__base">(base ${fmtMoney(row.rate)})</span>
                    </div>` : ""}
                  ` : ""}
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
        <strong>Légende :</strong>
        <span class="payroll-legend-item">Lignes <strong style="color:#b87410">jaunes</strong> / <strong style="color:#3b7cc6">bleues</strong> en alternance = un employé par ligne</span>
        <span class="payroll-legend-item">Petite <strong>barre ambrée</strong> à gauche d'une cellule = heure modifiée par rapport au planifié</span>
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
//
// IMPORTANT (fix v3.16.1) : on doit TOUJOURS écrire start ET end ensemble.
// Sinon ce bug se produit :
//   1. La cellule auto-importe le shift planifié (ex: 09:00 → 17:00). Visuel OK.
//   2. L'utilisateur modifie SEULEMENT start (ex: 10:00).
//   3. On écrit { actualShifts.emp.dk.start = "10:00" }.
//   4. Firestore stocke maintenant actualShifts.emp.dk = { start: "10:00" } — pas
//      de "end" du tout.
//   5. getActualShift voit qu'il y a un override pour ce jour (truthy) et le
//      retourne tel quel. Le fallback sur le planifié ne se déclenche plus.
//   6. La cellule "end" devient vide → l'utilisateur perd sa donnée.
// Solution : lire la valeur courante visible (getActualShift, qui inclut le
// fallback planifié) avant d'écrire, et toujours pousser les deux champs.
async function updateActualShift(empId, dk, field, value) {
  try {
    // Lit le shift courant visible (override OU fallback planifié OU null)
    const currentShift = getActualShift(empId, dk) || {};
    const newShift = {
      start: field === "start" ? (value || "") : (currentShift.start || ""),
      end:   field === "end"   ? (value || "") : (currentShift.end   || "")
    };

    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    // On écrit l'objet complet {start, end} — même si seul un des deux a changé,
    // l'autre reflète maintenant le planifié importé. C'est exactement ce que
    // l'utilisateur voit à l'écran au moment de la modification.
    const update = {
      weekId: wid,
      weekStart: dayKey(ws),
      updatedAt: Date.now(),
      actualShifts: {
        [empId]: {
          [dk]: newShift
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

// v3.18.0 — Override de la section d'un employé pour la semaine courante.
// Valeur attendue : "auto" (= delete la clé) | "cuisine" | "service" | "excluded"
// Stocké dans payroll/{weekId}.sectionOverrides{empId: ...}.
async function updateSectionOverride(empId, value) {
  if (payrollWeekData?.locked) {
    toast("Semaine verrouillée — déverrouille avant de modifier les sections.", "warning");
    return;
  }
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    const valueToWrite = (value === "auto" || !["cuisine", "service", "excluded"].includes(value))
      ? firebase.firestore.FieldValue.delete()
      : value;
    await ref.set({
      weekId: wid,
      weekStart: dayKey(ws),
      updatedAt: Date.now(),
      sectionOverrides: {
        [empId]: valueToWrite
      }
    }, { merge: true });
  } catch (err) {
    console.error("updateSectionOverride failed:", err);
    toast("Erreur sauvegarde section : " + (err.message || err.code || err), "error", 5000);
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
      "Aucune saisie à effacer pour cette semaine.",
      "info",
      4000
    );
    return;
  }

  // Détail à afficher dans la confirmation
  const parts = [];
  if (shiftOverrides > 0) parts.push(`<strong>${shiftOverrides}</strong> cellule${shiftOverrides > 1 ? "s" : ""} d'heures pointées/saisies`);
  if (tipDaysCount > 0) parts.push(`<strong>${tipDaysCount}</strong> jour${tipDaysCount > 1 ? "s" : ""} de pourboires`);
  const detailLine = parts.join(" + ");

  // v3.22.0 : modale custom avec champ de confirmation à taper pour éviter
  // les clics accidentels sur une action destructive irréversible.
  const weekStart = getWeekStart(payrollWeekOffset);
  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));

  showModal(`<div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3 style="color:#a23a36">${icon("alert", 18)} Effacer toutes les saisies — Semaine ${weekNum}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <div style="background:rgba(217,83,79,.08);border:1px solid rgba(217,83,79,.3);border-radius:var(--radius-md);padding:var(--sp-3);margin-bottom:var(--sp-3)">
      <strong style="color:#a23a36;font-size:14px">⚠ Action irréversible</strong>
      <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:var(--text2)">
        Cela va effacer définitivement ${detailLine} pour la <strong>semaine ${weekNum}</strong>.
        Les heures de pointage déjà enregistrées par les employés seront <strong>perdues</strong>.
      </p>
    </div>
    <p style="font-size:13px;line-height:1.5;color:var(--text2);margin:0 0 8px">
      Pour confirmer, tape <strong style="font-family:var(--font-mono);background:var(--surface2);padding:2px 6px;border-radius:4px;color:var(--text)">EFFACER</strong> dans le champ ci-dessous :
    </p>
    <label style="display:block;margin-bottom:var(--sp-2)">
      <input
        id="confirm-reset-input"
        type="text"
        placeholder="Tape EFFACER pour activer le bouton"
        autocomplete="off"
        autocapitalize="characters"
        oninput="document.getElementById('confirm-reset-btn').disabled = this.value.trim().toUpperCase() !== 'EFFACER'"
        style="width:100%;font-family:var(--font-mono);font-size:15px;font-weight:700;letter-spacing:.05em;text-transform:uppercase"
        autofocus
      />
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button
        id="confirm-reset-btn"
        class="btn-danger"
        onclick="doResetActualFromPlanned();closeModal()"
        disabled
        style="background:#d9534f;color:#fff;border:none">
        ${icon("trash", 14)} Effacer la semaine ${weekNum}
      </button>
    </div>
  </div>`);
}

async function doResetActualFromPlanned() {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    // Effacer entièrement actualShifts ET tipsByDay (v3.17.3 : plus d'auto-
    // import du planifié, donc les cellules redeviennent vides — visible
    // uniquement le hint gris sous chaque cellule pour les employés prévus).
    await db.collection("payroll").doc(wid).set({
      weekId: wid,
      weekStart: dayKey(ws),
      actualShifts: firebase.firestore.FieldValue.delete(),
      tipsByDay: firebase.firestore.FieldValue.delete(),
      // Nettoyer aussi l'éventuel ancien champ totalTips (rétrocompat)
      totalTips: firebase.firestore.FieldValue.delete(),
      updatedAt: Date.now()
    }, { merge: true });
    toast("Saisies effacées pour la semaine.", "success", 4000);
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
  // Inclut employés réels ET extras de la semaine (v3.15.0)
  const allForGross = [...employees, ...getManualEmployees()];
  for (const emp of allForGross) {
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

// ═══════════════════════════════════════════════════════════════
// v3.15.0 — Extras + ordre  (multiplicateurs retirés v3.15.2)
// ═══════════════════════════════════════════════════════════════

// ─ Ajout d'un employé extra (ad-hoc pour cette semaine seulement) ─
function openAddExtraModal() {
  if (payrollWeekData?.locked) {
    toast("Semaine verrouillée — déverrouille avant d'ajouter un extra.", "warning");
    return;
  }
  showModal(`<div class="modal" style="max-width:480px">
    <div class="modal-header">
      <h3>${icon("plus", 18)} Ajouter un extra à la semaine</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Crée un employé <strong>uniquement pour cette semaine de paie</strong> — il n'apparaîtra pas dans la liste principale Employés & Horaires.
      Idéal pour un remplaçant, un extra de soirée, un dépannage ponctuel.
    </p>
    <label>Nom <span style="color:var(--accent)">*</span>
      <input id="extra-name" type="text" placeholder="Ex: Sophie Martin" autofocus/>
    </label>
    <label>Section
      <select id="extra-section">
        <option value="service" selected>Service à la clientèle (pool 75%)</option>
        <option value="cuisine">Cuisine (pool 25%)</option>
        <option value="other">Autre / Admin (pool 75%)</option>
      </select>
    </label>
    <label>Taux horaire ($/h) <span style="color:var(--accent)">*</span>
      <input id="extra-rate" type="number" min="0" step="0.25" placeholder="ex: 17.50"/>
    </label>
    <p style="color:var(--text3);font-size:12px;margin-top:8px">
      ${icon("info", 11)} Tu pourras saisir ses heures et son multiplicateur de pourboires directement dans le tableau après l'ajout.
    </p>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveManualEmployee()">${icon("check", 14)} Ajouter</button>
    </div>
  </div>`);
}

async function saveManualEmployee() {
  try {
    const name = (document.getElementById("extra-name")?.value || "").trim();
    const section = document.getElementById("extra-section")?.value || "service";
    const rate = Number(document.getElementById("extra-rate")?.value);
    if (!name) return toast("Donne un nom à l'extra.", "error");
    if (isNaN(rate) || rate < 0) return toast("Le taux horaire doit être un nombre positif.", "error");

    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);

    // Génère un ID unique pour l'extra (préfixé pour distinguer des vrais employés)
    const newId = "manual_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    const newExtra = {
      id: newId,
      name,
      section,
      hourlyRate: rate,
      role: "Extra",
      isSalaried: false,
      shifts: {}, // pas de shifts planifiés
      createdAt: Date.now()
    };

    // Lecture+merge manuel : pour ajouter à un tableau, on lit l'existant puis on réécrit
    const snap = await ref.get();
    const existing = (snap.exists && Array.isArray(snap.data()?.manualEmployees)) ? snap.data().manualEmployees : [];
    const existingOrder = (snap.exists && Array.isArray(snap.data()?.empOrder)) ? snap.data().empOrder : null;

    // L'ajouter à la fin de l'ordre si un empOrder existe (pour qu'il soit visible)
    const nextOrder = existingOrder
      ? [...existingOrder, newId]
      : [...employees.map(e => e.id), ...existing.map(e => e.id), newId];

    await ref.set({
      weekId: wid,
      weekStart: dayKey(ws),
      manualEmployees: [...existing, newExtra],
      empOrder: nextOrder,
      updatedAt: Date.now()
    }, { merge: true });

    closeModal();
    toast(`Extra « ${name} » ajouté pour cette semaine.`, "success");
  } catch (err) {
    console.error("saveManualEmployee failed:", err);
    toast("Erreur ajout extra : " + (err.message || err.code || err), "error", 5000);
  }
}

// Retrait d'un extra — confirmation puis suppression de manualEmployees,
// actualShifts[id] et de l'entrée dans empOrder. (Aussi nettoie tipMultipliers
// par défense au cas où d'anciennes valeurs traînent.)
function removeManualEmployee(id) {
  const extras = getManualEmployees();
  const ex = extras.find(e => e.id === id);
  if (!ex) return;
  openConfirm(
    "Retirer cet extra ?",
    `Cela va supprimer <strong>${esc(ex.name)}</strong> de cette semaine et ses heures saisies.<br><br>
     ⚠ Action irréversible pour cette semaine.<br>
     ✓ Les autres semaines ne sont pas affectées.<br><br>
     Continuer ?`,
    () => doRemoveManualEmployee(id),
    true
  );
}

async function doRemoveManualEmployee(id) {
  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    const ref = db.collection("payroll").doc(wid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() || {};
    const newExtras = (data.manualEmployees || []).filter(e => e.id !== id);
    const newOrder = Array.isArray(data.empOrder) ? data.empOrder.filter(eid => eid !== id) : null;
    const newShifts = { ...(data.actualShifts || {}) };
    delete newShifts[id];
    // Défensif : nettoie aussi tipMultipliers[id] si présent (champ retiré v3.15.2)
    const newMults = { ...(data.tipMultipliers || {}) };
    delete newMults[id];
    // v3.18.0 : nettoie aussi le sectionOverride[id] s'il existe
    const newSections = { ...(data.sectionOverrides || {}) };
    delete newSections[id];

    const update = {
      weekId: wid,
      weekStart: dayKey(ws),
      manualEmployees: newExtras,
      actualShifts: newShifts,
      tipMultipliers: newMults,
      sectionOverrides: newSections,
      updatedAt: Date.now()
    };
    if (newOrder !== null) update.empOrder = newOrder;

    // Set sans merge pour les sous-objets (on a déjà fait le diff côté client)
    await ref.set(update, { merge: true });
    toast("Extra retiré.", "success");
  } catch (err) {
    console.error("doRemoveManualEmployee failed:", err);
    toast("Erreur retrait : " + (err.message || err.code || err), "error", 5000);
  }
}

// ─ Drag & drop pour réordonner les lignes employés ─────────
// Calqué sur empRowDragStart/Over/Drop dans pages-hr.js, mais écrit dans
// payroll/{weekId}.empOrder[] au lieu de employees.sortOrder.
function payrollRowDragStart(e, id) {
  if (payrollWeekData?.locked) { e.preventDefault(); return; }
  _payrollDragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  }
  const tr = document.querySelector(`tr[data-emp-id="${id}"]`);
  setTimeout(() => tr && tr.classList.add("schedule-row--dragging"), 0);
}

function payrollRowDragOver(e, id) {
  if (_payrollDragId === null || id === _payrollDragId) return;
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

function payrollRowDragLeave(e) {
  const tr = e.currentTarget;
  if (!tr) return;
  const related = e.relatedTarget;
  if (related && tr.contains(related)) return;
  tr.classList.remove("schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after");
}

function payrollRowDragEnd() {
  document.querySelectorAll("tr[data-emp-id]").forEach(tr =>
    tr.classList.remove("schedule-row--dragging", "schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after")
  );
  _payrollDragId = null;
}

async function payrollRowDrop(e, targetId) {
  e.preventDefault();
  const srcId = _payrollDragId;
  const tr = document.querySelector(`tr[data-emp-id="${targetId}"]`);
  const dropBefore = tr && tr.classList.contains("schedule-row--drop-before");
  payrollRowDragEnd();
  if (!srcId || srcId === targetId) return;

  // Recomposer l'ordre des IDs à partir de la liste fusionnée actuelle
  const all = getAllPayrollEmployees();
  const ids = all.map(emp => emp.id);
  const srcIdx = ids.indexOf(srcId);
  const tgtIdx = ids.indexOf(targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  ids.splice(srcIdx, 1);
  let insertAt = tgtIdx;
  if (srcIdx < tgtIdx) insertAt -= 1;
  if (!dropBefore) insertAt += 1;
  insertAt = Math.max(0, Math.min(insertAt, ids.length));
  ids.splice(insertAt, 0, srcId);

  try {
    const ws = getWeekStart(payrollWeekOffset);
    const wid = payrollWeekId(ws);
    await db.collection("payroll").doc(wid).set({
      weekId: wid,
      weekStart: dayKey(ws),
      empOrder: ids,
      updatedAt: Date.now()
    }, { merge: true });
  } catch (err) {
    console.error("payrollRowDrop failed:", err);
    toast("Erreur réorganisation : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// v3.16.0 — Export PDF du rapport de paie hebdomadaire
// ═══════════════════════════════════════════════════════════════
// Rapport complet en landscape Letter avec : en-tête Bochica, infos
// semaine, pourboires par jour, tableau détaillé (heures entrée/sortie),
// récap par employé avec bonus $/h, footer.
// Style aligné avec generateQuotePDF() : palette Crème Papier + tricolore.

function generatePayrollPDF() {
  if (typeof window.jspdf === "undefined") {
    toast("La bibliothèque PDF n'est pas chargée. Rechargez la page.", "error");
    return;
  }

  // ─ Recalcule les mêmes données que renderSalaires (mais sans HTML) ──
  const weekStart = getWeekStart(payrollWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]);
  const startLabel = weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" });

  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);

  const tipShares = payrollSettings?.tipShares || { cuisine: 0.25, service: 0.75 };
  const tipsByDay = payrollWeekData?.tipsByDay || {};
  const legacyTotal = Number(payrollWeekData?.totalTips) || 0;
  const totalTips = weekDays.reduce((s, d) => s + (Number(tipsByDay[dayKey(d)]) || 0), 0) || legacyTotal;
  const poolCuisine = totalTips * (Number(tipShares.cuisine) || 0);
  const poolService = totalTips * (Number(tipShares.service) || 0);

  const allEmps = getAllPayrollEmployees();
  if (allEmps.length === 0) {
    toast("Aucun employé à inclure dans le rapport.", "warning");
    return;
  }

  // Pré-calcul des pools journaliers (prorata simple)
  const dailyCalc = weekDays.map((d, k) => {
    const dk = dayKey(d);
    const dowIdx = visibleIdx[k];
    const dayTotal = Number(tipsByDay[dk]) || 0;
    const serviceWin = getServiceWindow(dowIdx);
    let totalKitchenHrsDay = 0;
    let totalServiceHrsDay = 0;
    for (const emp of allEmps) {
      const shift = getActualShift(emp.id, dk);
      const tipHrs = serviceWin ? intersectShiftHours(shift, serviceWin) : 0;
      if (tipGroupOf(emp) === "cuisine") totalKitchenHrsDay += tipHrs;
      else totalServiceHrsDay += tipHrs;
    }
    return {
      dk, dowIdx, serviceWin,
      dayTotal,
      poolKitchenDay: dayTotal * (Number(tipShares.cuisine) || 0),
      poolServiceDay: dayTotal * (Number(tipShares.service) || 0),
      totalKitchenHrsDay, totalServiceHrsDay
    };
  });

  const empRows = allEmps.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = tipGroupOf(emp);
    let totalHours = 0, plannedHours = 0, tipEligibleHours = 0, tipShare = 0;
    const daily = weekDays.map((d, k) => {
      const dk = dayKey(d);
      const actualShift = getActualShift(emp.id, dk);
      const plannedShift = getPlannedShift(emp.id, dk);
      const serviceWin = dailyCalc[k].serviceWin;
      const hours = hoursFromShift(actualShift);
      const pHours = hoursFromShift(plannedShift);
      const tipHours = serviceWin ? intersectShiftHours(actualShift, serviceWin) : 0;
      const groupPool = group === "cuisine" ? dailyCalc[k].poolKitchenDay : dailyCalc[k].poolServiceDay;
      const groupTotalHrs = group === "cuisine" ? dailyCalc[k].totalKitchenHrsDay : dailyCalc[k].totalServiceHrsDay;
      const dayTip = (groupTotalHrs > 0 && tipHours > 0) ? (tipHours / groupTotalHrs) * groupPool : 0;
      totalHours += hours;
      plannedHours += pHours;
      tipEligibleHours += tipHours;
      tipShare += dayTip;
      return { dk, actualShift, hours, tipHours, dayTip };
    });
    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    return {
      emp, rate, isSal, fixedHours, group, daily,
      totalHours, plannedHours, tipEligibleHours, tipShare, grossWage,
      totalPay: grossWage + tipShare,
      isManual: isManualEmployee(emp)
    };
  });

  const sumGross = empRows.reduce((s, r) => s + r.grossWage, 0);
  const sumTips = empRows.reduce((s, r) => s + r.tipShare, 0);
  const sumTotal = empRows.reduce((s, r) => s + r.totalPay, 0);
  const sumActualHours = empRows.reduce((s, r) => s + r.totalHours, 0);

  // ─ Setup jsPDF — landscape Letter ─────────────────────
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });

  const W = 279.4, H = 215.9;
  const M = 12;
  const contentW = W - 2 * M;

  // Palette Crème Papier (aligné avec generateQuotePDF)
  const COLOR_CREAM      = [253, 246, 231];
  const COLOR_TEXT       = [14, 13, 12];
  const COLOR_TEXT_LIGHT = [110, 95, 80];
  const COLOR_BORDER     = [200, 188, 165];
  const COLOR_ACCENT     = [247, 179, 44];
  const COLOR_BLUE       = [74, 144, 226];
  const COLOR_RED        = [231, 76, 60];
  const COLOR_GREEN      = [125, 191, 102];
  const COLOR_SURFACE2   = [237, 227, 210];
  const COLOR_HEADER_FILL = [232, 220, 200];

  let y = 0;
  let currentPage = 1;

  function paintBackground() {
    doc.setFillColor(...COLOR_CREAM);
    doc.rect(0, 0, W, H, "F");
  }
  function drawTricolore(cy, triW = 56) {
    const triX0 = (W - triW) / 2;
    const triH = 1.4;
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(triX0, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_BLUE);
    doc.rect(triX0 + triW / 3, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_RED);
    doc.rect(triX0 + 2 * triW / 3, cy, triW / 3, triH, "F");
  }
  function newPage() {
    doc.addPage();
    currentPage++;
    paintBackground();
    drawCompactHeader();
  }
  function ensureSpace(needed) {
    if (y + needed > H - 14) { // 14 = footer reserve
      newPage();
    }
  }

  // Header complet (1ère page)
  function drawFullHeader() {
    y = 12;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("BOCHICA", W / 2, y, { align: "center" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
    y += 2;
    drawTricolore(y, 50);
    y += 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(`Rapport de paie — Semaine ${weekNum}`, W / 2, y, { align: "center" });
    y += 4.5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(`${startLabel} – ${endLabel}`, W / 2, y, { align: "center" });
    y += 7;
  }
  // Header compact (pages suivantes)
  function drawCompactHeader() {
    y = 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(`BOCHICA · Rapport de paie sem. ${weekNum}`, M, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(`${startLabel} – ${endLabel}`, W - M, y, { align: "right" });
    y += 2;
    doc.setFillColor(...COLOR_ACCENT);
    doc.rect(M, y, contentW, 0.6, "F");
    y += 5;
  }

  // ─ Démarrage ─────────────────────────────────────────
  paintBackground();
  drawFullHeader();

  // ─ KPI cards (4 cards en haut) ──────────────────────
  const kpis = [
    { label: "Total à payer", value: fmtMoney(sumTotal), color: COLOR_ACCENT },
    { label: "Salaires bruts", value: fmtMoney(sumGross), color: COLOR_BLUE },
    { label: "Pourboires distribués", value: fmtMoney(sumTips), color: COLOR_GREEN },
    { label: "Heures totales", value: `${fmtHours(sumActualHours)} h`, color: COLOR_TEXT }
  ];
  const cardW = (contentW - 3 * 4) / 4;
  const cardH = 14;
  kpis.forEach((k, i) => {
    const cx = M + i * (cardW + 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "FD");
    // Barre latérale couleur
    doc.setFillColor(...k.color);
    doc.rect(cx, y, 1.2, cardH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(k.label.toUpperCase(), cx + 3.5, y + 4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(k.value, cx + 3.5, y + 10);
  });
  y += cardH + 5;

  // ─ Pourboires par jour (mini-grille) ─────────────────
  ensureSpace(18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(`Pourboires de la semaine — Total ${fmtMoney(totalTips)}`, M, y);
  // Pool indicators à droite
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text(
    `Pool Cuisine ${(tipShares.cuisine*100).toFixed(0)}% : ${fmtMoney(poolCuisine)}   ·   Pool Service+Admin ${(tipShares.service*100).toFixed(0)}% : ${fmtMoney(poolService)}`,
    W - M, y, { align: "right" }
  );
  y += 3;
  // Grille jours
  const dayW = contentW / weekDays.length;
  const dayH = 9;
  weekDays.forEach((d, k) => {
    const cx = M + k * dayW;
    doc.setFillColor(...COLOR_SURFACE2);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(cx, y, dayW - 1, dayH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(`${DAYS_FR[visibleIdx[k]]} ${d.getDate()}/${d.getMonth()+1}`, cx + 2, y + 3.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    const dayTotal = Number(tipsByDay[dayKey(d)]) || 0;
    doc.text(dayTotal > 0 ? fmtMoney(dayTotal) : "—", cx + 2, y + 7.5);
  });
  y += dayH + 6;

  // ─ Tableau principal : Employé | (J×Entrée+Sortie) | Hrs | Salaire | Pourb | Total
  // Largeurs des colonnes (en mm)
  // Total à allouer : contentW = 255.4 mm en landscape Letter avec M=12
  const COL_EMP = 36;
  const COL_DAY_PAIR = (contentW - COL_EMP - 14 - 18 - 18 - 22) / weekDays.length; // ce qui reste
  const COL_ENTRY = COL_DAY_PAIR / 2;
  const COL_EXIT = COL_DAY_PAIR / 2;
  const COL_HRS = 14;
  const COL_SAL = 18;
  const COL_TIP = 18;
  const COL_TOTAL = 22;

  function drawTableHeader() {
    ensureSpace(11);
    let cx = M;
    doc.setFillColor(...COLOR_HEADER_FILL);
    doc.rect(M, y, contentW, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT);
    // Employé
    doc.text("EMPLOYÉ", cx + 2, y + 6);
    cx += COL_EMP;
    // Jours
    weekDays.forEach((d, k) => {
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.2);
      doc.line(cx, y, cx, y + 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`${DAYS_FR[visibleIdx[k]]} ${d.getDate()}/${d.getMonth()+1}`, cx + COL_DAY_PAIR / 2, y + 3.8, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text("Entrée", cx + COL_ENTRY / 2, y + 8, { align: "center" });
      doc.text("Sortie", cx + COL_ENTRY + COL_EXIT / 2, y + 8, { align: "center" });
      cx += COL_DAY_PAIR;
    });
    // Hrs / Salaire / Pourb / Total
    [["HRS", COL_HRS], ["SALAIRE", COL_SAL], ["POURB.", COL_TIP], ["TOTAL", COL_TOTAL]].forEach(([label, w]) => {
      doc.setDrawColor(...COLOR_BORDER);
      doc.line(cx, y, cx, y + 10);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(label, cx + w / 2, y + 6, { align: "center" });
      cx += w;
    });
    // Bordure top et bottom
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + contentW, y);
    doc.line(M, y + 10, M + contentW, y + 10);
    y += 10;
  }

  drawTableHeader();

  // ─ Lignes employés ───────────────────────────────────
  const rowH = 6;
  empRows.forEach((row, idx) => {
    ensureSpace(rowH + 2);
    // Si on est en haut d'une nouvelle page, redessiner l'en-tête de table
    if (y < 20) {
      drawTableHeader();
    }
    // Fond alterné
    if (idx % 2 === 1) {
      doc.setFillColor(248, 242, 228);
      doc.rect(M, y, contentW, rowH, "F");
    }
    let cx = M;
    // Employé
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_TEXT);
    const empLabel = (row.emp.name || "") + (row.isManual ? " (EXTRA)" : "");
    doc.text(_truncatePdf(doc, empLabel, COL_EMP - 4), cx + 2, y + 3.3);
    // Section + taux
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    const sectionLabel = row.group === "cuisine" ? "Cuisine" : "Service+Adm";
    doc.text(`${sectionLabel} · ${row.rate.toFixed(2)}$/h${row.isSal ? " · FIXE" : ""}`, cx + 2, y + 5.3);
    cx += COL_EMP;
    // Jours (entrée / sortie)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT);
    row.daily.forEach(d => {
      const startVal = d.actualShift?.start || "—";
      const endVal = d.actualShift?.end || "—";
      doc.text(startVal, cx + COL_ENTRY / 2, y + 4, { align: "center" });
      doc.text(endVal, cx + COL_ENTRY + COL_EXIT / 2, y + 4, { align: "center" });
      cx += COL_DAY_PAIR;
    });
    // Hrs
    doc.setFont("helvetica", "bold");
    doc.text(row.totalHours ? `${fmtHours(row.totalHours)}h` : "—", cx + COL_HRS / 2, y + 4, { align: "center" });
    cx += COL_HRS;
    // Salaire
    doc.setFont("helvetica", "normal");
    doc.text(row.grossWage ? fmtMoney(row.grossWage) : "—", cx + COL_SAL / 2, y + 4, { align: "center" });
    cx += COL_SAL;
    // Pourboire
    doc.setTextColor(...COLOR_GREEN);
    doc.text(row.tipShare > 0 ? fmtMoney(row.tipShare) : "—", cx + COL_TIP / 2, y + 4, { align: "center" });
    cx += COL_TIP;
    // Total
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLOR_TEXT);
    doc.text(row.totalPay ? fmtMoney(row.totalPay) : "—", cx + COL_TOTAL / 2, y + 4, { align: "center" });

    // Ligne séparatrice
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.15);
    doc.line(M, y + rowH, M + contentW, y + rowH);
    y += rowH;
  });

  // ─ Ligne totaux ─────────────────────────────────────
  ensureSpace(7);
  doc.setFillColor(...COLOR_HEADER_FILL);
  doc.rect(M, y, contentW, 7, "F");
  let cxT = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_TEXT);
  doc.text(`TOTAUX (${empRows.length} employé${empRows.length > 1 ? "s" : ""})`, cxT + 2, y + 4.5);
  cxT += COL_EMP + weekDays.length * COL_DAY_PAIR;
  doc.text(`${fmtHours(sumActualHours)}h`, cxT + COL_HRS / 2, y + 4.5, { align: "center" });
  cxT += COL_HRS;
  doc.text(fmtMoney(sumGross), cxT + COL_SAL / 2, y + 4.5, { align: "center" });
  cxT += COL_SAL;
  doc.setTextColor(...COLOR_GREEN);
  doc.text(fmtMoney(sumTips), cxT + COL_TIP / 2, y + 4.5, { align: "center" });
  cxT += COL_TIP;
  doc.setTextColor(...COLOR_TEXT);
  doc.setFontSize(9);
  doc.text(fmtMoney(sumTotal), cxT + COL_TOTAL / 2, y + 4.5, { align: "center" });
  doc.setDrawColor(...COLOR_TEXT);
  doc.setLineWidth(0.4);
  doc.line(M, y, M + contentW, y);
  doc.line(M, y + 7, M + contentW, y + 7);
  y += 7 + 6;

  // ─ Récap par employé (pourboires + bonus $/h) ────────
  const recapRows = empRows.filter(r => r.tipShare > 0 || r.tipEligibleHours > 0);
  if (recapRows.length > 0) {
    ensureSpace(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text("Pourboires par employé", M, y);
    y += 5;

    // Grille 4 colonnes
    const RECAP_COLS = 4;
    const recapW = (contentW - (RECAP_COLS - 1) * 3) / RECAP_COLS;
    const recapH = 22;
    recapRows.forEach((r, i) => {
      const col = i % RECAP_COLS;
      const rowI = Math.floor(i / RECAP_COLS);
      if (col === 0 && rowI > 0) y += recapH + 3;
      ensureSpace(recapH);
      const cx = M + col * (recapW + 3);
      const isKitchen = r.group === "cuisine";
      const ringColor = isKitchen ? COLOR_ACCENT : COLOR_BLUE;
      const tint = isKitchen ? [254, 245, 220] : [228, 240, 252];

      doc.setFillColor(...tint);
      doc.setDrawColor(...ringColor);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, y, recapW, recapH, 1.5, 1.5, "FD");
      // Barre latérale
      doc.setFillColor(...ringColor);
      doc.rect(cx, y, 1.2, recapH, "F");

      // Nom
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(_truncatePdf(doc, r.emp.name || "", recapW - 6), cx + 4, y + 5);
      // Groupe
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text(isKitchen ? "Cuisine" : "Service + Admin", cx + 4, y + 8.5);
      // Montant
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(...COLOR_GREEN);
      doc.text(fmtMoney(r.tipShare), cx + 4, y + 13.5);

      // Bonus $/h pill
      if (r.totalHours > 0 && r.tipShare > 0) {
        const tipPerHour = r.tipShare / r.totalHours;
        const effective = r.rate + tipPerHour;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(...COLOR_ACCENT);
        doc.text(`+ ${fmtMoney(tipPerHour)}/h`, cx + 4, y + 17.5);
        // Effectif
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(...COLOR_TEXT_LIGHT);
        if (r.rate > 0) {
          doc.text(`Effectif : ${fmtMoney(effective)}/h (base ${fmtMoney(r.rate)})`, cx + 4, y + 20.5);
        }
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...COLOR_TEXT_LIGHT);
        doc.text(`${fmtHours(r.tipEligibleHours)}h éligibles`, cx + 4, y + 18);
      }
    });
    y += recapH + 3;
  }

  // ─ Footer (toutes les pages) ─────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = H - 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_TEXT_LIGHT);
    const now = new Date();
    const genDate = now.toLocaleString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`Généré le ${genDate} · Bochica Café Bistro`, M, fy);
    doc.text(`Page ${p} / ${totalPages}`, W - M, fy, { align: "right" });
  }

  // ─ Téléchargement ────────────────────────────────────
  const fileName = `Bochica_Paie_Sem${weekNum}_${dayKey(weekStart)}.pdf`;
  doc.save(fileName);
  toast(`Rapport PDF généré : ${fileName}`, "success", 4000);
}

// Petit helper : tronque un texte pour qu'il tienne dans une largeur (en mm)
// donnée dans le PDF, avec ellipsis. Utilise getTextWidth du contexte courant.
function _truncatePdf(doc, text, maxW) {
  if (!text) return "";
  if (doc.getTextWidth(text) <= maxW) return text;
  const ellipsis = "…";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.getTextWidth(text.slice(0, mid) + ellipsis) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

// ═══════════════════════════════════════════════════════════════
// v3.21.0 — Rapport PDF bi-mensuel (2 semaines de paie)
// ═══════════════════════════════════════════════════════════════
// Le resto paie aux 2 semaines, alors on regroupe la semaine courante +
// la précédente en un seul PDF. Évite de produire 2 rapports séparés.

// Helper : calcule toutes les données d'une semaine donnée (offset relatif
// à aujourd'hui). Fetch le doc Firestore si ce n'est pas celui auquel on
// est déjà abonné. Retourne { weekStart, weekEnd, weekNum, weekLabel,
// startLabel, endLabel, empRows, sums, tipsByDay, totalTips, poolCuisine,
// poolService }.
async function _computePayrollWeekData(offset) {
  const weekStart = getWeekStart(offset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]);
  const startLabel = weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" });
  const endLabel = weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" });
  const weekLabel = `${startLabel} – ${endLabel}`;

  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);

  // Fetch du doc payroll pour cette semaine. Si c'est la semaine courante
  // déjà subscribed, on utilise payrollWeekData (évite un appel inutile).
  const wid = payrollWeekId(weekStart);
  let weekData;
  if (offset === payrollWeekOffset && payrollWeekData && _payrollSubscribedWid === wid) {
    weekData = payrollWeekData;
  } else {
    try {
      const snap = await db.collection("payroll").doc(wid).get();
      weekData = snap.exists ? snap.data() : null;
    } catch (err) {
      console.error(`Failed to fetch payroll/${wid}:`, err);
      weekData = null;
    }
  }

  const tipShares = payrollSettings?.tipShares || { cuisine: 0.25, service: 0.75 };
  const tipsByDay = weekData?.tipsByDay || {};
  const legacyTotal = Number(weekData?.totalTips) || 0;
  const totalTips = weekDays.reduce((s, d) => s + (Number(tipsByDay[dayKey(d)]) || 0), 0) || legacyTotal;
  const poolCuisine = totalTips * (Number(tipShares.cuisine) || 0);
  const poolService = totalTips * (Number(tipShares.service) || 0);

  // Liste fusionnée employés réels + extras de la semaine (avec ordre custom)
  const manualEmps = Array.isArray(weekData?.manualEmployees) ? weekData.manualEmployees : [];
  const order = Array.isArray(weekData?.empOrder) ? weekData.empOrder : [];
  const allRaw = [...employees, ...manualEmps];
  const allEmps = order.length === 0 ? allRaw
    : allRaw.slice().sort((a, b) => {
        const ai = order.indexOf(a.id); const bi = order.indexOf(b.id);
        return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
      });

  // Section overrides de la semaine
  const sectionOverrides = weekData?.sectionOverrides || {};
  function effGroup(emp) {
    const ov = sectionOverrides[emp.id];
    if (ov === "excluded") return "excluded";
    if (ov === "cuisine") return "cuisine";
    if (ov === "service") return "service";
    return tipGroupOf(emp);
  }

  // Pré-calcul des pools journaliers
  const dailyCalc = weekDays.map((d, k) => {
    const dk = dayKey(d);
    const dowIdx = visibleIdx[k];
    const dayTotal = Number(tipsByDay[dk]) || 0;
    const serviceWin = getServiceWindow(dowIdx);
    let kHrs = 0, sHrs = 0;
    for (const emp of allEmps) {
      const g = effGroup(emp);
      if (g === "excluded") continue;
      const shift = (weekData?.actualShifts || {})[emp.id]?.[dk] || null;
      const tipHrs = serviceWin ? intersectShiftHours(shift, serviceWin) : 0;
      if (g === "cuisine") kHrs += tipHrs; else sHrs += tipHrs;
    }
    return {
      dk, dowIdx, serviceWin,
      dayTotal,
      poolK: dayTotal * (Number(tipShares.cuisine) || 0),
      poolS: dayTotal * (Number(tipShares.service) || 0),
      kHrs, sHrs
    };
  });

  // Calculs par employé
  const empRows = allEmps.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const group = effGroup(emp);
    let totalHours = 0, plannedHours = 0, tipEligibleHours = 0, tipShare = 0;
    const daily = weekDays.map((d, k) => {
      const dk = dayKey(d);
      const actualShift = (weekData?.actualShifts || {})[emp.id]?.[dk] || null;
      const plannedShift = (emp.shifts || {})[dk] || null;
      const sw = dailyCalc[k].serviceWin;
      const hours = hoursFromShift(actualShift);
      const pHours = hoursFromShift(plannedShift);
      const tipHours = sw ? intersectShiftHours(actualShift, sw) : 0;
      let dayTip = 0;
      if (group !== "excluded") {
        const pool = group === "cuisine" ? dailyCalc[k].poolK : dailyCalc[k].poolS;
        const totH = group === "cuisine" ? dailyCalc[k].kHrs : dailyCalc[k].sHrs;
        dayTip = (totH > 0 && tipHours > 0) ? (tipHours / totH) * pool : 0;
      }
      totalHours += hours; plannedHours += pHours;
      tipEligibleHours += tipHours; tipShare += dayTip;
      return { dk, actualShift, hours, tipHours, dayTip };
    });
    const grossWage = isSal ? (fixedHours * rate) : (totalHours * rate);
    return {
      emp, rate, isSal, fixedHours, group, daily,
      totalHours, plannedHours, tipEligibleHours, tipShare, grossWage,
      totalPay: grossWage + tipShare,
      isManual: manualEmps.some(m => m.id === emp.id)
    };
  });

  const sums = {
    gross: empRows.reduce((s, r) => s + r.grossWage, 0),
    tips: empRows.reduce((s, r) => s + r.tipShare, 0),
    total: empRows.reduce((s, r) => s + r.totalPay, 0),
    hours: empRows.reduce((s, r) => s + r.totalHours, 0)
  };

  return {
    weekStart, weekEnd, weekNum, weekLabel, startLabel, endLabel,
    weekDays, visibleIdx,
    empRows, sums,
    tipsByDay, totalTips, poolCuisine, poolService,
    tipShares
  };
}

// ─ Génération du PDF bi-mensuel (2 semaines) ──────────────
async function generateBiWeeklyPDF() {
  if (typeof window.jspdf === "undefined") {
    toast("La bibliothèque PDF n'est pas chargée. Rechargez la page.", "error");
    return;
  }
  toast("Préparation du rapport 2 semaines…", "info", 2000);

  // Récupère les 2 semaines : courante (offset = payrollWeekOffset) + précédente
  let w2, w1;
  try {
    w2 = await _computePayrollWeekData(payrollWeekOffset);       // semaine la plus récente
    w1 = await _computePayrollWeekData(payrollWeekOffset - 1);   // semaine précédente
  } catch (err) {
    console.error("Bi-weekly fetch failed:", err);
    toast("Erreur récupération des données : " + (err.message || err), "error", 5000);
    return;
  }

  // Agréger les employés des 2 semaines (union des IDs, ordre de la semaine 2)
  const empMap = new Map();
  // Ordre : on prend l'ordre de la semaine la plus récente, puis ajoute les
  // employés qui n'apparaissent que dans la semaine précédente.
  for (const r of w2.empRows) {
    empMap.set(r.emp.id, {
      emp: r.emp,
      isManual: r.isManual,
      isSal: r.isSal,
      rate: r.rate,
      group: r.group, // section effective sem 2 (peut différer sem 1)
      hrs1: 0, hrs2: r.totalHours,
      tips1: 0, tips2: r.tipShare,
      sal1: 0, sal2: r.grossWage,
      total1: 0, total2: r.totalPay,
      eligible1: 0, eligible2: r.tipEligibleHours
    });
  }
  for (const r of w1.empRows) {
    if (empMap.has(r.emp.id)) {
      const e = empMap.get(r.emp.id);
      e.hrs1 = r.totalHours;
      e.tips1 = r.tipShare;
      e.sal1 = r.grossWage;
      e.total1 = r.totalPay;
      e.eligible1 = r.tipEligibleHours;
    } else {
      empMap.set(r.emp.id, {
        emp: r.emp,
        isManual: r.isManual,
        isSal: r.isSal,
        rate: r.rate,
        group: r.group,
        hrs1: r.totalHours, hrs2: 0,
        tips1: r.tipShare, tips2: 0,
        sal1: r.grossWage, sal2: 0,
        total1: r.totalPay, total2: 0,
        eligible1: r.tipEligibleHours, eligible2: 0
      });
    }
  }
  const aggregatedRows = Array.from(empMap.values());
  if (aggregatedRows.length === 0) {
    toast("Aucun employé sur ces 2 semaines.", "warning");
    return;
  }

  const sumsCombined = {
    gross: w1.sums.gross + w2.sums.gross,
    tips: w1.sums.tips + w2.sums.tips,
    total: w1.sums.total + w2.sums.total,
    hours: w1.sums.hours + w2.sums.hours
  };

  // ─ Setup jsPDF — landscape Letter ─────────────────────
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279.4, H = 215.9;
  const M = 12;
  const contentW = W - 2 * M;

  const COLOR_CREAM      = [253, 246, 231];
  const COLOR_TEXT       = [14, 13, 12];
  const COLOR_TEXT_LIGHT = [110, 95, 80];
  const COLOR_BORDER     = [200, 188, 165];
  const COLOR_ACCENT     = [247, 179, 44];
  const COLOR_BLUE       = [74, 144, 226];
  const COLOR_RED        = [231, 76, 60];
  const COLOR_GREEN      = [125, 191, 102];
  const COLOR_HEADER_FILL = [232, 220, 200];
  const COLOR_TINT_ALT   = [248, 242, 228];

  let y = 0;
  let currentPage = 1;

  function paintBackground() {
    doc.setFillColor(...COLOR_CREAM);
    doc.rect(0, 0, W, H, "F");
  }
  function drawTricolore(cy, triW = 50) {
    const triX0 = (W - triW) / 2;
    const triH = 1.4;
    doc.setFillColor(...COLOR_ACCENT); doc.rect(triX0, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_BLUE);   doc.rect(triX0 + triW / 3, cy, triW / 3, triH, "F");
    doc.setFillColor(...COLOR_RED);    doc.rect(triX0 + 2 * triW / 3, cy, triW / 3, triH, "F");
  }
  function ensureSpace(needed) {
    if (y + needed > H - 14) {
      doc.addPage(); currentPage++; paintBackground();
      y = 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLOR_TEXT);
      doc.text(`BOCHICA · Paie 2 sem. ${w1.weekNum} + ${w2.weekNum}`, M, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_TEXT_LIGHT);
      doc.text(`${w1.startLabel} → ${w2.endLabel}`, W - M, y, { align: "right" });
      y += 2;
      doc.setFillColor(...COLOR_ACCENT);
      doc.rect(M, y, contentW, 0.6, "F");
      y += 5;
    }
  }

  // ─ Header complet ───────────────────────────────────
  paintBackground();
  y = 12;
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(...COLOR_TEXT);
  doc.text("BOCHICA", W / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text("Restaurant Colombien", W / 2, y, { align: "center" });
  y += 2;
  drawTricolore(y);
  y += 7;
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...COLOR_TEXT);
  doc.text(`Rapport de paie — 2 semaines (S${w1.weekNum} + S${w2.weekNum})`, W / 2, y, { align: "center" });
  y += 4.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...COLOR_TEXT_LIGHT);
  doc.text(`${w1.startLabel} → ${w2.endLabel}`, W / 2, y, { align: "center" });
  y += 7;

  // ─ KPI combinés (4 cards) ──────────────────────────
  const kpis = [
    { label: "Total à payer (2 sem)", value: fmtMoney(sumsCombined.total), color: COLOR_ACCENT },
    { label: "Salaires bruts (2 sem)", value: fmtMoney(sumsCombined.gross), color: COLOR_BLUE },
    { label: "Pourboires (2 sem)", value: fmtMoney(sumsCombined.tips), color: COLOR_GREEN },
    { label: "Heures totales (2 sem)", value: `${fmtHours(sumsCombined.hours)} h`, color: COLOR_TEXT }
  ];
  const cardW = (contentW - 3 * 4) / 4;
  const cardH = 14;
  kpis.forEach((k, i) => {
    const cx = M + i * (cardW + 4);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "FD");
    doc.setFillColor(...k.color); doc.rect(cx, y, 1.2, cardH, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(k.label.toUpperCase(), cx + 3.5, y + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...COLOR_TEXT);
    doc.text(k.value, cx + 3.5, y + 10);
  });
  y += cardH + 6;

  // ─ Sous-totaux par semaine (mini cards) ────────────
  ensureSpace(22);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...COLOR_TEXT);
  doc.text("Détail par semaine", M, y);
  y += 4;
  const halfW = (contentW - 6) / 2;
  [[w1, "Semaine"], [w2, "Semaine"]].forEach(([w, lbl], i) => {
    const cx = M + i * (halfW + 6);
    doc.setFillColor(...COLOR_HEADER_FILL);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, halfW, 16, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...COLOR_TEXT);
    doc.text(`${lbl} ${w.weekNum}`, cx + 4, y + 5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(w.weekLabel, cx + 4, y + 9);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...COLOR_TEXT);
    const lineY = y + 13;
    doc.text(`${fmtHours(w.sums.hours)}h · Sal ${fmtMoney(w.sums.gross)} · Pourb ${fmtMoney(w.sums.tips)} · Total ${fmtMoney(w.sums.total)}`, cx + 4, lineY);
  });
  y += 16 + 6;

  // ─ Tableau récap par employé : Nom | Section | Hrs S1 | Hrs S2 | Hrs Tot | Sal S1 | Sal S2 | Pourb S1 | Pourb S2 | Total à payer
  ensureSpace(11);
  const COL_NAME = 44;
  const COL_SECTION = 24;
  const COL_HRS = 14;       // ×3 (S1, S2, Tot)
  const COL_SAL = 20;       // ×2 (S1, S2)
  const COL_TIP = 20;       // ×2 (S1, S2)
  const COL_TOTAL = 31;
  // Total : 44 + 24 + 14*3 + 20*2 + 20*2 + 31 = 221 mm (tient dans 255)

  function drawTableHeader() {
    let cx = M;
    doc.setFillColor(...COLOR_HEADER_FILL); doc.rect(M, y, contentW, 11, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7); doc.setTextColor(...COLOR_TEXT);
    doc.text("EMPLOYÉ", cx + 2, y + 7); cx += COL_NAME;
    doc.line(cx, y, cx, y + 11);
    doc.text("SECTION", cx + COL_SECTION / 2, y + 7, { align: "center" }); cx += COL_SECTION;
    // Bloc Heures (3 colonnes)
    doc.line(cx, y, cx, y + 11);
    doc.setFontSize(6); doc.text("HEURES", cx + (COL_HRS * 3) / 2, y + 3.5, { align: "center" });
    doc.setFontSize(7);
    doc.text(`S${w1.weekNum}`, cx + COL_HRS / 2, y + 8, { align: "center" }); cx += COL_HRS;
    doc.text(`S${w2.weekNum}`, cx + COL_HRS / 2, y + 8, { align: "center" }); cx += COL_HRS;
    doc.text("Total", cx + COL_HRS / 2, y + 8, { align: "center" }); cx += COL_HRS;
    // Bloc Salaire (2 colonnes)
    doc.line(cx, y, cx, y + 11);
    doc.setFontSize(6); doc.text("SALAIRE", cx + (COL_SAL * 2) / 2, y + 3.5, { align: "center" });
    doc.setFontSize(7);
    doc.text(`S${w1.weekNum}`, cx + COL_SAL / 2, y + 8, { align: "center" }); cx += COL_SAL;
    doc.text(`S${w2.weekNum}`, cx + COL_SAL / 2, y + 8, { align: "center" }); cx += COL_SAL;
    // Bloc Pourboire (2 colonnes)
    doc.line(cx, y, cx, y + 11);
    doc.setFontSize(6); doc.text("POURBOIRE", cx + (COL_TIP * 2) / 2, y + 3.5, { align: "center" });
    doc.setFontSize(7);
    doc.text(`S${w1.weekNum}`, cx + COL_TIP / 2, y + 8, { align: "center" }); cx += COL_TIP;
    doc.text(`S${w2.weekNum}`, cx + COL_TIP / 2, y + 8, { align: "center" }); cx += COL_TIP;
    // Total
    doc.line(cx, y, cx, y + 11);
    doc.setFontSize(8); doc.text("TOTAL", cx + COL_TOTAL / 2, y + 7, { align: "center" });
    doc.setDrawColor(...COLOR_BORDER); doc.setLineWidth(0.3);
    doc.line(M, y, M + contentW, y);
    doc.line(M, y + 11, M + contentW, y + 11);
    y += 11;
  }
  drawTableHeader();

  // ─ Lignes employés ──────────────────────────────────
  const rowH = 7;
  aggregatedRows.forEach((r, idx) => {
    ensureSpace(rowH + 2);
    if (y < 20) drawTableHeader();
    if (idx % 2 === 1) {
      doc.setFillColor(...COLOR_TINT_ALT); doc.rect(M, y, contentW, rowH, "F");
    }
    let cx = M;
    // Nom (+ EXTRA badge)
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...COLOR_TEXT);
    const empLbl = (r.emp.name || "") + (r.isManual ? " (EXTRA)" : "");
    doc.text(_truncatePdf(doc, empLbl, COL_NAME - 4), cx + 2, y + 4.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(...COLOR_TEXT_LIGHT);
    doc.text(`${r.rate.toFixed(2)}$/h${r.isSal ? " · FIXE" : ""}`, cx + 2, y + 6.2);
    cx += COL_NAME;
    // Section
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...COLOR_TEXT);
    const secLbl = r.group === "cuisine" ? "Cuisine"
                 : r.group === "service" ? "Service"
                 : r.group === "excluded" ? "Exclu" : r.group;
    doc.text(secLbl, cx + COL_SECTION / 2, y + 4.5, { align: "center" });
    cx += COL_SECTION;
    // Heures S1 / S2 / Total
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...COLOR_TEXT);
    doc.text(r.hrs1 ? `${fmtHours(r.hrs1)}h` : "—", cx + COL_HRS / 2, y + 4.5, { align: "center" }); cx += COL_HRS;
    doc.text(r.hrs2 ? `${fmtHours(r.hrs2)}h` : "—", cx + COL_HRS / 2, y + 4.5, { align: "center" }); cx += COL_HRS;
    doc.setFont("helvetica", "bold");
    const totHrs = r.hrs1 + r.hrs2;
    doc.text(totHrs ? `${fmtHours(totHrs)}h` : "—", cx + COL_HRS / 2, y + 4.5, { align: "center" }); cx += COL_HRS;
    // Salaire S1 / S2
    doc.setFont("helvetica", "normal");
    doc.text(r.sal1 ? fmtMoney(r.sal1) : "—", cx + COL_SAL / 2, y + 4.5, { align: "center" }); cx += COL_SAL;
    doc.text(r.sal2 ? fmtMoney(r.sal2) : "—", cx + COL_SAL / 2, y + 4.5, { align: "center" }); cx += COL_SAL;
    // Pourboire S1 / S2 (en vert)
    doc.setTextColor(...COLOR_GREEN);
    doc.text(r.tips1 > 0 ? fmtMoney(r.tips1) : "—", cx + COL_TIP / 2, y + 4.5, { align: "center" }); cx += COL_TIP;
    doc.text(r.tips2 > 0 ? fmtMoney(r.tips2) : "—", cx + COL_TIP / 2, y + 4.5, { align: "center" }); cx += COL_TIP;
    // Total à payer (gras, fond accent léger)
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...COLOR_TEXT);
    const totalPay = r.total1 + r.total2;
    doc.text(totalPay ? fmtMoney(totalPay) : "—", cx + COL_TOTAL / 2, y + 4.5, { align: "center" });

    doc.setDrawColor(...COLOR_BORDER); doc.setLineWidth(0.15);
    doc.line(M, y + rowH, M + contentW, y + rowH);
    y += rowH;
  });

  // ─ Ligne totaux ─────────────────────────────────────
  ensureSpace(8);
  doc.setFillColor(...COLOR_HEADER_FILL);
  doc.rect(M, y, contentW, 8, "F");
  let cxT = M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...COLOR_TEXT);
  doc.text(`TOTAUX (${aggregatedRows.length} employé${aggregatedRows.length > 1 ? "s" : ""})`, cxT + 2, y + 5);
  cxT += COL_NAME + COL_SECTION;
  // 3 colonnes heures
  doc.text(fmtHours(w1.sums.hours) + "h", cxT + COL_HRS / 2, y + 5, { align: "center" }); cxT += COL_HRS;
  doc.text(fmtHours(w2.sums.hours) + "h", cxT + COL_HRS / 2, y + 5, { align: "center" }); cxT += COL_HRS;
  doc.text(fmtHours(sumsCombined.hours) + "h", cxT + COL_HRS / 2, y + 5, { align: "center" }); cxT += COL_HRS;
  // 2 colonnes salaire
  doc.text(fmtMoney(w1.sums.gross), cxT + COL_SAL / 2, y + 5, { align: "center" }); cxT += COL_SAL;
  doc.text(fmtMoney(w2.sums.gross), cxT + COL_SAL / 2, y + 5, { align: "center" }); cxT += COL_SAL;
  // 2 colonnes pourboire
  doc.setTextColor(...COLOR_GREEN);
  doc.text(fmtMoney(w1.sums.tips), cxT + COL_TIP / 2, y + 5, { align: "center" }); cxT += COL_TIP;
  doc.text(fmtMoney(w2.sums.tips), cxT + COL_TIP / 2, y + 5, { align: "center" }); cxT += COL_TIP;
  // Total combiné
  doc.setTextColor(...COLOR_TEXT); doc.setFontSize(10);
  doc.text(fmtMoney(sumsCombined.total), cxT + COL_TOTAL / 2, y + 5, { align: "center" });
  doc.setDrawColor(...COLOR_TEXT); doc.setLineWidth(0.4);
  doc.line(M, y, M + contentW, y);
  doc.line(M, y + 8, M + contentW, y + 8);
  y += 8 + 6;

  // ─ Footer toutes les pages ──────────────────────────
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fy = H - 6;
    doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(...COLOR_TEXT_LIGHT);
    const now = new Date();
    const genDate = now.toLocaleString("fr-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    doc.text(`Généré le ${genDate} · Bochica Café Bistro · Période de paie 2 semaines`, M, fy);
    doc.text(`Page ${p} / ${totalPages}`, W - M, fy, { align: "right" });
  }

  const fileName = `Bochica_Paie2Sem_S${w1.weekNum}-${w2.weekNum}_${dayKey(w1.weekStart)}.pdf`;
  doc.save(fileName);
  toast(`Rapport PDF 2 semaines généré : ${fileName}`, "success", 4000);
}

// ═══════════════════════════════════════════════════════════════
// v3.27.0 — Modal d'édition de shift + drag&drop pour Salaires
// ═══════════════════════════════════════════════════════════════
// Les shifts sont stockés dans payroll/{weekId}.actualShifts indexés par
// empId + dk (date YYYY-MM-DD). Modal + handlers payroll-spécifiques.

// État local pour le drag de cartes shift (différent de payrollRowDragId
// qui gère le réordonnement vertical des employés)
let _payrollShiftDragEmpId = null;
let _payrollShiftDragFromDk = null;

// Ouvre une modal pour créer/modifier un shift réel (par dk)
function openPayrollShiftModal(empId, dk) {
  if (payrollWeekData?.locked) {
    toast("Semaine verrouillée — déverrouille avant de modifier.", "warning");
    return;
  }
  const allEmps = getAllPayrollEmployees();
  const emp = allEmps.find(e => e.id === empId);
  if (!emp) return;
  const currentShift = getActualShift(empId, dk) || {};
  const startVal = currentShift.start || "";
  const endVal = currentShift.end || "";
  const hasShift = !!(startVal && endVal);
  // Date longue
  const [yy, mm, ddNum] = dk.split("-").map(Number);
  const dateObj = new Date(yy, mm - 1, ddNum);
  const dayLabel = dateObj.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });
  // Planifié (rappel)
  const plannedShift = getPlannedShift(empId, dk);
  const plannedHint = plannedShift?.start && plannedShift?.end
    ? `<span style="color:var(--text3);font-size:11px;font-style:italic;margin-left:6px">Prévu : ${plannedShift.start} → ${plannedShift.end}</span>`
    : "";

  showModal(`<div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} ${hasShift ? "Modifier le shift" : "Saisir un shift"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 var(--sp-3);text-transform:capitalize">
      ${icon("user", 12)} <strong>${esc(emp.name || "")}</strong> · ${dayLabel}${plannedHint}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-2)">
      <label>Entrée
        <select id="payroll-shift-start">${buildPayrollTimeOptions(startVal)}</select>
      </label>
      <label>Sortie
        <select id="payroll-shift-end">${buildPayrollTimeOptions(endVal)}</select>
      </label>
    </div>
    <div class="modal-actions" style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3)">
      ${hasShift ? `<button class="btn-cancel" style="color:#a23a36" onclick="deletePayrollShift('${empId}','${dk}')">${icon("trash", 14)} Supprimer</button>` : `<div></div>`}
      <div style="display:flex;gap:var(--sp-2)">
        <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
        <button class="btn btn-primary" onclick="savePayrollShiftFromModal('${empId}','${dk}')">${icon("check", 14)} ${hasShift ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </div>
  </div>`);
}

async function savePayrollShiftFromModal(empId, dk) {
  const start = document.getElementById("payroll-shift-start").value;
  const end = document.getElementById("payroll-shift-end").value;
  if (!start || !end) return toast("Saisis l'entrée et la sortie.", "warning");
  // updateActualShift gère le read-then-write pour ne rien effacer
  await updateActualShift(empId, dk, "start", start);
  await updateActualShift(empId, dk, "end", end);
  closeModal();
  toast("Shift enregistré.", "success", 2000);
}

async function deletePayrollShift(empId, dk) {
  await clearActualShift(empId, dk);
  closeModal();
  toast("Shift supprimé.", "success", 2000);
}

// ─ Drag & drop des cartes shift entre jours ─────────────
// Différent de payrollRowDrag* qui gère le réordonnement vertical des employés.
function payrollShiftDragStart(e, empId, fromDk) {
  if (payrollWeekData?.locked) { e.preventDefault(); return; }
  _payrollShiftDragEmpId = empId;
  _payrollShiftDragFromDk = fromDk;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", `${empId}|${fromDk}`); } catch (_) {}
  }
  e.stopPropagation();
  const card = e.currentTarget;
  setTimeout(() => card && card.classList.add("is-dragging"), 0);
}

function payrollShiftDragOver(e, targetDk) {
  if (!_payrollShiftDragEmpId || targetDk === _payrollShiftDragFromDk) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("is-drop-target");
}

function payrollShiftDragLeave(e) {
  const cell = e.currentTarget;
  if (!cell) return;
  const related = e.relatedTarget;
  if (related && cell.contains(related)) return;
  cell.classList.remove("is-drop-target");
}

function payrollShiftDragEnd(e) {
  if (e) e.stopPropagation();
  document.querySelectorAll(".shift-card.is-dragging").forEach(c => c.classList.remove("is-dragging"));
  document.querySelectorAll(".schedule-empgrid-cell.is-drop-target").forEach(c => c.classList.remove("is-drop-target"));
  _payrollShiftDragEmpId = null;
  _payrollShiftDragFromDk = null;
}

async function payrollShiftDrop(e, targetEmpId, targetDk) {
  e.preventDefault();
  e.stopPropagation();
  const empId = _payrollShiftDragEmpId;
  const fromDk = _payrollShiftDragFromDk;
  payrollShiftDragEnd();
  if (!empId || !fromDk || fromDk === targetDk) return;
  // On limite au même employé
  if (empId !== targetEmpId) {
    toast("On ne peut déplacer un shift que vers un autre jour du même employé.", "warning", 4000);
    return;
  }
  const src = getActualShift(empId, fromDk);
  if (!src || !src.start || !src.end) return;
  const tgt = (payrollWeekData?.actualShifts || {})[empId]?.[targetDk];
  if (tgt && tgt.start && tgt.end) {
    if (!confirm(`Un shift existe déjà : ${tgt.start} → ${tgt.end}. Le remplacer par ${src.start} → ${src.end} ?`)) return;
  }
  await updateActualShift(empId, targetDk, "start", src.start);
  await updateActualShift(empId, targetDk, "end", src.end);
  await clearActualShift(empId, fromDk);
  toast(`Shift déplacé vers le ${targetDk.slice(8,10)}/${targetDk.slice(5,7)}`, "success", 2500);
}
