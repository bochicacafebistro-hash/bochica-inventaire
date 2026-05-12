// ── Listeners Firebase temps réel ─────────────────────
db.collection("products").onSnapshot(snap => {
  products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  if (isLoggedIn) renderPage();
});

db.collection("suppliers").onSnapshot(snap => {
  suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn) renderPage();
});

db.collection("settings").doc("sections").onSnapshot(snap => {
  const data = snap.exists ? snap.data() : {};
  customSections = data.custom || [];
  // `all` = liste unifiée (nouveau modèle). Si absent → rétrocompatibilité.
  if (Array.isArray(data.all) && data.all.length) {
    allSections = data.all.slice();
  } else {
    allSections = [...DEFAULT_SECTIONS, ...customSections];
  }
  if (isLoggedIn) renderPage();
});

db.collection("logs").orderBy("ts", "desc").limit(300).onSnapshot(snap => {
  logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "historique") renderPage();
});

db.collection("employees").onSnapshot(snap => {
  employees = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  if (isLoggedIn && activePage === "employes") renderPage();
});

db.collection("tasks").onSnapshot(snap => {
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && ["taches", "inventaire"].includes(activePage)) renderPage();
});

db.collection("menu").onSnapshot(snap => {
  menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && ["menu", "recettes"].includes(activePage)) renderPage();
});

// Ingrédients (séparés des produits d'inventaire — pour calcul food cost)
db.collection("ingredients").onSnapshot(snap => {
  ingredients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (isLoggedIn && ["ingredients", "menu"].includes(activePage)) renderPage();
});

// Recettes (livre de cuisine — pour préparation des plats)
db.collection("recipes").onSnapshot(snap => {
  recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (isLoggedIn && activePage === "recettes") renderPage();
});

// Liste d'ingrédients (commandes / approvisionnement — séparée des ingrédients food cost)
db.collection("shoppingList").onSnapshot(snap => {
  shoppingList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "shopping") renderPage();
});

// Événements (calendrier — réservations, soirées spéciales, jours fériés, internes)
// Re-render aussi le dashboard car il affiche le widget "Prochains événements".
db.collection("events").onSnapshot(snap => {
  events = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (isLoggedIn && (activePage === "evenements" || activePage === "dashboard")) renderPage();
});

// Soumissions (admin only — devis pour clients)
db.collection("quotes").onSnapshot(snap => {
  quotes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (isLoggedIn && activePage === "soumissions") renderPage();
}, err => {
  // Le chef n'a pas accès à /quotes → on ignore silencieusement la perm denied
  if (err && err.code !== "permission-denied") console.warn("listener quotes:", err);
});

// Templates de forfaits (admin + chef — base des soumissions)
db.collection("quoteTemplates").onSnapshot(snap => {
  quoteTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  // Seed des templates par défaut au premier lancement si la collection est vide
  // Seul l'admin a les droits d'écriture (les règles le bloqueront sinon)
  if (snap.empty && isAdmin && typeof seedQuoteTemplates === "function") {
    seedQuoteTemplates();
  }
  if (isLoggedIn && activePage === "soumissions") renderPage();
});

db.collection("expenses").orderBy("date", "desc").limit(500).onSnapshot(snap => {
  expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "depenses") renderPage();
});

db.collection("revenues").orderBy("date", "desc").limit(500).onSnapshot(snap => {
  revenues = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "depenses") renderPage();
});

db.collection("expenseCategories").onSnapshot(snap => {
  expenseCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "depenses") renderPage();
});

db.collection("fixedExpenseTemplates").onSnapshot(snap => {
  fixedExpenseTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "depenses") renderPage();
});

// Paramètres horaire : ratio salaires/ventes + ventes réelles par jour + jours d'ouverture
db.collection("settings").doc("schedule").onSnapshot(snap => {
  const data = snap.exists ? snap.data() : {};
  scheduleSettings = {
    salesRatio: typeof data.salesRatio === "number" ? data.salesRatio : 0.32,
    actualSales: data.actualSales || {},
    openDays: Array.isArray(data.openDays) ? data.openDays : [0, 1, 2, 3, 4, 5, 6]
  };
  if (isLoggedIn && (activePage === "employes" || activePage === "salaires")) renderPage();
});

// Paramètres paie : pourcentages cuisine/service + fenêtre de service par défaut
db.collection("settings").doc("payroll").onSnapshot(snap => {
  const data = snap.exists ? snap.data() : {};
  payrollSettings = {
    tipShares: data.tipShares && typeof data.tipShares.cuisine === "number"
      ? { cuisine: Number(data.tipShares.cuisine), service: Number(data.tipShares.service) }
      : { cuisine: 0.25, service: 0.75 },
    defaultServiceHours: data.defaultServiceHours && typeof data.defaultServiceHours === "object"
      ? data.defaultServiceHours
      : {}
  };
  if (isLoggedIn && activePage === "salaires") renderPage();
});

// Simulations paie (admin only — scénarios hypothétiques RH)
// Re-render si on est sur la liste OU dans l'éditeur d'une simulation (pour
// que les inputs reflètent la sauvegarde Firestore).
db.collection("payrollSimulations").onSnapshot(snap => {
  payrollSimulations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (isLoggedIn && activePage === "simulations") {
    // Si on est dans l'éditeur d'une sim, on rend juste l'éditeur (sinon perte de focus
    // sur les inputs après chaque update)
    if (typeof _editingSimId !== "undefined" && _editingSimId) {
      // Sauver le focus avant le re-render
      const activeId = document.activeElement?.id;
      const sel = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT"
        ? { start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd }
        : null;
      if (typeof renderSimulationEditor === "function") {
        renderSimulationEditor();
      } else {
        renderPage();
      }
      // Restaurer le focus
      if (activeId) {
        const el = document.getElementById(activeId);
        if (el) {
          el.focus();
          if (sel && el.setSelectionRange) {
            try { el.setSelectionRange(sel.start, sel.end); } catch (_) {}
          }
        }
      }
    } else {
      renderPage();
    }
  }
}, err => {
  if (err && err.code !== "permission-denied") console.warn("listener payrollSimulations:", err);
});

// Note : le listener sur /payroll/{weekId} de la semaine courante est géré
// dynamiquement par subscribePayrollWeek() (dans pages-payroll.js) pour ne
// charger qu'un seul document à la fois. On l'abonne au login et à chaque
// changement de semaine.
