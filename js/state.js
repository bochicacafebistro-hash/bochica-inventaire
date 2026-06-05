// ── État global de l'application ──────────────────────

// ── Bootstrap : suivi des collections ayant reçu leur premier snapshot ──
// Sert à fixer la race condition au démarrage : si un snapshot arrive APRÈS
// le premier renderPage déclenché par applyLogin et que sa collection a un
// filtre `activePage` qui ne matche pas la home page, le re-render n'a pas
// lieu → données vides jusqu'au reload manuel. La solution : forcer le
// re-render lors du PREMIER snap de chaque collection, peu importe la page.
// Reset au logout pour que la logique fonctionne aussi au re-login.
let _firstSnapshots = new Set();

let products = [], suppliers = [], customSections = [], logs = [];
// allSections : liste complète (par défaut + personnalisées) gérée via Firestore.
// Si vide/absente en BD, fallback sur [...DEFAULT_SECTIONS, ...customSections].
let allSections = [];
let employees = [], tasks = [], menuItems = [], expenses = [];
let ingredients = []; // Ingrédients de menu (avec coûts, séparés des produits d'inventaire)
let recipes = [];    // Livre de cuisine — recettes pour préparation (sans coûts)
let recipeFilter = "all"; // Filtre actif sur page Recettes

// Liste d'ingrédients (commande / approvisionnement) — séparée des Ingrédients (food cost)
// Chaque item : { id, name, supplier (costco/viandex/gordon), category (proteine/legume/laitier/epicerie/autre), notes }
let shoppingList = [];
let shoppingFilterSupplier = "all"; // "all" | "costco" | "viandex" | "gordon"
let shoppingSortMode = "supplier";  // "supplier" | "name"
let shoppingSearchQuery = "";       // recherche texte (nom ou notes)

// Événements (calendrier) — réservations, karaoké, spectacles, hors-site, fériés, internes
// Chaque item : { id, name, date (YYYY-MM-DD), time (HH:MM, optionnel),
//                 type (reservation/karaoke/spectacle/hors_bochica/ferie/interne),
//                 status (confirme/attente/annule), capacity, contactName, contactPhone, contactEmail, notes }
let events = [];
let eventsViewMode = "calendar";        // "calendar" | "month" | "upcoming"
let eventsFilterType = "all";           // "all" | "reservation" | "karaoke" | "spectacle" | "hors_bochica" | "ferie" | "interne"
let eventsCalendarOffset = 0;           // 0 = mois courant, -1 = précédent, +1 = suivant
let eventsSearchQuery = "";             // recherche texte (nom, contact, notes)

// Soumissions (devis pour clients) — admin uniquement
// Chaque soumission : { id, quoteNumber ("2026-001"), clientName, clientPhone, clientEmail, clientCompany,
//                       eventDate, eventTime, eventVenue ("bochica"/"client"/"autre"), eventAddress, guestCount,
//                       packageOptions[] (NOUVEAU v3.14.0 — liste d'options de forfait que le client peut choisir),
//                         chaque option : { id (local), packageId, packageSnapshot (copie figée),
//                                           beerAddon (bool), customLines[], depositAmount, depositPaid }
//                       validUntil (YYYY-MM-DD), notes,
//                       status ("brouillon"/"envoyee"/"acceptee"/"refusee"/"expiree"), createdAt, updatedAt
//                       // RÉTROCOMPAT : si packageOptions absent, lit packageId/packageSnapshot/beerAddon/customLines/depositAmount/depositPaid à plat }
let quotes = [];
let quotesFilterStatus = "all";          // "all" | "brouillon" | "envoyee" | "acceptee" | "refusee" | "expiree"
let quotesSearchQuery = "";              // recherche (numéro, nom client, contact)
// État du formulaire d'édition des options de forfait (in-memory, perdu à la fermeture du modal)
// Permet d'ajouter/retirer des options dynamiquement sans perdre la saisie en cours.
let _editingQuoteOptions = [];

// Templates de forfaits (offres tarifaires) — sert de base pour les soumissions
// Chaque template : { id, name ("L'Essentiel"), label ("Forfait Un"), pricePerPerson, accentColor ("yellow"/"red"/"blue"/"green"),
//                     entree (texte), plat (texte), boisson (texte), sortOrder, beerPrice }
// beerPrice : prix de l'add-on bière commun à tous les forfaits (stocké dans chaque template pour simplicité,
//             le 1er template fait foi à l'affichage)
let quoteTemplates = [];

// Factures (v3.33.0) — admin uniquement
// Chaque facture : { id, invoiceNumber ("FAC-2026-001"), clientName, clientCompany,
//                    clientAddress, clientPhone, clientEmail,
//                    invoiceDate (YYYY-MM-DD), dueDate (YYYY-MM-DD),
//                    lines: [{ id (local), description, quantity, unitPrice }],
//                    tpsRate (default 0.05), tvqRate (default 0.09975),
//                    notes, status ("brouillon"/"envoyee"/"payee"/"annulee"),
//                    paidAt (timestamp), paidRevenueId (id du doc /revenues créé auto, ou null),
//                    createdAt, updatedAt, createdBy }
let invoices = [];
let invoicesFilterStatus = "all";   // "all" | "brouillon" | "envoyee" | "payee" | "annulee"
let invoicesSearchQuery = "";       // recherche (numéro, nom client, contact)
// État du formulaire d'édition des lignes (in-memory, perdu à la fermeture du modal)
let _editingInvoiceLines = [];

// Sections de la sidebar actuellement ouvertes (accordéons).
// Au login, on auto-ouvre la section contenant la home page. L'utilisateur
// peut ensuite ouvrir/fermer comme il veut pendant la session. Pas persisté
// entre sessions (intentionnel — on respecte le choix d'avoir seulement la
// section pertinente ouverte au démarrage).
let expandedNavSections = new Set();

