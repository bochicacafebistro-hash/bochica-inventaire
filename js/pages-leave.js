// ═══════════════════════════════════════════════════════════════
// DEMANDES DE CONGÉ / VACANCES (v3.42.0)
// ───────────────────────────────────────────────────────────────
// Deux pages :
//   • « demande-conge »  (employé) : identification par PIN → calendrier →
//     choix d'un ou plusieurs jours (ou congé partiel) → soumission.
//   • « demandes-conge » (admin)   : liste des demandes, approuver / refuser.
//
// Règle des 2 semaines :
//   - jour visé à PLUS de 14 jours  → approuvé automatiquement (status "approved")
//   - jour visé à 14 jours ou MOINS → en attente (status "pending"), message
//     « à faire approuver par le superviseur ».
//
// Stockage : collection /leaveRequests. L'identité (empId) est posée côté app
// via le PIN, comme le pointage (compte partagé "Employe" sur la tablette).
//
// Affichage dans les horaires : getTimeOff() (pages-hr.js) est étendu pour
// inclure les demandes APPROUVÉES de journée complète → un congé approuvé
// verrouille et s'affiche « Vacances / Maladie / … » partout (Horaire,
// Salaires, Mon horaire) sans code en double. Les congés PARTIELS s'affichent
// comme un badge sur la journée (sans verrouiller le quart).
// ═══════════════════════════════════════════════════════════════

// ─ Helpers de date ────────────────────────────────────────
function _leaveLocale() {
  return (typeof uiLocale === "function") ? uiLocale() : "fr-CA";
}
function _dkToDate(dk) {
  const [y, m, d] = String(dk).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
// Nombre de jours entre aujourd'hui (local) et un jour-clé (négatif = passé).
function _daysUntilDk(dk) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = _dkToDate(dk); target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}
function _leaveIsPast(dk) { return _daysUntilDk(dk) < 0; }
// Auto-approbation : TOUS les jours visés sont à plus de 14 jours
// (donc le plus proche est > 14). Si un seul jour est ≤ 14 → en attente.
function _leaveAutoApproves(dks) {
  if (!dks || !dks.length) return false;
  const minDays = Math.min(...dks.map(_daysUntilDk));
  return minDays > 14;
}
// Étiquette courte d'un jour : « lun 25 mai »
function _fmtDkShort(dk) {
  return _dkToDate(dk).toLocaleDateString(_leaveLocale(), { weekday: "short", day: "numeric", month: "short" });
}

// ─ Helpers d'accès aux demandes ───────────────────────────
function pendingLeaveRequests() {
  return (leaveRequests || []).filter(r => r.status === "pending");
}
function leaveRequestsForEmp(empId) {
  return (leaveRequests || []).filter(r => r.empId === empId);
}
// Demande APPROUVÉE de journée complète couvrant ce jour (ou null).
// Consommé par getTimeOff() → propage l'affichage « congé » partout.
function getApprovedFullDayLeave(empId, dk) {
  const list = leaveRequests || [];
  for (const r of list) {
    if (r.status !== "approved") continue;
    if (r.kind === "partial") continue;
    if (r.empId === empId && Array.isArray(r.dates) && r.dates.includes(dk)) return r;
  }
  return null;
}
// Congé PARTIEL approuvé pour ce jour (ou null) — { mode, time }.
function getApprovedPartialLeave(empId, dk) {
  const list = leaveRequests || [];
  for (const r of list) {
    if (r.status !== "approved") continue;
    if (r.kind !== "partial" || !r.partial) continue;
    if (r.empId === empId && r.partial.dk === dk) return r.partial;
  }
  return null;
}
// Badge HTML d'un congé partiel pour une cellule d'horaire (ou "").
function partialLeaveBadgeHTML(empId, dk) {
  const p = getApprovedPartialLeave(empId, dk);
  if (!p) return "";
  const label = p.mode === "late" ? `entre à ${p.time}` : `finit à ${p.time}`;
  const ic = p.mode === "late" ? "log-in" : "log-out";
  return `<div class="shift-partial-badge" title="Congé partiel approuvé — ${label}">${icon(ic, 10)} ${label}</div>`;
}

