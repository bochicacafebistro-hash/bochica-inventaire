// ── État global de l'application ──────────────────────
let products = [], suppliers = [], customSections = [], logs = [];
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
