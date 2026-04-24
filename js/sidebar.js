// ── Sidebar & Navigation ──────────────────────────────
function buildSidebar() {
  const nav = document.getElementById("sidebar-nav"); if (!nav) return;

  // Menu complet avec sections — filtré ensuite selon le rôle via canAccess()
  const fullNav = [
    { icon: "bar-chart", label: t("nav_dashboard"), page: "dashboard" },
    { section: t("nav_section_inventory") },
    { icon: "package", label: t("nav_inventaire"), page: "inventaire" },
    { icon: "cart", label: t("nav_to_order"), page: "rapport" },
    { icon: "history", label: t("nav_history"), page: "historique" },
    { section: t("nav_section_dashboard") },
    { icon: "clipboard", label: t("nav_tasks"), page: "taches" },
    { icon: "users", label: t("nav_employees"), page: "employes" },
    { icon: "wallet", label: t("nav_expenses"), page: "depenses" },
    { icon: "shield-check", label: "TPS/TVQ", page: "taxes" },
    { icon: "utensils", label: t("nav_menu"), page: "menu" },
    { icon: "tag", label: t("nav_ingredients"), page: "ingredients" },
    { icon: "file-text", label: t("nav_recipes"), page: "recettes" },
    { section: t("nav_section_management") },
    { icon: "store", label: t("nav_suppliers"), page: "fournisseurs" },
  ];

  // Filtrer par permission : on garde les items dont la page est autorisée,
  // et les sections seulement si au moins un item après elles est autorisé.
  const filtered = [];
  fullNav.forEach((item, i) => {
    if (item.section) {
      // Ne pas ajouter la section tout de suite, on décidera après avoir vu ses enfants
      filtered.push({ ...item, _isSection: true });
    } else if (canAccess(item.page)) {
      filtered.push(item);
    }
  });
  // Retirer les sections vides (suivies d'une autre section ou de rien)
  const items = filtered.filter((item, i) => {
    if (!item._isSection) return true;
    // Chercher le prochain item non-section
    for (let j = i + 1; j < filtered.length; j++) {
      if (!filtered[j]._isSection) return true; // il y a au moins un item après
      if (filtered[j]._isSection) break; // section suivante → section actuelle vide
    }
    return false;
  });
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item ${activePage === item.page ? "active" : ""}" onclick="navTo('${item.page}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navTo('${item.page}')}">
      <span class="icon">${icon(item.icon, 18)}</span>
      <span>${item.label}</span>
    </div>`;
  }).join("");
  // Rôle utilisateur avec icône + nom
  const roleEl = document.getElementById("topbar-role");
  if (roleEl) {
    const roleIconMap = { global_admin: "crown", chef: "utensils", employee: "user" };
    const roleIcon = roleIconMap[userRole] || "user";
    const roleLabelMap = {
      global_admin: t("role_admin") || "Admin",
      chef: "Chef",
      employee: t("role_employee") || "Employé"
    };
    const roleLabel = roleLabelMap[userRole] || "";
    const userName = (loggedInUser && loggedInUser.name) ? ` · ${esc(loggedInUser.name)}` : "";
    roleEl.innerHTML = `<span class="icon-inline">${icon(roleIcon, 14)} ${roleLabel}${userName}</span>`;
  }
  // Mettre à jour les boutons sidebar (dark + logout + lang)
  const darkBtn = document.getElementById("dark-btn");
  if (darkBtn) {
    darkBtn.setAttribute("aria-label", darkMode ? t("toggle_light") : t("toggle_dark"));
    darkBtn.setAttribute("title", darkMode ? t("toggle_light") : t("toggle_dark"));
  }
  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.innerHTML = icon("log-out", 14) + ` <span>${t("logout")}</span>`;
    logoutBtn.setAttribute("aria-label", t("logout"));
  }
  // Bouton de langue (FR/ES)
  const langBtn = document.getElementById("lang-btn");
  if (langBtn) {
    const cur = getUILang();
    langBtn.innerHTML = `<strong>${cur.toUpperCase()}</strong>`;
    langBtn.setAttribute("aria-label", t("language"));
    langBtn.setAttribute("title", cur === "fr" ? "Français → Español" : "Español → Français");
  }
}

// Bascule la langue de l'interface
function toggleUILang() {
  setUILang(getUILang() === "fr" ? "es" : "fr");
}

function navTo(page) {
  // Garde-fou : si le rôle n'a pas accès à cette page, on redirige à l'accueil
  if (!canAccess(page)) {
    page = getHomePage();
  }
  activePage = page; searchQuery = "";
  buildSidebar(); renderPage();
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("mobile-open");
  }
}

// Retour à l'accueil : selon le rôle
function goHome() {
  navTo(getHomePage());
}

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.toggle("mobile-open");
  } else {
    sidebarOpen = !sidebarOpen;
    document.getElementById("sidebar").classList.toggle("hidden", !sidebarOpen);
    document.getElementById("main-area").classList.toggle("full", !sidebarOpen);
  }
}

// ── Rendu principal ───────────────────────────────────
function renderPage() {
  const pageMeta = {
    dashboard:   { label: t("nav_dashboard"),   icon: "bar-chart" },
    inventaire:  { label: t("nav_inventaire"),  icon: "package" },
    historique:  { label: t("nav_history"),     icon: "history" },
    taches:      { label: t("nav_tasks"),       icon: "clipboard" },
    employes:    { label: t("nav_employees"),   icon: "users" },
    depenses:    { label: t("nav_expenses"),    icon: "wallet" },
    taxes:       { label: "TPS/TVQ",            icon: "shield-check" },
    menu:        { label: t("nav_menu"),        icon: "utensils" },
    ingredients: { label: t("nav_ingredients"), icon: "tag" },
    recettes:    { label: t("nav_recipes"),     icon: "file-text" },
    fournisseurs:{ label: t("nav_suppliers"),   icon: "store" },
    rapport:     { label: t("nav_to_order"),    icon: "cart" }
  };
  const meta = pageMeta[activePage] || { label: activePage, icon: "file-text" };
  const titleEl = document.getElementById("topbar-title");
  if (titleEl) titleEl.innerHTML = `<span class="icon-inline" style="gap:10px">${icon(meta.icon, 22)} ${meta.label}</span>`;

  const lowCount = products.filter(p => !p.archived && ["red", "yellow"].includes(getStatus(p))).length;
  const al = document.getElementById("topbar-alert");
  if (al) {
    const ariaLabel = `${lowCount} ${t("stock_products").toLowerCase()} ${t("nav_to_order").toLowerCase()}`;
    if (lowCount > 0 && isAdmin) {
      // Admin : alerte cliquable qui ouvre la page À commander
      al.innerHTML = `<button class="alert-pill alert-pill-btn" onclick="navTo('rapport')" aria-label="${ariaLabel}" title="${t("nav_to_order")}">${icon("alert", 14)} ${lowCount}</button>`;
    } else if (lowCount > 0) {
      // Employé : juste l'indicateur (pas d'accès à la page rapport)
      al.innerHTML = `<div class="alert-pill" aria-label="${ariaLabel}">${icon("alert", 14)} ${lowCount}</div>`;
    } else {
      al.innerHTML = "";
    }
  }
  const pc = document.getElementById("page-content"); if (!pc) return;
  // Blocage final : si rôle sans accès à la page courante, message d'erreur
  if (!canAccess(activePage)) {
    pc.innerHTML = `<div class="page"><div class="empty">
      <div style="margin-bottom:12px;color:var(--text3);display:flex;justify-content:center">${icon("alert", 36)}</div>
      Accès non autorisé pour votre rôle. <br/>
      <button class="btn btn-primary" style="margin-top:16px" onclick="goHome()">Retour à l'accueil</button>
    </div></div>`;
    return;
  }
  if (activePage === "dashboard") pc.innerHTML = renderDashboard();
  else if (activePage === "inventaire") pc.innerHTML = renderInventaire();
  else if (activePage === "rapport") pc.innerHTML = renderRapport();
  else if (activePage === "historique") pc.innerHTML = renderHistorique();
  else if (activePage === "taches") pc.innerHTML = renderTaches();
  else if (activePage === "employes") pc.innerHTML = renderEmployes();
  else if (activePage === "depenses") {
    pc.innerHTML = renderDepenses();
    setTimeout(() => { if (typeof initExpenseCharts === "function") initExpenseCharts(); }, 50);
  }
  else if (activePage === "taxes") pc.innerHTML = renderTaxes();
  else if (activePage === "menu") pc.innerHTML = renderMenu();
  else if (activePage === "ingredients") pc.innerHTML = renderIngredients();
  else if (activePage === "recettes") pc.innerHTML = renderRecettes();
  else if (activePage === "fournisseurs") pc.innerHTML = renderFournisseurs();
  else pc.innerHTML = `<div class="page"><div class="empty">Page introuvable.</div></div>`;
}
