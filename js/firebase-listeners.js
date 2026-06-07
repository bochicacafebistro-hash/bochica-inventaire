// ── Listeners Firebase temps réel ─────────────────────
//
// Bootstrap : `_firstSnapshots` (déclaré dans state.js) suit quelles
// collections ont reçu leur premier snapshot. Si un listener a un filtre
// `activePage === "X"` qui ne matche pas la home page (ex: dashboard),
// le premier snap doit quand même déclencher un render pour peupler la
// page. Le helper `shouldRender(collKey, ...activePages)` gère ça :
//   - 1er snap pour cette collection → toujours render si isLoggedIn
//   - 2e+ snap → render si activePage matche (optimisation préservée)
function shouldRender(collKey, ...activePages) {
  if (!isLoggedIn) return false;
  const firstTime = !_firstSnapshots.has(collKey);
  if (firstTime) _firstSnapshots.add(collKey);
  if (firstTime) return true; // 1er snap : toujours render (la var globale vient d'être peuplée)
  if (activePages.length === 0) return true; // pas de filtre = toujours render
  return activePages.includes(activePage);
}

db.collection("products").onSnapshot(snap => {
  products = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  if (shouldRender("products")) renderPage();
});

db.collection("suppliers").onSnapshot(snap => {
  suppliers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("suppliers")) renderPage();
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
  if (shouldRender("settings/sections")) renderPage();
});

db.collection("logs").orderBy("ts", "desc").limit(300).onSnapshot(snap => {
  logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("logs", "historique")) renderPage();
});

db.collection("employees").onSnapshot(snap => {
  employees = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  if (shouldRender("employees", "employes", "salaires", "simulations", "dashboard", "accueil", "mon-horaire")) renderPage();
});

db.collection("tasks").onSnapshot(snap => {
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("tasks", "taches", "inventaire", "dashboard")) renderPage();
});

// Tâches du jour (v3.36.0) — définies par l'admin, cochées par les employés.
// Re-render l'accueil employé + la page admin de gestion.
db.collection("dailyTasks").onSnapshot(snap => {
  dailyTasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  if (shouldRender("dailyTasks", "accueil", "taches-jour")) renderPage();
});

// Listes ouverture/fermeture (v3.36.0) — doc settings/openClose.
// Items normalisés en {id, text} (compat ascendante : anciennes chaînes simples).
db.collection("settings").doc("openClose").onSnapshot(snap => {
  const data = snap.exists ? snap.data() : {};
  const norm = (arr) => (Array.isArray(arr) ? arr : []).map(it =>
    (typeof it === "string") ? { id: (typeof slugId === "function" ? slugId(it) : it), text: it }
                             : { id: it.id || (typeof slugId === "function" ? slugId(it.text || "") : ""), text: it.text || "" }
  ).filter(it => it.text);
  openCloseLists = { opening: norm(data.opening), closing: norm(data.closing) };
  if (shouldRender("settings/openClose", "ouverture-fermeture")) renderPage();
});

db.collection("menu").onSnapshot(snap => {
  menuItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("menu", "menu", "recettes", "dashboard")) renderPage();
});

// Ingrédients (séparés des produits d'inventaire — pour calcul food cost)
db.collection("ingredients").onSnapshot(snap => {
  ingredients = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (shouldRender("ingredients", "ingredients", "menu")) renderPage();
});

// Recettes (livre de cuisine — pour préparation des plats)
db.collection("recipes").onSnapshot(snap => {
  recipes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  if (shouldRender("recipes", "recettes")) renderPage();
});

// Liste d'ingrédients (commandes / approvisionnement — séparée des ingrédients food cost)
db.collection("shoppingList").onSnapshot(snap => {
  shoppingList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("shoppingList", "shopping")) renderPage();
});

// Événements (calendrier — réservations, soirées spéciales, jours fériés, internes)
// Re-render aussi le dashboard car il affiche le widget "Prochains événements".
db.collection("events").onSnapshot(snap => {
  events = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (shouldRender("events", "evenements", "dashboard", "accueil")) renderPage();
});

