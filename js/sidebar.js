// ── Sidebar & Navigation ──────────────────────────────
function buildSidebar() {
  const nav = document.getElementById("sidebar-nav"); if (!nav) return;
  const employeeNav = [
    { icon: "📦", label: "Inventaire", page: "inventaire" },
    { icon: "📋", label: "Mes tâches", page: "taches" }
  ];
  const adminNav = [
    { section: "INVENTAIRE" },
    { icon: "📦", label: "Inventaire", page: "inventaire" },
    { icon: "📋", label: "Rapport", page: "rapport" },
    { icon: "🕐", label: "Historique", page: "historique" },
    { section: "DASHBOARD" },
    { icon: "📋", label: "Tâches", page: "taches" },
    { icon: "👥", label: "Employés & Horaires", page: "employes" },
    { icon: "💰", label: "Dépenses", page: "depenses" },
    { icon: "🍽️", label: "Menu", page: "menu" },
    { section: "GESTION" },
    { icon: "🏪", label: "Fournisseurs", page: "fournisseurs" },
  ];
  const items = isAdmin ? adminNav : employeeNav;
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item ${activePage === item.page ? "active" : ""}" onclick="navTo('${item.page}')">
      ${item.icon ? `<span class="icon">${item.icon}</span>` : ""}
      <span>${item.label}</span>
    </div>`;
  }).join("");
  document.getElementById("topbar-role").textContent = isAdmin ? "👑 Admin" : "👤 Employé";
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
  const pageLabels = {
    inventaire: "📦 Inventaire", historique: "📋 Historique",
    taches: "📋 Tâches", employes: "👥 Employés & Horaires",
    depenses: "💰 Dépenses", menu: "🍽️ Menu",
    fournisseurs: "🏪 Fournisseurs", rapport: "📋 Rapport"
  };
  document.getElementById("topbar-title").textContent = pageLabels[activePage] || activePage;
  const lowCount = products.filter(p => !p.archived && ["red", "yellow"].includes(getStatus(p))).length;
  const al = document.getElementById("topbar-alert");
  if (al) al.innerHTML = lowCount > 0 ? `<div class="alert-pill">⚠️ ${lowCount}</div>` : "";
  const pc = document.getElementById("page-content"); if (!pc) return;
  if (activePage === "inventaire") pc.innerHTML = renderInventaire();
  else if (activePage === "rapport") pc.innerHTML = renderRapport();
  else if (activePage === "historique" && isAdmin) pc.innerHTML = renderHistorique();
  else if (activePage === "taches") pc.innerHTML = renderTaches();
  else if (activePage === "employes" && isAdmin) pc.innerHTML = renderEmployes();
  else if (activePage === "depenses" && isAdmin) pc.innerHTML = renderDepenses();
  else if (activePage === "menu" && isAdmin) pc.innerHTML = renderMenu();
  else if (activePage === "fournisseurs") pc.innerHTML = renderFournisseurs();
  else pc.innerHTML = `<div class="page"><div class="empty">Accès non autorisé.</div></div>`;
}
