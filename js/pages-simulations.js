// ═══════════════════════════════════════════════════════════════
// SIMULATIONS PAIE — planification de scénarios RH (admin only)
// ───────────────────────────────────────────────────────────────
// Permet de copier l'horaire planifié actuel pour créer un scénario
// hypothétique : modifier noms/taux/heures, ajouter/retirer des
// employés, ajuster les pourboires, et comparer le résultat côte à
// côte avec l'horaire réel courant (écart $ et %).
//
// Cas d'usage : embaucher quelqu'un, prévoir un départ, tester une
// hausse de salaire, voir l'impact d'un changement de section.
//
// Données :
//   • payrollSimulations/{id}
//     ├─ name, description, baseWeekRef, createdAt, updatedAt, createdBy
//     ├─ baseline {employees[], serviceHours, tipShares, totalTips, openDays}
//     │   ← SNAPSHOT FIGÉ au moment de la création (référence "réel")
//     └─ simulation {employees[], serviceHours, tipShares, totalTips, openDays}
//         ← COPIE MODIFIABLE
//
//   Les shifts sont stockés par index de jour de semaine (0=Lun..6=Dim)
//   plutôt que par date, pour que la sim soit indépendante d'une
//   semaine particulière.
// ═══════════════════════════════════════════════════════════════

// ═ Helpers ══════════════════════════════════════════════

// Convertit un objet shifts indexé par date YYYY-MM-DD (format BDD employés)
// vers un objet indexé par index de jour de semaine (0=Lun..6=Dim).
// On utilise la semaine planifiée courante comme source.
function shiftsByDateToByDow(shiftsByDate, weekStart) {
  const out = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dk = d.toISOString().slice(0, 10);
    const s = shiftsByDate && shiftsByDate[dk];
    if (s && (s.start || s.end)) {
      out[i] = { start: s.start || "", end: s.end || "" };
    }
  }
  return out;
}

// Section "tipGroup" : "cuisine" ou "service" (service + other partagent le pool service)
function simTipGroupOf(empSim) {
  return (empSim.section || "service") === "cuisine" ? "cuisine" : "service";
}

// v3.45.0 — Shifts coupés (plusieurs quarts dans la même journée).
// Le modèle emp.shifts[dow] accepte désormais SOIT un objet unique {start,end}
// (ancien format, rétrocompat), SOIT un tableau de {start,end}.
// Ce helper normalise TOUJOURS vers un tableau de quarts valides {start,end}.
function simDayShifts(entry) {
  if (!entry) return [];
  const arr = Array.isArray(entry) ? entry : [entry];
  return arr
    .filter(s => s && s.start && s.end)
    .map(s => ({ start: s.start, end: s.end }));
}

// Calcule un snapshot complet d'un scénario (baseline ou simulation).
// Retourne { rows[], totals, pools, totalsHours }
function computeSimScenario(scenario) {
  if (!scenario || !Array.isArray(scenario.employees)) {
    return { rows: [], totals: { hours: 0, gross: 0, tips: 0, total: 0 }, pools: { cuisine: 0, service: 0 }, totalsHours: { cuisine: 0, service: 0 } };
  }
  const openDays = Array.isArray(scenario.openDays) && scenario.openDays.length
    ? scenario.openDays
    : [0, 1, 2, 3, 4, 5, 6];
  const serviceHours = scenario.serviceHours || {};
  const tipShares = scenario.tipShares || { cuisine: 0.25, service: 0.75 };
  const totalTips = Number(scenario.totalTips) || 0;

  // Pré-calcul des heures éligibles pourboires par groupe (sur tous les jours ouverts)
  // ET des totaux par jour (heures + coût salaire) pour le tfoot.
  let totalHrsCuisine = 0;
  let totalHrsService = 0;
  const nbOpenDays = openDays.length || 1;
  // Index 0..6 (Lun..Dim). Pour les jours non ouverts, valeur reste 0.
  const dayTotalsHours = new Array(7).fill(0);
  const dayTotalsCost = new Array(7).fill(0);

  const empCalc = scenario.employees.map(emp => {
    const rate = Number(emp.hourlyRate) || 0;
    const isSal = !!emp.isSalaried;
    const fixedHours = Number(emp.fixedWeeklyHours) || 0;
    // Salariés : coût hebdo fixe réparti à parts égales sur les jours ouverts
    const weeklyFixedPay = isSal ? fixedHours * rate : null;
    const dailyFixedCost = isSal ? weeklyFixedPay / nbOpenDays : null;
    const group = simTipGroupOf(emp);
    let totalHours = 0;
    let tipEligibleHours = 0;
    const daily = [];
    for (let dow = 0; dow < 7; dow++) {
      if (!openDays.includes(dow)) { daily.push(null); continue; }
      // v3.45.0 — un jour peut contenir PLUSIEURS quarts (shift coupé)
      const shifts = simDayShifts((emp.shifts || {})[dow]);
      const win = serviceHours[dow];
      let hours = 0;
      let tipHrs = 0;
      shifts.forEach(s => {
        hours += hoursFromShift(s);
        if (win) tipHrs += intersectShiftHours(s, win);
      });
      const cost = isSal ? dailyFixedCost : hours * rate;
      totalHours += hours;
      tipEligibleHours += tipHrs;
      dayTotalsHours[dow] += hours;
      dayTotalsCost[dow] += cost;
      daily.push({ shifts, hours, tipHrs, cost });
    }
    if (group === "cuisine") totalHrsCuisine += tipEligibleHours;
    else totalHrsService += tipEligibleHours;
    const grossWage = isSal ? weeklyFixedPay : totalHours * rate;
    return { emp, rate, isSal, fixedHours, group, daily, totalHours, tipEligibleHours, grossWage };
  });

  const poolCuisine = totalTips * (Number(tipShares.cuisine) || 0);
  const poolService = totalTips * (Number(tipShares.service) || 0);

  const rows = empCalc.map(r => {
    const groupPool = r.group === "cuisine" ? poolCuisine : poolService;
    const groupTotalHrs = r.group === "cuisine" ? totalHrsCuisine : totalHrsService;
    const tipShare = (groupTotalHrs > 0 && r.tipEligibleHours > 0)
      ? (r.tipEligibleHours / groupTotalHrs) * groupPool
      : 0;
    const totalPay = r.grossWage + tipShare;
    return { ...r, tipShare, totalPay };
  });

  const totals = {
    hours: rows.reduce((s, r) => s + r.totalHours, 0),
    gross: rows.reduce((s, r) => s + r.grossWage, 0),
    tips: rows.reduce((s, r) => s + r.tipShare, 0),
    total: rows.reduce((s, r) => s + r.totalPay, 0)
  };
  return {
    rows, totals,
    pools: { cuisine: poolCuisine, service: poolService },
    totalsHours: { cuisine: totalHrsCuisine, service: totalHrsService },
    dayTotalsHours,                    // tableau 7 (par dow 0..6, 0 si jour non ouvert)
    dayTotalsCost                      // idem pour coût salaire
  };
}

// Trouve l'écart $ et % entre deux valeurs (sim vs baseline)
function simGap(sim, base) {
  const diff = (Number(sim) || 0) - (Number(base) || 0);
  const pct = base > 0 ? (diff / base) * 100 : (sim > 0 ? 100 : 0);
  return { diff, pct };
}

// HTML d'une cellule "écart" colorée (positive = + rouge car ça coûte plus, négatif = vert)
function simGapCell(sim, base, opts = {}) {
  const { diff, pct } = simGap(sim, base);
  const positiveIsBad = opts.positiveIsBad !== false; // true par défaut (coûts)
  const cls = Math.abs(diff) < 0.005
    ? "is-zero"
    : (diff > 0 ? (positiveIsBad ? "is-negative" : "is-positive") : (positiveIsBad ? "is-positive" : "is-negative"));
  const arrow = Math.abs(diff) < 0.005 ? "—" : (diff > 0 ? "▲" : "▼");
  const sign = diff > 0 ? "+" : (diff < 0 ? "−" : "");
  return `<span class="sim-gap ${cls}">${arrow} ${sign}${fmtMoney(Math.abs(diff))} <small>(${sign}${Math.abs(pct).toFixed(1)}%)</small></span>`;
}

