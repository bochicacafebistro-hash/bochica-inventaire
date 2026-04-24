// ═══════════════════════════════════════════════════════════════
// AUTHENTIFICATION — username + password avec hash SHA-256
// Remplace l'ancien système de PIN à 4 chiffres
// ═══════════════════════════════════════════════════════════════

// ── Session persistante ───────────────────────────────
function restoreSession() {
  const saved = localStorage.getItem("bochica-session");
  if (!saved) return false;
  try {
    const parsed = JSON.parse(saved);
    // Nouveau format : { userRole, user: {username, displayName, role} }
    if (parsed && parsed.userRole && ROLE_PERMISSIONS[parsed.userRole]) {
      applyLogin(parsed.userRole, parsed.user || null);
      return true;
    }
    // Format legacy { role: "admin" | "employe" } → mappé sur global_admin / employee
    if (parsed && parsed.role === "admin") {
      applyLogin("global_admin", parsed.user || { name: "Admin", role: "admin" });
      return true;
    }
    if (parsed && parsed.role === "employe") {
      applyLogin("employee", parsed.user || { name: "Employé", role: "Employé" });
      return true;
    }
  } catch {
    // String legacy
    if (saved === "admin") { applyLogin("global_admin", { name: "Admin" }); return true; }
    if (saved === "employe") { applyLogin("employee", { name: "Employé" }); return true; }
  }
  return false;
}

function applyLogin(role, user) {
  userRole = role;
  // Rétrocompat : isAdmin = true pour global_admin ET chef (tous deux peuvent modifier dans leurs sections)
  isAdmin = (role === "global_admin" || role === "chef");
  isLoggedIn = true;
  loggedInUser = user || null;
  activePage = getHomePage();
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app-shell").style.display = "block";
  buildSidebar();
  renderPage();
  if (role === "global_admin" && typeof autoApplyFixedExpenses === "function") {
    autoApplyFixedExpenses();
  }
}

// ── Écran de login ────────────────────────────────────
function showLogin() {
  document.getElementById("login-screen").innerHTML = `
  <div class="login-bg">
    <button class="login-lang-btn" onclick="toggleUILang()" type="button">
      ${getUILang().toUpperCase()} → ${getUILang() === "fr" ? "ES" : "FR"}
    </button>

    <div class="login-brand">
      <div class="login-logo">BOCHI<span>CA</span></div>
      <div class="login-tagline">${t("login_subtitle") || "Gestion interne"}</div>
    </div>

    <form class="login-card" onsubmit="submitLogin(event)" autocomplete="off">
      <h2 class="login-title">${t("login_title") || "Connexion"}</h2>
      <p class="login-prompt">Entrez votre nom d'utilisateur et mot de passe</p>

      <label class="login-field">
        <span class="login-label">Nom d'utilisateur</span>
        <input type="text" id="login-username" autocomplete="username" required autofocus
               placeholder="ex: Bochica" spellcheck="false" autocapitalize="none"/>
      </label>

      <label class="login-field">
        <span class="login-label">Mot de passe</span>
        <div class="login-password-wrap">
          <input type="password" id="login-password" autocomplete="current-password" required placeholder="••••••••"/>
          <button type="button" class="login-toggle-pw" onclick="toggleLoginPasswordVisibility()" aria-label="Afficher/masquer le mot de passe" title="Afficher/masquer">
            ${icon("eye", 16)}
          </button>
        </div>
      </label>

      <div class="login-error" id="login-error" role="alert" aria-live="assertive"></div>

      <button type="submit" class="login-submit" id="login-submit">
        ${icon("log-out", 14, "")} <span>Se connecter</span>
      </button>
    </form>
  </div>`;
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("app-shell").style.display = "none";
}

function toggleLoginPasswordVisibility() {
  const input = document.getElementById("login-password");
  const btn = document.querySelector(".login-toggle-pw");
  if (!input || !btn) return;
  if (input.type === "password") {
    input.type = "text";
    btn.innerHTML = icon("eye-off", 16);
  } else {
    input.type = "password";
    btn.innerHTML = icon("eye", 16);
  }
}

async function submitLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");

  if (!username || !password) {
    if (errEl) errEl.textContent = "Veuillez remplir les deux champs.";
    return;
  }

  // Désactiver le bouton pendant la vérification
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Vérification...</span>`;
  }
  if (errEl) errEl.textContent = "";

  try {
    const account = await verifyLogin(username, password);
    if (!account) {
      if (errEl) errEl.textContent = "Nom d'utilisateur ou mot de passe incorrect.";
      // Vider le mot de passe, garder le nom d'utilisateur
      const pwInput = document.getElementById("login-password");
      if (pwInput) { pwInput.value = ""; pwInput.focus(); }
      return;
    }
    const payload = {
      userRole: account.role,
      user: {
        id: account.username,
        name: account.displayName,
        role: account.role,
        username: account.username
      }
    };
    localStorage.setItem("bochica-session", JSON.stringify(payload));
    applyLogin(account.role, payload.user);
  } catch (err) {
    console.error("Login error:", err);
    if (errEl) errEl.textContent = "Erreur technique. Réessayez.";
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon("log-out", 14, "")} <span>Se connecter</span>`;
    }
  }
}

// ── Déconnexion ───────────────────────────────────────
function logout() {
  userRole = null;
  isAdmin = false;
  isLoggedIn = false;
  loggedInUser = null;
  localStorage.removeItem("bochica-session");
  document.getElementById("app-shell").style.display = "none";
  document.getElementById("login-screen").style.display = "block";
  showLogin();
}
