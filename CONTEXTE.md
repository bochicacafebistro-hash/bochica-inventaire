# 📋 CONTEXTE — Projet Bochica

## 🏠 Description
Application web de gestion pour le **restaurant colombien Bochica**.
Déployée sur **Vercel** via **GitHub** (100% web, aucune installation locale).
Base de données : **Firebase Firestore** (temps réel).

## 🔗 Liens
- GitHub : https://github.com/bochicacafebistro-hash/bochica-inventaire
- Vercel : https://bochica-inventaire.vercel.app

## 🔑 Connexion PIN
- Admin : `0000`
- Employé : `1111`

## 🗂️ Structure des fichiers

bochica-inventaire/
├── index.html                  ← HTML + CSS + imports des scripts
└── js/
├── config.js               ← Config Firebase + constantes globales
├── state.js                ← Variables globales
├── utils.js                ← Fonctions utilitaires
├── inventaire.js           ← Page inventaire, stock, drag & drop
├── modals-produits.js      ← Modals produit, note, catégorie, réception
├── pages-secondaires.js    ← Pages rapport, historique, tâches
├── pages-admin.js          ← Pages employés, dépenses, revenus, menu, fournisseurs
├── sidebar.js              ← Navigation, sidebar, renderPage()
├── auth.js                 ← Connexion PIN, logout
└── firebase-listeners.js   ← Listeners Firestore temps réel

## ⚠️ Ordre des scripts dans index.html (important !)
```html
<script src="js/config.js"></script>
<script src="js/state.js"></script>
<script src="js/utils.js"></script>
<script src="js/inventaire.js"></script>
<script src="js/modals-produits.js"></script>
<script src="js/pages-secondaires.js"></script>
<script src="js/pages-admin.js"></script>
<script src="js/sidebar.js"></script>
<script src="js/auth.js"></script>
<script src="js/firebase-listeners.js"></script>
```

## 🔥 Firebase
- **Projet** : bochica-inventaire
- **Collections Firestore** :
  - `products` — inventaire (nom, stock, minimum, section, fournisseur, orderQty, orderUnit)
  - `suppliers` — fournisseurs (nom, contact, email, notes)
  - `employees` — employés (nom, rôle, phone, email, pin, shifts)
  - `tasks` — tâches (titre, description, statut, priorité, assigné, date limite)
  - `menu` — items du menu (nom, description, prix, catégorie, disponible)
  - `expenses` — dépenses (description, supplier, amount, tps, tvq, date, category, type, notes)
  - `revenues` — revenus (description, amount, tps, tvq, date, notes)
  - `expenseCategories` — catégories personnalisées de dépenses (name, type)
  - `fixedExpenseTemplates` — modèles de frais fixes automatiques (supplier, category, amount, tps, tvq)
  - `logs` — historique des actions
  - `settings/sections` — catégories personnalisées d'inventaire

## ✅ Fonctionnalités existantes

### 📦 Inventaire
- Stock, statuts (rouge/jaune/vert), drag & drop, archivage, notes, sections
- Sections par défaut : Cuisine, Emballage, Bar, Autre
- Sections personnalisées gérables via ⚙️

### 📋 Rapport
- Produits à commander, export imprimable

### 🕐 Historique
- Log de toutes les actions

### 📋 Tâches
- Kanban 3 colonnes (À faire / En cours / Complété)
- Priorités (haute/moyenne/basse), assignation, date limite

### 👥 Employés & Horaires
- Fiche employé (nom, rôle, phone, email, PIN)
- Grille horaire semaine, quarts : Matin/Soir/Journée/Congé

### 💰 Dépenses & Revenus
- **Dépenses** : description + fournisseur optionnel (liste déroulante), catégorie, type fixe/variable
- **Taxes** : TPS (5%) et TVQ (9.975%) calculées automatiquement mais modifiables
- **Revenus** : description, montant, TPS/TVQ perçues
- **Frais fixes automatiques** : copiés le 1er de chaque mois depuis `fixedExpenseTemplates`
  - Gérés via bouton 🔒 Frais fixes
  - Marqués `isFixedAuto: true` dans Firestore
- **Catégories par défaut** :
  - Nourriture (variable), Loyer (fixe), Électricité (fixe), Internet (fixe)
  - Logiciels (fixe), Abonnements (fixe), Salaires (fixe), Taxes (fixe), Autres (variable)
- **Catégories personnalisées** : ajout/suppression via ⚙️ Catégories
- **Sélecteur de mois** : navigation ◀ ▶, par défaut mois en cours
- **Stats** : revenus, dépenses avant taxes, taxes totales, profit/déficit, frais fixes vs variables
- **Graphiques** :
  - Barres : Revenus vs Dépenses sur 6 derniers mois
  - Camembert : Dépenses par catégorie
- **Créer fournisseur rapide** depuis le modal de dépense

### 🍽️ Menu
- Items par catégorie, toggle disponible/indisponible
- Catégories : Entrées, Plats principaux, Desserts, Boissons, Autres

### 🏪 Fournisseurs
- Fiches avec produits liés

### 🌙 Général
- Dark mode (toggle, sauvegardé en localStorage)
- Mobile responsive (sidebar cachée, cartes au lieu de tableau)

## 🔧 Constantes importantes (config.js)
- `ADMIN_PIN` = "0000"
- `EMPLOYEE_PIN` = "1111"
- `TPS_RATE` = 0.05
- `TVQ_RATE` = 0.09975
- `DEFAULT_SECTIONS` = ["Cuisine", "Emballage", "Bar", "Autre"]
- `SHIFT_TYPES` = Matin, Soir, Journée, Congé
- `TASK_COLS` = ["À faire", "En cours", "Complété"]
- `MENU_CATS` = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"]
- `EXPENSE_CATS` = tableau d'objets `{ name, type }` avec fixe/variable

## 🚧 Contraintes importantes
- **Aucune installation locale possible** — tout se fait via GitHub.com + Vercel
- **Vanilla JS uniquement** — pas de React, pas de build step
- **Modifications** : chaque fichier JS = une section de l'app
- Vercel redéploie automatiquement à chaque commit GitHub
- **L'ordre des scripts** dans index.html est critique — ne pas changer

## 📝 Fonctionnalités à ajouter (liste évolutive)
- [ ] À compléter selon les besoins futurs...