// ═══════════════════════════════════════════════════════════════
// PAGE EMPLOYÉ — « demande-conge »
// ═══════════════════════════════════════════════════════════════
function renderLeaveRequest() {
  if (_leaveStep !== "calendar" || !_leaveEmployee) {
    return `<div class="page page--wide page--punch">
      <div class="punch-screen">${_leaveKeypadHTML()}</div>
    </div>`;
  }
  return `<div class="page">${_leaveFormHTML()}</div>`;
}

// ─ Écran clavier (réutilise les styles du pointage) ───────
function _leaveKeypadHTML() {
  const dots = [0, 1, 2, 3].map(i =>
    `<span class="punch-pin-dot ${_leavePin.length > i ? "is-filled" : ""}"></span>`
  ).join("");
  const keys = [
    { type: "digit", v: "1" }, { type: "digit", v: "2" }, { type: "digit", v: "3" },
    { type: "digit", v: "4" }, { type: "digit", v: "5" }, { type: "digit", v: "6" },
    { type: "digit", v: "7" }, { type: "digit", v: "8" }, { type: "digit", v: "9" },
    { type: "clear" }, { type: "digit", v: "0" }, { type: "ok" }
  ];
  return `<div class="punch-keypad-screen">
    <h1 class="punch-title">${icon("sun", 30)} Demande de congé</h1>
    <p class="punch-subtitle">Entre ton NIP pour demander un congé ou des vacances</p>
    <div class="punch-pin-dots">${dots}</div>
    <div class="punch-keypad" role="group" aria-label="Clavier NIP">
      ${keys.map(k => {
        if (k.type === "clear") return `<button class="punch-key punch-key--clear" onclick="leaveKeyClear()" aria-label="Effacer">${icon("arrow-left", 28)}</button>`;
        if (k.type === "ok") return `<button class="punch-key punch-key--ok" onclick="leaveKeyOk()" aria-label="Valider" ${_leavePin.length === 4 ? "" : "disabled"}>${icon("check", 28)}</button>`;
        return `<button class="punch-key punch-key--digit" onclick="leaveKeyDigit('${k.v}')" aria-label="${k.v}">${k.v}</button>`;
      }).join("")}
    </div>
    <p class="punch-hint">Ton NIP est le même que pour le pointage.</p>
  </div>`;
}

