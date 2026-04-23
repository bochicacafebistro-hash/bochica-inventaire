// ── Session ───────────────────────────────────────────
function restoreSession() {
  const saved = localStorage.getItem("bochica-session");
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    if (parsed.role === "admin") {
      isAdmin = true; isLoggedIn = true;
      loggedInUser = parsed.user || null; // { id, name, role }
      activePage = "dashboard"; // Page d'accueil admin par défaut
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-shell").style.display = "block";
      buildSidebar(); renderPage(); autoApplyFixedExpenses();
      return true;
    } else if (parsed.role === "employe") {
      isAdmin = false; isLoggedIn = true;
      loggedInUser = parsed.user || null;
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-shell").style.display = "block";
      buildSidebar(); renderPage(); autoApplyFixedExpenses();
      return true;
    }
  } catch {
    // Compat legacy : ancien format string
    if (saved === "admin") {
      isAdmin = true; isLoggedIn = true;
      activePage = "dashboard";
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-shell").style.display = "block";
      buildSidebar(); renderPage(); autoApplyFixedExpenses();
      return true;
    } else if (saved === "employe") {
      isAdmin = false; isLoggedIn = true;
      document.getElementById("login-screen").style.display = "none";
      document.getElementById("app-shell").style.display = "block";
      buildSidebar(); renderPage(); autoApplyFixedExpenses();
      return true;
    }
  }
  return false;
}