// ═ Rendu principal — liste des simulations ═══════════════
function renderSimulations() {
  // Tri : plus récent en premier
  const sims = [...(payrollSimulations || [])].sort((a, b) => {
    const ta = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    return tb - ta;
  });

  return `<div class="page">
    <div class="toolbar">
      <h2 class="page-title">${icon("trending-up", 22)} Simulation paie</h2>
      <button class="btn btn-primary" onclick="createSimFromPlanned()">${icon("plus", 16)} Nouvelle simulation</button>
    </div>

    <div class="sim-intro card">
      ${icon("info", 18)}
      <div>
        <strong>Planifie des scénarios RH</strong> sans toucher à tes vraies données.
        Une simulation est une <strong>copie figée</strong> de ton horaire planifié actuel que tu peux modifier librement :
        changer un nom, ajuster un taux, ajouter une future embauche, retirer un employé, modifier des heures, etc.
        Compare ensuite le résultat <strong>côte à côte</strong> avec le réel pour voir l'écart en $ et %.
      </div>
    </div>

    ${sims.length === 0 ? renderEmptyState({
      kind: "default",
      title: "Aucune simulation pour l'instant",
      subtitle: "Crée un scénario hypothétique à partir de l'horaire planifié courant : changer un taux, ajouter une future embauche, retirer un employé, ajuster les pourboires… puis compare avec le réel.",
      cta: { label: "Créer ma première simulation", icon: "plus", onClick: "createSimFromPlanned()" },
      hint: "Compare en $ et % vs réel"
    }) : `
      <div class="sim-grid">
        ${sims.map(s => renderSimCard(s)).join("")}
      </div>
    `}
  </div>`;
}

// Carte d'une simulation dans la liste
function renderSimCard(sim) {
  const base = computeSimScenario(sim.baseline);
  const cur = computeSimScenario(sim.simulation);
  const gapTotal = simGap(cur.totals.total, base.totals.total);
  const gapCls = Math.abs(gapTotal.diff) < 0.005
    ? "is-zero"
    : (gapTotal.diff > 0 ? "is-negative" : "is-positive");
  const arrow = Math.abs(gapTotal.diff) < 0.005 ? "—" : (gapTotal.diff > 0 ? "▲" : "▼");
  const sign = gapTotal.diff > 0 ? "+" : (gapTotal.diff < 0 ? "−" : "");
  const empCount = (sim.simulation?.employees || []).length;
  const baseEmpCount = (sim.baseline?.employees || []).length;
  const dateLabel = sim.createdAt?.toDate
    ? sim.createdAt.toDate().toLocaleDateString("fr-CA", { year: "numeric", month: "short", day: "numeric" })
    : "";

  return `<div class="card sim-card">
    <div class="sim-card__head">
      <div class="sim-card__info">
        <div class="sim-card__name">${esc(sim.name || "Sans nom")}</div>
        ${sim.description ? `<div class="sim-card__desc">${esc(sim.description)}</div>` : ""}
        <div class="sim-card__meta">
          <span title="Semaine de référence">${icon("calendar", 11)} Base : ${esc(sim.baseWeekRef || "—")}</span>
          ${dateLabel ? `<span title="Date de création">${icon("clock", 11)} ${dateLabel}</span>` : ""}
          <span title="Employés dans la simulation">${icon("users", 11)} ${empCount} emp.${empCount !== baseEmpCount ? ` <em>(base : ${baseEmpCount})</em>` : ""}</span>
        </div>
      </div>
      <div class="menu-wrap">
        <button class="dots-btn" onclick="toggleDrop('sim${sim.id}')" aria-label="Actions">${icon("more-vertical", 16)}</button>
        <div class="dropdown" id="drop-sim${sim.id}">
          <button onclick="openSimulationEditor('${sim.id}');closeAllDrops()">${icon("pencil", 14)} Ouvrir / modifier</button>
          <button onclick="duplicateSimulation('${sim.id}');closeAllDrops()">${icon("copy", 14)} Dupliquer</button>
          <button onclick="resetSimToBaseline('${sim.id}');closeAllDrops()">${icon("refresh", 14)} Réinitialiser au réel</button>
          <div class="sep"></div>
          <button class="text-danger" onclick="askDeleteSimulation('${sim.id}');closeAllDrops()">${icon("trash", 14)} Supprimer</button>
        </div>
      </div>
    </div>

    <div class="sim-card__compare">
      <div class="sim-compare-col">
        <div class="sim-compare-label">${icon("shield-check", 12)} Réel (base)</div>
        <div class="sim-compare-value">${fmtMoney(base.totals.total)}</div>
        <div class="sim-compare-sub">${fmtHours(base.totals.hours)}h · Salaires ${fmtMoney(base.totals.gross)} · Pourb. ${fmtMoney(base.totals.tips)}</div>
      </div>
      <div class="sim-compare-arrow">${icon("chevron-right", 18)}</div>
      <div class="sim-compare-col">
        <div class="sim-compare-label sim-compare-label--sim">${icon("trending-up", 12)} Simulation</div>
        <div class="sim-compare-value">${fmtMoney(cur.totals.total)}</div>
        <div class="sim-compare-sub">${fmtHours(cur.totals.hours)}h · Salaires ${fmtMoney(cur.totals.gross)} · Pourb. ${fmtMoney(cur.totals.tips)}</div>
      </div>
    </div>

    <div class="sim-card__gap ${gapCls}">
      <span class="sim-card__gap-arrow">${arrow}</span>
      <strong>${sign}${fmtMoney(Math.abs(gapTotal.diff))}</strong>
      <span class="sim-card__gap-pct">(${sign}${Math.abs(gapTotal.pct).toFixed(1)}%)</span>
      <span class="sim-card__gap-label">vs réel</span>
    </div>

    <div class="sim-card__actions">
      <button class="btn-secondary btn-sm" onclick="openSimulationEditor('${sim.id}')">${icon("pencil", 14)} Ouvrir</button>
    </div>
  </div>`;
}

// ═ Création d'une simulation depuis l'horaire planifié courant ══

async function createSimFromPlanned() {
  if (employees.length === 0) {
    return toast("Ajoute d'abord au moins un employé dans Employés & Horaires.", "warning");
  }
  // Suggérer un nom par défaut
  const today = new Date();
  const defaultName = `Simulation du ${today.toLocaleDateString("fr-CA", { month: "short", day: "numeric", year: "numeric" })}`;

  showModal(`<div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h3>${icon("trending-up", 18)} Nouvelle simulation</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      On copie l'horaire planifié de la <strong>semaine courante</strong> (employés, taux, shifts) + les heures de service et la répartition des pourboires. Tu pourras ensuite tout modifier librement.
    </p>
    <label>Nom de la simulation
      <input id="sim-new-name" value="${esc(defaultName)}" placeholder="ex: Embauche serveuse été"/>
    </label>
    <label>Description / contexte <span style="font-weight:400;color:var(--text3);font-size:11px">(optionnel)</span>
      <textarea id="sim-new-desc" style="height:70px" placeholder="ex: Test impact d'une augmentation de 2$/h pour le service"></textarea>
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="confirmCreateSimFromPlanned()">${icon("plus", 14)} Créer</button>
    </div>
  </div>`);
}

