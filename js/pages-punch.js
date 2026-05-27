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
  return new Date().toLocaleDateString("fr-CA", {
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

  return `<div class="page page--wide page--punch">
    <div class="punch-screen">
      <div class="punch-clock-row">
        <div class="punch-clock" id="punch-live-clock">${_punchNowFull()}</div>
        <div class="punch-date">${_punchDateLong()}</div>
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
    <h1 class="punch-title">${icon("clock", 32)} Pointage</h1>
    <p class="punch-subtitle">Entrez votre PIN à 4 chiffres pour marquer votre entrée ou sortie</p>
    <div class="punch-pin-dots" aria-label="${_punchPin.length} chiffres saisis sur 4">${dots}</div>
    <div class="punch-keypad" role="group" aria-label="Clavier numérique">
      ${keys.map(k => {
        if (k.type === "clear") return `<button class="punch-key punch-key--clear" onclick="punchKeyClear()" aria-label="Effacer">${icon("arrow-left", 28)}</button>`;
        if (k.type === "ok")    return `<button class="punch-key punch-key--ok" onclick="punchKeyOk()" aria-label="Valider" ${_punchPin.length === 4 ? "" : "disabled"}>${icon("check", 28)}</button>`;
        return `<button class="punch-key punch-key--digit" onclick="punchKeyDigit('${k.v}')" aria-label="${k.v}">${k.v}</button>`;
      }).join("")}
    </div>
    <p class="punch-hint">L'admin configure ton PIN dans <strong>Employés &amp; Horaires</strong> → ta fiche.</p>
  </div>`;
}

// ─ Écran 2 : confirmation employé + bouton ENTRÉE ou SORTIE ─
function renderPunchEmployeeHTML() {
  const emp = _punchEmployee;
  if (!emp) return renderPunchKeypadHTML();

  const dk = dayKey(new Date());
  const todayShift = _punchGetTodayShift(emp.id, dk);
  const hasStart = !!(todayShift && todayShift.start);
  const hasEnd = !!(todayShift && todayShift.end);

  // Détection auto de l'action
  let mainAction, mainLabel, mainIcon, mainCls, sub;
  if (!hasStart) {
    mainAction = "entree";
    mainLabel = "ENTRÉE";
    mainIcon = "log-in";
    mainCls = "is-entree";
    sub = "Marque ton début de quart de travail";
  } else if (!hasEnd) {
    mainAction = "sortie";
    mainLabel = "SORTIE";
    mainIcon = "log-out";
    mainCls = "is-sortie";
    sub = `Tu as pointé ton entrée à <strong>${todayShift.start}</strong> aujourd'hui — marque ta sortie`;
  } else {
    // Les deux ont déjà été pointés → bloquer mais offrir d'écraser la sortie
    mainAction = "override-sortie";
    mainLabel = "METTRE À JOUR LA SORTIE";
    mainIcon = "log-out";
    mainCls = "is-override";
    sub = `Tu as déjà pointé : entrée <strong>${todayShift.start}</strong>, sortie <strong>${todayShift.end}</strong>. Cliquer pour remplacer la sortie par l'heure actuelle.`;
  }

  const groupBadge = (emp.section || "service") === "cuisine"
    ? `<span class="punch-emp-section punch-emp-section--cuisine">${icon("utensils", 12)} Cuisine</span>`
    : `<span class="punch-emp-section punch-emp-section--service">${icon("users", 12)} Service</span>`;

  return `<div class="punch-employee-screen">
    <button class="punch-back-btn" onclick="punchBackToKeypad()" aria-label="Retour">${icon("arrow-left", 18)} Pas moi</button>
    <div class="punch-greeting">
      <div class="punch-greeting-hello">Bonjour</div>
      <div class="punch-greeting-name">${esc(emp.name || "")}</div>
      ${groupBadge}
    </div>
    <button class="punch-main-btn ${mainCls}" onclick="punchDoAction('${mainAction}')">
      ${icon(mainIcon, 48)}
      <span class="punch-main-btn-label">${mainLabel}</span>
      <span class="punch-main-btn-time">${_punchNowHHMM()}</span>
    </button>
    <p class="punch-action-sub">${sub}</p>
  </div>`;
}

// ─ Écran 3 : confirmation post-punch (3s) ─────────────────
function renderPunchConfirmedHTML() {
  const emp = _punchEmployee;
  const actLabel = _punchAction === "entree" ? "ENTRÉE" : "SORTIE";
  const actCls = _punchAction === "entree" ? "is-entree" : "is-sortie";
  const actIcon = _punchAction === "entree" ? "log-in" : "log-out";
  const wish = _punchAction === "entree"
    ? "Bon shift !"
    : "Bonne soirée et merci !";
  return `<div class="punch-confirmed-screen ${actCls}">
    <div class="punch-confirmed-check">${icon("check", 96)}</div>
    <div class="punch-confirmed-label">${icon(actIcon, 22)} ${actLabel} ENREGISTRÉE</div>
    <div class="punch-confirmed-name">${esc(emp?.name || "")}</div>
    <div class="punch-confirmed-time">à ${_punchActionTime || _punchNowHHMM()}</div>
    <div class="punch-confirmed-wish">${wish}</div>
    <button class="punch-tap-anywhere" onclick="punchReset()">Suivant ${icon("arrow-right", 14)}</button>
  </div>`;
}

// ─ Écran 4 : erreur PIN ───────────────────────────────────
function renderPunchErrorHTML() {
  return `<div class="punch-error-screen">
    <div class="punch-error-icon">${icon("alert", 96)}</div>
    <div class="punch-error-msg">${esc(_punchErrMessage || "PIN non reconnu")}</div>
    <button class="punch-tap-anywhere" onclick="punchReset()">Suivant ${icon("arrow-right", 14)}</button>
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
    toast("Saisis un PIN à 4 chiffres.", "warning");
    return;
  }
  // Match contre la liste des employés
  const emp = (employees || []).find(e => e.pin && String(e.pin).trim() === _punchPin);
  if (!emp) {
    _punchErrMessage = "PIN non reconnu — vérifie avec l'admin.";
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

  const dk = dayKey(new Date());
  const nowHHMM = _punchNowHHMM();
  _punchActionTime = nowHHMM;

  // Map action → champ Firestore
  let field;
  let displayAction;
  if (action === "entree") {
    field = "start";
    displayAction = "entree";
  } else if (action === "sortie") {
    field = "end";
    displayAction = "sortie";
  } else if (action === "override-sortie") {
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
    _punchErrMessage = "Erreur d'enregistrement. Réessaie ou avise l'admin.";
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