// ── Login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").innerHTML = `
  <div style="min-height:100vh;background:linear-gradient(135deg,#0a0907 0%,#14110f 60%,#2a1f0a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative">
    <!-- Bouton de langue en haut à droite -->
    <button onclick="toggleUILang()" style="position:absolute;top:18px;right:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#f5f1e8;padding:8px 14px;border-radius:var(--radius-pill);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:13px;letter-spacing:1px;backdrop-filter:blur(6px)">${getUILang().toUpperCase()} → ${getUILang() === "fr" ? "ES" : "FR"}</button>
    <div style="margin-bottom:28px;text-align:center">
      <div style="font-family:var(--font-heading);font-weight:400;font-size:52px;letter-spacing:4px;color:#f5f1e8;line-height:1">BOCHI<span style="color:var(--yellow)">CA</span></div>
      <div style="font-family:var(--font-mono);font-size:11px;color:rgba(245,241,232,0.6);letter-spacing:2.5px;margin-top:8px;text-transform:uppercase;font-weight:500">${t("login_subtitle")}</div>
      <div style="display:flex;height:3px;width:170px;margin:12px auto 0" aria-hidden="true">
        <div style="flex:1;background:var(--yellow)"></div>
        <div style="flex:1;background:var(--blue)"></div>
        <div style="flex:1;background:var(--red)"></div>
      </div>
    </div>
    <div style="background:var(--surface);border-radius:var(--radius-xl);padding:28px;width:100%;max-width:320px;box-shadow:var(--shadow-modal)">
      <h2 style="font-family:var(--font-heading);text-align:center;color:var(--text);font-size:20px;margin-bottom:4px;font-weight:700;letter-spacing:-.3px">${t("login_title")}</h2>
      <p style="text-align:center;color:var(--text3);font-size:12px;margin-bottom:20px;font-family:var(--font-body)">${t("login_pin_prompt")}</p>
      <form class="pin-pad" onsubmit="event.preventDefault()" aria-label="${t("login_pin_label")}">
        <div class="pin-display" role="status" aria-live="polite" aria-label="${t("login_pin_dots_label")}">
          <div class="pin-dot" id="dot0"></div>
          <div class="pin-dot" id="dot1"></div>
          <div class="pin-dot" id="dot2"></div>
          <div class="pin-dot" id="dot3"></div>
        </div>
        <div class="pin-error" id="pin-error" role="alert" aria-live="assertive"></div>
        <div class="pin-grid">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" class="pin-btn" onclick="pinPress('${n}')" aria-label="${t("digit")} ${n}">${n}</button>`).join("")}
          <button type="button" class="pin-btn" onclick="pinClear()" style="font-size:11px" aria-label="${t("login_clear")}">${t("login_clear")}</button>
          <button type="button" class="pin-btn" onclick="pinPress('0')" aria-label="${t("digit")} 0">0</button>
          <button type="button" class="pin-btn" onclick="pinBackspace()" style="font-size:16px" aria-label="Backspace">⌫</button>
        </div>
        <p style="text-align:center;color:var(--text3);font-size:11px;margin-top:14px;font-family:var(--font-body)">${t("login_keyboard_hint")}</p>
      </form>
    </div>
  </div>`;
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
  // Focus sur le premier bouton pour navigation clavier
  setTimeout(() => {
    const firstBtn = document.querySelector(".pin-btn");
    if (firstBtn) firstBtn.focus();
  }, 50);
}

// ── Saisie clavier pour le PIN (accessibilité) ────────
document.addEventListener("keydown", (e) => {
  // Actif seulement si l'écran de login est affiché
  const loginScreen = document.getElementById("login-screen");
  if (!loginScreen || loginScreen.style.display === "none") return;
  // Ignorer si focus dans un input/textarea
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (e.key >= "0" && e.key <= "9") {
    e.preventDefault();
    pinPress(e.key);
  } else if (e.key === "Backspace") {
    e.preventDefault();
    pinBackspace();
  } else if (e.key === "Escape" || e.key === "Delete") {
    e.preventDefault();
    pinClear();
  }
});

function logout() {
  isAdmin = false; isLoggedIn = false; pinBuffer = "";
  loggedInUser = null;
  localStorage.removeItem("bochica-session");
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("login-screen").style.display = "block";
  showLogin();
}

function pinPress(d) { if (pinBuffer.length >= 4) return; pinBuffer += d; updatePinDots(); if (pinBuffer.length === 4) checkPin(); }
function pinClear() { pinBuffer = ""; updatePinDots(); }
function pinBackspace() { pinBuffer = pinBuffer.slice(0, -1); updatePinDots(); }

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById("dot" + i);
    if (d) d.classList.toggle("filled", i < pinBuffer.length);
  }
}

function checkPin() {
  // 1. Admin PIN par défaut (super-admin)
  if (pinBuffer === ADMIN_PIN) {
    loginAs({ role: "admin", user: { id: "_super_admin", name: "Admin", role: "admin" } });
    return;
  }
  // 2. Vérifier les PINs individuels des employés
  const emp = (employees || []).find(e => e.pin && String(e.pin).trim() === pinBuffer);
  if (emp) {
    const isAdminEmp = (emp.role || "").toLowerCase().includes("admin");
    loginAs({ role: isAdminEmp ? "admin" : "employe", user: { id: emp.id, name: emp.name, role: emp.role || "Employé" } });
    return;
  }
  // 3. PIN employé partagé legacy (compat)
  if (pinBuffer === EMPLOYEE_PIN) {
    loginAs({ role: "employe", user: { id: "_shared_employee", name: t("role_employee"), role: "Employé" } });
    return;
  }
  // 4. PIN incorrect
  const e = document.getElementById("pin-error");
  if (e) e.textContent = t("login_wrong_pin");
  pinBuffer = ""; updatePinDots();
}

function loginAs(payload) {
  isAdmin = payload.role === "admin";
  isLoggedIn = true;
  loggedInUser = payload.user;
  if (isAdmin) activePage = "dashboard"; // Admin → dashboard, Employé → garde activePage par défaut
  localStorage.setItem("bochica-session", JSON.stringify(payload));
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "block";
  buildSidebar(); renderPage(); autoApplyFixedExpenses();
}

// ── Ancienne fonction de checkPin (split en deux pour clarté) ────
function checkPinLegacyREPLACED() {
  if (pinBuffer === ADMIN_PIN) {
    isAdmin = true; isLoggedIn = true;
    localStorage.setItem("bochica-session", "admin");
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    buildSidebar(); renderPage(); autoApplyFixedExpenses();
  } else if (pinBuffer === EMPLOYEE_PIN) {
    isAdmin = false; isLoggedIn = true;
    localStorage.setItem("bochica-session", "employe");
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    buildSidebar(); renderPage(); autoApplyFixedExpenses();
  } else {
    const e = document.getElementById("pin-error");
    if (e) e.textContent = t("login_wrong_pin");
    pinBuffer = ""; updatePinDots();
  }
}