async function confirmCreateSimFromPlanned() {
  const name = document.getElementById("sim-new-name").value.trim();
  if (!name) return toast("Donne un nom à ta simulation.", "error");
  const description = document.getElementById("sim-new-desc").value.trim();

  const weekStart = getWeekStart(scheduleWeekOffset);
  const weekNum = getISOWeek(new Date(weekStart.getTime() + 3 * 86400000));
  const baseWeekRef = `${weekStart.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

  // Snapshot des employés : conversion shifts par date → par index de jour
  // (employés archivés exclus du scénario de base)
  const empSnapshots = (typeof activeEmployees === "function" ? activeEmployees() : employees).map(emp => ({
    id: emp.id,
    name: emp.name || "",
    section: emp.section || "service",
    hourlyRate: Number(emp.hourlyRate) || 0,
    isSalaried: !!emp.isSalaried,
    fixedWeeklyHours: Number(emp.fixedWeeklyHours) || 0,
    role: emp.role || "",
    isFictional: false,
    shifts: shiftsByDateToByDow(emp.shifts || {}, weekStart)
  }));

  // Heures de service par jour (snapshot)
  const serviceHours = {};
  const defSH = payrollSettings?.defaultServiceHours || {};
  for (const k of Object.keys(defSH)) {
    const v = defSH[k];
    if (v && v.start && v.end) serviceHours[Number(k)] = { start: v.start, end: v.end };
  }
  const tipShares = {
    cuisine: Number(payrollSettings?.tipShares?.cuisine ?? 0.25),
    service: Number(payrollSettings?.tipShares?.service ?? 0.75)
  };
  // Pourboires : si la semaine courante en a (page Salaires), prendre le total, sinon 0
  let totalTips = 0;
  if (payrollWeekData?.tipsByDay) {
    totalTips = Object.values(payrollWeekData.tipsByDay).reduce((s, v) => s + (Number(v) || 0), 0);
  } else if (payrollWeekData?.totalTips) {
    totalTips = Number(payrollWeekData.totalTips) || 0;
  }
  const openDays = Array.isArray(scheduleSettings.openDays) ? [...scheduleSettings.openDays] : [0,1,2,3,4,5,6];
  // Snapshot du ratio salaires/ventes (sert au calcul des ventes prévues dans la sim)
  const salesRatio = Number(scheduleSettings.salesRatio) || 0.32;

  const baseline = {
    employees: empSnapshots,
    serviceHours,
    tipShares,
    totalTips,
    openDays,
    salesRatio
  };
  // Simulation = copie initiale identique au baseline
  const simulation = JSON.parse(JSON.stringify(baseline));

  const id = genId();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  try {
    await db.collection("payrollSimulations").doc(id).set({
      id,
      name,
      description,
      baseWeekRef,
      baseline,
      simulation,
      createdAt: now,
      updatedAt: now,
      createdBy: (loggedInUser?.id) || "—"
    });
    closeModal();
    toast(`Simulation « ${name} » créée.`, "success");
    await addLog("—", "Simulation créée", `${name} (base : ${baseWeekRef}, ${empSnapshots.length} employés)`);
    // Ouvrir l'éditeur directement
    openSimulationEditor(id);
  } catch (err) {
    console.error("createSim:", err);
    toast("Erreur création : " + (err.message || err), "error");
  }
}

// ═ Suppression / duplication / reset ═══════════════════

function askDeleteSimulation(id) {
  const sim = (payrollSimulations || []).find(s => s.id === id);
  if (!sim) return;
  openConfirm(
    "Supprimer cette simulation ?",
    `« <strong>${esc(sim.name || "Sans nom")}</strong> » sera supprimée définitivement. Cette action est <strong>irréversible</strong>.`,
    async () => {
      try {
        await db.collection("payrollSimulations").doc(id).delete();
        toast("Simulation supprimée.", "success");
        await addLog("—", "Simulation supprimée", sim.name || id);
      } catch (err) {
        toast("Erreur suppression : " + (err.message || err), "error");
      }
    },
    true
  );
}

async function duplicateSimulation(id) {
  const sim = (payrollSimulations || []).find(s => s.id === id);
  if (!sim) return;
  const nid = genId();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  try {
    await db.collection("payrollSimulations").doc(nid).set({
      id: nid,
      name: (sim.name || "Sans nom") + " (Copie)",
      description: sim.description || "",
      baseWeekRef: sim.baseWeekRef || "—",
      baseline: sim.baseline || {},
      simulation: sim.simulation || sim.baseline || {},
      createdAt: now,
      updatedAt: now,
      createdBy: (loggedInUser?.id) || "—"
    });
    toast("Simulation dupliquée.", "success");
  } catch (err) {
    toast("Erreur duplication : " + (err.message || err), "error");
  }
}

function resetSimToBaseline(id) {
  const sim = (payrollSimulations || []).find(s => s.id === id);
  if (!sim) return;
  openConfirm(
    "Réinitialiser la simulation ?",
    `Toutes tes modifications dans « <strong>${esc(sim.name || "Sans nom")}</strong> » seront <strong>écrasées</strong> par les valeurs du réel (snapshot d'origine). Continuer ?`,
    async () => {
      try {
        const copy = JSON.parse(JSON.stringify(sim.baseline || {}));
        await db.collection("payrollSimulations").doc(id).update({
          simulation: copy,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        toast("Simulation réinitialisée.", "success");
      } catch (err) {
        toast("Erreur : " + (err.message || err), "error");
      }
    },
    true
  );
}

// ═ Éditeur d'une simulation ═════════════════════════════

let _editingSimId = null;

function openSimulationEditor(id) {
  const sim = (payrollSimulations || []).find(s => s.id === id);
  if (!sim) return toast("Simulation introuvable.", "error");
  _editingSimId = id;
  renderSimulationEditor();
}

function closeSimulationEditor() {
  _editingSimId = null;
  renderPage();
}

function renderSimulationEditor() {
  const sim = (payrollSimulations || []).find(s => s.id === _editingSimId);
  const pc = document.getElementById("page-content");
  if (!pc) return;
  if (!sim) {
    _editingSimId = null;
    renderPage();
    return;
  }
  pc.innerHTML = renderSimulationEditorHTML(sim);
  // Initialiser/rafraîchir le graphique de couverture après l'injection du DOM
  setTimeout(() => { if (typeof initSimCoverageChart === "function") initSimCoverageChart(); }, 50);
}

function renderSimulationEditorHTML(sim) {
  const base = computeSimScenario(sim.baseline);
  const cur = computeSimScenario(sim.simulation);
  const gapTotal = simGap(cur.totals.total, base.totals.total);
  const gapHours = simGap(cur.totals.hours, base.totals.hours);
  const gapGross = simGap(cur.totals.gross, base.totals.gross);
  const gapTips = simGap(cur.totals.tips, base.totals.tips);

  const openDays = Array.isArray(sim.simulation?.openDays) && sim.simulation.openDays.length
    ? sim.simulation.openDays
    : [0,1,2,3,4,5,6];
  const visibleIdx = [0,1,2,3,4,5,6].filter(i => openDays.includes(i));
  // v3.45.0 — fenêtre d'ouverture par jour (affichée dans l'en-tête de la grille)
  const serviceHours = sim.simulation?.serviceHours || {};

  const tipShares = sim.simulation?.tipShares || { cuisine: 0.25, service: 0.75 };
  const totalTips = Number(sim.simulation?.totalTips) || 0;
  const baseTotalTips = Number(sim.baseline?.totalTips) || 0;
  // Ratio salaires/ventes pour le calcul des ventes prévues du tfoot
  const salesRatio = Number(sim.simulation?.salesRatio) || 0.32;
  const baseSalesRatio = Number(sim.baseline?.salesRatio) || 0.32;
  // Totaux par jour (heures + coûts) pour le tfoot
  const weekTotalHours = visibleIdx.reduce((s, dow) => s + (cur.dayTotalsHours[dow] || 0), 0);
  const weekTotalCost = visibleIdx.reduce((s, dow) => s + (cur.dayTotalsCost[dow] || 0), 0);
  const weekTotalSales = salesRatio > 0 ? weekTotalCost / salesRatio : 0;

  return `<div class="page sim-editor">
    <div class="toolbar">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="closeSimulationEditor()" title="Retour à la liste">${icon("chevron-left", 14)} Retour</button>
        <h2 class="page-title" style="margin:0">${icon("trending-up", 20)} ${esc(sim.name || "Sans nom")}</h2>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-secondary btn-sm" onclick="openSimMetaModal('${sim.id}')" title="Modifier nom et description">${icon("pencil", 14)} Renommer</button>
        <button class="btn-secondary btn-sm" onclick="copyCurrentWeekIntoSim('${sim.id}')" title="Remplacer les employés et quarts de cette simulation par l'horaire planifié de la semaine en cours">${icon("download", 14)} Copier l'horaire</button>
        <button class="btn-secondary btn-sm" onclick="resetSimToBaseline('${sim.id}')" title="Réinitialiser la simulation aux valeurs du réel">${icon("refresh", 14)} Réinitialiser</button>
        <button class="btn-secondary btn-sm" onclick="duplicateSimulation('${sim.id}')" title="Dupliquer cette simulation">${icon("copy", 14)} Dupliquer</button>
      </div>
    </div>

    ${sim.description ? `<div class="sim-editor-desc card">${icon("info", 14)} ${esc(sim.description)}</div>` : ""}

    <!-- ═ KPI totaux ════════════════════════════════ -->
    <div class="sim-kpi-row">
      ${renderSimKpi("Heures totales", `${fmtHours(cur.totals.hours)} h`, `${fmtHours(base.totals.hours)} h`, gapHours, false, "clock")}
      ${renderSimKpi("Masse salariale", fmtMoney(cur.totals.gross), fmtMoney(base.totals.gross), gapGross, true, "dollar-sign")}
      ${renderSimKpi("Pourboires distribués", fmtMoney(cur.totals.tips), fmtMoney(base.totals.tips), gapTips, false, "percent")}
      ${renderSimKpi("Total à payer", fmtMoney(cur.totals.total), fmtMoney(base.totals.total), gapTotal, true, "wallet")}
    </div>

    <!-- ═ Paramètres globaux : pourboires + répartition ═ -->
    <div class="card sim-params-card">
      <h3 class="section-title" style="margin:0 0 14px 0">${icon("dollar-sign", 16)} Paramètres globaux</h3>
      <div class="sim-params-grid">
        <label>Pourboires totaux (semaine)
          <div class="sim-input-money">
            <input type="number" min="0" step="0.01" value="${totalTips || ""}" placeholder="0.00" onchange="updateSimTotalTips('${sim.id}', this.value)"/>
            <span>$</span>
          </div>
          <span class="field-hint">${icon("info", 11)} Base : ${fmtMoney(baseTotalTips)}</span>
        </label>
        <label>Part cuisine (%)
          <div class="sim-input-money">
            <input type="number" min="0" max="100" step="1" value="${Math.round(tipShares.cuisine * 100)}" onchange="updateSimTipShare('${sim.id}', 'cuisine', this.value)"/>
            <span>%</span>
          </div>
          <span class="field-hint">${icon("info", 11)} Service+autre = ${(100 - Math.round(tipShares.cuisine * 100))}%</span>
        </label>
        <label>Ratio salaires / ventes (%)
          <div class="sim-input-money">
            <select class="sim-ratio-select" onchange="updateSimSalesRatio('${sim.id}', this.value)">
              ${(() => {
                const curPct = salesRatio * 100;
                const opts = Array.from({ length: 11 }, (_, i) => 30 + i); // 30..40
                const inRange = opts.some(v => Math.abs(v - curPct) < 0.001);
                const lines = [];
                if (!inRange) {
                  lines.push(`<option value="${curPct.toFixed(1)}" selected>${curPct.toFixed(1)} (actuel)</option>`);
                }
                opts.forEach(v => {
                  const sel = inRange && Math.abs(v - curPct) < 0.001 ? "selected" : "";
                  lines.push(`<option value="${v}" ${sel}>${v}</option>`);
                });
                return lines.join("");
              })()}
            </select>
            <span>%</span>
          </div>
          <span class="field-hint">${icon("info", 11)} Base : ${(baseSalesRatio * 100).toFixed(1)}% · Cible &lt;32%</span>
        </label>
        <label>Pool cuisine
          <div class="sim-readonly">${fmtMoney(cur.pools.cuisine)}</div>
          <span class="field-hint">${fmtHours(cur.totalsHours.cuisine)}h éligibles</span>
        </label>
        <label>Pool service
          <div class="sim-readonly">${fmtMoney(cur.pools.service)}</div>
          <span class="field-hint">${fmtHours(cur.totalsHours.service)}h éligibles</span>
        </label>
      </div>
    </div>

    <!-- ═ Grille employés × jours (v3.26.0 — empgrid comme Horaires) ═ -->
    <div class="schedule-empgrid sim-empgrid" style="--n-days:${visibleIdx.length};">
      <!-- Header -->
      <div class="schedule-empgrid-header">
        <div class="schedule-empgrid-emp-head">Employé · Taux · Section</div>
        ${visibleIdx.map(dow => {
          const count = cur.rows.filter(r => (r.daily[dow]?.shifts || []).length > 0).length;
          const dayHrs = cur.dayTotalsHours[dow] || 0;
          const win = serviceHours[dow];
          const winLabel = win && win.start && win.end ? `${win.start}–${win.end}` : "";
          return `<div class="schedule-empgrid-day-head">
            <div class="schedule-empgrid-day-name">${DAYS_FR[dow]}</div>
            ${winLabel ? `<div class="schedule-empgrid-day-svc" title="Fenêtre d'ouverture / de service">${icon("clock", 9)} ${winLabel}</div>` : ""}
            <div class="schedule-empgrid-day-count">${count} pers · ${dayHrs ? fmtHours(dayHrs) + "h" : "0h"}</div>
          </div>`;
        }).join("")}
        <div class="schedule-empgrid-total-head">Total</div>
      </div>

      <!-- Body : une ligne par employé simulé -->
      ${cur.rows.map((row, rowIdx) => renderSimEmpRow(sim, row, rowIdx, visibleIdx, base.rows)).join("")}
    </div>

    <!-- ═ Panneau totaux (mêmes colonnes que la grille du haut) ═ -->
    <div class="schedule-totals-panel sim-totals-panel" style="--n-days:${visibleIdx.length};">
      <div class="schedule-totals-grid">
        <div class="schedule-totals-label">Heures / jour</div>
        ${visibleIdx.map(dow => {
          const h = cur.dayTotalsHours[dow] || 0;
          return `<div class="schedule-totals-val">${h ? fmtHours(h) + "h" : "—"}</div>`;
        }).join("")}
        <div class="schedule-totals-val schedule-totals-val--total">${fmtHours(weekTotalHours)}h</div>

        <div class="schedule-totals-label">Coût / jour</div>
        ${visibleIdx.map(dow => {
          const c = cur.dayTotalsCost[dow] || 0;
          return `<div class="schedule-totals-val">${c ? fmtMoney(c) : "—"}</div>`;
        }).join("")}
        <div class="schedule-totals-val schedule-totals-val--total">${fmtMoney(weekTotalCost)}</div>

        <div class="schedule-totals-label">Ventes prévues</div>
        ${visibleIdx.map(dow => {
          const c = cur.dayTotalsCost[dow] || 0;
          const predicted = salesRatio > 0 ? c / salesRatio : 0;
          return `<div class="schedule-totals-val schedule-totals-val--predicted">${predicted ? fmtMoney(predicted) : "—"}</div>`;
        }).join("")}
        <div class="schedule-totals-val schedule-totals-val--total schedule-totals-val--predicted">${fmtMoney(weekTotalSales)}</div>
      </div>
    </div>

    <!-- ═ Bouton ajouter employé ════════════════════ -->
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-primary" onclick="openSimAddEmpModal('${sim.id}')">${icon("plus", 14)} Ajouter un employé fictif</button>
      <button class="btn-secondary" onclick="openSimServiceHoursModal('${sim.id}')">${icon("clock", 14)} Heures de service</button>
      <button class="btn-secondary" onclick="openSimOpenDaysModal('${sim.id}')">${icon("calendar", 14)} Jours ouverts (${visibleIdx.length}/7)</button>
    </div>

    <!-- ═ Graphique de couverture (employés sur le plancher) ═ -->
    <div class="card coverage-card" style="margin-top:var(--sp-5)">
      <div class="coverage-header">
        <div>
          <h3 class="coverage-title">Couverture — employés sur le plancher</h3>
          <div class="coverage-subtitle">Nombre d'employés présents par heure, pour chaque jour de la semaine (selon la simulation)</div>
        </div>
        <div class="coverage-filter" role="tablist" aria-label="Filtrer par section">
          <button class="coverage-tab ${_simCoverageSection === "all" ? "is-active" : ""}" onclick="setSimCoverageSection('all')" role="tab" aria-selected="${_simCoverageSection === "all"}">Tous</button>
          <button class="coverage-tab ${_simCoverageSection === "service" ? "is-active" : ""}" onclick="setSimCoverageSection('service')" role="tab" aria-selected="${_simCoverageSection === "service"}">${icon("users", 12)} Service</button>
          <button class="coverage-tab ${_simCoverageSection === "cuisine" ? "is-active" : ""}" onclick="setSimCoverageSection('cuisine')" role="tab" aria-selected="${_simCoverageSection === "cuisine"}">${icon("utensils", 12)} Cuisine</button>
          <button class="coverage-tab ${_simCoverageSection === "other" ? "is-active" : ""}" onclick="setSimCoverageSection('other')" role="tab" aria-selected="${_simCoverageSection === "other"}">Autre</button>
        </div>
      </div>
      <div class="coverage-canvas-wrap">
        <canvas id="sim-coverage-chart" height="280"></canvas>
      </div>
    </div>

    <!-- ═ Comparaison détaillée côte à côte ═════════ -->
    <div class="card sim-compare-card">
      <h3 class="section-title" style="margin:0 0 14px 0">${icon("bar-chart", 16)} Comparaison réel ↔ simulation</h3>
      <div class="sim-compare-table-wrap" style="overflow-x:auto">
        <table class="sim-compare-table">
          <thead>
            <tr>
              <th>Employé</th>
              <th class="sim-col-base">Heures (réel)</th>
              <th class="sim-col-sim">Heures (sim)</th>
              <th class="sim-col-base">Salaire (réel)</th>
              <th class="sim-col-sim">Salaire (sim)</th>
              <th class="sim-col-base">Total (réel)</th>
              <th class="sim-col-sim">Total (sim)</th>
              <th class="sim-col-gap">Écart total</th>
            </tr>
          </thead>
          <tbody>
            ${renderSimCompareRows(base.rows, cur.rows)}
            <tr class="sim-compare-total-row">
              <td><strong>TOTAL</strong></td>
              <td class="sim-col-base">${fmtHours(base.totals.hours)} h</td>
              <td class="sim-col-sim">${fmtHours(cur.totals.hours)} h</td>
              <td class="sim-col-base">${fmtMoney(base.totals.gross)}</td>
              <td class="sim-col-sim">${fmtMoney(cur.totals.gross)}</td>
              <td class="sim-col-base">${fmtMoney(base.totals.total)}</td>
              <td class="sim-col-sim">${fmtMoney(cur.totals.total)}</td>
              <td class="sim-col-gap">${simGapCell(cur.totals.total, base.totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>`;
}

// KPI tuile
function renderSimKpi(label, valSim, valBase, gap, positiveIsBad, iconName) {
  const cls = Math.abs(gap.diff) < 0.005
    ? "is-zero"
    : (gap.diff > 0 ? (positiveIsBad ? "is-negative" : "is-positive") : (positiveIsBad ? "is-positive" : "is-negative"));
  const arrow = Math.abs(gap.diff) < 0.005 ? "—" : (gap.diff > 0 ? "▲" : "▼");
  const sign = gap.diff > 0 ? "+" : (gap.diff < 0 ? "−" : "");
  // Pour les heures, on affiche les heures et pas en $
  const isHours = label.toLowerCase().includes("heure");
  const diffLabel = isHours
    ? `${sign}${Math.abs(gap.diff).toFixed(1)}h`
    : `${sign}${fmtMoney(Math.abs(gap.diff))}`;
  return `<div class="sim-kpi">
    <div class="sim-kpi__head">${icon(iconName, 13)} ${label}</div>
    <div class="sim-kpi__value">${valSim}</div>
    <div class="sim-kpi__base">Réel : <strong>${valBase}</strong></div>
    <div class="sim-kpi__gap ${cls}">${arrow} ${diffLabel} <small>(${sign}${Math.abs(gap.pct).toFixed(1)}%)</small></div>
  </div>`;
}

// Ligne d'employé dans le tableau de la simulation (éditable)
function renderSimEmpRow(sim, row, rowIdx, visibleIdx, baseRows) {
  const emp = row.emp;
  const isFictional = !!emp.isFictional;
  const sec = (emp.section || "service");
  const secCls = sec === "cuisine" ? "is-kitchen"
              : sec === "service" ? "is-service" : "is-other";

  return `<div class="schedule-empgrid-row sim-empgrid-row${isFictional ? " is-fictional" : ""}" data-emp-id="${emp.id}">
    <!-- Cellule employé éditable (gauche) -->
    <div class="schedule-empgrid-emp sim-empgrid-emp ${secCls}">
      <div class="sim-emp-name-row">
        <input class="sim-input-name" type="text" value="${esc(emp.name || "")}" placeholder="Nom" onchange="updateSimEmployee('${sim.id}','${emp.id}','name',this.value)"/>
        ${isFictional ? `<span class="sim-badge-fictional" title="Employé ajouté dans la simulation">FICTIF</span>` : ""}
      </div>
      <div class="sim-emp-fields">
        <input class="sim-rate-input" type="number" min="0" step="0.25" value="${emp.hourlyRate || ""}" placeholder="Taux" title="Taux horaire ($/h)" onchange="updateSimEmployee('${sim.id}','${emp.id}','hourlyRate',this.value)"/>
        <select class="sim-section-select" title="Section pour les pourboires" onchange="updateSimEmployee('${sim.id}','${emp.id}','section',this.value)">
          <option value="service" ${sec === "service" ? "selected" : ""}>Service</option>
          <option value="cuisine" ${sec === "cuisine" ? "selected" : ""}>Cuisine</option>
          <option value="other" ${sec === "other" ? "selected" : ""}>Autre</option>
        </select>
      </div>
    </div>
    <!-- Cellules par jour : 0..N cartes de quart (shift coupé) ou Congé -->
    ${visibleIdx.map(dow => {
      const d = row.daily[dow];
      const shifts = d ? d.shifts : [];
      if (!shifts.length) {
        return `<div class="schedule-empgrid-cell schedule-empgrid-cell--empty"
            data-dow="${dow}"
            ondragover="simShiftCardDragOver(event,${dow})"
            ondragleave="simShiftCardDragLeave(event)"
            ondrop="simShiftCardDrop(event,'${sim.id}','${emp.id}',${dow})">
          <div class="shift-card shift-card--off"
              onclick="openSimShiftModal('${sim.id}','${emp.id}',${dow})"
              title="Aucun shift — cliquer pour ajouter">
            <div class="shift-off-label">Congé</div>
            <div class="shift-off-add">${icon("plus", 11)} Ajouter</div>
          </div>
        </div>`;
      }
      return `<div class="schedule-empgrid-cell sim-cell-multi"
          data-dow="${dow}"
          ondragover="simShiftCardDragOver(event,${dow})"
          ondragleave="simShiftCardDragLeave(event)"
          ondrop="simShiftCardDrop(event,'${sim.id}','${emp.id}',${dow})">
        ${shifts.map((s, si) => {
          const h = hoursFromShift(s);
          return `<div class="shift-card shift-card--compact ${secCls}"
              draggable="true"
              data-emp-id="${emp.id}"
              data-from-dow="${dow}"
              data-shift-idx="${si}"
              ondragstart="simShiftCardDragStart(event,'${emp.id}',${dow},${si})"
              ondragend="simShiftCardDragEnd(event)"
              onclick="openSimShiftModal('${sim.id}','${emp.id}',${dow},${si})"
              title="Cliquer pour modifier · Glisser pour déplacer">
            <div class="shift-card-time">${s.start} → ${s.end}</div>
            <div class="shift-card-meta">
              <span>${fmtHours(h)}h</span>
              ${row.isSal ? "" : `<span class="shift-card-cost">${fmtMoney(h * row.rate)}</span>`}
            </div>
          </div>`;
        }).join("")}
        <button class="sim-add-shift-btn" onclick="openSimShiftModal('${sim.id}','${emp.id}',${dow})" title="Ajouter un autre quart ce jour-là">${icon("plus", 11)} Quart</button>
      </div>`;
    }).join("")}
    <!-- Cellule totaux + bouton supprimer (droite) -->
    <div class="schedule-empgrid-total sim-empgrid-total">
      <div class="sim-empgrid-total-row">
        <span class="sim-empgrid-total-lbl">Hrs</span>
        <span class="sim-empgrid-total-val">${row.totalHours ? fmtHours(row.totalHours) + "h" : "—"}</span>
      </div>
      <div class="sim-empgrid-total-row">
        <span class="sim-empgrid-total-lbl">Sal</span>
        <span class="sim-empgrid-total-val">${row.grossWage ? fmtMoney(row.grossWage) : "—"}</span>
      </div>
      <div class="sim-empgrid-total-row">
        <span class="sim-empgrid-total-lbl">Pourb</span>
        <span class="sim-empgrid-total-val sim-empgrid-total-val--tip">${row.tipShare > 0.005 ? fmtMoney(row.tipShare) : "—"}</span>
      </div>
      <div class="sim-empgrid-total-row sim-empgrid-total-row--final">
        <span class="sim-empgrid-total-lbl">Total</span>
        <span class="sim-empgrid-total-val sim-empgrid-total-val--final">${row.totalPay ? fmtMoney(row.totalPay) : "—"}</span>
      </div>
      <button class="sim-empgrid-remove" onclick="askRemoveSimEmp('${sim.id}','${emp.id}')" title="Retirer de la simulation" aria-label="Retirer ${esc(emp.name)}">${icon("trash", 12)}</button>
    </div>
  </div>`;
}

// Lignes comparaison côte à côte (réel ↔ sim)
function renderSimCompareRows(baseRows, simRows) {
  // Trouver tous les ID (présents en base, sim, ou les deux)
  const baseMap = new Map(baseRows.map(r => [r.emp.id, r]));
  const simMap = new Map(simRows.map(r => [r.emp.id, r]));
  const allIds = new Set([...baseMap.keys(), ...simMap.keys()]);

  // Ordonner : ceux qui existent dans la sim d'abord (dans l'ordre de la sim), puis ceux retirés
  const orderedIds = [];
  simRows.forEach(r => orderedIds.push(r.emp.id));
  baseRows.forEach(r => { if (!orderedIds.includes(r.emp.id)) orderedIds.push(r.emp.id); });

  return orderedIds.map(empId => {
    const b = baseMap.get(empId);
    const s = simMap.get(empId);
    const name = (s?.emp.name) || (b?.emp.name) || "—";
    const fictBadge = (s?.emp.isFictional) ? ` <span class="sim-badge-fictional" style="font-size:9px">FICTIF</span>` : "";
    const removedBadge = (!s && b) ? ` <span class="sim-badge-removed" title="Retiré dans la simulation">RETIRÉ</span>` : "";
    const addedBadge = (s && !b) ? ` <span class="sim-badge-added" title="Ajouté dans la simulation">AJOUTÉ</span>` : "";

    const bHours = b?.totalHours || 0;
    const sHours = s?.totalHours || 0;
    const bGross = b?.grossWage || 0;
    const sGross = s?.grossWage || 0;
    const bTotal = b?.totalPay || 0;
    const sTotal = s?.totalPay || 0;

    return `<tr>
      <td><strong>${esc(name)}</strong>${fictBadge}${addedBadge}${removedBadge}</td>
      <td class="sim-col-base">${b ? fmtHours(bHours) + " h" : "—"}</td>
      <td class="sim-col-sim">${s ? fmtHours(sHours) + " h" : "—"}</td>
      <td class="sim-col-base">${b ? fmtMoney(bGross) : "—"}</td>
      <td class="sim-col-sim">${s ? fmtMoney(sGross) : "—"}</td>
      <td class="sim-col-base">${b ? fmtMoney(bTotal) : "—"}</td>
      <td class="sim-col-sim">${s ? fmtMoney(sTotal) : "—"}</td>
      <td class="sim-col-gap">${simGapCell(sTotal, bTotal)}</td>
    </tr>`;
  }).join("");
}

// ═ Graphique de couverture (adapté de pages-hr.js pour la sim) ════
// État local : instance Chart.js + filtre section actif
let _simCoverageChartInstance = null;
let _simCoverageSection = "all";    // "all" | "cuisine" | "service" | "other"

function setSimCoverageSection(section) {
  _simCoverageSection = section;
  renderSimulationEditor();   // re-render pour mettre à jour les tabs actifs + le graphique
}

// Compte le nombre d'employés présents à l'heure H pour un jour de la semaine
// dans une simulation (shifts par dow 0..6, pas par date).
function countSimCoverageAtHour(simEmployees, dow, H, sectionFilter) {
  let count = 0;
  for (const emp of simEmployees) {
    if (sectionFilter !== "all") {
      const empSection = emp.section || "service";
      if (empSection !== sectionFilter) continue;
    }
    // v3.45.0 — plusieurs quarts possibles ; l'employé est compté UNE fois s'il
    // est présent à l'heure H dans l'un de ses quarts du jour.
    const shifts = simDayShifts((emp.shifts || {})[dow]);
    let present = false;
    for (const s of shifts) {
      let start = parseTimeToFloat(s.start);
      let end = parseTimeToFloat(s.end);
      if (start == null || end == null) continue;
      if (end <= start) end += 24;       // shift qui passe minuit
      if ((H >= start && H < end) || (H + 24 >= start && H + 24 < end)) { present = true; break; }
    }
    if (present) count++;
  }
  return count;
}

// Construit et affiche le graphique pour la simulation courante
function initSimCoverageChart() {
  const sim = (payrollSimulations || []).find(s => s.id === _editingSimId);
  if (!sim) return;
  const canvas = document.getElementById("sim-coverage-chart");
  if (!canvas) return;
  if (typeof Chart === "undefined") {
    canvas.parentNode.innerHTML = `<div class="empty" style="padding:var(--sp-5)">Chargement du graphique...</div>`;
    return;
  }

  // Détruire l'instance précédente (évite fuites + superposition)
  if (_simCoverageChartInstance) {
    try { _simCoverageChartInstance.destroy(); } catch (_) {}
    _simCoverageChartInstance = null;
  }

  const simEmployees = sim.simulation?.employees || [];
  const openDays = Array.isArray(sim.simulation?.openDays) && sim.simulation.openDays.length
    ? sim.simulation.openDays
    : [0, 1, 2, 3, 4, 5, 6];
  const visibleIdx = [0, 1, 2, 3, 4, 5, 6].filter(i => openDays.includes(i));
  const section = _simCoverageSection;

  // Plage X dynamique : min start → max end parmi tous les shifts (après filtre)
  let minH = 24, maxH = 0;
  let anyShift = false;
  visibleIdx.forEach(dow => {
    for (const emp of simEmployees) {
      if (section !== "all") {
        const empSection = emp.section || "service";
        if (empSection !== section) continue;
      }
      for (const s of simDayShifts((emp.shifts || {})[dow])) {
        const sh = parseTimeToFloat(s.start);
        let eh = parseTimeToFloat(s.end);
        if (sh == null || eh == null) continue;
        if (eh <= sh) eh += 24;
        minH = Math.min(minH, Math.floor(sh));
        maxH = Math.max(maxH, Math.ceil(eh));
        anyShift = true;
      }
    }
  });

  if (!anyShift) {
    const wrap = canvas.parentNode;
    wrap.innerHTML = `<div class="empty coverage-empty">
      <div class="empty-state-icon">${icon("bar-chart", 36)}</div>
      Aucun quart saisi dans cette simulation ${section !== "all" ? `(section ${section})` : ""}.<br>
      <span style="font-size:13px;color:var(--text3)">Ajoute des horaires dans le tableau ci-dessus pour voir le graphique.</span>
    </div>`;
    return;
  }

  // Labels heures
  const labels = [];
  for (let h = minH; h < maxH; h++) labels.push((h % 24) + "h");

  // Un dataset par jour ouvert (couleurs cohérentes avec le graphique d'horaire)
  const DAY_COLORS = {
    0: "#8b5cf6", 1: "#14b8a6", 2: "#4a90e2",
    3: "#e74c3c", 4: "#F7B32C", 5: "#7dbf66", 6: "#f97316"
  };
  const datasets = visibleIdx.map(dow => {
    const data = [];
    for (let h = minH; h < maxH; h++) {
      data.push(countSimCoverageAtHour(simEmployees, dow, h, section));
    }
    const color = DAY_COLORS[dow];
    return {
      label: DAYS_FR[dow],
      data,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 0,
      borderRadius: 3,
      barPercentage: 0.85,
      categoryPercentage: 0.85
    };
  });

  const textColor   = darkMode ? "rgba(245,241,232,.72)" : "rgba(14,13,12,.72)";
  const gridColor   = darkMode ? "rgba(245,241,232,.08)" : "rgba(14,13,12,.08)";
  const tooltipBg   = darkMode ? "#25201d" : "#ffffff";
  const tooltipText = darkMode ? "#f5f1e8" : "#0e0d0c";

  _simCoverageChartInstance = new Chart(canvas, {
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

// ═ Mutations Firestore ═════════════════════════════════

async function updateSimEmployee(simId, empId, field, value) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  // Note : on utilise `simEmps` au lieu de `employees` pour éviter de masquer
  // la variable globale `employees` (liste des vrais employés Firestore).
  const simEmps = [...(sim.simulation?.employees || [])];
  const idx = simEmps.findIndex(e => e.id === empId);
  if (idx < 0) return;
  const updated = { ...simEmps[idx] };
  if (field === "hourlyRate" || field === "fixedWeeklyHours") {
    updated[field] = Number(value) || 0;
  } else if (field === "isSalaried") {
    updated[field] = !!value;
  } else {
    updated[field] = value;
  }
  simEmps[idx] = updated;
  await persistSim(simId, { ...sim.simulation, employees: simEmps });
}

// v3.45.0 — écrit la map shifts complète d'un employé simulé.
// Les quarts d'un jour sont TOUJOURS stockés en tableau (shift coupé possible) ;
// un jour vide est retiré de la map.
async function _writeSimEmpShifts(simId, empId, shiftsMap) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const simEmps = [...(sim.simulation?.employees || [])];
  const idx = simEmps.findIndex(e => e.id === empId);
  if (idx < 0) return;
  // Nettoie : tableaux vides supprimés
  const clean = {};
  for (const k of Object.keys(shiftsMap)) {
    const arr = simDayShifts(shiftsMap[k]);
    if (arr.length) clean[k] = arr;
  }
  simEmps[idx] = { ...simEmps[idx], shifts: clean };
  await persistSim(simId, { ...sim.simulation, employees: simEmps });
}

// Ajoute (idx<0) ou modifie (idx>=0) un quart pour un jour donné.
async function setSimDayShift(simId, empId, dow, shiftIdx, shift) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const emp = (sim.simulation?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  const shiftsMap = { ...(emp.shifts || {}) };
  const arr = simDayShifts(shiftsMap[dow]);
  if (shiftIdx >= 0 && shiftIdx < arr.length) arr[shiftIdx] = shift;
  else arr.push(shift);
  shiftsMap[dow] = arr;
  await _writeSimEmpShifts(simId, empId, shiftsMap);
}

// Supprime le quart à l'index donné pour un jour.
async function deleteSimDayShift(simId, empId, dow, shiftIdx) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const emp = (sim.simulation?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  const shiftsMap = { ...(emp.shifts || {}) };
  const arr = simDayShifts(shiftsMap[dow]);
  if (shiftIdx >= 0 && shiftIdx < arr.length) arr.splice(shiftIdx, 1);
  shiftsMap[dow] = arr;
  await _writeSimEmpShifts(simId, empId, shiftsMap);
}

async function updateSimTotalTips(simId, value) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const v = Number(value) || 0;
  await persistSim(simId, { ...sim.simulation, totalTips: v });
}

async function updateSimTipShare(simId, group, percentStr) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const pct = Math.max(0, Math.min(100, Number(percentStr) || 0));
  const newShare = pct / 100;
  const tipShares = group === "cuisine"
    ? { cuisine: newShare, service: 1 - newShare }
    : { cuisine: 1 - newShare, service: newShare };
  await persistSim(simId, { ...sim.simulation, tipShares });
}

async function updateSimSalesRatio(simId, percentStr) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const pct = Math.max(1, Math.min(100, Number(percentStr) || 32));
  const salesRatio = pct / 100;
  await persistSim(simId, { ...sim.simulation, salesRatio });
}

