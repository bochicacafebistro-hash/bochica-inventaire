// ── Sidebar & Navigation ──────────────────────────────
function buildSidebar() {
  const nav = document.getElementById("sidebar-nav"); if (!nav) return;
  const employeeNav = [
    { icon: "package", label: "Inventaire", page: "inventaire" },
    { icon: "clipboard", label: "Mes tâches", page: "taches" }
  ];
  const adminNav = [
    { section: "INVENTAIRE" },
    { icon: "package", label: "Inventaire", page: "inventaire" },
    { icon: "cart", label: "À commander", page: "rapport" },
    { icon: "history", label: "Historique", page: "historique" },
    { section: "DASHBOARD" },
    { icon: "clipboard", label: "Tâches", page: "taches" },
    { icon: "users", label: "Employés & Horaires", page: "employes" },
    { icon: "wallet", label: "Dépenses", page: "depenses" },
    { icon: "utensils", label: "Menu", page: "menu" },
    { section: "GESTION" },
    { icon: "store", label: "Fournisseurs", page: "fournisseurs" },
  ];
  const items = isAdmin ? adminNav : employeeNav;
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item ${activePage === item.page ? "active" : ""}" onclick="navTo('${item.page}')" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();navTo('${item.page}')}">
      <span class="icon">${icon(item.icon, 18)}</span>
      <span>${item.label}</span>
    </div>`;
  }).join("");
  // Rôle utilisateur avec icône
  const roleEl = document.getElementById("topbar-role");
  if (roleEl) {
    roleEl.innerHTML = isAdmin
      ? `<span class="icon-inline">${icon("crown", 14)} Admin</span>`
      : `<span class="icon-inline">${icon("user", 14)} Employé</span>`;
  }
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
    inventaire:  { label: "Inventaire",          icon: "package" },
    historique:  { label: "Historique",          icon: "history" },
    taches:      { label: "Tâches",              icon: "clipboard" },
    employes:    { label: "Employés & Horaires", icon: "users" },
    depenses:    { label: "Dépenses",            icon: "wallet" },
    menu:        { label: "Menu",                icon: "utensils" },
    fournisseurs:{ label: "Fournisseurs",        icon: "store" },
    rapport:     { label: "À commander",         icon: "cart" }
  };
  const meta = pageMeta[activePage] || { label: activePage, icon: "file-text" };
  const titleEl = document.getElementById("topbar-title");
  if (titleEl) titleEl.innerHTML = `<span class="icon-inline" style="gap:10px">${icon(meta.icon, 22)} ${meta.label}</span>`;

  const lowCount = products.filter(p => !p.archived && ["red", "yellow"].includes(getStatus(p))).length;
  const al = document.getElementById("topbar-alert");
  if (al) {
    if (lowCount > 0 && isAdmin) {
      // Admin : alerte cliquable qui ouvre la page À commander
      al.innerHTML = `<button class="alert-pill alert-pill-btn" onclick="navTo('rapport')" aria-label="Voir les ${lowCount} produit${lowCount > 1 ? "s" : ""} à commander" title="Voir la liste à commander">${icon("alert", 14)} ${lowCount}</button>`;
    } else if (lowCount > 0) {
      // Employé : juste l'indicateur (pas d'accès à la page rapport)
      al.innerHTML = `<div class="alert-pill" aria-label="${lowCount} produit${lowCount > 1 ? "s" : ""} à commander">${icon("alert", 14)} ${lowCount}</div>`;
    } else {
      al.innerHTML = "";
    }
  }
  const pc = document.getElementById("page-content"); if (!pc) return;
  if (activePage === "inventaire") pc.innerHTML = renderInventaire();
  else if (activePage === "rapport") pc.innerHTML = renderRapport();
  else if (activePage === "historique" && isAdmin) pc.innerHTML = renderHistorique();
  else if (activePage === "taches") pc.innerHTML = renderTaches();
  else if (activePage === "employes" && isAdmin) pc.innerHTML = renderEmployes();
  else if (activePage === "depenses" && isAdmin) {
    pc.innerHTML = renderDepenses();
    // Initialiser les graphiques Chart.js après le rendu
    setTimeout(() => { if (typeof initExpenseCharts === "function") initExpenseCharts(); }, 50);
  }
  else if (activePage === "menu" && isAdmin) pc.innerHTML = renderMenu();
  else if (activePage === "fournisseurs") pc.innerHTML = renderFournisseurs();
  else pc.innerHTML = `<div class="page"><div class="empty">Accès non autorisé.</div></div>`;
}