// ─ Formulaire de demande (après identification) ───────────
function _leaveFormHTML() {
  const emp = _leaveEmployee;
  const sel = _leaveSelectedDays;
  const isPartial = _leaveKind === "partial";

  // Bannière de la règle des 2 semaines (selon la sélection courante)
  let banner = "";
  if (sel.length) {
    const auto = _leaveAutoApproves(sel);
    banner = auto
      ? `<div class="leave-banner is-auto">${icon("check", 16)} <span><strong>Plus de 2 semaines</strong> — ta demande sera <strong>approuvée automatiquement</strong>.</span></div>`
      : `<div class="leave-banner is-soon">${icon("alert", 16)} <span><strong>Moins de 2 semaines</strong> — à faire <strong>approuver par ton superviseur</strong>. La demande lui sera envoyée pour décision.</span></div>`;
  }

  // Sélecteur de type (les 4)
  const typeBtns = (typeof LEAVE_TYPES !== "undefined" ? LEAVE_TYPES : []).map(l =>
    `<button type="button" class="leave-type-btn ${_leaveType === l.id ? "is-active" : ""}" style="--leave-color:${l.color}"
       onclick="leaveSetType('${l.id}')">${esc(l.label)}</button>`
  ).join("");

  // Récap de la sélection
  let selRecap = "";
  if (isPartial) {
    selRecap = sel.length
      ? `<div class="leave-sel-recap">${_fmtDkShort(sel[0])} · ${_leavePartialMode === "late" ? "entrée plus tard" : "fin plus tôt"}${_leavePartialTime ? " à " + _leavePartialTime : ""}</div>`
      : `<div class="leave-sel-recap is-empty">Choisis la journée du congé partiel</div>`;
  } else {
    selRecap = sel.length
      ? `<div class="leave-sel-recap">${sel.length} jour${sel.length > 1 ? "s" : ""} : ${sel.slice().sort().map(_fmtDkShort).join(" · ")}</div>`
      : `<div class="leave-sel-recap is-empty">Choisis un ou plusieurs jours dans le calendrier</div>`;
  }

  // Bloc congé partiel (mode + heure)
  const partialBlock = isPartial ? `
    <div class="leave-partial-block">
      <div class="leave-partial-modes">
        <button type="button" class="leave-pmode-btn ${_leavePartialMode === "late" ? "is-active" : ""}" onclick="leaveSetPartialMode('late')">${icon("log-in", 14)} Entrer plus tard</button>
        <button type="button" class="leave-pmode-btn ${_leavePartialMode === "early" ? "is-active" : ""}" onclick="leaveSetPartialMode('early')">${icon("log-out", 14)} Finir plus tôt</button>
      </div>
      <label class="leave-partial-time">${_leavePartialMode === "late" ? "Heure d'arrivée" : "Heure de départ"}
        ${timeInputHTML("leave-partial-time", _leavePartialTime)}
      </label>
      ${timeDatalistHTML()}
    </div>` : "";

  // Mes demandes
  const mine = leaveRequestsForEmp(emp.id).slice().sort((a, b) => (Number(b.requestedAt) || 0) - (Number(a.requestedAt) || 0));
  const mineHTML = mine.length === 0
    ? `<div class="empty" style="margin:12px 0">${icon("info", 22)}<br/>Aucune demande pour l'instant.</div>`
    : `<div class="leave-mine-list">${mine.map(_leaveMineCardHTML).join("")}</div>`;

  return `
    <div class="leave-form-head">
      <div>
        <div class="leave-hello">Bonjour <strong>${esc(emp.name || "")}</strong></div>
        <div class="leave-hello-sub">Choisis tes journées de congé ci-dessous</div>
      </div>
      <button class="btn-secondary btn-sm" onclick="leaveBackToKeypad()">${icon("arrow-left", 14)} Pas moi / Terminé</button>
    </div>

    <div class="card leave-card">
      <div class="leave-kind-toggle">
        <button type="button" class="leave-kind-btn ${!isPartial ? "is-active" : ""}" onclick="leaveSetKind('full')">${icon("sun", 14)} Journée(s) complète(s)</button>
        <button type="button" class="leave-kind-btn ${isPartial ? "is-active" : ""}" onclick="leaveSetKind('partial')">${icon("clock", 14)} Congé partiel</button>
      </div>

      <div class="leave-field-label">Type de congé</div>
      <div class="leave-type-row">${typeBtns}</div>

      ${partialBlock}

      <div class="leave-field-label">${isPartial ? "Journée" : "Journée(s)"}</div>
      ${_leaveCalendarHTML()}

      ${selRecap}
      ${banner}

      <label class="leave-reason-label">Motif (optionnel)
        <textarea id="leave-reason" class="leave-reason" rows="2" placeholder="Ex. rendez-vous, voyage…" oninput="_leaveReason=this.value">${esc(_leaveReason || "")}</textarea>
      </label>

      <div class="leave-submit-row">
        <button class="btn btn-primary" onclick="submitLeaveRequest()" ${sel.length === 0 ? "disabled" : ""}>${icon("check", 16)} Envoyer la demande</button>
      </div>
    </div>

    <div class="card leave-mine-card">
      <h3 class="leave-mine-title">${icon("clipboard", 16)} Mes demandes</h3>
      ${mineHTML}
    </div>`;
}