// Soumissions (admin only — devis pour clients)
db.collection("quotes").onSnapshot(snap => {
  quotes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (shouldRender("quotes", "soumissions")) renderPage();
}, err => {
  // Le chef n'a pas accès à /quotes → on ignore silencieusement la perm denied
  if (err && err.code !== "permission-denied") console.warn("listener quotes:", err);
});

// Factures (admin only — v3.33.0)
db.collection("invoices").onSnapshot(snap => {
  invoices = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (shouldRender("invoices", "factures")) renderPage();
}, err => {
  if (err && err.code !== "permission-denied") console.warn("listener invoices:", err);
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
  if (shouldRender("quoteTemplates", "soumissions")) renderPage();
});

db.collection("expenses").orderBy("date", "desc").limit(500).onSnapshot(snap => {
  expenses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("expenses", "depenses", "dashboard", "taxes")) renderPage();
});

db.collection("revenues").orderBy("date", "desc").limit(500).onSnapshot(snap => {
  revenues = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("revenues", "depenses", "dashboard", "taxes")) renderPage();
});

db.collection("expenseCategories").onSnapshot(snap => {
  expenseCategories = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("expenseCategories", "depenses")) renderPage();
});

db.collection("fixedExpenseTemplates").onSnapshot(snap => {
  fixedExpenseTemplates = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (shouldRender("fixedExpenseTemplates", "depenses", "dashboard")) renderPage();
});

// Paramètres horaire : ratio salaires/ventes + ventes réelles par jour + jours d'ouverture
db.collection("settings").doc("schedule").onSnapshot(snap => {
  const data = snap.exists ? snap.data() : {};
  scheduleSettings = {
    salesRatio: typeof data.salesRatio === "number" ? data.salesRatio : 0.32,
    actualSales: data.actualSales || {},
    openDays: Array.isArray(data.openDays) ? data.openDays : [0, 1, 2, 3, 4, 5, 6],
    weekOrder: data.weekOrder || {},
    weekHidden: data.weekHidden || {}
  };
  if (shouldRender("settings/schedule", "employes", "salaires", "simulations", "mon-horaire")) renderPage();
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
  if (shouldRender("settings/payroll", "salaires", "simulations")) renderPage();
});

// Simulations paie (admin only — scénarios hypothétiques RH)
// Re-render si on est sur la liste OU dans l'éditeur d'une simulation (pour
// que les inputs reflètent la sauvegarde Firestore).
db.collection("payrollSimulations").onSnapshot(snap => {
  payrollSimulations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const firstTime = !_firstSnapshots.has("payrollSimulations");
  _firstSnapshots.add("payrollSimulations");
  if (!isLoggedIn) return;
  // Cas spécial : si on est dans l'éditeur d'une sim, on re-render juste
  // l'éditeur (sinon perte de focus sur les inputs après chaque update)
  if (activePage === "simulations" || firstTime) {
    if (typeof _editingSimId !== "undefined" && _editingSimId && activePage === "simulations") {
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
    } else if (activePage === "simulations") {
      renderPage();
    }
    // Si firstTime mais pas sur simulations : on ne render pas (pas besoin)
    // — les autres listeners qui matchent la home page le feront déjà.
  }
}, err => {
  // Erreur critique : les règles Firestore /payrollSimulations ne sont pas
  // publiées dans la console Firebase. Afficher un toast clair côté admin.
  console.error("listener payrollSimulations:", err);
  if (err && err.code === "permission-denied" && isAdmin && activePage === "simulations") {
    toast("⚠ Règles Firestore manquantes pour /payrollSimulations. Va dans Firebase Console → Firestore → Règles et publie le contenu de firestore.rules.", "error", 10000);
  }
});

// Rapports mensuels (admin only — agrégation des PDFs Cluster)
db.collection("monthlyReports").onSnapshot(snap => {
  monthlyReports = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.period || "").localeCompare(b.period || ""));
  if (shouldRender("monthlyReports", "rapports")) renderPage();
}, err => {
  if (err && err.code !== "permission-denied") console.warn("listener monthlyReports:", err);
});

// Note : le listener sur /payroll/{weekId} de la semaine courante est géré
// dynamiquement par subscribePayrollWeek() (dans pages-payroll.js) pour ne
// charger qu'un seul document à la fois. On l'abonne au login et à chaque
// changement de semaine.
