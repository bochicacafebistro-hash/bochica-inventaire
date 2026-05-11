// ── État global de l'application ──────────────────────
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
//                       packageId (ref vers quoteTemplates), packageSnapshot (copie figée du forfait au moment du devis),
//                       beerAddon (bool), customLines[] (liste de {description, amount}),
//                       depositAmount, depositPaid, depositPaidDate, validUntil (YYYY-MM-DD),
//                       notes, status ("brouillon"/"envoyee"/"acceptee"/"refusee"/"expiree"), createdAt, updatedAt }
let quotes = [];
let quotesFilterStatus = "all";          // "all" | "brouillon" | "envoyee" | "acceptee" | "refusee" | "expiree"
let quotesSearchQuery = "";              // recherche (numéro, nom client, contact)

// Templates de forfaits (offres tarifaires) — sert de base pour les soumissions
// Chaque template : { id, name ("L'Essentiel"), label ("Forfait Un"), pricePerPerson, accentColor ("yellow"/"red"/"blue"/"green"),
//                     entree (texte), plat (texte), boisson (texte), sortOrder, beerPrice }
// beerPrice : prix de l'add-on bière commun à tous les forfaits (stocké dans chaque template pour simplicité,
//             le 1er template fait foi à l'affichage)
let quoteTemplates = [];

let isAdmin = false, isLoggedIn = false, darkMode = false;
let userRole = null; // "global_admin" | "chef" | "employee" | null
let loggedInUser = null; // { id, name, role } pour traçabilité
let activeSection = "Toutes", searchQuery = "", sectionsExpanded = false;
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