function _leaveMineCardHTML(r) {
  const lm = (typeof leaveTypeMeta === "function") ? leaveTypeMeta(r.type) : { label: r.type, color: "#0d9488" };
  return `<div class="leave-mine-item" style="--leave-color:${lm.color}">
    <div class="leave-mine-main">
      <span class="leave-mine-type">${esc(lm.label)}</span>
      <span class="leave-mine-dates">${_leaveDatesLabel(r)}</span>
    </div>
    ${_leaveStatusBadge(r)}
  </div>`;
}

function _leaveDatesLabel(r) {
  if (r.kind === "partial" && r.partial) {
    return `${_fmtDkShort(r.partial.dk)} · ${r.partial.mode === "late" ? "entre à" : "finit à"} ${r.partial.time}`;
  }
  const ds = Array.isArray(r.dates) ? r.dates.slice().sort() : [];
  if (ds.length === 0) return "—";
  if (ds.length === 1) return _fmtDkShort(ds[0]);
  return `${ds.length} jours : ${ds.map(_fmtDkShort).join(" · ")}`;
}

function _leaveStatusBadge(r) {
  if (r.status === "approved") {
    return `<span class="leave-status leave-status--approved">${icon("check", 11)} Approuvé${r.autoApproved ? " (auto)" : ""}</span>`;
  }
  if (r.status === "rejected") {
    return `<span class="leave-status leave-status--rejected">${icon("x", 11)} Refusé</span>`;
  }
  return `<span class="leave-status leave-status--pending">${icon("clock", 11)} En attente</span>`;
}

// ─ Calendrier mensuel ─────────────────────────────────────
const _LEAVE_DOW = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
function _leaveCalendarHTML() {
  const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
  base.setMonth(base.getMonth() + _leaveMonthOffset);
  const year = base.getFullYear(), month = base.getMonth();
  const monthLabel = base.toLocaleDateString(_leaveLocale(), { month: "long", year: "numeric" });
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Lun=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(`<div class="leave-cal-day is-empty"></div>`);
  for (let d = 1; d <= daysInMonth; d++) {
    const dk = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const past = _leaveIsPast(dk);
    const sel = _leaveSelectedDays.includes(dk);
    const soon = !past && _daysUntilDk(dk) <= 14;
    const cls = ["leave-cal-day"];
    if (past) cls.push("is-past");
    if (sel) cls.push("is-selected");
    if (soon) cls.push("is-soon");
    cells.push(`<button type="button" class="${cls.join(" ")}" ${past ? "disabled" : `onclick="leaveToggleDay('${dk}')"`}
      title="${past ? "Jour passé" : soon ? "Moins de 2 semaines — à approuver par le superviseur" : "Plus de 2 semaines — approuvé automatiquement"}">
      <span class="leave-cal-num">${d}</span>
    </button>`);
  }
  const canPrev = _leaveMonthOffset > 0;
  return `<div class="leave-cal">
    <div class="leave-cal-nav">
      <button type="button" class="btn-icon-only" onclick="leaveMonthNav(-1)" aria-label="Mois précédent" ${canPrev ? "" : "disabled"}>${icon("chevron-left", 16)}</button>
      <div class="leave-cal-month">${monthLabel}</div>
      <button type="button" class="btn-icon-only" onclick="leaveMonthNav(1)" aria-label="Mois suivant">${icon("chevron-right", 16)}</button>
    </div>
    <div class="leave-cal-head">${_LEAVE_DOW.map(d => `<div class="leave-cal-dow">${d}</div>`).join("")}</div>
    <div class="leave-cal-grid">${cells.join("")}</div>
    <div class="leave-cal-legend"><span class="leave-cal-legend-soon"></span> = moins de 2 semaines (à approuver)</div>
  </div>`;
}

