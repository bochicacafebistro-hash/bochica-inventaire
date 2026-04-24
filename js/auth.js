// ═══════════════════════════════════════════════════════════════
// AUTHENTIFICATION — Firebase Authentication (email+password)
// ───────────────────────────────────────────────────────────────
// Le username saisi (ex: "Bochica") est traduit en email interne
// (ex: bochica@bochica.app) via AUTH_USER_EMAILS puis envoyé à
// firebase.auth().signInWithEmailAndPassword.
// Après connexion, le rôle est lu depuis Firestore /users/{uid}.role.
// Les règles Firestore vérifient request.auth.uid + ce rôle pour
// autoriser/refuser les écritures côté serveur.
// ═══════════════════════════════════════════════════════════════

// Instance Auth Firebase (initialisée après firebase.initializeApp de config.js)
const auth = firebase.auth();
// Persistance : garder la session au-delà du rechargement (navigateur local)
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(err => {
  console.warn("Auth persistence LOCAL indisponible :", err);
});

// ── Bootstrap : appelé une fois au chargement de l'app ────────
// Écoute les changements d'état d'authentification (login/logout,
// restauration de session automatique, expiration de token, etc.)
function initAuth() {
  // Masquer les deux écrans au départ — onAuthStateChanged décidera lequel afficher
  auth.onAuthStateChanged(async (fbUser) => {
    if (!fbUser) {
      // Pas connecté → afficher le login
      userRole = null;
      isAdmin = false;
      isLoggedIn = false;
      loggedInUser = null;
      document.getElementById("app-shell").style.display = "none";
      showLogin();
      return;
    }
    // Connecté → récupérer le rôle depuis Firestore /users/{uid}
    try {
      const doc = await db.collection("users").doc(fbUser.uid).get();
      if (!doc.exists) {
        alert("Ton compte Firebase Auth existe mais n'a pas de rôle attribué dans Firestore.\nContacte l'administrateur.");
        await auth.signOut();
        return;
      }
      const role = doc.data().role;
      if (!ROLE_PERMISSIONS[role]) {
        alert(`Rôle inconnu ou invalide : "${role}". Déconnexion.`);
        await auth.signOut();
        return;
      }
      const displayName = AUTH_DISPLAY_NAMES[fbUser.email] || fbUser.email;
      applyLogin(role, {
        id: fbUser.uid,
        name: displayName,
        role,
        email: fbUser.email
      });
    } catch (err) {
      console.error("Lecture /users/{uid} échouée :", err);
      alert("Impossible de charger ton profil. Vérifie ta connexion.\n\n" + (err.message || err));
      try { await auth.signOut(); } catch (_) {}
    }
  });
}

// ── Application du login (fait basculer l'UI en mode connecté) ─
function applyLogin(role, user) {
  userRole = role;
  // Rétrocompat : isAdmin=true pour global_admin ET chef (peuvent modifier)
  isAdmin = (role === "global_admin" || role === "chef");
  isLoggedIn = true;
  loggedInUser = user;
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

// ── Soumission du formulaire ──────────────────────────
async function submitLogin(event) {
  if (event && event.preventDefault) event.preventDefault();
  const username = (document.getElementById("login-username").value || "").trim().toLowerCase();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");
  const submitBtn = document.getElementById("login-submit");

  if (!username || !password) {
    if (errEl) errEl.textContent = "Veuillez remplir les deux champs.";
    return;
  }

  // Traduire username → email pour Firebase Auth
  const email = AUTH_USER_EMAILS[username];
  if (!email) {
    if (errEl) errEl.textContent = "Nom d'utilisateur ou mot de passe incorrect.";
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Vérification...</span>`;
  }
  if (errEl) errEl.textContent = "";

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged prend le relais et appelle applyLogin
  } catch (err) {
    console.error("Firebase Auth login error:", err);
    if (errEl) {
      // Messages user-friendly selon le code d'erreur Firebase
      const map = {
        "auth/invalid-credential":   "Nom d'utilisateur ou mot de passe incorrect.",
        "auth/wrong-password":        "Nom d'utilisateur ou mot de passe incorrect.",
        "auth/user-not-found":        "Nom d'utilisateur ou mot de passe incorrect.",
        "auth/invalid-email":         "Nom d'utilisateur invalide.",
        "auth/user-disabled":         "Ce compte est désactivé. Contacte l'administrateur.",
        "auth/too-many-requests":     "Trop de tentatives. Réessaie dans quelques minutes.",
        "auth/network-request-failed": "Problème de connexion. Vérifie ton réseau."
      };
      errEl.textContent = map[err.code] || `Erreur : ${err.message || err.code || err}`;
    }
    // Vider le mot de passe, garder le nom d'utilisateur
    const pwInput = document.getElementById("login-password");
    if (pwInput) { pwInput.value = ""; pwInput.focus(); }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${icon("log-out", 14, "")} <span>Se connecter</span>`;
    }
  }
}

// ── Déconnexion ───────────────────────────────────────
async function logout() {
  try {
    await auth.signOut();
    // onAuthStateChanged va déclencher showLogin() automatiquement
  } catch (err) {
    console.error("Logout error:", err);
  }
}

// ── restoreSession — conservé pour compatibilité avec l'ancien appel ──
// Retourne false : laisse initAuth gérer la session via onAuthStateChanged.
function restoreSession() {
  // Nettoyer l'ancien format localStorage (legacy SHA-256) si présent
  try { localStorage.removeItem("bochica-session"); } catch (_) {}
  return false;
}