// ── Opérations (v3.36.0) ──────────────────────────────
// Tâches du jour (collection /dailyTasks) : définies par l'admin, cochées
// par les employés sur l'accueil. type "recurring" (reset chaque jour via
// lastCompletedDate) ou "once" (done=true permanent, doneDate pour l'affichage).
let dailyTasks = [];
// Listes ouverture/fermeture (doc /settings/openClose) — items {id, text}.
let openCloseLists = { opening: [], closing: [] };
// État de complétion du jour (doc /dailyChecklistState/{YYYY-MM-DD}) — se
// réinitialise chaque jour (nouveau doc = vide). { date, opening:{id:true}, closing:{id:true} }
let dailyChecklistToday = { date: null, opening: {}, closing: {} };
let _checklistUnsub = null;          // unsubscribe du listener du jour courant
let _checklistSubscribedDate = null; // date actuellement abonnée (anti-réabo en boucle)

let isAdmin = false, isLoggedIn = false, darkMode = false;
let userRole = null; // "global_admin" | "chef" | "employee" | null
let loggedInUser = null; // { id, name, role } pour traçabilité

// v3.28.0 — Mode aperçu : l'admin peut visualiser l'app comme si elle/il
// était chef ou employee, sans changer de compte. Pendant l'aperçu :
//   • userRole et isAdmin sont temporairement écrasés par le rôle simulé
//   • _realUserRole et _realIsAdmin gardent les vraies valeurs
//   • _previewActive = true pour signaler l'état (banner, restore au logout)
// Toutes les vérifications existantes (userRole === "X", isAdmin, etc.) sont
// automatiquement cohérentes — aucun refactor des 38 références nécessaire.
let _realUserRole = null;
let _realIsAdmin = false;
let _previewActive = false;
let activeSection = "Toutes", searchQuery = "", sectionsExpanded = false;
// Mode de tri pour la page À commander : "section" (catégorie inv.) ou "supplier"
let rapportSortMode = "section";
let showArchived = false, logFilter = "";
let activePage = "inventaire";
let activeMenuCat = "Toutes", activeExpensePeriod = "mois";
let sidebarOpen = true;
let pendingConfirm = null, openDropId = null;
let dragSrcId = null;

let editingProduct = null, editingSupplier = null, editingEmployee = null;
let editingTask = null, editingMenuItem = null, editingExpense = null;
let noteProductId = null, movingProductId = null, receivingProduct = null;
let shiftModal = { emp: null, day: null };
let revenues = [];
let expenseCategories = [];
let fixedExpenseTemplates = [];

// Horaires — navigation de semaine + paramètres (ratio + ventes réelles)
let scheduleWeekOffset = 0; // 0 = semaine courante, -1 = précédente, +1 = suivante
// openDays : indices des jours de la semaine où le resto est ouvert (0=Lun ... 6=Dim)
// Par défaut 7/7. Les jours absents sont cachés de la grille.
let scheduleSettings = { salesRatio: 0.32, actualSales: {}, openDays: [0, 1, 2, 3, 4, 5, 6] };
// Filtre du graphique de couverture horaire : "all" | "cuisine" | "service" | "other"
let scheduleCoverageSection = "all";
// Instance Chart.js (détruit/recréé à chaque render pour éviter les fuites)
let _coverageChartInstance = null;

// ── Rapports mensuels (admin only) ────────────────────
// Un doc par mois Firestore (id = "YYYY-MM"). Données extraites des PDFs
// Cluster via parse_reports.py — voir monthly-reports-seed.js pour le seed.
let monthlyReports = [];
let reportsViewPeriod = 6;     // 3 | 6 | 12 | "all" | "custom"
let reportsCustomStart = "";   // YYYY-MM (utilisé si reportsViewPeriod === "custom")
let reportsCustomEnd = "";     // YYYY-MM (utilisé si reportsViewPeriod === "custom")
let reportsCompareYoY = true;  // true = afficher comparatif vs année précédente (par défaut ON)

// ── Simulations paie ──────────────────────────────────
// Scénarios hypothétiques pour planifier des changements RH :
// copie figée de l'horaire planifié + version modifiable (nom, taux,
// heures, section, ajout/retrait d'employés) + comparaison écart $/%.
// Doc Firestore /payrollSimulations/{id}
//   { id, name, description, baseWeekRef, baseline, simulation,
//     createdAt, updatedAt, createdBy }
// baseline et simulation ont la même structure :
//   { employees[], serviceHours, tipShares, totalTips, openDays }
// Les shifts sont indexés par jour de semaine (0=Lun..6=Dim) plutôt
// que par date — la sim est indépendante d'une semaine particulière.
let payrollSimulations = [];

// ── Salaires & Pourboires ─────────────────────────────
// Page hebdomadaire pour saisir les heures réelles + calculer salaires et
// répartition des pourboires au prorata des heures de service.
let payrollWeekOffset = 0;          // 0 = semaine courante
let payrollWeekData = null;         // doc Firestore /payroll/{weekId} (cache live)
let payrollSettings = {              // doc Firestore /settings/payroll
  tipShares: { cuisine: 0.25, service: 0.75 }, // 25% cuisine / 75% service+admin
  defaultServiceHours: {}            // { 0: {start,end}, 2: {start,end}, ... } par jour de semaine
};
// Unsubscribe du listener temps réel sur le doc /payroll/{weekId} courant
// (réabonné UNIQUEMENT à chaque changement de semaine pour limiter la BP)
let _payrollUnsub = null;
// ID de la semaine actuellement abonnée — évite les ré-abonnements en boucle
// (sinon chaque snapshot déclenche renderPage qui re-subscribe = boucle infinie)
let _payrollSubscribedWid = null;