// ─ Actions clavier NIP ────────────────────────────────────
function leaveKeyDigit(d) {
  if (_leavePin.length >= 4) return;
  _leavePin += d;
  if (_leavePin.length === 4) { setTimeout(() => leaveKeyOk(), 120); }
  renderPage();
}
function leaveKeyClear() {
  if (_leavePin.length === 0) return;
  _leavePin = _leavePin.slice(0, -1);
  renderPage();
}
function leaveKeyOk() {
  if (_leavePin.length !== 4) return toast("Entre ton NIP à 4 chiffres.", "warning");
  const emp = (employees || []).find(e => !e.archived && e.pin && String(e.pin).trim() === _leavePin);
  if (!emp) {
    toast("NIP non reconnu. Réessaie.", "error", 2500);
    _leavePin = "";
    renderPage();
    return;
  }
  _leaveEmployee = emp;
  _leaveStep = "calendar";
  _leaveSelectedDays = [];
  _leaveReason = "";
  renderPage();
}
function leaveBackToKeypad() {
  _leavePin = "";
  _leaveEmployee = null;
  _leaveStep = "keypad";
  _leaveSelectedDays = [];
  _leaveReason = "";
  _leavePartialTime = "";
  renderPage();
}

// ─ Actions du formulaire ──────────────────────────────────
function leaveSetType(type) { _leaveType = type; renderPage(); }
function leaveSetKind(kind) {
  _leaveKind = kind;
  // En partiel : on garde au plus 1 jour sélectionné.
  if (kind === "partial" && _leaveSelectedDays.length > 1) _leaveSelectedDays = [_leaveSelectedDays[0]];
  renderPage();
}
function leaveSetPartialMode(mode) { _leavePartialMode = mode; renderPage(); }
function leaveMonthNav(delta) { _leaveMonthOffset = Math.max(0, _leaveMonthOffset + delta); renderPage(); }
function leaveToggleDay(dk) {
  if (_leaveKind === "partial") {
    _leaveSelectedDays = (_leaveSelectedDays[0] === dk) ? [] : [dk];
  } else {
    const i = _leaveSelectedDays.indexOf(dk);
    if (i >= 0) _leaveSelectedDays.splice(i, 1);
    else _leaveSelectedDays.push(dk);
  }
  renderPage();
}

// ─ Soumission ─────────────────────────────────────────────
async function submitLeaveRequest() {
  const emp = _leaveEmployee;
  if (!emp) return;
  const kind = _leaveKind;
  let dates = [], partial = null;

  if (kind === "partial") {
    if (_leaveSelectedDays.length !== 1) return toast("Choisis une journée pour le congé partiel.", "warning");
    // Lire l'heure depuis le champ (au cas où le blur n'a pas encore normalisé)
    const rawTime = (document.getElementById("leave-partial-time") || {}).value || _leavePartialTime;
    const time = normalizeTimeInput(rawTime);
    if (!time) return toast("Indique une heure valide (ex. 18:00).", "warning");
    _leavePartialTime = time;
    partial = { dk: _leaveSelectedDays[0], mode: _leavePartialMode, time };
    dates = [_leaveSelectedDays[0]];
  } else {
    if (_leaveSelectedDays.length === 0) return toast("Choisis au moins une journée.", "warning");
    dates = _leaveSelectedDays.slice().sort();
  }
  if (dates.some(_leaveIsPast)) return toast("Tu ne peux pas demander un congé dans le passé.", "warning");

  const auto = _leaveAutoApproves(dates);
  const now = Date.now();
  const reason = (document.getElementById("leave-reason") || {}).value;
  const req = {
    empId: emp.id,
    empName: emp.name || "",
    type: _leaveType,
    kind,
    dates,
    partial,
    status: auto ? "approved" : "pending",
    autoApproved: auto,
    reason: (reason != null ? reason : (_leaveReason || "")).trim(),
    requestedAt: now,
    decidedAt: auto ? now : null,
    decidedBy: auto ? "auto" : null
  };
  try {
    await db.collection("leaveRequests").add(req);
    _leaveSelectedDays = [];
    _leaveReason = "";
    _leavePartialTime = "";
    if (auto) toast("✓ Congé approuvé automatiquement (plus de 2 semaines).", "success", 4500);
    else toast("Demande envoyée — à faire approuver par ton superviseur (moins de 2 semaines).", "info", 6000);
    renderPage();
  } catch (err) {
    console.error("submitLeaveRequest failed:", err);
    toast("Erreur d'envoi : " + (err.message || err.code || err), "error", 5000);
  }
}

