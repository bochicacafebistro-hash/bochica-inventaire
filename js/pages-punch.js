// ═══════════════════════════════════════════════════════════════
// POINTAGE — écran kiosque pour pointer entrée/sortie par PIN
// ───────────────────────────────────────────────────────────────
// Flow :
//   1. L'employé tape son PIN à 4 chiffres
//   2. Le système l'identifie en faisant un match dans `employees`
//   3. Détection auto : on regarde si une entrée a déjà été saisie aujourd'hui
//      → 1er punch du jour       = ENTRÉE  (écrit dans actualShifts[id][dk].start)
//      → 2e punch du jour        = SORTIE  (écrit dans actualShifts[id][dk].end)
//      → 3e+ punch (déjà bouclé) = avertissement avec option d'écraser la sortie
//   4. Confirmation visuelle (nom + heure + action) pendant 3s, puis retour au PIN
//
// Stockage : les punches vont DIRECTEMENT dans payroll/{weekId}.actualShifts.
// Conséquence : le tableau Salaires & Pourboires se remplit tout seul, semaine
// par semaine. L'admin peut toujours corriger manuellement les heures à postériori.
//
// Sécurité : la page est visible par les 3 rôles. Usage typique : tablette
// permanente loggée en compte "Employe", chaque punch est identifié par le PIN.
// Les règles Firestore /payroll autorisent les écritures de tous les rôles
// mais uniquement sur le sous-champ actualShifts (voir firestore.rules v2).
// ═══════════════════════════════════════════════════════════════

// ─ État UI (local au module) ──────────────────────────────
// "keypad"     → écran de saisie du PIN
// "employee"   → écran de confirmation employé avec un gros bouton ENTRÉE/SORTIE
// "confirmed"  → écran post-punch (s'efface après 3s)
// "error"      → écran d'erreur (PIN invalide, pas trouvé) — auto-reset
let _punchState = "keypad";
let _punchPin = "";
let _punchEmployee = null;
let _punchAction = null;       // "entree" | "sortie" | "blocked"
let _punchActionTime = null;   // "HH:MM" enregistré
let _punchErrMessage = "";
let _punchAutoResetTimer = null;

