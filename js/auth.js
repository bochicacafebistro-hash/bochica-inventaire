// ── Session ───────────────────────────────────────────
function restoreSession() {
  const saved = localStorage.getItem("bochica-session");
  if (saved === "admin") {
    isAdmin = true; isLoggedIn = true;
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
  return false;
}

// ── Login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").innerHTML = `
  <div style="min-height:100vh;background:linear-gradient(135deg,var(--header-from),var(--accent-soft));display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;position:relative">
    <!-- Bouton de langue en haut à droite -->
    <button onclick="toggleUILang()" style="position:absolute;top:18px;right:18px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#faf6f0;padding:8px 14px;border-radius:var(--radius-pill);font-family:var(--font-body);font-weight:700;cursor:pointer;font-size:13px;letter-spacing:1px;backdrop-filter:blur(6px)">${getUILang().toUpperCase()} → ${getUILang() === "fr" ? "ES" : "FR"}</button>
    <div style="margin-bottom:28px;text-align:center">
      <div style="font-family:var(--font-heading);font-weight:800;font-size:34px;letter-spacing:6px;color:#faf6f0">BOCHI<span style="color:var(--yellow);font-style:italic">CA</span></div>
      <div style="font-family:var(--font-body);font-size:11px;color:rgba(250,246,240,0.6);letter-spacing:2.5px;margin-top:6px;text-transform:uppercase;font-weight:500">${t("login_subtitle")}</div>
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