async function persistSim(simId, simulation) {
  try {
    await db.collection("payrollSimulations").doc(simId).update({
      simulation,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("persistSim:", err);
    toast("Erreur sauvegarde : " + (err.message || err), "error");
  }
}

// ═ Ajouter un employé fictif ═══════════════════════════

function openSimAddEmpModal(simId) {
  showModal(`<div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h3>${icon("plus", 18)} Ajouter un employé fictif</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Cet employé n'existe <strong>que dans cette simulation</strong>. Utile pour tester une future embauche.
    </p>
    <label>Nom<input id="sim-add-name" placeholder="ex: Nouvelle serveuse"/></label>
    <label>Section
      <select id="sim-add-section">
        <option value="service" selected>Service</option>
        <option value="cuisine">Cuisine</option>
        <option value="other">Autre</option>
      </select>
    </label>
    <label>Taux horaire ($/h)
      <input id="sim-add-rate" type="number" min="0" step="0.25" placeholder="ex: 17.50"/>
    </label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="confirmAddSimEmp('${simId}')">${icon("plus", 14)} Ajouter</button>
    </div>
  </div>`);
}

async function confirmAddSimEmp(simId) {
  const name = document.getElementById("sim-add-name").value.trim();
  if (!name) return toast("Donne un nom à l'employé.", "error");
  const section = document.getElementById("sim-add-section").value || "service";
  const hourlyRate = Number(document.getElementById("sim-add-rate").value) || 0;

  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return toast("Simulation introuvable.", "error");

  const simEmps = [...(sim.simulation?.employees || [])];
  simEmps.push({
    id: "sim_" + genId(),
    name,
    section,
    hourlyRate,
    isSalaried: false,
    fixedWeeklyHours: 0,
    role: "",
    isFictional: true,
    shifts: {}
  });
  await persistSim(simId, { ...sim.simulation, employees: simEmps });
  closeModal();
  toast(`« ${name} » ajouté à la simulation.`, "success");
}

function askRemoveSimEmp(simId, empId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const emp = (sim.simulation?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  openConfirm(
    `Retirer ${esc(emp.name || "cet employé")} ?`,
    `Il sera retiré <strong>uniquement de cette simulation</strong>. Son employé réel n'est pas affecté.`,
    async () => {
      const simEmps = (sim.simulation?.employees || []).filter(e => e.id !== empId);
      await persistSim(simId, { ...sim.simulation, employees: simEmps });
      toast("Employé retiré de la simulation.", "success");
    },
    true
  );
}

// ═ Modifier nom / description ═══════════════════════════

function openSimMetaModal(simId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  showModal(`<div class="modal" style="max-width:500px">
    <div class="modal-header">
      <h3>${icon("pencil", 18)} Modifier la simulation</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <label>Nom<input id="sim-meta-name" value="${esc(sim.name || "")}"/></label>
    <label>Description<textarea id="sim-meta-desc" style="height:80px">${esc(sim.description || "")}</textarea></label>
    <div class="modal-actions">
      <button class="btn-cancel" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="confirmUpdateSimMeta('${simId}')">${t("save")}</button>
    </div>
  </div>`);
}

async function confirmUpdateSimMeta(simId) {
  const name = document.getElementById("sim-meta-name").value.trim();
  if (!name) return toast("Le nom est obligatoire.", "error");
  const description = document.getElementById("sim-meta-desc").value.trim();
  try {
    await db.collection("payrollSimulations").doc(simId).update({
      name, description,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    closeModal();
    toast("Simulation mise à jour.", "success");
  } catch (err) {
    toast("Erreur : " + (err.message || err), "error");
  }
}

// ═ Heures de service (par jour de semaine) ═════════════

function openSimServiceHoursModal(simId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const sh = sim.simulation?.serviceHours || {};
  showModal(`<div class="modal" style="max-width:520px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} Heures de service (simulation)</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Définis la <strong>fenêtre de service</strong> de chaque jour. Seules les heures travaillées dans cette fenêtre comptent pour le calcul des pourboires. ${icon("info", 11)} Régler une fenêtre pour un jour l'<strong>ouvre automatiquement</strong> (il apparaît dans la grille) ; pour <strong>fermer</strong> un jour, décoche-le dans « Jours ouverts ».
    </p>
    <div class="sim-svc-grid">
      ${DAYS_FR.map((dn, dow) => {
        const v = sh[dow] || {};
        return `<div class="sim-svc-row">
          <div class="sim-svc-day">${dn}</div>
          <select onchange="updateSimServiceHours('${simId}',${dow},'start',this.value)" aria-label="Début service ${dn}">${buildTimeOptions(v.start || "")}</select>
          <span>→</span>
          <select onchange="updateSimServiceHours('${simId}',${dow},'end',this.value)" aria-label="Fin service ${dn}">${buildTimeOptions(v.end || "")}</select>
        </div>`;
      }).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">${t("close")}</button>
    </div>
  </div>`);
}

async function updateSimServiceHours(simId, dow, field, value) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const sh = { ...(sim.simulation?.serviceHours || {}) };
  const cur = sh[dow] || {};
  const next = { ...cur, [field]: value || "" };
  if (!next.start && !next.end) {
    delete sh[dow];
  } else {
    sh[dow] = next;
  }
  // v3.45.0 — lier ouverture ↔ heures de service : définir une fenêtre de service
  // pour un jour l'ouvre automatiquement (il apparaît alors dans la grille).
  const patch = { ...sim.simulation, serviceHours: sh };
  if (next.start || next.end) {
    const openDays = Array.isArray(sim.simulation?.openDays) ? [...sim.simulation.openDays] : [0,1,2,3,4,5,6];
    if (!openDays.includes(dow)) {
      patch.openDays = [...openDays, dow].sort((a, b) => a - b);
    }
  }
  await persistSim(simId, patch);
}

// ═ Jours d'ouverture (par jour de semaine) ═════════════

function openSimOpenDaysModal(simId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const current = Array.isArray(sim.simulation?.openDays) ? sim.simulation.openDays : [0,1,2,3,4,5,6];
  showModal(`<div class="modal" style="max-width:400px">
    <div class="modal-header">
      <h3>${icon("calendar", 18)} Jours d'ouverture (simulation)</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="Fermer">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text3);font-size:13px;margin-bottom:16px;line-height:1.5">
      Choisis les jours où le resto est ouvert dans ce scénario.
    </p>
    <div class="open-days-grid">
      ${DAYS_FR.map((d, i) => {
        const checked = current.includes(i) ? "checked" : "";
        const dayLabel = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"][i];
        return `<label class="open-day-item">
          <input type="checkbox" data-day="${i}" ${checked} onchange="toggleSimOpenDay('${simId}', ${i}, this.checked)"/>
          <span class="open-day-label">${dayLabel}</span>
        </label>`;
      }).join("")}
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">${t("close")}</button>
    </div>
  </div>`);
}

async function toggleSimOpenDay(simId, dayIdx, checked) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const current = Array.isArray(sim.simulation?.openDays) ? [...sim.simulation.openDays] : [0,1,2,3,4,5,6];
  let next;
  if (checked && !current.includes(dayIdx)) {
    next = [...current, dayIdx].sort((a, b) => a - b);
  } else if (!checked && current.includes(dayIdx)) {
    next = current.filter(d => d !== dayIdx);
  } else {
    return;
  }
  if (next.length === 0) {
    toast("Au moins un jour doit rester ouvert.", "warning");
    const cb = document.querySelector(`.open-days-grid input[data-day="${dayIdx}"]`);
    if (cb) cb.checked = true;
    return;
  }
  await persistSim(simId, { ...sim.simulation, openDays: next });
}

// ═══════════════════════════════════════════════════════════════
// v3.26.0 — Modal d'édition de shift + drag&drop pour Simulation
// ═══════════════════════════════════════════════════════════════
// La sim utilise dow (0-6) au lieu de dk (date) puisqu'elle est
// indépendante d'une semaine particulière. Handlers séparés des
// handlers Horaires (qui utilisent dk).

// État local pour le drag&drop sim
let _simShiftDragEmpId = null;
let _simShiftDragFromDow = null;
let _simShiftDragShiftIdx = null;   // v3.45.0 — index du quart déplacé (shift coupé)

// Ouvre une modal pour créer/modifier un quart sim (par dow).
// shiftIdx absent/<0 → AJOUT d'un nouveau quart ; shiftIdx>=0 → modification.
function openSimShiftModal(simId, empId, dow, shiftIdx) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const emp = (sim.simulation?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  const dayShifts = simDayShifts((emp.shifts || {})[dow]);
  const idx = (typeof shiftIdx === "number" && shiftIdx >= 0) ? shiftIdx : -1;
  const editing = idx >= 0 && !!dayShifts[idx];
  const startVal = editing ? dayShifts[idx].start : "";
  const endVal = editing ? dayShifts[idx].end : "";

  showModal(`<div class="modal" style="max-width:440px">
    <div class="modal-header">
      <h3>${icon("clock", 18)} ${editing ? "Modifier le quart" : "Ajouter un quart"}</h3>
      <button class="close-btn" onclick="closeModal()" aria-label="${t("close")}">${icon("x", 18)}</button>
    </div>
    <p style="color:var(--text2);font-size:13px;margin:0 0 var(--sp-3)">
      ${icon("user", 12)} <strong>${esc(emp.name || "")}</strong> · ${DAYS_FR[dow]}${dayShifts.length > 1 || (editing && dayShifts.length > 1) ? ` · quart ${editing ? idx + 1 : dayShifts.length + 1}` : ""}
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-3);margin-top:var(--sp-2)">
      <label>Entrée
        ${timeInputHTML("sim-shift-start", startVal)}
      </label>
      <label>Sortie
        ${timeInputHTML("sim-shift-end", endVal)}
      </label>
    </div>
    <p class="time-input-hint">${icon("info", 11)} Tape l'heure exacte (ex. 17:04) ou choisis aux 15 min dans la liste. Tu peux ajouter <strong>plusieurs quarts</strong> dans la même journée (ex. 12:00–14:00 puis 17:00–21:00).</p>
    ${timeDatalistHTML()}
    <div class="modal-actions" style="display:flex;justify-content:space-between;align-items:center;gap:var(--sp-2);margin-top:var(--sp-3)">
      ${editing ? `<button class="btn-cancel" style="color:#a23a36" onclick="deleteSimShift('${simId}','${empId}',${dow},${idx})">${icon("trash", 14)} Supprimer</button>` : `<div></div>`}
      <div style="display:flex;gap:var(--sp-2)">
        <button class="btn-cancel" onclick="closeModal()">${t("cancel")}</button>
        <button class="btn btn-primary" onclick="saveSimShiftFromModal('${simId}','${empId}',${dow},${idx})">${icon("check", 14)} ${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </div>
  </div>`);
}

async function saveSimShiftFromModal(simId, empId, dow, shiftIdx) {
  const start = normalizeTimeInput(document.getElementById("sim-shift-start").value);
  const end = normalizeTimeInput(document.getElementById("sim-shift-end").value);
  if (start === null || end === null) return toast("Heure invalide — utilise le format hh:mm (ex. 17:04).", "warning");
  if (!start || !end) return toast("Saisis l'entrée et la sortie.", "warning");
  await setSimDayShift(simId, empId, dow, Number(shiftIdx), { start, end });
  closeModal();
  toast("Quart sim enregistré.", "success", 2000);
}

async function deleteSimShift(simId, empId, dow, shiftIdx) {
  await deleteSimDayShift(simId, empId, dow, Number(shiftIdx));
  closeModal();
  toast("Quart sim supprimé.", "success", 2000);
}

// ─ Drag & drop sim (par dow + index de quart) ────────────
function simShiftCardDragStart(e, empId, fromDow, shiftIdx) {
  _simShiftDragEmpId = empId;
  _simShiftDragFromDow = fromDow;
  _simShiftDragShiftIdx = (typeof shiftIdx === "number") ? shiftIdx : 0;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", `${empId}|${fromDow}|${_simShiftDragShiftIdx}`); } catch (_) {}
  }
  const card = e.currentTarget;
  setTimeout(() => card && card.classList.add("is-dragging"), 0);
}

function simShiftCardDragOver(e, targetDow) {
  if (_simShiftDragEmpId === null || targetDow === _simShiftDragFromDow) return;
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
  e.currentTarget.classList.add("is-drop-target");
}

function simShiftCardDragLeave(e) {
  const cell = e.currentTarget;
  if (!cell) return;
  const related = e.relatedTarget;
  if (related && cell.contains(related)) return;
  cell.classList.remove("is-drop-target");
}

function simShiftCardDragEnd() {
  document.querySelectorAll(".shift-card.is-dragging").forEach(c => c.classList.remove("is-dragging"));
  document.querySelectorAll(".schedule-empgrid-cell.is-drop-target").forEach(c => c.classList.remove("is-drop-target"));
  _simShiftDragEmpId = null;
  _simShiftDragFromDow = null;
  _simShiftDragShiftIdx = null;
}

async function simShiftCardDrop(e, simId, targetEmpId, targetDow) {
  e.preventDefault();
  const empId = _simShiftDragEmpId;
  const fromDow = _simShiftDragFromDow;
  const srcIdx = _simShiftDragShiftIdx;
  simShiftCardDragEnd();
  if (!empId || fromDow === null || fromDow === targetDow) return;
  // Le drop doit rester pour le MÊME employé (déplacer son quart vers un autre jour)
  if (empId !== targetEmpId) {
    toast("On ne peut déplacer un quart que vers un autre jour du même employé.", "warning", 4000);
    return;
  }
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const emp = (sim.simulation?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  // v3.45.0 — on déplace UN quart précis (shift coupé) ; il s'ajoute aux quarts
  // existants du jour cible (au lieu de les écraser).
  const shiftsMap = { ...(emp.shifts || {}) };
  const fromArr = simDayShifts(shiftsMap[fromDow]);
  const moved = fromArr[srcIdx];
  if (!moved) return;
  fromArr.splice(srcIdx, 1);
  const targetArr = simDayShifts(shiftsMap[targetDow]);
  targetArr.push(moved);
  shiftsMap[fromDow] = fromArr;
  shiftsMap[targetDow] = targetArr;
  await _writeSimEmpShifts(simId, empId, shiftsMap);
  toast(`Quart sim déplacé ${DAYS_FR[fromDow]} → ${DAYS_FR[targetDow]}`, "success", 2500);
}

// ═ Copier l'horaire planifié de la semaine en cours dans la sim (point 3) ═
function copyCurrentWeekIntoSim(simId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  const activeEmps = (typeof activeEmployees === "function" ? activeEmployees() : employees);
  if (!activeEmps || activeEmps.length === 0) {
    return toast("Aucun employé actif dans Employés & Horaires à copier.", "warning");
  }
  openConfirm(
    "Copier l'horaire de la semaine en cours ?",
    "Les employés et les quarts de cette simulation seront <strong>remplacés</strong> par l'horaire planifié de la <strong>semaine en cours</strong> (noms, taux, sections, quarts). Les réglages de pourboires, de ratio salaires/ventes et de jours d'ouverture de la simulation sont <strong>conservés</strong>.",
    async () => { await doCopyCurrentWeekIntoSim(simId); },
    false
  );
}

async function doCopyCurrentWeekIntoSim(simId) {
  const sim = (payrollSimulations || []).find(s => s.id === simId);
  if (!sim) return;
  // « Semaine en cours » = semaine calendaire courante (offset 0), peu importe
  // la semaine éventuellement naviguée dans la page Horaires.
  const weekStart = getWeekStart(0);
  const activeEmps = (typeof activeEmployees === "function" ? activeEmployees() : employees);
  const empSnapshots = activeEmps.map(emp => ({
    id: emp.id,
    name: emp.name || "",
    section: emp.section || "service",
    hourlyRate: Number(emp.hourlyRate) || 0,
    isSalaried: !!emp.isSalaried,
    fixedWeeklyHours: Number(emp.fixedWeeklyHours) || 0,
    role: emp.role || "",
    isFictional: false,
    shifts: shiftsByDateToByDow(emp.shifts || {}, weekStart)
  }));
  await persistSim(simId, { ...sim.simulation, employees: empSnapshots });
  toast("Horaire de la semaine en cours copié dans la simulation.", "success", 2500);
}
