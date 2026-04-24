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
  employees = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
  if (isLoggedIn && activePage === "employes") renderPage();
});
