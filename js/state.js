// ── État global de l'application ──────────────────────
let products = [], suppliers = [], customSections = [], logs = [];
// allSections : liste complète (par défaut + personnalisées) gérée via Firestore.
// Si vide/absente en BD, fallback sur [...DEFAULT_SECTIONS, ...customSections].
let allSections = [];
let employees = [], tasks = [], menuItems = [], expenses = [];
let ingredients = []; // Ingrédients de menu (avec coûts, séparés des produits d'inventaire)
let recipes = [];    // Livre de cuisine — recettes pour préparation (sans coûts)
let recipeFilter = "all"; // Filtre actif sur page Recettes

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
// (réabonné à chaque changement de semaine pour limiter la BP)
let _payrollUnsub = null;
