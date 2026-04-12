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

// ── Constantes ────────────────────────────────────────
const ADMIN_PIN = "0000";
const EMPLOYEE_PIN = "1111";
const DEFAULT_SECTIONS = ["Cuisine", "Emballage", "Bar", "Autre"];
const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATUS_ORDER = { "red": 0, "yellow": 1, "green": 2 };
const TASK_COLS = ["À faire", "En cours", "Complété"];
const MENU_CATS = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"];
const EXPENSE_CATS = ["Nourriture", "Boissons", "Équipement", "Salaires", "Autre"];
const SHIFT_TYPES = [
  { label: "Matin",   color: "#3b82f6" },
  { label: "Soir",    color: "#8b5cf6" },
  { label: "Journée", color: "#22c55e" },
  { label: "Congé",   color: "#94a3b8" }
];
