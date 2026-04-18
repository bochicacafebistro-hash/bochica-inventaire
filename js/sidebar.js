// ── Sidebar & Navigation ──────────────────────────────
function buildSidebar() {
  const nav = document.getElementById("sidebar-nav"); if (!nav) return;
  const employeeNav = [
    { icon: "package", label: t("nav_inventaire"), page: "inventaire" },
    { icon: "clipboard", label: t("nav_my_tasks"), page: "taches" }
  ];
  const adminNav = [
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
  const items = isAdmin ? adminNav : employeeNav;
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item ${activePage === item.page ? "active" : ""}" onclick="navTo('${item.page}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navTo('${item.page}')}">
      <span class="icon">${icon(item.icon, 18)}</span>
      <span>${item.label}</span>
    </div>`;
  }).join("");
  // Rôle utilisateur avec icône + nom si disponible
  const roleEl = document.getElementById("topbar-role");
  if (roleEl) {
    const roleIcon = isAdmin ? "crown" : "user";
    const roleLabel = isAdmin ? t("role_admin") : t("role_employee");
    const userName = (loggedInUser && loggedInUser.name && loggedInUser.id !== "_super_admin" && loggedInUser.id !== "_shared_employee")
      ? ` · ${esc(loggedInUser.name)}`
      : "";
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
  activePage = page; searchQuery = "";
  buildSidebar(); renderPage();
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("mobile-open");
  }
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
  if (activePage === "dashboard" && isAdmin) pc.innerHTML = renderDashboard();
  else if (activePage === "inventaire") pc.innerHTML = renderInventaire();
  else if (activePage === "rapport") pc.innerHTML = renderRapport();
  else if (activePage === "historique" && isAdmin) pc.innerHTML = renderHistorique();
  else if (activePage === "taches") pc.innerHTML = renderTaches();
  else if (activePage === "employes" && isAdmin) pc.innerHTML = renderEmployes();
  else if (activePage === "depenses" && isAdmin) {
    pc.innerHTML = renderDepenses();
    // Initialiser les graphiques Chart.js après le rendu
    setTimeout(() => { if (typeof initExpenseCharts === "function") initExpenseCharts(); }, 50);
  }
  else if (activePage === "taxes" && isAdmin) pc.innerHTML = renderTaxes();
  else if (activePage === "menu" && isAdmin) pc.innerHTML = renderMenu();
  else if (activePage === "ingredients" && isAdmin) pc.innerHTML = renderIngredients();
  else if (activePage === "recettes" && isAdmin) pc.innerHTML = renderRecettes();
  else if (activePage === "fournisseurs") pc.innerHTML = renderFournisseurs();
  else pc.innerHTML = `<div class="page"><div class="empty">Accès non autorisé.</div></div>`;
}
