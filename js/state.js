// ── État global de l'application ──────────────────────
let products = [], suppliers = [], customSections = [], logs = [];
let employees = [], tasks = [], menuItems = [], expenses = [];

let isAdmin = false, isLoggedIn = false, pinBuffer = "", darkMode = false;
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
