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

// dayKey : retourne une clé "YYYY-MM-DD" basée sur la date LOCALE.
//
// ⚠ FIX critique v3.17.3 — Avant on utilisait `date.toISOString().slice(0,10)`,
// qui retourne la date UTC. Pour Québec (UTC-4 ou -5), un punch fait à 21h
// le soir basculait dans le jour SUIVANT en UTC (21h EDT = 01h UTC du J+1).
// Conséquences observées :
//   • Punch d'entrée à 9h sur "2026-05-26" — OK
//   • Punch de sortie à 21h enregistré sur "2026-05-27" — BUG
//   • Le système ne voyait plus l'entrée du jour → réaffichait le bouton ENTRÉE
//   • Heures éparpillées sur plusieurs jours dans le tableau de paie
// La nouvelle implémentation utilise les getters locaux du Date object pour
// rester aligné sur le fuseau horaire de l'utilisateur (le navigateur).
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Clé "YYYY-MM-DD" d'aujourd'hui (date locale).
function todayKey() { return dayKey(new Date()); }

// ─── Taux horaire effectif à une date donnée (v3.52.0) ───────────────
// Un employé peut avoir un HISTORIQUE de taux daté : emp.rateHistory =
// [{ rate, from:"YYYY-MM-DD" }, ...]. Le taux applicable à une date est
// celui de l'entrée la plus récente dont `from` <= dateKey. Avant la 1re
// entrée → on prend la plus ancienne connue. Sans historique → emp.hourlyRate.
//
// Comparaison de chaînes "YYYY-MM-DD" = comparaison chronologique (sûre).
// `dateKey` doit être une clé jour locale (dayKey()/todayKey()).
function effectiveHourlyRate(emp, dateKey) {
  const hist = Array.isArray(emp?.rateHistory) ? emp.rateHistory.filter(h => h && h.from) : [];
  if (hist.length === 0) return Number(emp?.hourlyRate) || 0;
  const dk = dateKey || todayKey();
  let best = null;
  let earliest = null;
  for (const h of hist) {
    if (!earliest || h.from < earliest.from) earliest = h;
    if (h.from <= dk && (!best || h.from > best.from)) best = h;
  }
  const chosen = best || earliest;
  return Number(chosen?.rate) || 0;
}

// Normalise/trie un historique de taux : enlève les entrées vides, trie par
// date croissante, fusionne les doublons exacts de date (le dernier gagne) et
// supprime les paliers redondants (même taux que le précédent).
function normalizeRateHistory(hist) {
  const byDate = {};
  (Array.isArray(hist) ? hist : []).forEach(h => {
    if (!h || !h.from) return;
    const r = Math.max(0, Number(h.rate) || 0);
    byDate[h.from] = { rate: r, from: h.from }; // même date → dernière valeur conservée
  });
  const sorted = Object.values(byDate).sort((a, b) => a.from.localeCompare(b.from));
  const out = [];
  for (const h of sorted) {
    if (out.length && out[out.length - 1].rate === h.rate) continue; // palier redondant
    out.push(h);
  }
  return out;
}

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

// ═══════════════════════════════════════════════════════════════
// Congés approuvés (v3.37.0)
// ═══════════════════════════════════════════════════════════════
// Modèle : employees[id].timeOff[dk] = { type, note, createdAt }
// Un jour en congé est VERROUILLÉ : on ne peut pas y assigner de quart
// (horaire + salaires) et il s'affiche « Congé » partout.

// Retourne l'objet congé d'un employé pour un jour (ou null).
// v3.42.0 : en plus des congés saisis manuellement par l'admin
// (employees[id].timeOff), on tient compte des DEMANDES DE CONGÉ APPROUVÉES
// de journée complète (collection /leaveRequests). Résultat : un congé
// approuvé verrouille le jour et s'affiche « Vacances / Maladie / … » partout
// (Horaire, Salaires, Mon horaire) sans dupliquer le code d'affichage.
// L'objet renvoyé porte `_fromRequest:true` + `_requestId` quand il vient
// d'une demande (pour router le clic vers la page Demandes de congé).
function getTimeOff(empId, dk) {
  const emp = employees.find(e => e.id === empId);
  const manual = emp && (emp.timeOff || {})[dk];
  if (manual) return manual;
  if (typeof getApprovedFullDayLeave === "function") {
    const r = getApprovedFullDayLeave(empId, dk);
    if (r) return { type: r.type, note: r.reason || "", createdAt: r.requestedAt, _fromRequest: true, _requestId: r.id };
  }
  return null;
}
// Raccourci booléen.
function isTimeOff(empId, dk) {
  return !!getTimeOff(empId, dk);
}
// Métadonnées d'un type de congé (objet de LEAVE_TYPES) — fallback « Congé ».
function leaveTypeMeta(type) {
  return (typeof LEAVE_TYPES !== "undefined" ? LEAVE_TYPES : []).find(l => l.id === type)
    || { id: type || "", label: "Congé", labelEs: "Descanso", color: "#0d9488" };
}
// Libellé localisé d'un type de congé (FR/ES selon la locale UI si dispo).
function leaveTypeLabel(type) {
  const m = leaveTypeMeta(type);
  const es = (typeof uiLang !== "undefined" && uiLang === "es");
  return es ? m.labelEs : m.label;
}
// Options <select> des types de congé.
function buildLeaveTypeOptions(selected) {
  const sel = selected || "vacances";
  return (typeof LEAVE_TYPES !== "undefined" ? LEAVE_TYPES : [])
    .map(l => `<option value="${l.id}" ${l.id === sel ? "selected" : ""}>${l.label}</option>`)
    .join("");
}

// ═══════════════════════════════════════════════════════════════
// Employés actifs / archivés + ordre & masquage par semaine (v3.38.0)
// ═══════════════════════════════════════════════════════════════
// Suppression d'un employé = ARCHIVAGE (archived:true) : sa fiche, ses
// horaires et ses paies passées sont CONSERVÉS. Un archivé n'apparaît
// plus dans les vues courantes, SAUF dans une semaine passée où il a
// travaillé (pour préserver l'historique).
//
// Ordre et masquage par semaine (Horaires) — stockés dans settings/schedule :
//   • weekOrder[weekKey]  = [empId, …]  ordre d'affichage pour cette semaine
//   • weekHidden[weekKey] = [empId, …]  employés masqués pour cette semaine
// weekKey = clé du lundi (dayKey du début de semaine), comme actualSales.