// ═══════════════════════════════════════════════════════════════
// PAGE ADMIN — « demandes-conge »
// ═══════════════════════════════════════════════════════════════
function renderLeaveAdmin() {
  const all = (leaveRequests || []).slice();
  const counts = {
    pending: all.filter(r => r.status === "pending").length,
    approved: all.filter(r => r.status === "approved").length,
    rejected: all.filter(r => r.status === "rejected").length,
    all: all.length
  };
  const f = leaveAdminFilter;
  const list = (f === "all" ? all : all.filter(r => r.status === f))
    .sort((a, b) => (Number(b.requestedAt) || 0) - (Number(a.requestedAt) || 0));

  const tab = (id, label) =>
    `<button class="leave-tab ${f === id ? "is-active" : ""}" onclick="setLeaveAdminFilter('${id}')">${label} <span class="leave-tab-count">${counts[id]}</span></button>`;

  const body = list.length === 0
    ? `<div class="empty" style="margin:24px 0">${icon("sun", 28)}<br/>Aucune demande ${f === "pending" ? "en attente" : f === "approved" ? "approuvée" : f === "rejected" ? "refusée" : ""}.</div>`
    : `<div class="leave-admin-list">${list.map(_leaveAdminCardHTML).join("")}</div>`;

  return `<div class="page page--wide">
    <div class="page-head">
      <h2 class="page-title">${icon("sun", 22)} Demandes de congé</h2>
      <p class="page-sub">Les demandes à plus de 2 semaines sont approuvées automatiquement. Celles à moins de 2 semaines attendent ta décision.</p>
    </div>
    <div class="leave-tabs">
      ${tab("pending", "En attente")}
      ${tab("approved", "Approuvées")}
      ${tab("rejected", "Refusées")}
      ${tab("all", "Toutes")}
    </div>
    ${body}
  </div>`;
}