// Heure courante au format HH:MM (toujours 24h, zéros devant)
function _punchNowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Heure du jour pour affichage (HH:MM:SS — l'horloge tourne)
function _punchNowFull() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// Date longue façon "Mardi 26 mai 2026"
function _punchDateLong() {
  return new Date().toLocaleDateString(uiLocale(), {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
}

// ─ Render principal ───────────────────────────────────────
function renderPunch() {
  // ⚠ NE PAS clearer _punchAutoResetTimer ici — c'est ce qui faisait que
  // l'auto-retour au keypad ne fonctionnait pas (v3.17.0 → fix v3.17.1).
  // Le timer doit survivre au re-render qui suit immédiatement le punch.
  // Le clear se fait dans punchReset() et punchBackToKeypad() à la place.

  let body = "";
  if (_punchState === "keypad")     body = renderPunchKeypadHTML();
  else if (_punchState === "employee")  body = renderPunchEmployeeHTML();
  else if (_punchState === "confirmed") body = renderPunchConfirmedHTML();
  else if (_punchState === "error")     body = renderPunchErrorHTML();

  // Badge timezone — affiche le fuseau détecté par le navigateur + le dayKey
  // utilisé par le système. Permet à l'admin/utilisateur de vérifier d'un
  // coup d'œil que la date "système" correspond bien au jour réel local.
  // Si jamais ça affiche le mauvais jour, on sait que c'est ici qu'il faut
  // creuser (problème de fuseau au niveau OS, navigateur, ou code).
  const tzGuess = Intl.DateTimeFormat().resolvedOptions().timeZone || "?";
  const todayDk = dayKey(new Date());
  const tzBadge = `<div class="punch-tz-badge" title="${t("punch_tz_title")}">
    ${tzGuess} · ${t("punch_tz_label")} ${todayDk}
  </div>`;

  return `<div class="page page--wide page--punch">
    <div class="punch-screen">
      <div class="punch-clock-row">
        <div class="punch-clock" id="punch-live-clock">${_punchNowFull()}</div>
        <div class="punch-date">${_punchDateLong()}</div>
        ${tzBadge}
      </div>
      ${body}
    </div>
  </div>`;
}

// ─ Écran 1 : keypad de saisie du PIN ──────────────────────
function renderPunchKeypadHTML() {
  const dots = [0,1,2,3].map(i =>
    `<span class="punch-pin-dot ${_punchPin.length > i ? "is-filled" : ""}"></span>`
  ).join("");

  // Disposition style téléphone : 1 2 3 / 4 5 6 / 7 8 9 / clear 0 ok
  const keys = [
    { type: "digit", v: "1" }, { type: "digit", v: "2" }, { type: "digit", v: "3" },
    { type: "digit", v: "4" }, { type: "digit", v: "5" }, { type: "digit", v: "6" },
    { type: "digit", v: "7" }, { type: "digit", v: "8" }, { type: "digit", v: "9" },
    { type: "clear" },         { type: "digit", v: "0" }, { type: "ok" }
  ];

  return `<div class="punch-keypad-screen">
    <h1 class="punch-title">${icon("clock", 32)} ${t("punch_title")}</h1>
    <p class="punch-subtitle">${t("punch_subtitle")}</p>
    <div class="punch-pin-dots" aria-label="${t("punch_dots_aria", { n: _punchPin.length })}">${dots}</div>
    <div class="punch-keypad" role="group" aria-label="${t("punch_keypad_aria")}">
      ${keys.map(k => {
        if (k.type === "clear") return `<button class="punch-key punch-key--clear" onclick="punchKeyClear()" aria-label="${t("punch_aria_clear")}">${icon("arrow-left", 28)}</button>`;
        if (k.type === "ok")    return `<button class="punch-key punch-key--ok" onclick="punchKeyOk()" aria-label="${t("punch_aria_validate")}" ${_punchPin.length === 4 ? "" : "disabled"}>${icon("check", 28)}</button>`;
        return `<button class="punch-key punch-key--digit" onclick="punchKeyDigit('${k.v}')" aria-label="${k.v}">${k.v}</button>`;
      }).join("")}
    </div>
    <p class="punch-hint">${t("punch_hint")}</p>
  </div>`;
}

// ─ Écran 2 : confirmation employé + 2 boutons ENTRÉE + SORTIE
// v3.20.0 — Les 2 boutons sont TOUJOURS visibles (au lieu d'un seul bouton
// auto-détecté). L'employé sait toujours ce qu'il fait et peut corriger
// une saisie en re-cliquant. L'état actuel (déjà pointé ?) s'affiche dans
// une barre d'info entre le nom et les boutons.
function renderPunchEmployeeHTML() {
  const emp = _punchEmployee;
  if (!emp) return renderPunchKeypadHTML();

  const dk = dayKey(new Date());
  const todayShift = _punchGetTodayShift(emp.id, dk);
  const hasStart = !!(todayShift && todayShift.start);
  const hasEnd = !!(todayShift && todayShift.end);

  const groupBadge = (emp.section || "service") === "cuisine"
    ? `<span class="punch-emp-section punch-emp-section--cuisine">${icon("utensils", 12)} ${t("section_kitchen")}</span>`
    : `<span class="punch-emp-section punch-emp-section--service">${icon("users", 12)} ${t("section_service")}</span>`;

  // Quart de nuit ouvert depuis hier (entrée sans sortie, tôt le matin) :
  // on prévient l'employé qu'un appui sur SORTIE va fermer ce quart-là.
  const overnightPrev = !hasStart ? _punchYesterdayOpenShiftSync(emp.id) : null;

  // Bloc info état : ce qui a déjà été pointé aujourd'hui
  let stateInfo;
  if (overnightPrev) {
    stateInfo = `<div class="punch-state-info punch-state-info--overnight">
      ${icon("log-in", 14)} ${t("punch_overnight_hint", { t: overnightPrev.start })}
    </div>`;
  } else if (!hasStart && !hasEnd) {
    stateInfo = `<div class="punch-state-info punch-state-info--empty">
      ${icon("info", 14)} ${t("punch_no_today")}
    </div>`;
  } else {
    stateInfo = `<div class="punch-state-info">
      ${hasStart ? `<span class="punch-state-item punch-state-item--entree">
        ${icon("log-in", 14)} ${t("punch_entry")} :
        <span class="punch-state-item-time">${todayShift.start}</span>
      </span>` : ""}
      ${hasEnd ? `<span class="punch-state-item punch-state-item--sortie">
        ${icon("log-out", 14)} ${t("punch_exit")} :
        <span class="punch-state-item-time">${todayShift.end}</span>
      </span>` : ""}
    </div>`;
  }

  const nowHHMM = _punchNowHHMM();

  return `<div class="punch-employee-screen">
    <button class="punch-back-btn" onclick="punchBackToKeypad()" aria-label="${t("close")}">${icon("arrow-left", 18)} ${t("punch_not_me")}</button>
    <div class="punch-greeting">
      <div class="punch-greeting-hello">${t("punch_hello")}</div>
      <div class="punch-greeting-name">${esc(emp.name || "")}</div>
      ${groupBadge}
    </div>
    ${stateInfo}
    <div class="punch-buttons-row">
      <button class="punch-main-btn is-entree" onclick="punchDoAction('entree')" title="${t("punch_btn_in_title")}${hasStart ? " " + t("punch_replace", { t: todayShift.start }) : ""}">
        ${icon("log-in", 36)}
        <span class="punch-main-btn-label">${t("punch_in")}</span>
        <span class="punch-main-btn-time">${nowHHMM}</span>
        ${hasStart ? `<span class="punch-main-btn-state">${t("punch_replace", { t: todayShift.start })}</span>` : ""}
      </button>
      <button class="punch-main-btn is-sortie" onclick="punchDoAction('sortie')" title="${t("punch_btn_out_title")}${hasEnd ? " " + t("punch_replace", { t: todayShift.end }) : ""}">
        ${icon("log-out", 36)}
        <span class="punch-main-btn-label">${t("punch_out")}</span>
        <span class="punch-main-btn-time">${nowHHMM}</span>
        ${hasEnd ? `<span class="punch-main-btn-state">${t("punch_replace", { t: todayShift.end })}</span>` : ""}
      </button>
    </div>
    <p class="punch-action-sub">${t("punch_action_sub")}</p>
  </div>`;
}

// ─ Écran 3 : confirmation post-punch (3s) ─────────────────
function renderPunchConfirmedHTML() {
  const emp = _punchEmployee;
  const actLabel = _punchAction === "entree" ? t("punch_in") : t("punch_out");
  const actCls = _punchAction === "entree" ? "is-entree" : "is-sortie";
  const actIcon = _punchAction === "entree" ? "log-in" : "log-out";
  const wish = _punchAction === "entree"
    ? t("punch_wish_in")
    : t("punch_wish_out");
  return `<div class="punch-confirmed-screen ${actCls}">
    <div class="punch-confirmed-check">${icon("check", 96)}</div>
    <div class="punch-confirmed-label">${icon(actIcon, 22)} ${actLabel} ${t("punch_recorded")}</div>
    <div class="punch-confirmed-name">${esc(emp?.name || "")}</div>
    <div class="punch-confirmed-time">${t("punch_at", { t: _punchActionTime || _punchNowHHMM() })}</div>
    <div class="punch-confirmed-wish">${wish}</div>
    <button class="punch-tap-anywhere" onclick="punchReset()">${t("punch_next")} ${icon("arrow-right", 14)}</button>
  </div>`;
}

// ─ Écran 4 : erreur PIN ───────────────────────────────────
function renderPunchErrorHTML() {
  return `<div class="punch-error-screen">
    <div class="punch-error-icon">${icon("alert", 96)}</div>
    <div class="punch-error-msg">${esc(_punchErrMessage || t("punch_pin_unknown"))}</div>
    <button class="punch-tap-anywhere" onclick="punchReset()">${t("punch_next")} ${icon("arrow-right", 14)}</button>
  </div>`;
}

// ─ Helpers de lecture ─────────────────────────────────────
// Lit le shift courant pour cet employé pour aujourd'hui (override seulement,
// pas de fallback sur planifié — le pointage doit refléter strictement ce qui
// a été punché aujourd'hui, pas un import auto).
function _punchGetTodayShift(empId, dk) {
  const actual = payrollWeekData?.actualShifts?.[empId];
  return (actual && actual[dk]) ? actual[dk] : null;
}

// ─ Quart de nuit (passage de minuit) ──────────────────────
// Problème réglé : un employé entre le soir (ex. 22:00) et sort le lendemain
// matin (ex. 00:56). Comme le punch « sortie » du matin tombe sur un NOUVEAU
// jour (lendemain) où il n'a pas d'entrée, l'ancien code l'écrivait dans
// actualShifts[lendemain].end → un jour avec une sortie sans entrée, et la
// veille restait avec une entrée sans sortie. Les heures étaient éparpillées
// sur 2 jours et le calcul était faux.
//
// Fix : si un employé pointe SORTIE le matin SANS entrée aujourd'hui ET qu'un
// quart est resté OUVERT la veille (entrée présente, pas de sortie), on ferme
// CE quart-là (on écrit la sortie sur la VEILLE). hoursFromShift() gère déjà le
// passage de minuit (22:00 → 00:56 = ~2h56 sur le même enregistrement).
//
// Garde-fous pour éviter de fermer par erreur un quart de jour oublié la veille :
//   • on n'agit que tôt le matin (avant PUNCH_OVERNIGHT_CUTOFF_HOUR)
//   • la durée résultante doit rester plausible (≤ PUNCH_OVERNIGHT_MAX_HOURS)
const PUNCH_OVERNIGHT_CUTOFF_HOUR = 10;   // ne ferme la veille que si on est avant 10:00
const PUNCH_OVERNIGHT_MAX_HOURS = 12;     // durée max d'un quart de nuit considéré « plausible »

// Lundi (00:00 local) de la semaine contenant `dateObj`. Indépendant de la
// semaine actuellement affichée — sert à viser le bon doc payroll/{weekId}
// même quand la veille est dans une semaine ISO précédente (nuit dim→lun).
function _punchMondayOf(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // lundi
  d.setDate(diff); d.setHours(0, 0, 0, 0);
  return d;
}

// Lit le shift réel d'un employé pour une date donnée, DIRECTEMENT depuis
// Firestore (autoritatif) — peut viser une autre semaine que celle affichée.
// Retourne { shift, wid, weekStart, dk } ou null en cas d'erreur.
async function _punchFetchShiftForDate(empId, dateObj) {
  try {
    const ws = _punchMondayOf(dateObj);
    const wid = payrollWeekId(ws);
    const dk = dayKey(dateObj);
    const snap = await db.collection("payroll").doc(wid).get();
    const data = snap.exists ? snap.data() : null;
    const shift = data?.actualShifts?.[empId]?.[dk] || null;
    return { shift, wid, weekStart: ws, dk };
  } catch (err) {
    console.error("_punchFetchShiftForDate failed:", err);
    return null;
  }
}

// Tente de fermer un quart de nuit ouvert la veille (entrée sans sortie) en y
// écrivant la sortie `nowHHMM`. Retourne true si un quart a bien été fermé.
async function _punchCloseOvernightShift(emp, yDate, nowHHMM) {
  const info = await _punchFetchShiftForDate(emp.id, yDate);
  if (!info || !info.shift) return false;
  const ys = info.shift;
  // Doit être un quart OUVERT : entrée présente, pas de sortie, pas « absent ».
  if (!ys.start || ys.end || ys.markedAbsent) return false;
  // Durée plausible pour un quart de nuit (hoursFromShift gère le passage minuit).
  const dur = hoursFromShift({ start: ys.start, end: nowHHMM });
  if (!(dur > 0) || dur > PUNCH_OVERNIGHT_MAX_HOURS) return false;

  // Écrit la sortie sur la veille en PRÉSERVANT l'entrée (et en nettoyant les
  // flags auto-fill / absent comme le fait updateActualShift).
  const newShift = {
    start: ys.start,
    end: nowHHMM,
    autoFilled: firebase.firestore.FieldValue.delete(),
    autoFilledAt: firebase.firestore.FieldValue.delete(),
    autoFilledNoStart: firebase.firestore.FieldValue.delete(),
    markedAbsent: firebase.firestore.FieldValue.delete(),
    markedAbsentAt: firebase.firestore.FieldValue.delete()
  };
  await db.collection("payroll").doc(info.wid).set({
    weekId: info.wid,
    weekStart: dayKey(info.weekStart),
    updatedAt: Date.now(),
    actualShifts: { [emp.id]: { [info.dk]: newShift } }
  }, { merge: true });
  return true;
}

// Pour l'AFFICHAGE seulement (synchrone) : un quart de nuit ouvert hier est-il
// visible dans la semaine courante chargée ? Sert à afficher un indice à
// l'employé. (La fermeture réelle passe par _punchCloseOvernightShift, qui lit
// Firestore et gère aussi le cas dim→lun en semaine précédente.)
function _punchYesterdayOpenShiftSync(empId) {
  const now = new Date();
  if (now.getHours() >= PUNCH_OVERNIGHT_CUTOFF_HOUR) return null;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const ydk = dayKey(y);
  const actual = payrollWeekData?.actualShifts?.[empId];
  const ys = actual && actual[ydk] ? actual[ydk] : null;
  if (ys && ys.start && !ys.end && !ys.markedAbsent) return ys;
  return null;
}

// ─ Actions clavier numérique ──────────────────────────────
function punchKeyDigit(d) {
  if (_punchState !== "keypad") return;
  if (_punchPin.length >= 4) return;
  _punchPin += d;
  // Auto-valider quand on atteint 4 chiffres (UX kiosque : moins de gestes)
  if (_punchPin.length === 4) {
    setTimeout(() => punchKeyOk(), 120); // léger délai pour voir le 4e dot
    renderPage();
  } else {
    renderPage();
  }
}

function punchKeyClear() {
  if (_punchState !== "keypad") return;
  if (_punchPin.length === 0) return;
  _punchPin = _punchPin.slice(0, -1);
  renderPage();
}

function punchKeyOk() {
  if (_punchState !== "keypad") return;
  if (_punchPin.length !== 4) {
    toast(t("punch_enter_4"), "warning");
    return;
  }
  // Match contre la liste des employés
  const emp = (employees || []).find(e => !e.archived && e.pin && String(e.pin).trim() === _punchPin);
  if (!emp) {
    _punchErrMessage = t("punch_pin_unknown_full");
    _punchState = "error";
    renderPage();
    _punchAutoResetTimer = setTimeout(punchReset, 2200);
    return;
  }
  _punchEmployee = emp;
  _punchState = "employee";
  renderPage();
}

// Retour à l'écran clavier (volontaire — bouton "Pas moi" ou après confirmation)
function punchBackToKeypad() {
  _punchPin = "";
  _punchEmployee = null;
  _punchAction = null;
  _punchActionTime = null;
  _punchErrMessage = "";
  _punchState = "keypad";
  renderPage();
}

// Reset complet (alias plus expressif pour les confirmation screens)
function punchReset() {
  if (_punchAutoResetTimer) { clearTimeout(_punchAutoResetTimer); _punchAutoResetTimer = null; }
  punchBackToKeypad();
}

// ─ Action principale : enregistrer le punch ───────────────
async function punchDoAction(action) {
  const emp = _punchEmployee;
  if (!emp) return punchBackToKeypad();

  // ⚠ GARDE-FOU CRITIQUE (v3.17.3) — Un punch ne peut JAMAIS être enregistré
  // sur un jour autre que la journée courante (locale). On recalcule la date
  // au tout dernier moment (juste avant le write Firestore) pour éviter qu'un
  // dayKey calculé plus tôt dans la session puisse glisser. La fonction
  // dayKey() utilise désormais la date locale (fix v3.17.3), donc tant qu'on
  // l'appelle avec `new Date()`, on est sûr de pointer le bon jour.
  const now = new Date();
  const dk = dayKey(now);

  // Sanity check : le dk doit correspondre exactement au jour local courant.
  // (Si jamais quelqu'un modifie dayKey() à l'avenir et le casse, on le voit.)
  const expectedDk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dk !== expectedDk) {
    console.error(`Punch refusé : dayKey(${dk}) ≠ jour local courant (${expectedDk}).`);
    _punchErrMessage = t("punch_err_internal");
    _punchState = "error";
    renderPage();
    _punchAutoResetTimer = setTimeout(punchReset, 3000);
    return;
  }

  const nowHHMM = _punchNowHHMM();
  _punchActionTime = nowHHMM;

  // ─ Quart de nuit (fix passage de minuit) ────────────────
  // Si l'employé pointe SORTIE le matin SANS entrée aujourd'hui, et qu'un quart
  // est resté OUVERT la veille (entrée sans sortie), on ferme ce quart-là sur
  // la VEILLE au lieu de créer une sortie orpheline aujourd'hui. _punchClose-
  // OvernightShift vérifie l'heure (avant 10:00), la durée plausible (≤ 12h) et
  // gère le doc payroll de la semaine précédente (nuit dim→lun).
  if (action === "sortie") {
    const todayShift = _punchGetTodayShift(emp.id, dk);
    const hasStartToday = !!(todayShift && todayShift.start);
    if (!hasStartToday && now.getHours() < PUNCH_OVERNIGHT_CUTOFF_HOUR) {
      try {
        const yDate = new Date(now); yDate.setDate(yDate.getDate() - 1);
        const closed = await _punchCloseOvernightShift(emp, yDate, nowHHMM);
        if (closed) {
          _punchAction = "sortie";
          _punchState = "confirmed";
          renderPage();
          _punchAutoResetTimer = setTimeout(punchReset, 1800);
          return;
        }
      } catch (err) {
        console.error("Overnight close failed:", err);
        // On retombe sur le comportement normal (sortie sur aujourd'hui).
      }
    }
  }

  // Map action → champ Firestore (v3.20.0 : on n'a plus que entree/sortie,
  // l'ancienne action "override-sortie" est retirée — les 2 boutons sont
  // toujours visibles donc l'admin/employé peut juste re-cliquer SORTIE).
  let field;
  let displayAction;
  if (action === "entree") {
    field = "start";
    displayAction = "entree";
  } else if (action === "sortie") {
    field = "end";
    displayAction = "sortie";
  } else {
    return; // unknown
  }

  try {
    // Réutilise updateActualShift de pages-payroll.js — il gère déjà le
    // pattern read-then-write (start+end ensemble) pour ne rien effacer.
    // L'offset 0 = semaine courante, ce qui est correct pour un punch « now ».
    // Si payrollWeekOffset est sur une autre semaine (admin l'a navigué), on
    // force temporairement à 0 pour cette opération.
    const savedOffset = payrollWeekOffset;
    payrollWeekOffset = 0;
    await updateActualShift(emp.id, dk, field, nowHHMM);
    payrollWeekOffset = savedOffset;

    _punchAction = displayAction;
    _punchState = "confirmed";
    // Délai court (1,8 s) pour fluidifier les changements d'employé pendant un
    // rush — l'écran de confirmation reste visible le temps qu'on lise « Marie,
    // entrée à 17:32 » puis retour auto au keypad pour le suivant.
    renderPage();
    _punchAutoResetTimer = setTimeout(punchReset, 1800);
  } catch (err) {
    console.error("Punch failed:", err);
    _punchErrMessage = t("punch_err_save");
    _punchState = "error";
    renderPage();
    _punchAutoResetTimer = setTimeout(punchReset, 2500);
  }
}

// ─ Live clock + écouteur clavier physique ─────────────────
// Appelé par sidebar.js après chaque render de la page pointage. Idempotent :
// nettoie son interval précédent à chaque appel pour éviter l'accumulation.
let _punchClockInterval = null;
let _punchKeyboardHandler = null;

function initPunchKeypad() {
  // 1. Live clock — actualisation toutes les 1s, sans re-render complet (juste
  //    le texte de l'horloge — pas de saute visuelle, pas de perte de focus).
  if (_punchClockInterval) clearInterval(_punchClockInterval);
  _punchClockInterval = setInterval(() => {
    const clockEl = document.getElementById("punch-live-clock");
    if (clockEl) clockEl.textContent = _punchNowFull();
    // Si on a navigé hors de la page pointage, on stoppe l'interval
    if (!clockEl && activePage !== "pointage") {
      clearInterval(_punchClockInterval);
      _punchClockInterval = null;
    }
  }, 1000);

  // 2. Clavier physique : digits + Backspace + Enter + Escape
  if (_punchKeyboardHandler) {
    document.removeEventListener("keydown", _punchKeyboardHandler);
  }
  _punchKeyboardHandler = (e) => {
    if (activePage !== "pointage") return;
    if (_punchState !== "keypad") {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        punchReset();
      }
      return;
    }
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      punchKeyDigit(e.key);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      punchKeyClear();
    } else if (e.key === "Enter") {
      e.preventDefault();
      punchKeyOk();
    } else if (e.key === "Escape") {
      e.preventDefault();
      _punchPin = "";
      renderPage();
    }
  };
  document.addEventListener("keydown", _punchKeyboardHandler);
}
