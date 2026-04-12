// ── Login ─────────────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").innerHTML = `
  <div style="min-height:100vh;background:linear-gradient(135deg,#1e293b,#334155);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px">
    <div style="margin-bottom:28px;text-align:center">
      <div style="font-weight:900;font-size:32px;letter-spacing:6px;color:#fff">BOCHICA</div>
      <div style="font-size:12px;color:rgba(255,255,255,0.55);letter-spacing:2px;margin-top:4px">Restaurant Colombien</div>
      <div style="display:flex;height:3px;width:170px;margin:10px auto 0">
        <div style="flex:1;background:#f5a623"></div>
        <div style="flex:1;background:#4a90e2"></div>
        <div style="flex:1;background:#e74c3c"></div>
      </div>
    </div>
    <div style="background:var(--surface);border-radius:20px;padding:28px;width:100%;max-width:310px;box-shadow:0 25px 60px rgba(0,0,0,0.3)">
      <h2 style="text-align:center;color:var(--text);font-size:17px;margin-bottom:4px">Connexion</h2>
      <p style="text-align:center;color:var(--text3);font-size:12px;margin-bottom:18px">Entrez votre code PIN</p>
      <div class="pin-pad">
        <div class="pin-display">
          <div class="pin-dot" id="dot0"></div>
          <div class="pin-dot" id="dot1"></div>
          <div class="pin-dot" id="dot2"></div>
          <div class="pin-dot" id="dot3"></div>
        </div>
        <div class="pin-error" id="pin-error"></div>
        <div class="pin-grid">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-btn" onclick="pinPress('${n}')">${n}</button>`).join("")}
          <button class="pin-btn" onclick="pinClear()" style="font-size:11px">Effacer</button>
          <button class="pin-btn" onclick="pinPress('0')">0</button>
          <button class="pin-btn" onclick="pinBackspace()" style="font-size:16px">⌫</button>
        </div>
      </div>
    </div>
  </div>`;
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
}

function logout() {
  isAdmin = false; isLoggedIn = false; pinBuffer = "";
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
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    buildSidebar(); renderPage();
  } else if (pinBuffer === EMPLOYEE_PIN) {
    isAdmin = false; isLoggedIn = true;
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("app-shell").style.display = "block";
    buildSidebar(); renderPage();
  } else {
    const e = document.getElementById("pin-error");
    if (e) e.textContent = "❌ Code PIN incorrect";
    pinBuffer = ""; updatePinDots();
  }
}
