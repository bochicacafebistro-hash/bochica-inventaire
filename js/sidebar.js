// ── Sidebar & Navigation ──────────────────────────────

// Structure de la navigation — organisée en groupes (accordéons) par domaine.
// Chaque entrée est soit :
//   - { type: "link", icon, label, page } : lien direct (Dashboard, Fournisseurs)
//   - { type: "section", id, icon, label, items: [...] } : accordéon avec sous-items
// L'ordre est important (affichage de haut en bas).
function getNavStructure() {
  return [
    // Vues employé (visibles seulement pour le rôle « employee » via canAccess).
    // Placées en haut : elles forment l'accueil de l'équipe.
    { type: "link", icon: "bar-chart", label: "Accueil", page: "accueil" },
    { type: "link", icon: "clock", label: "Mon horaire", page: "mon-horaire" },
    { type: "link", icon: "bar-chart", label: t("nav_dashboard"), page: "dashboard" },
    {
      type: "section", id: "inventory", icon: "package", label: "Inventaire",
      items: [
        { icon: "package", label: t("nav_inventaire"), page: "inventaire" },
        { icon: "cart", label: t("nav_to_order"), page: "rapport" },
        { icon: "cart", label: "Liste d'ingrédients", page: "shopping" }
      ]
    },
    {
      type: "section", id: "hr", icon: "users", label: "RH & Horaires",
      items: [
        { icon: "users", label: t("nav_employees"), page: "employes" },
        { icon: "dollar-sign", label: t("nav_salaires"), page: "salaires" },
        { icon: "trending-up", label: "Simulation paie", page: "simulations" },
        { icon: "clipboard", label: t("nav_tasks"), page: "taches" }
      ]
    },
    {
      type: "section", id: "kitchen", icon: "utensils", label: "Cuisine",
      items: [
        { icon: "utensils", label: t("nav_menu"), page: "menu" },
        { icon: "tag", label: t("nav_ingredients"), page: "ingredients" },
        { icon: "file-text", label: t("nav_recipes"), page: "recettes" }
      ]
    },
    {
      type: "section", id: "finance", icon: "wallet", label: "Finances",
      items: [
        { icon: "wallet", label: t("nav_expenses"), page: "depenses" },
        { icon: "receipt", label: "Factures", page: "factures" },
        { icon: "shield-check", label: "TPS/TVQ", page: "taxes" },
        { icon: "bar-chart", label: "Rapports mensuels", page: "rapports" }
      ]
    },
    {
      type: "section", id: "clients", icon: "calendar", label: "Clients & Événements",
      items: [
        { icon: "calendar", label: "Événements", page: "evenements" },
        { icon: "receipt", label: "Soumissions", page: "soumissions" }
      ]
    },
    { type: "link", icon: "store", label: t("nav_suppliers"), page: "fournisseurs" },
    // Pointage : visible par tous les rôles. Idéal sur tablette permanente —
    // chaque employé tape juste son PIN pour marquer entrée/sortie.
    { type: "link", icon: "clock", label: "Pointage", page: "pointage" }
  ];
}

// Mapping page → id de section, pour auto-ouvrir la bonne section après une navigation
const PAGE_TO_SECTION = {
  inventaire: "inventory", rapport: "inventory", shopping: "inventory",
  employes: "hr", salaires: "hr", simulations: "hr", taches: "hr",
  menu: "kitchen", ingredients: "kitchen", recettes: "kitchen",
  depenses: "finance", factures: "finance", taxes: "finance", rapports: "finance",
  evenements: "clients", soumissions: "clients"
};

// Auto-ouvre la section contenant cette page (utilisé à navigate + login)
function autoExpandSectionFor(page) {
  const sec = PAGE_TO_SECTION[page];
  if (sec) expandedNavSections.add(sec);
}

// Toggle ouverture/fermeture d'un accordéon
function toggleNavSection(id) {
  if (expandedNavSections.has(id)) expandedNavSections.delete(id);
  else expandedNavSections.add(id);
  buildSidebar();
}