function _leaveAdminCardHTML(r) {
  const lm = (typeof leaveTypeMeta === "function") ? leaveTypeMeta(r.type) : { label: r.type, color: "#0d9488" };
  const when = r.requestedAt ? new Date(Number(r.requestedAt)).toLocaleDateString(_leaveLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  const decided = (r.status !== "pending" && r.decidedBy)
    ? `<div class="leave-admin-decided">${r.status === "approved" ? "Approuvé" : "Refusé"} ${r.decidedBy === "auto" ? "automatiquement" : "par " + esc(r.decidedBy)}</div>`
    : "";
  const reason = r.reason ? `<div class="leave-admin-reason">${icon("file-text", 11)} ${esc(r.reason)}</div>` : "";
  const kindTag = r.kind === "partial"
    ? `<span class="leave-admin-kind">Congé partiel</span>`
    : `<span class="leave-admin-kind">${(r.dates || []).length} jour${(r.dates || []).length > 1 ? "s" : ""}</span>`;

  let actions = "";
  if (r.status === "pending") {
    actions = `<div class="leave-admin-actions">
      <button class="btn btn-primary btn-sm" onclick="approveLeaveRequest('${r.id}')">${icon("check", 14)} Approuver</button>
      <button class="btn-secondary btn-sm leave-reject-btn" onclick="rejectLeaveRequest('${r.id}')">${icon("x", 14)} Refuser</button>
    </div>`;
  } else {
    actions = `<div class="leave-admin-actions">
      <button class="btn-cancel btn-sm" style="color:#a23a36" onclick="deleteLeaveRequest('${r.id}')" title="Retirer cette demande">${icon("trash", 13)} Retirer</button>
    </div>`;
  }

  return `<div class="leave-admin-card leave-admin-card--${r.status}" style="--leave-color:${lm.color}">
    <div class="leave-admin-top">
      <div class="leave-admin-emp">${icon("user", 13)} <strong>${esc(r.empName || "")}</strong></div>
      ${_leaveStatusBadge(r)}
    </div>
    <div class="leave-admin-meta">
      <span class="leave-admin-type">${esc(lm.label)}</span>
      ${kindTag}
      ${when ? `<span class="leave-admin-when">${icon("clock", 11)} ${when}</span>` : ""}
    </div>
    <div class="leave-admin-dates">${_leaveDatesLabel(r)}</div>
    ${reason}
    ${decided}
    ${actions}
  </div>`;
}

function setLeaveAdminFilter(f) { leaveAdminFilter = f; renderPage(); }

async function approveLeaveRequest(id) {
  try {
    await db.collection("leaveRequests").doc(id).update({
      status: "approved",
      autoApproved: false,
      decidedAt: Date.now(),
      decidedBy: (loggedInUser && loggedInUser.name) || "Admin"
    });
    toast("Demande approuvée — le congé apparaît dans les horaires.", "success", 3500);
  } catch (err) {
    console.error("approveLeaveRequest failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}
async function rejectLeaveRequest(id) {
  try {
    await db.collection("leaveRequests").doc(id).update({
      status: "rejected",
      decidedAt: Date.now(),
      decidedBy: (loggedInUser && loggedInUser.name) || "Admin"
    });
    toast("Demande refusée.", "success", 2500);
  } catch (err) {
    console.error("rejectLeaveRequest failed:", err);
    toast("Erreur : " + (err.message || err.code || err), "error", 5000);
  }
}
function deleteLeaveRequest(id) {
  const r = (leaveRequests || []).find(x => x.id === id);
  const name = r ? r.empName : "";
  const doDelete = async () => {
    try {
      await db.collection("leaveRequests").doc(id).delete();
      toast("Demande retirée.", "success", 2500);
    } catch (err) {
      console.error("deleteLeaveRequest failed:", err);
      toast("Erreur : " + (err.message || err.code || err), "error", 5000);
    }
  };
  if (typeof openConfirm === "function") {
    openConfirm("Retirer la demande", `Retirer la demande de congé de « ${esc(name)} » ?<br><br>Si elle était approuvée, le congé disparaîtra des horaires.`, doDelete, true);
  } else {
    doDelete();
  }
}

// ═══════════════════════════════════════════════════════════════
// BANDEAU NOTIFICATION (tableau de bord admin)
// ═══════════════════════════════════════════════════════════════
function renderLeaveDashboardBanner() {
  if (!isAdmin) return "";
  const pending = pendingLeaveRequests();
  if (pending.length === 0) return "";
  const names = [...new Set(pending.map(r => r.empName).filter(Boolean))];
  const namesLabel = names.slice(0, 4).join(", ") + (names.length > 4 ? "…" : "");
  return `<div class="card leave-dash-banner" onclick="navTo('demandes-conge')" role="button" tabindex="0"
      onkeydown="if(event.key==='Enter'){navTo('demandes-conge')}" title="Voir les demandes de congé">
    <div class="leave-dash-banner-icon">${icon("sun", 20)}</div>
    <div class="leave-dash-banner-body">
      <div class="leave-dash-banner-title">${icon("alert", 14)} ${pending.length} demande${pending.length > 1 ? "s" : ""} de congé en attente</div>
      <div class="leave-dash-banner-sub">${esc(namesLabel)} — clique pour approuver ou refuser</div>
    </div>
    <div class="leave-dash-banner-cta">${icon("chevron-right", 18)}</div>
  </div>`;
}
