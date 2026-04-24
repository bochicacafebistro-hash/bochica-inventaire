// ── Configuration Firebase ────────────────────────────
firebase.initializeApp({
  apiKey: "AIzaSyC27HzALz_DoIN5huqGwVBsKTLHg37rUuc",
  authDomain: "bochica-inventaire.firebaseapp.com",
  projectId: "bochica-inventaire",
  storageBucket: "bochica-inventaire.firebasestorage.app",
  messagingSenderId: "261321722710",
  appId: "1:261321722710:web:5a7aa0039fa0fd1a20a4f7"
});
const db = firebase.firestore();

// ── Authentification ──────────────────────────────────
// Sécurité : les mots de passe ne sont JAMAIS stockés en clair.
// On stocke SHA-256(password + AUTH_SALT) et on compare au moment du login.
// ⚠️ Limitation : comme tout est côté client, un attaquant motivé pourrait lire
// les hashes et tenter un brute-force. Pour une vraie sécurité, migrer vers
// Firebase Authentication (backend de Google). Ce système reste un fort
// compromis entre "mot de passe en clair" (dangereux) et "Firebase Auth" (refonte).
const AUTH_SALT = "bochica-cafe-bistro-v2";
const AUTH_ACCOUNTS = {
  "bochica": {
    passwordHash: "444193fbe195fa5f68dc365ed84ebcf1c819a37f2d4fbea27fbbaf8c53f9c469",
    role: "global_admin",
    displayName: "Admin Bochica"
  },
  "chef": {
    passwordHash: "486eba619a1ba5bc2a2e45d4c62e2f4082951fab912ed30610ea3ccc7e1901bb",
    role: "chef",
    displayName: "Chef de cuisine"
  },
  "employe": {
    passwordHash: "2ca6cca899c18ff05aec4e7d087b79ccaf60613abfc30a2141767ca0d99de6cf",
    role: "employee",
    displayName: "Employé"
  }
};

// Permissions par rôle : pages accessibles + pages modifiables (écriture)
const ROLE_PERMISSIONS = {
  global_admin: {
    canAccess: ["dashboard", "inventaire", "rapport", "historique", "taches", "employes",
                "depenses", "taxes", "menu", "ingredients", "recettes", "fournisseurs"],
    canWrite: ["dashboard", "inventaire", "rapport", "historique", "taches", "employes",
               "depenses", "taxes", "menu", "ingredients", "recettes", "fournisseurs"],
    homePage: "dashboard"
  },
  chef: {
    canAccess: ["inventaire", "menu", "ingredients", "recettes"],
    canWrite:  ["inventaire", "menu", "ingredients", "recettes"],
    homePage: "inventaire"
  },
  employee: {
    canAccess: ["inventaire"],
    canWrite:  ["inventaire"], // écriture = mise à jour du stock seulement (pas d'ajout de produit)
    homePage: "inventaire"
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

const SHIFT_TYPES = [
  { label: "Matin",   color: "#3b82f6" },
  { label: "Soir",    color: "#8b5cf6" },
  { label: "Journée", color: "#22c55e" },
  { label: "Congé",   color: "#94a3b8" }
];