function buildSidebar() {
  const nav = document.getElementById("sidebar-nav"); if (!nav) return;

  // Filtrer la structure selon les permissions du rôle courant.
  // Pour les sections, on filtre les sous-items ; si une section finit avec 0
  // item, on la masque ; si elle finit avec 1 seul item, on le promeut en
  // lien direct (évite un accordéon ouvert pour rien).
  const filtered = getNavStructure().map(g => {
    if (g.type === "link") return canAccess(g.page) ? g : null;
    const items = g.items.filter(it => canAccess(it.page));
    if (items.length === 0) return null;
    if (items.length === 1) {
      // Promouvoir l'item unique en lien direct
      return { type: "link", icon: items[0].icon, label: items[0].label, page: items[0].page };
    }
    return { ...g, items };
  }).filter(Boolean);

  nav.innerHTML = filtered.map(g => {
    if (g.type === "link") {
      return `<div class="nav-item ${activePage === g.page ? "active" : ""}" onclick="navTo('${g.page}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navTo('${g.page}')}">
        <span class="icon">${icon(g.icon, 18)}</span>
        <span>${g.label}</span>
      </div>`;
    }
    // Section accordéon
    const isOpen = expandedNavSections.has(g.id);
    const hasActive = g.items.some(it => it.page === activePage);
    return `<div class="nav-section-wrap ${isOpen ? "is-open" : ""} ${hasActive ? "has-active" : ""}">
      <button class="nav-section-toggle" onclick="toggleNavSection('${g.id}')" aria-expanded="${isOpen}" type="button">
        <span class="icon">${icon(g.icon, 16)}</span>
        <span class="nav-section-label">${g.label}</span>
        <span class="nav-section-chevron">${icon("chevron-right", 14)}</span>
      </button>
      <div class="nav-section-items" role="region">
        ${g.items.map(it => `<div class="nav-item nav-subitem ${activePage === it.page ? "active" : ""}" onclick="navTo('${it.page}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navTo('${it.page}')}">
          <span class="icon">${icon(it.icon, 16)}</span>
          <span>${it.label}</span>
        </div>`).join("")}
      </div>
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
  // v3.28.0 — Pill aperçu rôle : visible uniquement pour le VRAI admin
  const previewPill = document.getElementById("preview-role-pill");
  if (previewPill) {
    const isRealAdmin = _previewActive ? (_realUserRole === "global_admin") : (userRole === "global_admin");
    previewPill.style.display = isRealAdmin ? "flex" : "none";
    previewPill.classList.toggle("is-active", _previewActive);
    const sel = document.getElementById("preview-role-select");
    if (sel) sel.value = _previewActive ? userRole : "";
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
  // Reset de l'éditeur de simulation à chaque navigation : si l'utilisateur
  // clique sur "Simulation paie" dans la sidebar, il retombe sur la liste.
  // L'éditeur est ouvert seulement par openSimulationEditor (qui ne passe
  // pas par navTo), donc reset systématique sans risque.
  if (typeof _editingSimId !== "undefined") _editingSimId = null;
  activePage = page; searchQuery = "";
  // Auto-ouvrir la section contenant la nouvelle page active (accordéon UX)
  autoExpandSectionFor(page);
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
  // Fermer tout dropdown ouvert avant de re-render (sinon l'élément portaillé
  // dans body deviendrait orphelin quand son parent est remplacé par innerHTML=...)
  if (typeof closeAllDrops === "function" && openDropId) closeAllDrops();
  const pageMeta = {
    accueil:     { label: "Accueil",            icon: "bar-chart" },
    "mon-horaire": { label: "Mon horaire",      icon: "clock" },
    dashboard:   { label: t("nav_dashboard"),   icon: "bar-chart" },
    inventaire:  { label: t("nav_inventaire"),  icon: "package" },
    taches:      { label: t("nav_tasks"),       icon: "clipboard" },
    employes:    { label: t("nav_employees"),   icon: "users" },
    salaires:    { label: t("nav_salaires"),    icon: "dollar-sign" },
    simulations: { label: "Simulation paie",    icon: "trending-up" },
    depenses:    { label: t("nav_expenses"),    icon: "wallet" },
    taxes:       { label: "TPS/TVQ",            icon: "shield-check" },
    rapports:    { label: "Rapports mensuels",  icon: "bar-chart" },
    menu:        { label: t("nav_menu"),        icon: "utensils" },
    ingredients: { label: t("nav_ingredients"), icon: "tag" },
    recettes:    { label: t("nav_recipes"),     icon: "file-text" },
    shopping:    { label: "Liste d'ingrédients", icon: "cart" },
    evenements:  { label: "Événements",         icon: "calendar" },
    soumissions: { label: "Soumissions",        icon: "receipt" },
    fournisseurs:{ label: t("nav_suppliers"),   icon: "store" },
    rapport:     { label: t("nav_to_order"),    icon: "cart" },
    pointage:    { label: "Pointage",           icon: "clock" }
  };
  const meta = pageMeta[activePage] || { label: activePage, icon: "file-text" };
  const titleEl = document.getElementById("topbar-title");
  if (titleEl) titleEl.innerHTML = `<span class="icon-inline" style="gap:10px">${icon(meta.icon, 22)} ${meta.label}</span>`;

  // v3.28.0 — Bandeau aperçu rôle : visible si admin prévisualise
  const previewBanner = document.getElementById("preview-banner");
  const previewMsg = document.getElementById("preview-banner-msg");
  if (previewBanner) {
    if (_previewActive) {
      const roleLabel = userRole === "chef" ? "Chef de cuisine" : "Employé";
      if (previewMsg) previewMsg.innerHTML = `Aperçu actif — tu vois l'app comme un <strong>${roleLabel}</strong>. Les boutons admin sont cachés.`;
      previewBanner.style.display = "flex";
    } else {
      previewBanner.style.display = "none";
    }
  }

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
      <div class="empty-state-icon">${icon("alert", 36)}</div>
      Accès non autorisé pour votre rôle. <br/>
      <button class="btn btn-primary" style="margin-top:16px" onclick="goHome()">Retour à l'accueil</button>
    </div></div>`;
    return;
  }
  if (activePage === "accueil") {
    pc.innerHTML = renderEmployeeDashboard();
  }
  else if (activePage === "mon-horaire") {
    pc.innerHTML = renderEmployeeSchedule();
  }
  else if (activePage === "dashboard") {
    pc.innerHTML = renderDashboard();
    // Init sparklines après l'injection DOM
    setTimeout(() => { if (typeof initDashSparklines === "function") initDashSparklines(); }, 50);
  }
  else if (activePage === "inventaire") pc.innerHTML = renderInventaire();
  else if (activePage === "rapport") pc.innerHTML = renderRapport();
  else if (activePage === "taches") pc.innerHTML = renderTaches();
  else if (activePage === "employes") {
    pc.innerHTML = renderEmployes();
    // Initialiser le graphique de couverture après l'injection du DOM
    setTimeout(() => { if (typeof initCoverageChart === "function") initCoverageChart(); }, 50);
  }
  else if (activePage === "salaires") {
    // S'abonner au doc payroll de la semaine courante (idempotent)
    if (typeof subscribePayrollWeek === "function") subscribePayrollWeek();
    pc.innerHTML = renderSalaires();
  }
  else if (activePage === "simulations") {
    // Si on est en train d'éditer une sim, montrer l'éditeur ; sinon la liste
    if (typeof _editingSimId !== "undefined" && _editingSimId) {
      const sim = (payrollSimulations || []).find(s => s.id === _editingSimId);
      if (sim) {
        pc.innerHTML = renderSimulationEditorHTML(sim);
        // Init du graphique de couverture après injection DOM
        setTimeout(() => { if (typeof initSimCoverageChart === "function") initSimCoverageChart(); }, 50);
      } else {
        _editingSimId = null;
        pc.innerHTML = renderSimulations();
      }
    } else {
      pc.innerHTML = renderSimulations();
    }
  }
  else if (activePage === "depenses") {
    pc.innerHTML = renderDepenses();
    setTimeout(() => { if (typeof initExpenseCharts === "function") initExpenseCharts(); }, 50);
  }
  else if (activePage === "taxes") pc.innerHTML = renderTaxes();
  else if (activePage === "rapports") {
    pc.innerHTML = renderRapports();
    setTimeout(() => { if (typeof initReportsCharts === "function") initReportsCharts(); }, 50);
  }
  else if (activePage === "menu") pc.innerHTML = renderMenu();
  else if (activePage === "ingredients") pc.innerHTML = renderIngredients();
  else if (activePage === "recettes") pc.innerHTML = renderRecettes();
  else if (activePage === "shopping") pc.innerHTML = renderShoppingList();
  else if (activePage === "evenements") pc.innerHTML = renderEvents();
  else if (activePage === "soumissions") pc.innerHTML = renderQuotes();
  else if (activePage === "factures") pc.innerHTML = renderInvoices();
  else if (activePage === "fournisseurs") pc.innerHTML = renderFournisseurs();
  else if (activePage === "pointage") {
    // S'abonner au doc payroll de la semaine courante pour lire l'état des
    // punches existants (savoir si on est en mode entrée ou sortie).
    if (typeof subscribePayrollWeek === "function") subscribePayrollWeek();
    pc.innerHTML = renderPunch();
    // Focus initial sur le premier digit pour clavier physique
    setTimeout(() => { if (typeof initPunchKeypad === "function") initPunchKeypad(); }, 30);
  }
  else pc.innerHTML = `<div class="page"><div class="empty">Page introuvable.</div></div>`;
}
