// ── État global de l'application ──────────────────────
let products = [], suppliers = [], customSections = [], logs = [];
// allSections : liste complète (par défaut + personnalisées) gérée via Firestore.
// Si vide/absente en BD, fallback sur [...DEFAULT_SECTIONS, ...customSections].
let allSections = [];
let employees = [], tasks = [], menuItems = [], expenses = [];
let ingredients = []; // Ingrédients de menu (avec coûts, séparés des produits d'inventaire)
let recipes = [];    // Livre de cuisine — recettes pour préparation (sans coûts)
let recipeFilter = "all"; // Filtre actif sur page Recettes

let isAdmin = false, isLoggedIn = false, pinBuffer = "", darkMode = false;
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