// Employés non archivés (liste de travail courante).
function activeEmployees() {
  return (typeof employees !== "undefined" ? employees : []).filter(e => !e.archived);
}
// Un employé a-t-il un quart (start+end) sur l'un des jours donnés ?
function empWorkedOnDays(emp, days) {
  const sh = (emp && emp.shifts) || {};
  return days.some(d => { const s = sh[dayKey(d)]; return s && s.start && s.end; });
}
// Clé de la semaine d'horaire affichée (lundi).
function scheduleWeekKey(offset) {
  return dayKey(getWeekStart(typeof offset === "number" ? offset : scheduleWeekOffset));
}
// Ordre / masqués d'une semaine d'horaire.
function getScheduleWeekOrder(weekKey) {
  const m = (scheduleSettings && scheduleSettings.weekOrder) || {};
  return Array.isArray(m[weekKey]) ? m[weekKey] : [];
}
function getScheduleWeekHidden(weekKey) {
  const m = (scheduleSettings && scheduleSettings.weekHidden) || {};
  return Array.isArray(m[weekKey]) ? m[weekKey] : [];
}
// Liste ordonnée + filtrée des employés visibles pour une semaine d'horaire.
function visibleScheduleEmployees(weekDays, weekKey) {
  const hidden = new Set(getScheduleWeekHidden(weekKey));
  const order = getScheduleWeekOrder(weekKey);
  const orderIdx = id => { const i = order.indexOf(id); return i === -1 ? Infinity : i; };
  return (typeof employees !== "undefined" ? employees : [])
    .filter(emp => {
      if (hidden.has(emp.id)) return false;
      if (!emp.archived) return true;
      return empWorkedOnDays(emp, weekDays); // archivé : seulement s'il a travaillé
    })
    .sort((a, b) => {
      const ai = orderIdx(a.id), bi = orderIdx(b.id);
      if (ai !== bi) return ai - bi;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

// ─ Masquer / réafficher un employé pour la semaine d'horaire courante ─
async function hideEmpFromScheduleWeek(empId) {
  const weekKey = scheduleWeekKey();
  const cur = getScheduleWeekHidden(weekKey);
  if (cur.includes(empId)) return;
  const next = [...cur, empId];
  try {
    await db.collection("settings").doc("schedule").set({
      weekHidden: { [weekKey]: next }
    }, { merge: true });
    const emp = employees.find(e => e.id === empId);
    pushScheduleUndo(`Retrait de ${emp ? emp.name : "l'employé"} (cette semaine)`, () =>
      db.collection("settings").doc("schedule").set({ weekHidden: { [weekKey]: cur } }, { merge: true }));
    toast(`${emp ? emp.name : "Employé"} retiré de cette semaine (réversible).`, "success", 3000);
  } catch (err) {
    console.error("hideEmpFromScheduleWeek failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}
async function unhideEmpFromScheduleWeek(empId) {
  const weekKey = scheduleWeekKey();
  const cur = getScheduleWeekHidden(weekKey);
  const next = cur.filter(id => id !== empId);
  try {
    await db.collection("settings").doc("schedule").set({
      weekHidden: { [weekKey]: next }
    }, { merge: true });
    const emp = employees.find(e => e.id === empId);
    pushScheduleUndo(`Réaffichage de ${emp ? emp.name : "l'employé"}`, () =>
      db.collection("settings").doc("schedule").set({ weekHidden: { [weekKey]: cur } }, { merge: true }));
  } catch (err) {
    console.error("unhideEmpFromScheduleWeek failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ─ Archivage (suppression douce) d'un employé ─
function askDeleteEmployee(id, name) {
  openConfirm(
    "🗑️ Retirer l'employé",
    `Retirer « ${esc(name)} » de l'équipe active ?<br><br>Son <strong>historique est conservé</strong> : il restera visible dans les horaires et paies des semaines passées où il a travaillé. Tu pourras le restaurer via « Voir les archivés ».`,
    async () => {
      await db.collection("employees").doc(id).update({ archived: true, archivedAt: Date.now() });
      await addLog(name, "Employé archivé", "");
      pushScheduleUndo(`Suppression de ${name}`, () =>
        db.collection("employees").doc(id).update({ archived: false, archivedAt: firebase.firestore.FieldValue.delete() }));
    },
    true
  );
}
async function restoreEmployee(id) {
  try {
    await db.collection("employees").doc(id).update({ archived: false, archivedAt: firebase.firestore.FieldValue.delete() });
    const emp = employees.find(e => e.id === id);
    await addLog(emp ? emp.name : id, "Employé restauré", "");
    toast("Employé restauré.", "success", 2500);
  } catch (err) {
    console.error("restoreEmployee failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// Annuler (undo) — pile des derniers changements d'horaire (v3.39.0)
// ═══════════════════════════════════════════════════════════════
// Pile en mémoire (réinitialisée au rechargement). Chaque action annulable
// capture l'état AVANT modification et enregistre une fonction qui le restaure.
// On garde au maximum SCHEDULE_UNDO_MAX entrées (les plus anciennes tombent).
let _scheduleUndo = [];
const SCHEDULE_UNDO_MAX = 5;

function pushScheduleUndo(label, restoreFn) {
  _scheduleUndo.push({ label, restoreFn });
  if (_scheduleUndo.length > SCHEDULE_UNDO_MAX) _scheduleUndo.shift();
}
async function undoLastSchedule() {
  const entry = _scheduleUndo.pop();
  if (!entry) { toast("Rien à annuler.", "info", 2000); return; }
  try {
    await entry.restoreFn();
    toast(`Annulé : ${entry.label}`, "success", 2800);
  } catch (err) {
    console.error("undoLastSchedule failed:", err);
    _scheduleUndo.push(entry); // échec → on remet l'entrée
    toast("Erreur lors de l'annulation : " + (err.message || err.code || err), "error", 5000);
  }
}
// Restaure (ou supprime si absent) un quart d'un employé pour un jour donné.
function _restoreShiftFn(empId, dk, prevShift) {
  return () => db.collection("employees").doc(empId).set({
    shifts: { [dk]: prevShift ? { ...prevShift } : firebase.firestore.FieldValue.delete() }
  }, { merge: true });
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
  // Options du sélecteur de ratio : 25 % → 40 % (v3.43.2). Si la valeur courante
  // tombe hors de cette plage (réglage antérieur), on l'ajoute pour ne pas la perdre.
  const curRatioPct = Math.round(ratio * 100);
  const ratioOptions = [];
  for (let p = 25; p <= 40; p++) ratioOptions.push(p);
  if (!ratioOptions.includes(curRatioPct)) { ratioOptions.push(curRatioPct); ratioOptions.sort((a, b) => a - b); }
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
  // Liste visible pour CETTE semaine : ordre par semaine, masqués retirés,
  // archivés présents seulement s'ils ont travaillé la semaine (historique).
  const weekKey = scheduleWeekKey();
  const weekEmps = visibleScheduleEmployees(weekDays, weekKey);
  const weekHiddenIds = getScheduleWeekHidden(weekKey);
  // Taux daté (v3.52.0) : le taux affiché et le coût d'un salarié utilisent le
  // taux effectif au DÉBUT de la semaine affichée ; le coût horaire est calculé
  // jour par jour avec le taux effectif de chaque jour (gère une hausse en cours
  // de semaine).
  const weekStartKey = dayKey(weekDays[0] || new Date());
  const empRows = weekEmps.map(emp => {
    const shifts = emp.shifts || {};
    const rate = effectiveHourlyRate(emp, weekStartKey);
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const weeklyFixedPay = isSal ? fixedHours * rate : null;
    const dailyFixedCost = isSal ? weeklyFixedPay / nbOpenDays : null;

    const daily = weekDays.map((d, col) => {
      const s = shifts[dayKey(d)];
      const hours = hoursFromShift(s);
      const cost = isSal ? dailyFixedCost : hours * effectiveHourlyRate(emp, dayKey(d));
      dayTotalsHours[col] += hours;
      dayTotalsCost[col] += cost;
      return { shift: s, hours, cost };
    });
    const totalHours = daily.reduce((sum, d) => sum + d.hours, 0);
    const totalPay = isSal ? weeklyFixedPay : daily.reduce((sum, d) => sum + d.cost, 0);
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
      ? renderEmptyState({
          kind: "employes",
          title: "Aucun employé encore",
          subtitle: "Commence par ajouter ton équipe — leur taux horaire et leur section (cuisine/service) servent ensuite à calculer les horaires, les salaires et la répartition des pourboires.",
          cta: { label: "Ajouter un employé", icon: "plus", onClick: "openEmployeeModal()" },
          hint: "Premier pas vers une équipe organisée"
        })
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
          <button class="btn-secondary btn-sm" onclick="undoLastSchedule()" ${_scheduleUndo.length === 0 ? "disabled" : ""} title="Annuler le dernier changement (Ctrl/Cmd+Z) — jusqu'à ${SCHEDULE_UNDO_MAX} en arrière">${icon("undo", 14)} Annuler${_scheduleUndo.length ? ` (${_scheduleUndo.length})` : ""}</button>
          <button class="btn-secondary btn-sm" onclick="openOpenDaysModal()" title="Choisir les jours d'ouverture">${icon("calendar", 14)} Jours ouverts</button>
          <button class="btn-secondary btn-sm" onclick="openTimeOffModal()" title="Marquer un employé en congé sur une ou plusieurs journées (bloque l'assignation de quarts)">${icon("sun", 14)} Ajouter un congé</button>
          <button class="btn-secondary btn-sm" onclick="duplicateScheduleToNextWeek()" title="Copier cet horaire vers la semaine suivante">${icon("copy", 14)} Copier → S${weekNum + 1}</button>
          <button class="btn-secondary btn-sm" onclick="exportScheduleAsPNG()" title="Télécharger une image PNG de l'horaire pour partager avec l'équipe (sans aucune donnée financière, exclut les employés en congé toute la semaine)">${icon("download", 14)} PNG pour équipe</button>
          ${userRole === "global_admin" ? `<button class="btn-secondary btn-sm" onclick="exportScheduleAsPNGAdmin()" title="Rapport admin complet : taux horaire, coût par shift, totaux semaine, ventes prévues. À usage interne — ne pas partager avec l'équipe.">${icon("download", 14)} PNG admin</button>` : ""}
          <div class="schedule-ratio-pill" title="Ratio salaires / ventes : les Ventes prévues sont recalculées instantanément">
            <span class="schedule-ratio-pill__label">${icon("trending-up", 14)} Ratio</span>
            <select id="sched-ratio" class="schedule-ratio-pill__select" onchange="updateSalesRatio(this.value)" aria-label="Ratio salaires sur ventes">
              ${ratioOptions.map(p => `<option value="${p}" ${p === curRatioPct ? "selected" : ""}>${p} %</option>`).join("")}
            </select>
          </div>
        </div>
      </div>

      ${weekHiddenIds.length > 0 ? `
      <!-- ══ Bandeau : employés masqués pour cette semaine ══ -->
      <div class="week-hidden-banner">
        <span class="week-hidden-label">${icon("eye-off", 13)} Masqué${weekHiddenIds.length > 1 ? "s" : ""} cette semaine :</span>
        ${weekHiddenIds.map(id => {
          const e = employees.find(x => x.id === id);
          if (!e) return "";
          return `<button class="week-hidden-chip" onclick="unhideEmpFromScheduleWeek('${id}')" title="Réafficher dans cette semaine">${esc(e.name || "?")} ${icon("plus", 11)}</button>`;
        }).join("")}
      </div>` : ""}

      <!-- ══ Grille employés × jours avec cartes shift (v3.24.1) ══ -->
      <!-- Liste des employés à gauche, 7 colonnes jour, totaux à droite. -->
      <div class="schedule-empgrid" style="--n-days:${nCols};">
        <!-- Header : labels jours + colonne totaux -->
        <div class="schedule-empgrid-header">
          <div class="schedule-empgrid-emp-head">Employé</div>
          ${weekDays.map((d, k) => {
            const dk = dayKey(d);
            const dowIdx = visibleIdx[k];
            const dayShiftsCount = empRows.filter(r => r.daily[k]?.shift?.start && r.daily[k]?.shift?.end).length;
            return `<div class="schedule-empgrid-day-head">
              <div class="schedule-empgrid-day-name">${DAYS_FR[dowIdx]}</div>
              <div class="schedule-empgrid-day-date">${d.getDate()}/${d.getMonth() + 1}</div>
              <div class="schedule-empgrid-day-count">${dayShiftsCount} pers · ${dayTotalsHours[k] ? fmtHours(dayTotalsHours[k]) + "h" : "0h"}</div>
            </div>`;
          }).join("")}
          <div class="schedule-empgrid-total-head">Total</div>
        </div>

        <!-- Body : une ligne par employé -->
        ${empRows.map(row => {
          const emp = row.emp;
          const sec = (emp.section || "service");
          const secCls = sec === "cuisine" ? "is-kitchen"
                      : sec === "service" ? "is-service" : "is-other";
          const secLabel = sec === "cuisine" ? "Cuisine"
                        : sec === "service" ? "Service" : "Autre";
          return `<div class="schedule-empgrid-row" data-emp-id="${emp.id}"
              ondragover="empRowDragOver(event,'${emp.id}')"
              ondragleave="empRowDragLeave(event)"
              ondrop="empRowDrop(event,'${emp.id}')">
            <!-- Cellule employé (sticky à gauche) -->
            <div class="schedule-empgrid-emp ${secCls} ${emp.archived ? "is-archived-emp" : ""}">
              <div class="schedule-empgrid-emp-row">
                <span class="schedule-emp-drag-handle" draggable="true"
                    ondragstart="empRowDragStart(event,'${emp.id}')"
                    ondragend="empRowDragEnd()"
                    title="Glisser pour réordonner (cette semaine)"
                    aria-label="Glisser pour réordonner ${esc(emp.name || "")}">${icon("grip-vertical", 12)}</span>
                <div class="schedule-empgrid-emp-name">${esc(emp.name || "")}</div>
                ${emp.archived ? `<span class="emp-archived-badge" title="Employé archivé — affiché car il a travaillé cette semaine">${icon("archive", 10)} Archivé</span>` : ""}
                <button class="emp-week-remove" onclick="hideEmpFromScheduleWeek('${emp.id}')" title="Retirer de cette semaine (n'affecte pas les autres semaines ni la fiche)" aria-label="Retirer ${esc(emp.name || "")} de cette semaine">${icon("x", 12)}</button>
              </div>
              <div class="schedule-empgrid-emp-meta">
                <span class="schedule-empgrid-emp-section">${secLabel}</span>
                ${row.rate ? `<span class="schedule-empgrid-emp-rate">${row.rate.toFixed(2)} $/h${row.isSal ? " · FIXE" : ""}</span>` : ""}
              </div>
            </div>
            <!-- Cellules par jour : shift card OU bouton + Add -->
            ${row.daily.map((d, k) => {
              const dk = dayKey(weekDays[k]);
              const s = d.shift;
              const hasShift = s && s.start && s.end;
              // ─ Congé approuvé : carte verrouillée, pas de quart possible ─
              const leave = getTimeOff(row.emp.id, dk);
              if (leave) {
                const lm = leaveTypeMeta(leave.type);
                const noteTxt = leave.note ? ` — ${esc(leave.note)}` : "";
                const fromReq = !!leave._fromRequest;
                const clickAttr = fromReq
                  ? `onclick="navTo('demandes-conge')"`
                  : `onclick="openTimeOffCellModal('${row.emp.id}','${dk}')"`;
                const titleTxt = fromReq
                  ? `Congé approuvé via une demande (${esc(leaveTypeLabel(leave.type))})${noteTxt} — gérer dans « Demandes de congé ».`
                  : `En congé (${esc(leaveTypeLabel(leave.type))})${noteTxt} — aucun quart possible ce jour-là. Cliquer pour modifier ou retirer.`;
                return `<div class="schedule-empgrid-cell schedule-empgrid-cell--leave"
                    data-day-key="${dk}"
                    title="${titleTxt}">
                  <div class="shift-card shift-card--leave"
                      style="--leave-color:${lm.color}"
                      ${clickAttr}>
                    <div class="shift-leave-label">${icon("sun", 11)} ${fromReq ? "Congé approuvé" : "Congé"}</div>
                    <div class="shift-leave-type">${esc(leaveTypeLabel(leave.type))}${fromReq ? ` <span class="shift-leave-req">${icon("user", 9)}</span>` : ""}</div>
                  </div>
                </div>`;
              }
              const partialBadge = (typeof partialLeaveBadgeHTML === "function") ? partialLeaveBadgeHTML(row.emp.id, dk) : "";
              if (!hasShift) {
                return `<div class="schedule-empgrid-cell schedule-empgrid-cell--empty"
                    data-day-key="${dk}"
                    ondragover="shiftCardDragOver(event,'${dk}')"
                    ondragleave="shiftCardDragLeave(event)"
                    ondrop="shiftCardDrop(event,'${dk}')">
                  <div class="shift-card shift-card--off"
                      onclick="openShiftModal('${row.emp.id}','${dk}')"
                      title="Aucun shift ce jour-là — cliquer pour ajouter">
                    <div class="shift-off-label">Libre</div>
                    <div class="shift-off-add">${icon("plus", 11)} Ajouter</div>
                    ${partialBadge}
                  </div>
                </div>`;
              }
              return `<div class="schedule-empgrid-cell"
                  data-day-key="${dk}"
                  ondragover="shiftCardDragOver(event,'${dk}')"
                  ondragleave="shiftCardDragLeave(event)"
                  ondrop="shiftCardDrop(event,'${dk}')">
                <div class="shift-card shift-card--compact ${secCls}"
                    draggable="true"
                    data-emp-id="${row.emp.id}"
                    data-from-day="${dk}"
                    ondragstart="shiftCardDragStart(event,'${row.emp.id}','${dk}')"
                    ondragend="shiftCardDragEnd(event)"
                    onclick="openShiftModal('${row.emp.id}','${dk}')"
                    title="Cliquer pour modifier · Glisser pour déplacer">
                  <div class="shift-card-time">${s.start} → ${s.end}</div>
                  <div class="shift-card-meta">
                    <span>${fmtHours(d.hours)}h</span>
                    <span class="shift-card-cost">${fmtMoney(d.cost)}</span>
                  </div>
                  ${partialBadge}
                </div>
              </div>`;
            }).join("")}
            <!-- Cellule totaux employé (sticky à droite) -->
            <div class="schedule-empgrid-total">
              <div class="schedule-empgrid-total-hrs">${row.totalHours ? fmtHours(row.totalHours) + "h" : "—"}</div>
              <div class="schedule-empgrid-total-pay">${row.totalPay ? fmtMoney(row.totalPay) : ""}</div>
            </div>
          </div>`;
        }).join("")}
      </div>

      <!-- ══ Panneau totaux compact (sous le calendrier) ══ -->
      <div class="schedule-totals-panel card">
        <div class="schedule-totals-grid" style="--n-days:${nCols};">
          <div class="schedule-totals-label">Heures</div>
          ${dayTotalsHours.map(h => `<div class="schedule-totals-val">${h ? fmtHours(h) + "h" : "—"}</div>`).join("")}
          <div class="schedule-totals-val schedule-totals-val--total">${fmtHours(weekTotalHours)}h</div>

          <div class="schedule-totals-label">Coût</div>
          ${dayTotalsCost.map(c => `<div class="schedule-totals-val">${c ? fmtMoney(c) : "—"}</div>`).join("")}
          <div class="schedule-totals-val schedule-totals-val--total">${fmtMoney(weekTotalCost)}</div>

          <div class="schedule-totals-label">Ventes prévues</div>
          ${dayTotalsCost.map(c => {
            const p = ratio > 0 ? c / ratio : 0;
            return `<div class="schedule-totals-val schedule-totals-val--predicted">${p ? fmtMoney(p) : "—"}</div>`;
          }).join("")}
          <div class="schedule-totals-val schedule-totals-val--total schedule-totals-val--predicted">${fmtMoney(ratio > 0 ? weekTotalCost / ratio : 0)}</div>

          <div class="schedule-totals-label">Ventes réelles</div>
          ${weekDays.map((d, k) => {
            const dk = dayKey(d);
            const val = Number(scheduleSettings.actualSales?.[dk] || 0);
            const dayName = DAYS_FR[visibleIdx[k]];
            const dateLabel = `${d.getDate()}/${d.getMonth() + 1}`;
            return `<div class="schedule-totals-val schedule-totals-val--input">
              <input type="number" step="0.01" min="0" class="schedule-sales-input" placeholder="—" value="${val || ""}" onchange="updateActualSales('${dk}',this.value)" aria-label="Ventes réelles ${dayName} ${dateLabel}"/>
            </div>`;
          }).join("")}
          <div class="schedule-totals-val schedule-totals-val--total">${(() => {
            const total = weekDays.reduce((sum, d) => sum + (Number(scheduleSettings.actualSales?.[dayKey(d)] || 0)), 0);
            return total ? fmtMoney(total) : "—";
          })()}</div>

          <div class="schedule-totals-label">${icon("trending-up", 12)} Écart</div>
          ${weekDays.map((d, k) => {
            const dk = dayKey(d);
            const actual = Number(scheduleSettings.actualSales?.[dk] || 0);
            const predicted = ratio > 0 ? dayTotalsCost[k] / ratio : 0;
            const gap = actual - predicted;
            const cls = gap > 0.01 ? "is-positive" : gap < -0.01 ? "is-negative" : "";
            const arrow = gap > 0.01 ? "▲" : gap < -0.01 ? "▼" : "";
            const content = (actual || predicted) ? `<span class="gap-arrow">${arrow}</span>${fmtMoney(gap)}` : "—";
            return `<div class="schedule-totals-val schedule-totals-val--gap ${cls}">${content}</div>`;
          }).join("")}
          <div class="schedule-totals-val schedule-totals-val--total schedule-totals-val--gap ${(() => {
            const totalActual = weekDays.reduce((sum, d) => sum + (Number(scheduleSettings.actualSales?.[dayKey(d)] || 0)), 0);
            const totalPredicted = ratio > 0 ? weekTotalCost / ratio : 0;
            const gap = totalActual - totalPredicted;
            return gap > 0.01 ? "is-positive" : gap < -0.01 ? "is-negative" : "";
          })()}">${(() => {
            const totalActual = weekDays.reduce((sum, d) => sum + (Number(scheduleSettings.actualSales?.[dayKey(d)] || 0)), 0);
            const totalPredicted = ratio > 0 ? weekTotalCost / ratio : 0;
            const gap = totalActual - totalPredicted;
            const arrow = gap > 0.01 ? "▲" : gap < -0.01 ? "▼" : "";
            return (totalActual || totalPredicted) ? `<span class="gap-arrow">${arrow}</span>${fmtMoney(gap)}` : "—";
          })()}</div>
        </div>
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
        ${activeEmployees().slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(emp => `<div class="card team-card">
          <div class="team-card__head">
            <div class="team-card__info">
              <div class="team-card__name">${icon("user", 14)} ${esc(emp.name || "")}${emp.noTips ? ` <span class="no-tips-badge" title="Exclu du partage des pourboires">${icon("ban", 10)} Sans pourboire</span>` : ""}</div>
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
              <button class="text-danger" onclick="askDeleteEmployee('${emp.id}','${esc(emp.name || "")}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
            </div></div>
          </div>
        </div>`).join("")}
      </div>

      ${(() => {
        const archived = (employees || []).filter(e => e.archived);
        if (archived.length === 0) return "";
        return `<div class="archived-emps-banner">
          <div class="archived-emps-head">${icon("archive", 14)} ${archived.length} employé${archived.length > 1 ? "s" : ""} archivé${archived.length > 1 ? "s" : ""} <span class="archived-emps-hint">(conservé${archived.length > 1 ? "s" : ""} dans l'historique)</span></div>
          <div class="archived-emps-list">
            ${archived.map(e => `<span class="archived-emp-chip">${esc(e.name || "?")}
              <button onclick="restoreEmployee('${e.id}')" title="Restaurer dans l'équipe active">${icon("upload", 11)} Restaurer</button>
            </span>`).join("")}
          </div>
        </div>`;
      })()}`}
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

  // Vérifier si la source a au moins un shift (employés actifs seulement)
  const hasSource = activeEmployees().some(emp => {
    const shifts = emp.shifts || {};
    return curDates.some(dk => shifts[dk] && shifts[dk].start);
  });
  if (!hasSource) {
    toast("La semaine actuelle est vide. Remplissez au moins un horaire avant de copier.", "warning");
    return;
  }

  // Vérifier si la cible contient déjà des données
  const nextHasData = activeEmployees().some(emp => {
    const shifts = emp.shifts || {};
    return nextDates.some(dk => shifts[dk] && shifts[dk].start);
  });

  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));
  const nextWeekNum = weekNum + 1;

  const doCopy = async () => {
    const batch = db.batch();
    for (const emp of activeEmployees()) {
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
// v3.30.0 — Rebranché sur la grille empgrid (v3.24.1+). Les sélecteurs
// utilisent `[data-emp-id="..."]` au lieu de `tr[data-emp-id="..."]`
// pour fonctionner avec n'importe quelle structure (table legacy ou
// .schedule-empgrid-row). L'ordre est persisté dans `employees.sortOrder`
// via un batch update — le listener Firestore re-trie automatiquement
// la liste au snapshot suivant (voir firebase-listeners.js).
let _empDragId = null;

function empRowDragStart(e, id) {
  _empDragId = id;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch (_) {}
  }
  const row = document.querySelector(`[data-emp-id="${id}"]`);
  setTimeout(() => row && row.classList.add("schedule-row--dragging"), 0);
}

function empRowDragOver(e, id) {
  if (_empDragId === null || id === _empDragId) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const row = document.querySelector(`[data-emp-id="${id}"]`);
  if (!row) return;
  row.classList.add("schedule-row--drag-over");
  const rect = row.getBoundingClientRect();
  const before = (e.clientY - rect.top) < rect.height / 2;
  row.classList.toggle("schedule-row--drop-before", before);
  row.classList.toggle("schedule-row--drop-after", !before);
}

function empRowDragLeave(e) {
  const row = e.currentTarget;
  if (!row) return;
  const related = e.relatedTarget;
  if (related && row.contains(related)) return;
  row.classList.remove("schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after");
}

function empRowDragEnd() {
  document.querySelectorAll("[data-emp-id]").forEach(row =>
    row.classList.remove("schedule-row--dragging", "schedule-row--drag-over", "schedule-row--drop-before", "schedule-row--drop-after")
  );
  _empDragId = null;
}

async function empRowDrop(e, targetId) {
  e.preventDefault();
  e.stopPropagation();
  const srcId = _empDragId;
  const row = document.querySelector(`[data-emp-id="${targetId}"]`);
  const dropBefore = row && row.classList.contains("schedule-row--drop-before");
  empRowDragEnd();
  if (!srcId || srcId === targetId) return;

  // Recomposer l'ordre des IDs à partir de l'ordre AFFICHÉ (lignes visibles
  // de la semaine courante) — l'ordre est sauvé PAR SEMAINE, pas globalement.
  const ids = Array.from(document.querySelectorAll(".schedule-empgrid-row[data-emp-id]"))
    .map(r => r.getAttribute("data-emp-id"));
  const srcIdx = ids.indexOf(srcId);
  const tgtIdx = ids.indexOf(targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  ids.splice(srcIdx, 1);
  let insertAt = tgtIdx;
  if (srcIdx < tgtIdx) insertAt -= 1;
  if (!dropBefore) insertAt += 1;
  insertAt = Math.max(0, Math.min(insertAt, ids.length));
  ids.splice(insertAt, 0, srcId);

  // Écrit l'ordre dans settings/schedule.weekOrder[weekKey] (par semaine).
  try {
    const weekKey = scheduleWeekKey();
    const prevOrder = getScheduleWeekOrder(weekKey); // pour l'annulation
    await db.collection("settings").doc("schedule").set({
      weekOrder: { [weekKey]: ids }
    }, { merge: true });
    pushScheduleUndo("Réordonnancement des employés", () =>
      db.collection("settings").doc("schedule").set({ weekOrder: { [weekKey]: prevOrder } }, { merge: true }));
    toast("Ordre mis à jour (cette semaine seulement).", "success", 2200);
  } catch (err) {
    console.error("empRowDrop failed:", err);
    toast("Erreur réordonnancement : " + (err.message || err.code || err), "error", 5000);
  }
}

// Affiche l'historique des taux datés d'un employé (lecture seule + retrait).
// Chaque palier : « 18,00 $/h à partir du 23 juin 2026 ». Bouton ✕ pour
// supprimer un palier (corrige une erreur de saisie) — écrit directement dans
// /employeesComp puis ré-ouvre le modal.
function renderRateHistory(emp) {
  const hist = normalizeRateHistory(emp?.rateHistory);
  if (hist.length <= 1) return ""; // 0 ou 1 palier → rien à montrer (cas courant)
  const today = todayKey();
  const rows = [...hist].reverse().map(h => {
    const future = h.from > today;
    return `<li class="rate-hist__row ${future ? "rate-hist__row--future" : ""}">
      <span class="rate-hist__rate">${fmtMoney(h.rate)}/h</span>
      <span class="rate-hist__from">à partir du ${esc(fmtDateLong(h.from))}${future ? " · à venir" : ""}</span>
      ${emp?.id ? `<button type="button" class="btn-icon-only rate-hist__del" onclick="removeRateHistoryEntry('${esc(emp.id)}','${esc(h.from)}')" aria-label="Retirer ce palier" title="Retirer ce palier">${icon("trash", 12)}</button>` : ""}
    </li>`;
  }).join("");
  return `<div class="rate-hist">
    <div class="rate-hist__title">${icon("clock", 12)} Historique des taux</div>
    <ul class="rate-hist__list">${rows}</ul>
  </div>`;
}

// Date longue FR-CA tolérante : "2026-06-23" → "23 juin 2026".
function fmtDateLong(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
  } catch (_) { return iso; }
}

// Retire un palier de taux (par sa date `from`) puis ré-ouvre la fiche.
async function removeRateHistoryEntry(empId, fromKey) {
  if (!isAdmin) return;
  const emp = employees.find(e => e.id === empId);
  const hist = normalizeRateHistory(emp?.rateHistory).filter(h => h.from !== fromKey);
  try {
    await db.collection("employeesComp").doc(empId).set({
      rateHistory: hist,
      hourlyRate: effectiveHourlyRate({ rateHistory: hist, hourlyRate: emp?.hourlyRate }, todayKey()),
      updatedAt: Date.now()
    }, { merge: true });
    toast("Palier de taux retiré.", "success");
    closeModal();
    setTimeout(() => openEmployeeModal(empId), 60);
  } catch (err) {
    console.error("removeRateHistoryEntry:", err);
    toast("Erreur : " + (err.message || err), "error");
  }
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
    <label class="emp-salaried-toggle">
      <input type="checkbox" id="e-no-tips" ${emp?.noTips ? "checked" : ""}/>
      <span>Sans pourboire — exclu du partage</span>
    </label>
    <span class="field-hint" style="display:block;margin:-4px 0 4px">${icon("info", 11)} Si coché, cet employé ne reçoit aucun pourboire et ses heures ne diluent pas le pool de l'équipe (ex. gérant, propriétaire). Tu peux quand même le réinclure ponctuellement via la dérogation de section, dans Salaires & Pourboires.</span>
    <div class="form-row">
      <label>${t("emp_field_phone")}<input id="e-phone" value="${esc(emp?.phone || "")}"/></label>
      <label>${t("emp_field_email")}<input id="e-email" value="${esc(emp?.email || "")}"/></label>
    </div>
    <div class="form-row">
      <label>Taux horaire ($/h)
        <input id="e-hourly-rate" type="number" min="0" step="0.25" value="${emp?.hourlyRate || ""}" placeholder="ex: 17.50"/>
      </label>
      <label>En vigueur à partir du
        <input id="e-rate-effective" type="date" value="${todayKey()}"/>
      </label>
    </div>
    <span class="field-hint" style="display:block;margin:-4px 0 4px">${icon("info", 11)} Le nouveau taux s'applique aux semaines (paie et coûts d'horaire) <strong>à partir de la date choisie</strong>. Les semaines antérieures gardent l'ancien taux. Laisse la date d'aujourd'hui pour un changement immédiat, ou choisis une date future (ex. le lundi de la semaine prochaine).</span>
    ${renderRateHistory(emp)}
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
      <span class="field-hint">${icon("info", 11)} PIN utilisé sur la page <strong>Pointage</strong> pour marquer entrées et sorties. Doit être unique entre les employés. Sans PIN, l'employé ne pourra pas pointer (mais l'admin pourra toujours saisir ses heures manuellement dans Salaires & Pourboires).</span>
    </label>
    <label>${t("notes_field")}<textarea id="e-notes" style="height:60px">${esc(emp?.notes || "")}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveEmployee('${id || ""}')">${t("save")}</button>
    </div>
  </div>`);
}

// ═══════════════════════════════════════════════════════════════
// Rémunération séparée (confidentialité des salaires) — v3.43.0
// ═══════════════════════════════════════════════════════════════
// hourlyRate / isSalaried / fixedWeeklyHours sont stockés dans /employeesComp
// (admin only) au lieu de /employees (lisible par tous). On les FUSIONNE dans
// le tableau `employees` en mémoire pour que toutes les lectures existantes de
// emp.hourlyRate continuent de fonctionner sans toucher aux dizaines de sites.

// Fusionne la rémunération (employeesComp) dans les objets de `employees`.
function _applyEmployeeComp() {
  const comp = (typeof employeesComp !== "undefined" && employeesComp) || {};
  for (const e of (typeof employees !== "undefined" ? employees : [])) {
    const c = comp[e.id];
    if (c) {
      e.isSalaried = !!c.isSalaried;
      e.fixedWeeklyHours = Number(c.fixedWeeklyHours) || 0;
      // Historique de taux daté (v3.52.0) : propagé tel quel sur l'objet emp.
      e.rateHistory = normalizeRateHistory(c.rateHistory);
      // `hourlyRate` = taux EN VIGUEUR AUJOURD'HUI (dérivé de l'historique s'il
      // existe). Garde toutes les lectures "courantes" (team cards, simulation,
      // dashboard) justes même après le passage d'une date d'effet future.
      e.hourlyRate = e.rateHistory.length
        ? effectiveHourlyRate(e, todayKey())
        : (Number(c.hourlyRate) || 0);
    }
  }
}

// Migration unique (admin) : pour chaque employé dont la fiche /employees
// contient ENCORE des champs de rémunération, on les copie dans /employeesComp
// puis on les RETIRE de /employees (pour qu'ils ne soient plus exposés).
// Idempotent : une fois migré, l'employé n'a plus ces champs → ignoré.
// `rawEmps` = docs bruts du snapshot /employees (avant fusion en mémoire).
let _compMigrationInFlight = false;
async function migrateEmployeeComp(rawEmps) {
  if (!isAdmin || _compMigrationInFlight) return;
  const targets = (rawEmps || []).filter(e =>
    ("hourlyRate" in e) || ("isSalaried" in e) || ("fixedWeeklyHours" in e));
  if (targets.length === 0) return;
  _compMigrationInFlight = true;
  const FV = firebase.firestore.FieldValue;
  try {
    for (const e of targets) {
      // 1) Sauver la rémunération dans la collection séparée (admin only)
      await db.collection("employeesComp").doc(e.id).set({
        hourlyRate: Number(e.hourlyRate) || 0,
        isSalaried: !!e.isSalaried,
        fixedWeeklyHours: Number(e.fixedWeeklyHours) || 0,
        updatedAt: Date.now()
      }, { merge: true });
      // 2) Retirer les champs de /employees (ne plus les exposer)
      await db.collection("employees").doc(e.id).update({
        hourlyRate: FV.delete(),
        isSalaried: FV.delete(),
        fixedWeeklyHours: FV.delete()
      });
    }
    console.log(`Rémunération : ${targets.length} employé(s) migré(s) vers /employeesComp.`);
  } catch (err) {
    console.error("migrateEmployeeComp failed:", err);
  } finally {
    _compMigrationInFlight = false;
  }
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
  // Données « publiques » (lisibles par tous les authentifiés) — SANS rémunération
  const data = {
    name,
    role: document.getElementById("e-role").value,
    section: document.getElementById("e-section").value || "service",
    phone: document.getElementById("e-phone").value,
    email: document.getElementById("e-email").value,
    pin,
    // Réglage permanent : exclu du partage des pourboires (non sensible — pas de
    // montant —, donc reste dans /employees avec section). Branché dans
    // getEffectiveTipGroup (pages-payroll.js).
    noTips: !!document.getElementById("e-no-tips")?.checked,
    notes: document.getElementById("e-notes").value
  };
  let empId = id;
  if (id) {
    await db.collection("employees").doc(id).update(data);
  } else {
    empId = genId();
    // sortOrder : placer le nouvel employé à la fin de la liste
    const maxSort = employees.reduce((m, e) => Math.max(m, e.sortOrder || 0), 0);
    await db.collection("employees").doc(empId).set({
      ...data, id: empId, shifts: {}, sortOrder: maxSort + 1
    });
  }

  // ─── Historique de taux daté (v3.52.0) ───────────────────────────────
  // On enregistre le taux saisi AVEC sa date d'effet dans rateHistory[].
  // Règle : on « upsert » le taux saisi à la date choisie, puis on normalise
  // (tri + fusion des paliers redondants). Si la fiche avait un ancien taux
  // sans historique, on le « scelle » dans le passé (2000-01-01) pour que les
  // semaines antérieures conservent l'ancien taux.
  const existingComp = (typeof employeesComp !== "undefined" && employeesComp[empId]) || {};
  const newRate = Math.max(0, Number(document.getElementById("e-hourly-rate").value) || 0);
  const effDate = document.getElementById("e-rate-effective")?.value || todayKey();
  let hist = normalizeRateHistory(existingComp.rateHistory);
  if (hist.length === 0) {
    const priorRate = Math.max(0, Number(existingComp.hourlyRate) || 0);
    if (id && priorRate > 0) hist.push({ rate: priorRate, from: "2000-01-01" });
  }
  hist = normalizeRateHistory([...hist.filter(h => h.from !== effDate), { rate: newRate, from: effDate }]);
  const currentRate = hist.length ? effectiveHourlyRate({ rateHistory: hist }, todayKey()) : newRate;

  // Rémunération (confidentielle) → collection séparée /employeesComp (admin only)
  const comp = {
    hourlyRate: currentRate,            // taux en vigueur AUJOURD'HUI (dérivé de l'historique)
    rateHistory: hist,                  // paliers datés
    isSalaried: document.getElementById("e-is-salaried").checked,
    fixedWeeklyHours: Number(document.getElementById("e-fixed-hours").value) || 0,
    updatedAt: Date.now()
  };
  // Écrit la rémunération à part (jamais dans /employees → invisible aux employés)
  await db.collection("employeesComp").doc(empId).set(comp, { merge: true });
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

// ═══════════════════════════════════════════════════════════════
// v3.24.0 — Vue calendrier hebdomadaire (refonte Horaires)
// ═══════════════════════════════════════════════════════════════
// Modal d'édition de shift + drag&drop des cartes entre jours.

// État local pour le drag & drop des cartes shift
let _shiftDragEmpId = null;
let _shiftDragFromDay = null;

// Ouvre un modal pour créer/modifier un shift sur un jour donné.
// empId === "" → mode création, on affiche le select employé en haut
// empId !== "" → mode édition, employé fixe, on charge le shift existant
function openShiftModal(empId, dk) {
  const emp = empId ? employees.find(e => e.id === empId) : null;
  const existingShift = emp ? (emp.shifts || {})[dk] : null;
  // Convertit dk "YYYY-MM-DD" en label "Mardi 27 mai 2026"
  const [yy, mm, ddNum] = dk.split("-").map(Number);
  const dateObj = new Date(yy, mm - 1, ddNum);
  const dayLabel = dateObj.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  const isEdit = !!emp;
  const startVal = existingShift?.start || "";
  const endVal = existingShift?.end || "";

  // Employés sans shift CE jour-là (pour l'option création) — exclut ceux qui
  // ont déjà un shift le même jour (un seul shift par employé par jour) et
  // les employés archivés (hors équipe active).
  const availableEmps = isEdit ? employees.slice() : activeEmployees().filter(e => {
    const s = (e.shifts || {})[dk];
    return !(s && s.start && s.end);
  });

  showModal(`<div class="modal" style="max-width:460px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} ${isEdit ? "Modifier le shift" : "Ajouter un shift"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 var(--sp-3);text-transform:capitalize">
      ${icon("calendar", 12)} ${dayLabel}
    </p>
    <label>Employé
      ${isEdit
        ? `<input type="text" value="${esc(emp.name || "")}" disabled style="background:var(--surface2);color:var(--text2);cursor:not-allowed"/>
           <input type="hidden" id="shift-emp-id" value="${empId}"/>`
        : `<select id="shift-emp-id" autofocus>
            <option value="">— Choisir un employé —</option>
            ${availableEmps.map(e => `<option value="${e.id}">${esc(e.name || "")}${e.section === "cuisine" ? " (Cuisine)" : e.section === "service" ? " (Service)" : ""}</option>`).join("")}
          </select>`
      }
    </label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-2)">
      <label>Entrée
        ${timeInputHTML("shift-start", startVal)}
      </label>
      <label>Sortie
        ${timeInputHTML("shift-end", endVal)}
      </label>
    </div>
    <p class="time-input-hint">${icon("info", 11)} Tape l'heure exacte (ex. 17:04) ou choisis aux 15 min dans la liste.</p>
    ${timeDatalistHTML()}
    <div class="modal-actions" style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3)">
      <div style="display:flex;gap:var(--sp-2)">
        ${(isEdit && startVal && endVal) ? `<button class="btn-cancel" style="color:#a23a36" onclick="deleteShift('${empId}','${dk}')">${icon("trash", 14)} Supprimer</button>` : ""}
        ${isEdit ? `<button class="btn-cancel" onclick="closeModal();openTimeOffModal('${empId}','${dk}')" title="Marquer cette journée en congé (retire le quart s'il y en a un)">${icon("sun", 14)} Marquer en congé</button>` : ""}
      </div>
      <div style="display:flex;gap:var(--sp-2)">
        <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
        <button class="btn btn-primary" onclick="saveShiftFromModal('${dk}')">${icon("check", 14)} ${isEdit ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </div>
  </div>`);
}

// Sauve le shift saisi dans la modale.
async function saveShiftFromModal(dk) {
  const empIdEl = document.getElementById("shift-emp-id");
  const empId = empIdEl ? empIdEl.value : "";
  if (!empId) return toast("Choisis un employé.", "warning");
  if (isTimeOff(empId, dk)) {
    const emp = employees.find(e => e.id === empId);
    return toast(`${emp ? emp.name : "Cet employé"} est en congé ce jour-là — retire le congé d'abord pour assigner un quart.`, "warning", 4500);
  }
  const start = normalizeTimeInput(document.getElementById("shift-start").value);
  const end = normalizeTimeInput(document.getElementById("shift-end").value);
  if (start === null || end === null) return toast("Heure invalide — utilise le format hh:mm (ex. 17:04).", "warning");
  if (!start || !end) return toast("Saisis l'entrée et la sortie.", "warning");
  const empPrev = employees.find(e => e.id === empId);
  const prevShift = empPrev ? (empPrev.shifts || {})[dk] : null; // pour l'annulation
  try {
    // Écrit start + end ensemble pour ne rien perdre.
    await db.collection("employees").doc(empId).set({
      shifts: { [dk]: { start, end } }
    }, { merge: true });
    pushScheduleUndo(prevShift ? "Modification d'un quart" : "Ajout d'un quart", _restoreShiftFn(empId, dk, prevShift));
    closeModal();
    toast("Shift enregistré.", "success", 2500);
  } catch (err) {
    console.error("saveShiftFromModal failed:", err);
    toast("Erreur sauvegarde : " + (err.message || err.code || err), "error", 5000);
  }
}

// Supprime un shift (depuis la modale d'édition).
async function deleteShift(empId, dk) {
  const empPrev = employees.find(e => e.id === empId);
  const prevShift = empPrev ? (empPrev.shifts || {})[dk] : null; // pour l'annulation
  try {
    // Pour supprimer la clé d'un map Firestore, on utilise FieldValue.delete()
    // en nesting dans un set merge:true.
    await db.collection("employees").doc(empId).set({
      shifts: { [dk]: firebase.firestore.FieldValue.delete() }
    }, { merge: true });
    pushScheduleUndo("Suppression d'un quart", _restoreShiftFn(empId, dk, prevShift));
    closeModal();
    toast("Shift supprimé.", "success", 2500);
  } catch (err) {
    console.error("deleteShift failed:", err);
    toast("Erreur suppression : " + (err.message || err.code || err), "error", 5000);
  }
}

// ─ Drag & drop de cartes shift entre colonnes-jour ────────
function shiftCardDragStart(e, empId, fromDk) {
  _shiftDragEmpId = empId;
  _shiftDragFromDay = fromDk;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", `${empId}|${fromDk}`); } catch (_) {}
  }
  // Petit décalage visuel sur la carte en cours de drag
  const card = e.currentTarget;
  setTimeout(() => card && card.classList.add("is-dragging"), 0);
}

function shiftCardDragOver(e, targetDk) {
  if (!_shiftDragEmpId || targetDk === _shiftDragFromDay) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  const col = e.currentTarget;
  col.classList.add("is-drop-target");
}

function shiftCardDragLeave(e) {
  const col = e.currentTarget;
  if (!col) return;
  // Ignore si on entre dans un enfant (le dragleave se déclenche aussi)
  const related = e.relatedTarget;
  if (related && col.contains(related)) return;
  col.classList.remove("is-drop-target");
}

function shiftCardDragEnd() {
  document.querySelectorAll(".shift-card.is-dragging").forEach(c => c.classList.remove("is-dragging"));
  document.querySelectorAll(".schedule-day-col.is-drop-target").forEach(c => c.classList.remove("is-drop-target"));
  _shiftDragEmpId = null;
  _shiftDragFromDay = null;
}

async function shiftCardDrop(e, targetDk) {
  e.preventDefault();
  const empId = _shiftDragEmpId;
  const fromDk = _shiftDragFromDay;
  shiftCardDragEnd();
  if (!empId || !fromDk || fromDk === targetDk) return;
  const emp = employees.find(x => x.id === empId);
  if (!emp) return;
  // Cible en congé → on bloque (un jour de congé ne peut pas recevoir de quart)
  if (isTimeOff(empId, targetDk)) {
    return toast(`${emp.name} est en congé ce jour-là — impossible d'y déplacer un quart.`, "warning", 4000);
  }
  const srcShift = (emp.shifts || {})[fromDk];
  if (!srcShift || !srcShift.start || !srcShift.end) return;
  // Si la cible a déjà un shift pour cet employé, on demande confirmation
  const tgtShift = (emp.shifts || {})[targetDk];
  if (tgtShift && tgtShift.start && tgtShift.end) {
    if (!confirm(`${emp.name} a déjà un shift ${tgtShift.start}→${tgtShift.end} ce jour-là. Le remplacer par ${srcShift.start}→${srcShift.end} ?`)) return;
  }
  const prevFrom = srcShift ? { ...srcShift } : null;       // pour l'annulation
  const prevTgt = (tgtShift && tgtShift.start) ? { ...tgtShift } : null;
  try {
    await db.collection("employees").doc(empId).set({
      shifts: {
        [fromDk]: firebase.firestore.FieldValue.delete(),
        [targetDk]: { start: srcShift.start, end: srcShift.end }
      }
    }, { merge: true });
    pushScheduleUndo("Déplacement d'un quart", () =>
      db.collection("employees").doc(empId).set({
        shifts: {
          [fromDk]: prevFrom ? { ...prevFrom } : firebase.firestore.FieldValue.delete(),
          [targetDk]: prevTgt ? { ...prevTgt } : firebase.firestore.FieldValue.delete()
        }
      }, { merge: true }));
    toast(`Shift déplacé : ${emp.name} ${srcShift.start}→${srcShift.end}`, "success", 2500);
  } catch (err) {
    console.error("shiftCardDrop failed:", err);
    toast("Erreur déplacement : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// Congés approuvés — modals de saisie (v3.37.0)
// ═══════════════════════════════════════════════════════════════

// Modal principal : marquer un employé en congé sur une plage de dates.
// prefillEmpId / prefillDk (optionnels) — viennent du raccourci « Marquer
// en congé » d'une cellule de la grille (employé + jour figés).
function openTimeOffModal(prefillEmpId, prefillDk) {
  const emp = prefillEmpId ? employees.find(e => e.id === prefillEmpId) : null;
  const fixedEmp = !!emp;
  const defDate = prefillDk || dayKey(new Date());

  showModal(`<div class="modal" style="max-width:480px">
    <div class="modal-header">
      <h3>${icon("sun", 18)} Ajouter un congé</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 var(--sp-3)">
      Les journées choisies seront verrouillées : impossible d'y assigner un quart. Les quarts déjà présents ces jours-là seront retirés.
    </p>
    <label>Employé
      ${fixedEmp
        ? `<input type="text" value="${esc(emp.name || "")}" disabled style="background:var(--surface2);color:var(--text2);cursor:not-allowed"/>
           <input type="hidden" id="to-emp-id" value="${prefillEmpId}"/>`
        : `<select id="to-emp-id" autofocus>
            <option value="">— Choisir un employé —</option>
            ${activeEmployees().slice().sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0)).map(e => `<option value="${e.id}">${esc(e.name || "")}</option>`).join("")}
          </select>`
      }
    </label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-2)">
      <label>Du
        <input type="date" id="to-start" value="${defDate}"/>
      </label>
      <label>Au
        <input type="date" id="to-end" value="${defDate}"/>
      </label>
    </div>
    <label style="margin-top:var(--sp-2);display:block">Type
      <select id="to-type">${buildLeaveTypeOptions("vacances")}</select>
    </label>
    <label style="margin-top:var(--sp-2);display:block">Note (optionnel)
      <input type="text" id="to-note" placeholder="ex. demandé le 1er mai" maxlength="120"/>
    </label>
    <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:var(--sp-2);margin-top:var(--sp-3)">
      <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
      <button class="btn btn-primary" onclick="saveTimeOffFromModal()">${icon("check", 14)} Enregistrer</button>
    </div>
  </div>`);
}

// Liste les clés jour "YYYY-MM-DD" entre deux dates incluses (max 366).
function _dkRange(startDk, endDk) {
  const [sy, sm, sd] = startDk.split("-").map(Number);
  const [ey, em, ed] = endDk.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  if (end < start) return [];
  const out = [];
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 366) {
    out.push(dayKey(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

// Sauve le congé saisi dans la modale (plage de dates).
async function saveTimeOffFromModal() {
  const empId = (document.getElementById("to-emp-id") || {}).value || "";
  if (!empId) return toast("Choisis un employé.", "warning");
  const startDk = (document.getElementById("to-start") || {}).value || "";
  const endDk = (document.getElementById("to-end") || {}).value || "";
  if (!startDk || !endDk) return toast("Choisis les dates de début et de fin.", "warning");
  const days = _dkRange(startDk, endDk);
  if (days.length === 0) return toast("La date de fin doit être après la date de début.", "warning");
  const type = (document.getElementById("to-type") || {}).value || "vacances";
  const note = ((document.getElementById("to-note") || {}).value || "").trim();

  const emp = employees.find(e => e.id === empId);
  const existingShifts = emp ? (emp.shifts || {}) : {};
  const existingTimeOff = emp ? (emp.timeOff || {}) : {};

  const timeOffPayload = {};
  const shiftsPayload = {};
  // Captures pour l'annulation : état précédent des jours touchés
  const undoTimeOff = {};
  const undoShifts = {};
  let removedShifts = 0;
  const now = Date.now();
  for (const dk of days) {
    timeOffPayload[dk] = { type, note, createdAt: now };
    undoTimeOff[dk] = existingTimeOff[dk] ? { ...existingTimeOff[dk] } : firebase.firestore.FieldValue.delete();
    if (existingShifts[dk] && existingShifts[dk].start && existingShifts[dk].end) {
      shiftsPayload[dk] = firebase.firestore.FieldValue.delete();
      undoShifts[dk] = { ...existingShifts[dk] };
      removedShifts++;
    }
  }

  try {
    const payload = { timeOff: timeOffPayload };
    if (removedShifts > 0) payload.shifts = shiftsPayload;
    await db.collection("employees").doc(empId).set(payload, { merge: true });
    await addLog("—", "Congé ajouté", `${emp ? emp.name : empId} · ${days.length} jour(s) · ${leaveTypeLabel(type)}`);
    pushScheduleUndo(`Congé de ${emp ? emp.name : "l'employé"} (${days.length} j)`, () => {
      const restore = { timeOff: undoTimeOff };
      if (removedShifts > 0) restore.shifts = undoShifts;
      return db.collection("employees").doc(empId).set(restore, { merge: true });
    });
    closeModal();
    let msg = `Congé enregistré · ${days.length} jour${days.length > 1 ? "s" : ""}`;
    if (removedShifts > 0) msg += ` · ${removedShifts} quart${removedShifts > 1 ? "s" : ""} retiré${removedShifts > 1 ? "s" : ""}`;
    toast(msg, "success", 4000);
  } catch (err) {
    console.error("saveTimeOffFromModal failed:", err);
    toast("Erreur sauvegarde congé : " + (err.message || err.code || err), "error", 5000);
  }
}

// Modal d'une cellule en congé : modifier le type / la note ou retirer.
function openTimeOffCellModal(empId, dk) {
  const emp = employees.find(e => e.id === empId);
  const leave = getTimeOff(empId, dk);
  if (!emp || !leave) return;
  const [yy, mm, ddNum] = dk.split("-").map(Number);
  const dayLabel = new Date(yy, mm - 1, ddNum).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" });

  showModal(`<div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>${icon("sun", 18)} Congé — ${esc(emp.name || "")}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 var(--sp-3);text-transform:capitalize">
      ${icon("calendar", 12)} ${dayLabel}
    </p>
    <label>Type
      <select id="toc-type">${buildLeaveTypeOptions(leave.type)}</select>
    </label>
    <label style="margin-top:var(--sp-2);display:block">Note (optionnel)
      <input type="text" id="toc-note" value="${esc(leave.note || "")}" maxlength="120"/>
    </label>
    <div class="modal-actions" style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3)">
      <button class="btn-cancel" style="color:#a23a36" onclick="removeTimeOff('${empId}','${dk}')">${icon("trash", 14)} Retirer le congé</button>
      <div style="display:flex;gap:var(--sp-2)">
        <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
        <button class="btn btn-primary" onclick="updateTimeOffCell('${empId}','${dk}')">${icon("check", 14)} Enregistrer</button>
      </div>
    </div>
  </div>`);
}

// Met à jour le type / la note d'un seul jour de congé.
async function updateTimeOffCell(empId, dk) {
  const type = (document.getElementById("toc-type") || {}).value || "vacances";
  const note = ((document.getElementById("toc-note") || {}).value || "").trim();
  const existing = getTimeOff(empId, dk) || {};
  const prev = getTimeOff(empId, dk); // pour l'annulation (objet complet ou null)
  try {
    await db.collection("employees").doc(empId).set({
      timeOff: { [dk]: { type, note, createdAt: existing.createdAt || Date.now() } }
    }, { merge: true });
    pushScheduleUndo("Modification d'un congé", () =>
      db.collection("employees").doc(empId).set({
        timeOff: { [dk]: prev ? { ...prev } : firebase.firestore.FieldValue.delete() }
      }, { merge: true }));
    closeModal();
    toast("Congé mis à jour.", "success", 2500);
  } catch (err) {
    console.error("updateTimeOffCell failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// Retire le congé d'un jour (la journée redevient assignable).
async function removeTimeOff(empId, dk) {
  const prev = getTimeOff(empId, dk); // pour l'annulation
  try {
    await db.collection("employees").doc(empId).set({
      timeOff: { [dk]: firebase.firestore.FieldValue.delete() }
    }, { merge: true });
    pushScheduleUndo("Retrait d'un congé", () =>
      db.collection("employees").doc(empId).set({
        timeOff: { [dk]: prev ? { ...prev } : firebase.firestore.FieldValue.delete() }
      }, { merge: true }));
    closeModal();
    toast("Congé retiré.", "success", 2500);
  } catch (err) {
    console.error("removeTimeOff failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// Téléchargement d'un canvas en PNG — robuste aux téléchargements répétés
// ═══════════════════════════════════════════════════════════════
// v3.43.2 — Avant, on faisait `canvas.toDataURL()` + `<a href="data:...">`.
// Chrome étouffe/bloque les téléchargements répétés de grosses data-URI
// jusqu'à une navigation (reload) → après un 1er export, le 2e ne partait
// plus tant qu'on n'avait pas rechargé la page. On passe par un **Blob +
// objectURL** (révoqué après coup), ce qui n'est pas soumis à ce blocage.
function _downloadCanvasPNG(canvas, filename) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (!blob) { reject(new Error("Génération du PNG impossible (toBlob a renvoyé null).")); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.download = filename;
        link.href = url;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        // Révoque l'URL après un court délai pour laisser le download démarrer.
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve();
      }, "image/png");
    } catch (e) { reject(e); }
  });
}

// ═══════════════════════════════════════════════════════════════
// v3.25.0 — Export PNG d'horaire (version publique pour employés)
// ═══════════════════════════════════════════════════════════════
// Génère une image PNG propre de l'horaire de la semaine pour partage
// avec les employés. SUPPRIME tous les chiffres financiers (taux horaire,
// coût par jour, total à payer) — seules les heures entrée/sortie sont
// affichées. Utilise html2canvas pour capturer un DOM dédié.

async function exportScheduleAsPNG() {
  if (typeof window.html2canvas !== "function") {
    toast("La bibliothèque PNG n'est pas chargée. Recharge la page.", "error");
    return;
  }
  toast("Préparation de l'image…", "info", 2000);

  const weekStart = getWeekStart(scheduleWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]);
  const weekLabel = `${weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);

  // v3.43.1 — Même ordre que l'affichage : on part de la liste visible de la
  // semaine (ordre par semaine `weekOrder`, masqués `weekHidden` retirés,
  // archivés seulement s'ils ont travaillé) puis on exclut ceux sans aucun
  // shift sur les jours visibles (vacances/congé toute la semaine) — pour ne
  // pas polluer le PNG équipe avec une ligne « Congé Congé Congé… ».
  const weekKey = dayKey(weekStart);
  const empsWithShifts = visibleScheduleEmployees(weekDays, weekKey).filter(emp => {
    const shifts = emp.shifts || {};
    return weekDays.some(d => {
      const s = shifts[dayKey(d)];
      return !!(s && s.start && s.end);
    });
  });

  if (empsWithShifts.length === 0) {
    toast("Aucun employé n'a de shift cette semaine — rien à exporter.", "warning", 4500);
    return;
  }

  // Récupère les shifts par employé (sans aucune donnée financière)
  const rows = empsWithShifts.map(emp => {
    const shifts = emp.shifts || {};
    const sec = (emp.section || "service");
    const daily = weekDays.map(d => {
      const s = shifts[dayKey(d)];
      if (s && s.start && s.end) return { start: s.start, end: s.end };
      return null;
    });
    return { emp, section: sec, daily };
  });

  // Construit un DOM off-screen avec un style minimaliste destiné à l'export.
  // Nettoyage défensif : retire un éventuel conteneur resté d'un export précédent
  // (si un finally n'a pas tourné) pour éviter tout doublon d'id.
  document.getElementById("_schedule-png-export")?.remove();
  const container = document.createElement("div");
  container.id = "_schedule-png-export";
  container.style.cssText = `
    position:fixed; left:-99999px; top:0; z-index:-1;
    background:#fdf6e7; padding:32px;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    color:#0e0d0c; width:1200px;
  `;
  container.innerHTML = `
    <div style="text-align:center; margin-bottom:24px; padding-bottom:18px; border-bottom:2px solid #0e0d0c">
      <div style="font-family:'Bebas Neue',Impact,sans-serif; font-size:42px; letter-spacing:.08em; line-height:1">BOCHICA</div>
      <div style="font-size:13px; color:#6e5f50; margin-top:2px">Restaurant Colombien</div>
      <div style="margin-top:8px">
        <div style="display:inline-block; height:3px; width:60px; background:#F7B32C"></div><div style="display:inline-block; height:3px; width:60px; background:#4a90e2"></div><div style="display:inline-block; height:3px; width:60px; background:#e74c3c"></div>
      </div>
      <div style="font-size:26px; font-weight:700; margin-top:14px">Horaire — Semaine ${weekNum}</div>
      <div style="font-size:14px; color:#444; margin-top:2px">${weekLabel}</div>
    </div>

    <div style="display:grid; grid-template-columns:180px repeat(${visibleIdx.length}, 1fr); gap:1px; background:#c8bca5; border:1px solid #c8bca5; border-radius:8px; overflow:hidden">
      <div style="background:#ede3d2; padding:12px; font-size:12px; font-weight:600; color:#444; text-transform:uppercase; letter-spacing:.05em">Employé</div>
      ${weekDays.map((d, k) => `<div style="background:#ede3d2; padding:12px; text-align:center">
        <div style="font-size:11px; font-weight:600; color:#444; text-transform:uppercase; letter-spacing:.05em">${DAYS_FR[visibleIdx[k]]}</div>
        <div style="font-size:18px; font-weight:700; margin-top:2px">${d.getDate()}/${d.getMonth() + 1}</div>
      </div>`).join("")}

      ${rows.map(row => {
        const isKitchen = row.section === "cuisine";
        const isService = row.section === "service";
        const accentColor = isKitchen ? "#BA7517" : isService ? "#378ADD" : "#888780";
        const secLabel = isKitchen ? "Cuisine" : isService ? "Service" : "Autre";
        return `
          <div style="background:#fff; padding:12px; border-left:4px solid ${accentColor}; display:flex; flex-direction:column; justify-content:center; min-height:70px">
            <div style="font-size:15px; font-weight:700; line-height:1.2">${esc(row.emp.name || "")}</div>
            <div style="font-size:11px; font-weight:600; color:#666; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">${secLabel}</div>
          </div>
          ${row.daily.map(d => {
            if (!d) {
              return `<div style="background:#fff; padding:10px; display:flex; align-items:center; justify-content:center; min-height:70px">
                <div style="font-size:13px; color:#999; font-style:italic">Congé</div>
              </div>`;
            }
            const tintBg = isKitchen ? "rgba(186,117,23,.10)" : isService ? "rgba(55,138,221,.08)" : "#f5f1e8";
            return `<div style="background:#fff; padding:8px; display:flex; align-items:center; justify-content:center; min-height:70px">
              <div style="background:${tintBg}; border-left:4px solid ${accentColor}; padding:8px 12px; border-radius:8px; text-align:center; min-width:90px">
                <div style="font-size:16px; font-weight:700; color:#0e0d0c; letter-spacing:.02em">${d.start} → ${d.end}</div>
              </div>
            </div>`;
          }).join("")}
        `;
      }).join("")}
    </div>

    <div style="margin-top:24px; padding-top:14px; border-top:1px dashed #c8bca5; display:flex; justify-content:space-between; font-size:11px; color:#6e5f50">
      <div>Bochica Café Bistro</div>
      <div>Affiché le ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</div>
    </div>
  `;
  document.body.appendChild(container);

  try {
    // Attendre un peu pour que les polices/styles se rendent
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(container, {
      scale: 2,                    // Retina-quality
      backgroundColor: "#fdf6e7",  // Fond crème
      logging: false,
      useCORS: true
    });
    await _downloadCanvasPNG(canvas, `Bochica_Horaire_Sem${weekNum}_${dayKey(weekStart)}.png`);
    toast("Image PNG téléchargée — prête à partager avec l'équipe.", "success", 4000);
  } catch (err) {
    console.error("exportScheduleAsPNG failed:", err);
    toast("Erreur génération PNG : " + (err.message || err), "error", 5000);
  } finally {
    container.remove();
  }
}

// ═══════════════════════════════════════════════════════════════
// v3.32.0 — Export PNG admin (version complète, INTERNE)
// ═══════════════════════════════════════════════════════════════
// Version enrichie du PNG horaire à usage interne admin : inclut
// le taux horaire, le coût $ par shift, les totaux heures+salaire
// par employé, les totaux semaine (heures, masse salariale, ventes
// prévues si dispo). Comme la version équipe, on exclut les employés
// sans aucun shift sur la semaine. Badge « INTERNE — NE PAS PARTAGER »
// en haut pour éviter qu'il finisse dans le groupe SMS de l'équipe.

async function exportScheduleAsPNGAdmin() {
  if (typeof window.html2canvas !== "function") {
    toast("La bibliothèque PNG n'est pas chargée. Recharge la page.", "error");
    return;
  }
  toast("Préparation du rapport admin…", "info", 2000);

  const weekStart = getWeekStart(scheduleWeekOffset);
  const weekDaysAll = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const weekEnd = weekDaysAll[6];
  const weekNum = getISOWeek(weekDaysAll[3]);
  const weekLabel = `${weekDaysAll[0].toLocaleDateString("fr-CA", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  const openDays = Array.isArray(scheduleSettings.openDays) ? scheduleSettings.openDays : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  const weekDays = visibleIdx.map(i => weekDaysAll[i]);
  const nbOpenDays = weekDays.length || 1;

  // v3.43.1 — Même ordre que l'affichage (visibleScheduleEmployees : ordre par
  // semaine, masqués retirés, archivés gérés) puis exclusion des employés sans
  // aucun shift sur la semaine (vacances/congé) — cohérent avec le PNG équipe.
  const weekKey = dayKey(weekStart);
  const weekVisibleEmps = visibleScheduleEmployees(weekDays, weekKey);
  const empsWithShifts = weekVisibleEmps.filter(emp => {
    const shifts = emp.shifts || {};
    return weekDays.some(d => {
      const s = shifts[dayKey(d)];
      return !!(s && s.start && s.end);
    });
  });

  if (empsWithShifts.length === 0) {
    toast("Aucun employé n'a de shift cette semaine — rien à exporter.", "warning", 4500);
    return;
  }

  // ─ Calcul des shifts + coûts par employé ─
  // Réplique la logique de renderHoraires (empRows) pour la PNG.
  const dayTotalsHours = new Array(weekDays.length).fill(0);
  const dayTotalsCost = new Array(weekDays.length).fill(0);
  const pngWeekStartKey = dayKey(weekDays[0] || new Date());
  const rows = empsWithShifts.map(emp => {
    const shifts = emp.shifts || {};
    const rate = effectiveHourlyRate(emp, pngWeekStartKey); // taux daté (v3.52.0)
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    const weeklyFixedPay = isSal ? fixedHours * rate : null;
    const dailyFixedCost = isSal ? weeklyFixedPay / nbOpenDays : null;
    const sec = (emp.section || "service");
    const daily = weekDays.map((d, col) => {
      const s = shifts[dayKey(d)];
      const hours = hoursFromShift(s);
      const cost = isSal ? dailyFixedCost : hours * effectiveHourlyRate(emp, dayKey(d));
      dayTotalsHours[col] += hours;
      dayTotalsCost[col] += cost;
      return { shift: s, hours, cost };
    });
    const totalHours = daily.reduce((sum, d) => sum + d.hours, 0);
    const totalPay = isSal ? weeklyFixedPay : daily.reduce((sum, d) => sum + d.cost, 0);
    return { emp, rate, isSal, fixedHours, section: sec, daily, totalHours, totalPay };
  });

  const weekTotalHours = dayTotalsHours.reduce((a, b) => a + b, 0);
  const weekTotalCost = dayTotalsCost.reduce((a, b) => a + b, 0);

  // Ratio salaires/ventes + ventes prévues
  // ⚠ Doit lire le MÊME champ que la page web (settings/schedule.salesRatio,
  // défaut 0.32). Avant v3.43.1 ce code lisait `salaryRatio` (champ inexistant)
  // → retombait toujours sur 0.30, d'où des ventes prévues différentes du web.
  const ratio = Number(scheduleSettings.salesRatio) || 0.32;
  const expectedSales = ratio > 0 ? (weekTotalCost / ratio) : 0;
  const actualSales = scheduleSettings.actualSales || {};
  const weekActualSales = weekDays.reduce((sum, d) => sum + (Number(actualSales[dayKey(d)]) || 0), 0);

  // Construit un DOM off-screen pour l'export (nettoyage défensif d'abord).
  document.getElementById("_schedule-png-export-admin")?.remove();
  const container = document.createElement("div");
  container.id = "_schedule-png-export-admin";
  container.style.cssText = `
    position:fixed; left:-99999px; top:0; z-index:-1;
    background:#fdf6e7; padding:32px;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    color:#0e0d0c; width:1400px;
  `;
  container.innerHTML = `
    <div style="text-align:center; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #0e0d0c">
      <div style="font-family:'Bebas Neue',Impact,sans-serif; font-size:42px; letter-spacing:.08em; line-height:1">BOCHICA</div>
      <div style="font-size:13px; color:#6e5f50; margin-top:2px">Restaurant Colombien</div>
      <div style="margin-top:8px">
        <div style="display:inline-block; height:3px; width:60px; background:#F7B32C"></div><div style="display:inline-block; height:3px; width:60px; background:#4a90e2"></div><div style="display:inline-block; height:3px; width:60px; background:#e74c3c"></div>
      </div>
      <div style="font-size:26px; font-weight:700; margin-top:14px">Horaire ADMIN — Semaine ${weekNum}</div>
      <div style="font-size:14px; color:#444; margin-top:2px">${weekLabel}</div>
      <div style="display:inline-block; margin-top:10px; padding:4px 12px; background:#9f1239; color:#fff; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; border-radius:4px">INTERNE — Ne pas partager</div>
    </div>

    <div style="display:grid; grid-template-columns:200px repeat(${visibleIdx.length}, 1fr) 130px; gap:1px; background:#c8bca5; border:1px solid #c8bca5; border-radius:8px; overflow:hidden">
      <!-- Header -->
      <div style="background:#ede3d2; padding:12px; font-size:12px; font-weight:600; color:#444; text-transform:uppercase; letter-spacing:.05em">Employé · Taux</div>
      ${weekDays.map((d, k) => `<div style="background:#ede3d2; padding:12px; text-align:center">
        <div style="font-size:11px; font-weight:600; color:#444; text-transform:uppercase; letter-spacing:.05em">${DAYS_FR[visibleIdx[k]]}</div>
        <div style="font-size:18px; font-weight:700; margin-top:2px">${d.getDate()}/${d.getMonth() + 1}</div>
        <div style="font-size:10px; color:#666; margin-top:2px">${fmtHours(dayTotalsHours[k])}h · ${fmtMoney(dayTotalsCost[k])}</div>
      </div>`).join("")}
      <div style="background:#ede3d2; padding:12px; text-align:center; font-size:12px; font-weight:600; color:#444; text-transform:uppercase; letter-spacing:.05em">Total emp.</div>

      <!-- Lignes employés -->
      ${rows.map(row => {
        const isKitchen = row.section === "cuisine";
        const isService = row.section === "service";
        const accentColor = isKitchen ? "#BA7517" : isService ? "#378ADD" : "#888780";
        const secLabel = isKitchen ? "Cuisine" : isService ? "Service" : "Autre";
        return `
          <div style="background:#fff; padding:12px; border-left:4px solid ${accentColor}; display:flex; flex-direction:column; justify-content:center; min-height:80px">
            <div style="font-size:15px; font-weight:700; line-height:1.2">${esc(row.emp.name || "")}</div>
            <div style="font-size:11px; font-weight:600; color:#666; text-transform:uppercase; letter-spacing:.05em; margin-top:3px">${secLabel}</div>
            <div style="font-size:12px; color:#0e0d0c; margin-top:3px; font-weight:600">${row.rate.toFixed(2)} $/h${row.isSal ? " · FIXE" : ""}</div>
          </div>
          ${row.daily.map(d => {
            if (!d.shift || !d.shift.start || !d.shift.end) {
              return `<div style="background:#fff; padding:10px; display:flex; align-items:center; justify-content:center; min-height:80px">
                <div style="font-size:13px; color:#999; font-style:italic">Congé</div>
              </div>`;
            }
            const tintBg = isKitchen ? "rgba(186,117,23,.10)" : isService ? "rgba(55,138,221,.08)" : "#f5f1e8";
            return `<div style="background:#fff; padding:8px; display:flex; align-items:center; justify-content:center; min-height:80px">
              <div style="background:${tintBg}; border-left:4px solid ${accentColor}; padding:8px 12px; border-radius:8px; text-align:center; min-width:100px">
                <div style="font-size:15px; font-weight:700; color:#0e0d0c; letter-spacing:.02em">${d.shift.start} → ${d.shift.end}</div>
                <div style="font-size:11px; color:#444; margin-top:3px">${fmtHours(d.hours)}h · ${fmtMoney(d.cost)}</div>
              </div>
            </div>`;
          }).join("")}
          <!-- Cellule totaux par employé -->
          <div style="background:#fff; padding:10px; display:flex; flex-direction:column; justify-content:center; align-items:center; min-height:80px; border-left:1px solid #e5d9c4">
            <div style="font-size:13px; font-weight:700; color:#0e0d0c">${fmtHours(row.totalHours)}h</div>
            <div style="font-size:14px; font-weight:800; color:${accentColor}; margin-top:3px">${fmtMoney(row.totalPay)}</div>
          </div>
        `;
      }).join("")}
    </div>

    <!-- Panneau de totaux semaine -->
    <div style="margin-top:18px; padding:16px; background:#fff; border:1.5px solid #c8bca5; border-radius:10px">
      <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:16px; text-align:center">
        <div>
          <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.05em; font-weight:600">Heures totales</div>
          <div style="font-size:22px; font-weight:800; color:#0e0d0c; margin-top:4px">${fmtHours(weekTotalHours)}h</div>
        </div>
        <div>
          <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.05em; font-weight:600">Masse salariale</div>
          <div style="font-size:22px; font-weight:800; color:#0e0d0c; margin-top:4px">${fmtMoney(weekTotalCost)}</div>
        </div>
        <div>
          <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.05em; font-weight:600">Ventes prévues</div>
          <div style="font-size:22px; font-weight:800; color:#0e0d0c; margin-top:4px">${fmtMoney(expectedSales)}</div>
          <div style="font-size:10px; color:#666; margin-top:2px">à ratio ${(ratio * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.05em; font-weight:600">Ventes réelles</div>
          <div style="font-size:22px; font-weight:800; color:${weekActualSales > 0 ? "#0e0d0c" : "#999"}; margin-top:4px">${weekActualSales > 0 ? fmtMoney(weekActualSales) : "—"}</div>
          ${weekActualSales > 0 ? `<div style="font-size:10px; color:#666; margin-top:2px">ratio réel ${(weekTotalCost / weekActualSales * 100).toFixed(1)}%</div>` : ""}
        </div>
      </div>
      ${empsWithShifts.length < weekVisibleEmps.length
        ? `<div style="margin-top:14px; padding-top:12px; border-top:1px dashed #c8bca5; font-size:11px; color:#6e5f50; text-align:center; font-style:italic">
            ${weekVisibleEmps.length - empsWithShifts.length} employé${weekVisibleEmps.length - empsWithShifts.length > 1 ? "s" : ""} en congé toute la semaine non affiché${weekVisibleEmps.length - empsWithShifts.length > 1 ? "s" : ""}
          </div>`
        : ""}
    </div>

    <div style="margin-top:18px; padding-top:14px; border-top:1px dashed #c8bca5; display:flex; justify-content:space-between; font-size:11px; color:#6e5f50">
      <div>Bochica Café Bistro — Document interne admin</div>
      <div>Généré le ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} à ${new Date().toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  `;
  document.body.appendChild(container);

  try {
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#fdf6e7",
      logging: false,
      useCORS: true
    });
    await _downloadCanvasPNG(canvas, `Bochica_HoraireAdmin_Sem${weekNum}_${dayKey(weekStart)}.png`);
    toast("Rapport admin PNG téléchargé — pour usage interne seulement.", "success", 4000);
  } catch (err) {
    console.error("exportScheduleAsPNGAdmin failed:", err);
    toast("Erreur génération PNG : " + (err.message || err), "error", 5000);
  } finally {
    container.remove();
  }
}
