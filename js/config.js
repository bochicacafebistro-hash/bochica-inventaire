// ── Configuration Firebase ────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyC27HzALz_DolN5huqGwVBsKTLHg37rUuc",
  authDomain: "bochica-inventaire.firebaseapp.com",
  projectId: "bochica-inventaire",
  storageBucket: "bochica-inventaire.firebasestorage.app",
  messagingSenderId: "261321722710",
  appId: "1:261321722710:web:5a7aa0039fa0fd1a20a4f7"
});
const db = firebase.firestore();

// ── Authentification (Firebase Auth) ──────────────────
// Les mots de passe sont maintenant gérés par Firebase Authentication
// (backend Google, hashé côté serveur avec bcrypt-like + rate-limiting intégré).
// Le username saisi par l'utilisateur est traduit en email interne pour Firebase Auth.
// Les rôles sont lus depuis Firestore /users/{uid}.role après connexion réussie.
const AUTH_USER_EMAILS = {
  "bochica": "bochica@bochica.app",
  "chef":    "chef@bochica.app",
  "employe": "employe@bochica.app"
};
// Noms d'affichage (utilisés à la place du displayName Firebase — on ne s'appuie pas dessus)
const AUTH_DISPLAY_NAMES = {
  "bochica@bochica.app": "Admin Bochica",
  "chef@bochica.app":    "Chef de cuisine",
  "employe@bochica.app": "Employé"
};

// Permissions par rôle : pages accessibles + pages modifiables (écriture)
// La page "pointage" est volontairement ouverte aux 3 rôles — c'est l'écran
// kiosque où les employés tapent leur PIN pour pointer entrées/sorties.
// L'identification se fait par le PIN, pas par le compte loggué (qui peut
// rester "Employe" en permanence sur la tablette).
const ROLE_PERMISSIONS = {
  global_admin: {
    canAccess: ["dashboard", "inventaire", "rapport", "taches", "taches-jour", "ouverture-fermeture", "employes", "salaires", "simulations", "demandes-conge",
                "depenses", "taxes", "menu", "ingredients", "recettes", "shopping", "evenements", "soumissions", "factures", "fournisseurs", "rapports", "pointage"],
    canWrite: ["dashboard", "inventaire", "rapport", "taches", "taches-jour", "ouverture-fermeture", "employes", "salaires", "simulations", "demandes-conge",
               "depenses", "taxes", "menu", "ingredients", "recettes", "shopping", "evenements", "soumissions", "factures", "fournisseurs", "rapports", "pointage"],
    homePage: "dashboard"
  },
  chef: {
    canAccess: ["inventaire", "menu", "ingredients", "recettes", "shopping", "evenements", "pointage"],
    canWrite:  ["inventaire", "menu", "ingredients", "recettes", "shopping", "evenements", "pointage"],
    homePage: "inventaire"
  },
  employee: {
    // accueil = tableau de bord employé (avec tâches du jour cochables) ·
    // mon-horaire = horaire hebdo lecture seule · ouverture-fermeture = listes
    // de référence (v3.36.0). Vues allégées sans données financières.
    canAccess: ["accueil", "mon-horaire", "mes-taches", "ouverture-fermeture", "demande-conge", "inventaire", "pointage"],
    canWrite:  ["inventaire", "pointage", "accueil", "mes-taches", "demande-conge"], // accueil + mes-taches : cocher les tâches du jour ; demande-conge : créer une demande
    homePage: "pointage" // v3.17.2 : la tablette permanente s'ouvre directement sur le pointage
  }
};

// Constantes legacy retirées (ADMIN_PIN / EMPLOYEE_PIN) — l'authentification
// par PIN à 4 chiffres est remplacée par username + password avec hash SHA-256.
const DEFAULT_SECTIONS = ["Cuisine", "Emballage", "Bar", "Autre"];
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUS_ORDER = { "red": 0, "yellow": 1, "green": 2 };
const TASK_COLS = ["À faire", "En cours", "Complété"];
const MENU_CATS = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"];
const EXPENSE_CATS = [
  { name: "Nourriture", type: "variable" },
  { name: "Loyer", type: "fixe" },
  { name: "Électricité", type: "fixe" },
  { name: "Internet", type: "fixe" },
  { name: "Logiciels", type: "fixe" },
  { name: "Abonnements", type: "fixe" },
  { name: "Salaires", type: "fixe" },
  { name: "Taxes", type: "fixe" },
  { name: "Autres", type: "variable" }
];
const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;

// ── Forfaits par défaut (Soumissions) ─────────────────
// Utilisés au premier chargement (seed). Une fois en base, ils sont
// modifiables via la modale « Gérer les forfaits ».
const DEFAULT_QUOTE_TEMPLATES = [
  {
    id: "forfait-essentiel",
    name: "L'Essentiel",
    label: "Forfait Un",
    pricePerPerson: 22,
    accentColor: "yellow",
    entree:  "1 empanada au bœuf ou au poulet par personne",
    plat:    "Arepa classique ou végé",
    boisson: "Une boisson gazeuse colombienne ou autre",
    beerPrice: 7,
    dessertPrice: 6,
    sortOrder: 0
  },
  {
    id: "forfait-gourmand",
    name: "Le Gourmand",
    label: "Forfait Deux",
    pricePerPerson: 27,
    accentColor: "red",
    entree:  "1 empanada au bœuf ou au poulet par personne",
    plat:    "Bol Bogota, Bol Medellin, Bol végé, Salchipapas ou Bochica Burger",
    boisson: "Une boisson gazeuse colombienne ou autre",
    beerPrice: 7,
    dessertPrice: 6,
    sortOrder: 1
  }
];

const SHIFT_TYPES = [
  { label: "Matin",   color: "#3b82f6" },
  { label: "Soir",    color: "#8b5cf6" },
  { label: "Journée", color: "#22c55e" },
  { label: "Congé",   color: "#94a3b8" }
];

// ── Types de congé / absence approuvée (v3.37.0) ──────
// Un congé approuvé est stocké dans employees[id].timeOff[dk] = { type, note, createdAt }
// (dk = clé jour "YYYY-MM-DD"). Il VERROUILLE le jour : impossible d'assigner
// un quart ce jour-là (horaire ET salaires), et il s'affiche « Congé » partout.
// `id` = valeur stockée · `label` FR · `labelEs` ES · `color` = teinte de la carte.
const LEAVE_TYPES = [
  { id: "vacances",   label: "Vacances",   labelEs: "Vacaciones", color: "#0d9488" },
  { id: "maladie",    label: "Maladie",    labelEs: "Enfermedad", color: "#d97706" },
  { id: "personnel",  label: "Personnel",  labelEs: "Personal",   color: "#7c3aed" },
  { id: "sans_solde", label: "Sans solde", labelEs: "Sin sueldo", color: "#64748b" }
];
