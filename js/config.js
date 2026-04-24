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
