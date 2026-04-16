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
- Session sauvegardée dans localStorage (pas de déconnexion au rechargement)

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
├── auth.js                 ← Connexion PIN, logout, session
└── firebase-listeners.js   ← Listeners Firestore temps réel
## ⚠️ Ordre des scripts dans index.html (critique !)
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
  - `products` — inventaire (nom, stock, minimum, section, supplierId, orderQty, orderUnit, unitsPerBox, sortOrder, archived, note)
  - `suppliers` — fournisseurs (nom, contact, email, notes)
  - `employees` — employés (nom, rôle, phone, email, pin, shifts)
  - `tasks` — tâches (titre, description, statut, priorité, assigné, date limite)
  - `menu` — items du menu (nom, description, prix, catégorie, disponible)
  - `expenses` — dépenses (description, supplier, amount, tps, tvq, date, category, type, notes, isFixedAuto)
  - `revenues` — revenus (description, amount, tps, tvq, date, notes)
  - `expenseCategories` — catégories personnalisées de dépenses (name, type)
  - `fixedExpenseTemplates` — modèles frais fixes auto (supplier, category, amount, tps, tvq)
  - `logs` — historique des actions
  - `settings/sections` — catégories personnalisées d'inventaire

## 🎨 Design — Palette Gris perle & Violet doux (Design A)
```css
:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --surface2: #f0f0f8;
  --surface3: #e8e8f0;
  --border: #e0e0e6;
  --text: #1a1a2e;
  --text2: #888899;
  --text3: #aaaabc;
  --accent: #5b5bd6;
  --accent2: #7c7ce8;
  --header-from: #2a2a3e;
  --header-to: #333348;
}
```
- Badges : rouge `#c0392b`, jaune `#b8860b`, vert `#27ae60`, bleu/violet `#5b5bd6`
- Borders : `0.5px solid` partout (pas 1px)
- Couleurs statuts dans JS : rouge `#c0392b`, jaune `#b8860b`, vert `#27ae60`

## ✅ Fonctionnalités existantes

### 📦 Inventaire
- Stats desktop : total produits, à commander, en stock (3 cartes en haut)
- Stock, statuts (rouge/jaune/vert), drag & drop, archivage, notes, sections
- Sections par défaut : Cuisine, Emballage, Bar, Autre + sections personnalisées
- Vue tableau desktop, vue cartes mobile

### 📋 Rapport
- Produits à commander par section, export imprimable

### 🕐 Historique
- Log de toutes les actions avec filtre

### 📋 Tâches
- Kanban 3 colonnes (À faire / En cours / Complété)
- Priorités, assignation, date limite

### 👥 Employés & Horaires
- Fiche employé (nom, rôle, phone, email, PIN)
- Grille horaire semaine, quarts : Matin/Soir/Journée/Congé

### 💰 Dépenses & Revenus
- Dépenses : description + fournisseur optionnel, catégorie, type fixe/variable
- TPS (5%) et TVQ (9.975%) auto mais modifiables
- Revenus : description, montant, TPS/TVQ perçues
- Frais fixes auto : copiés le 1er du mois depuis `fixedExpenseTemplates`
- Catégories par défaut : Nourriture (var), Loyer (fixe), Électricité (fixe),
  Internet (fixe), Logiciels (fixe), Abonnements (fixe), Salaires (fixe), Taxes (fixe), Autres (var)
- Catégories personnalisées via ⚙️
- Sélecteur de mois avec navigation ◀ ▶
- Stats : revenus, dépenses, taxes, profit/déficit, frais fixes vs variables
- Graphiques : barres 6 mois + camembert par catégorie
- Créer fournisseur rapide depuis modal dépense

### 🍽️ Menu
- Items par catégorie, toggle disponible/indisponible

### 🏪 Fournisseurs
- Fiches avec produits liés

### 🌙 Général
- Dark mode (toggle, localStorage)
- Mobile responsive
- Session persistante (localStorage)

## 🔧 Constantes importantes (config.js)
- `ADMIN_PIN` = "0000"
- `EMPLOYEE_PIN` = "1111"
- `TPS_RATE` = 0.05
- `TVQ_RATE` = 0.09975
- `DEFAULT_SECTIONS` = ["Cuisine", "Emballage", "Bar", "Autre"]
- `SHIFT_TYPES` = Matin (#3b82f6), Soir (#8b5cf6), Journée (#22c55e), Congé (#94a3b8)
- `TASK_COLS` = ["À faire", "En cours", "Complété"]
- `MENU_CATS` = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"]
- `EXPENSE_CATS` = tableau objets `{ name, type }` fixe/variable

## 🚧 Contraintes importantes
- Aucune installation locale — tout via GitHub.com + Vercel
- Vanilla JS uniquement — pas de React, pas de build
- Chaque fichier JS = une section de l'app
- Vercel redéploie automatiquement à chaque commit
- L'ordre des scripts dans index.html est critique
- Pour déboguer : F12 → Console → messages en rouge

## 📝 Fonctionnalités à ajouter (liste évolutive)
- [ ] À compléter selon les besoins futurs...
