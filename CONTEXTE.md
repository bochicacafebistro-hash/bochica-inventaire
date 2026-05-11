# 📋 CONTEXTE — Projet Bochica Inventaire

> ⚠️ **Dernière mise à jour : 11 mai 2026** — page **Événements** (v3.7.1) : calendrier mensuel (grille), vue « Ce mois-ci », vue « À venir (30 j) », filtres par type (6 types : réservation privée, soirée karaoké, soirée spectacle, événement hors Bochica, journée fériée, événement interne), recherche texte, statuts (confirmé / en attente / annulé), capacité + contact + notes par événement. Widget « Prochains événements » ajouté au dashboard admin. Accès Admin + Chef.

## 🏠 Description
Application web de **gestion interne** pour le restaurant colombien Bochica.
- Hébergement : **Vercel** via **GitHub** (100% web, aucune installation locale)
- Base de données : **Firebase Firestore** (temps réel)
- **Installable comme PWA** sur mobile et desktop (Add to Home Screen)
- Pas de SEO — outil interne (`<meta name="robots" content="noindex, nofollow">`)

## 🔗 Liens
- GitHub : https://github.com/bochicacafebistro-hash/bochica-inventaire
- Vercel : https://bochica-inventaire.vercel.app

## 🔑 Authentification (Firebase Auth)

Migration v3.0.0 — voir `FIREBASE_AUTH_SETUP.md` pour la procédure de migration initiale.

### Comptes
| Username | Email interne | Rôle | Accès |
|---|---|---|---|
| **Bochica** | bochica@bochica.app | `global_admin` | Tout |
| **Chef** | chef@bochica.app | `chef` | Inventaire, Menu, Ingrédients, Recettes, Liste d'ingrédients, Événements |
| **Employe** | employe@bochica.app | `employee` | Inventaire uniquement |

### Sécurité
- **Firebase Authentication** (backend Google) gère les mots de passe : bcrypt-hashés côté serveur, rate-limiting, tokens JWT signés
- Le rôle est stocké dans **Firestore `/users/{uid}.role`** — vérifié côté serveur via les règles Firestore
- **Session persistante** via `firebase.auth.Auth.Persistence.LOCAL` — restauration automatique au rechargement
- L'utilisateur tape un **username simple** (Bochica) qui est traduit en email interne (bochica@bochica.app) via `AUTH_USER_EMAILS` dans `config.js`
- **Les règles Firestore** (`firestore.rules` à la racine du repo) protègent l'accès à la BD : vérifient `request.auth != null` + le rôle de l'utilisateur pour chaque collection

## 🗂️ Structure des fichiers
```
bochica-inventaire/
├── index.html              ← HTML squelette (CSS externalisé)
├── manifest.json           ← Configuration PWA
├── sw.js                   ← Service Worker (cache offline)
├── favicon.ico
├── CONTEXTE.md             ← ce fichier
├── README.md
├── firestore.rules         ← Règles Firestore (à publier dans la console Firebase)
├── FIREBASE_AUTH_SETUP.md  ← Procédure migration vers Firebase Auth
├── css/
│   └── style.css           ← Design system complet (2400+ lignes)
├── js/
│   ├── config.js           ← Config Firebase + AUTH_USER_EMAILS + ROLE_PERMISSIONS
│   ├── state.js            ← Variables globales (products, allSections, etc.)
│   ├── icons.js            ← Bibliothèque d'icônes Lucide SVG inline
│   ├── i18n.js             ← Traductions FR/ES
│   ├── utils.js            ← Utils, markdown parser, toolbar, duplicateItem, dropdowns, toast()
│   ├── inventaire.js       ← Page inventaire, stock, drag & drop produits
│   ├── modals-produits.js  ← Modals produit, note, catégorie (drag & drop), réception
│   ├── pages-secondaires.js ← Pages rapport, historique, tâches
│   ├── pages-hr.js         ← Employés, horaires, coverage chart, salaires fixes
│   ├── pages-payroll.js    ← Salaires & Pourboires (heures réelles, fenêtre service, prorata)
│   ├── pages-finance.js    ← Dépenses, revenus, catégories, frais fixes, rapports, charts dépenses
│   ├── pages-kitchen.js    ← Menu, fournisseurs, ingrédients, recettes
│   ├── pages-shopping.js   ← Liste d'ingrédients (commandes par fournisseur)
│   ├── pages-events.js     ← Événements / calendrier (réservations, soirées, etc.)
│   ├── pages-dashboard.js  ← Dashboard, taxes, helpers taxes, autoApplyFixedExpenses
│   ├── sidebar.js          ← Navigation, sidebar, renderPage(), goHome()
│   ├── auth.js             ← Firebase Auth, login/logout, session, rôles
│   └── firebase-listeners.js ← Listeners Firestore temps réel
└── images/
    ├── favicon-16x16.png
    ├── favicon-32x32.png
    ├── apple-touch-icon.png
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

## ⚠️ Ordre des scripts dans index.html (critique !)
```html
<script src="js/config.js"></script>
<script src="js/state.js"></script>
<script src="js/icons.js"></script>
<script src="js/i18n.js"></script>
<script src="js/utils.js"></script>
<script src="js/inventaire.js"></script>
<script src="js/modals-produits.js"></script>
<script src="js/pages-secondaires.js"></script>
<script src="js/pages-hr.js"></script>
<script src="js/pages-payroll.js"></script>
<script src="js/pages-finance.js"></script>
<script src="js/pages-kitchen.js"></script>
<script src="js/pages-shopping.js"></script>
<script src="js/pages-events.js"></script>
<script src="js/pages-dashboard.js"></script>
<script src="js/sidebar.js"></script>
<script src="js/auth.js"></script>
<script src="js/firebase-listeners.js"></script>
```

## 🔥 Firebase
- **Projet** : bochica-inventaire
- **Collections Firestore** :
  - `products` — inventaire (name, currentStock, minimum, section, supplierId, orderQty, orderUnit, unitsPerBox, sortOrder, archived, note)
  - `suppliers` — fournisseurs (name, contact, email, notes)
  - `employees` — employés (name, role, phone, email, pin, shifts)
  - `tasks` — tâches (title, description, status, priority, assignee, dueDate)
  - `menu` — items du menu (name, description, price, category, available, recipe[])
  - `ingredients` — ingrédients pour food cost (name, costPerUnit, unit, category)
  - `recipes` — livre de cuisine (name, description, category, servings, prepTime, cookTime, ingredients, steps, tips — **markdown**)
  - `shoppingList` — **liste d'ingrédients** pour commandes/approvisionnement (séparée de `ingredients`) :
    - Champs : `id`, `name`, `supplier` (∈ `costco`/`viandex`/`gordon`), `category` (∈ `proteine`/`legume`/`laitier`/`epicerie`/`autre`), `notes`, `createdAt`, `updatedAt`
    - Accès : admin + chef
  - `events` — **événements / calendrier** (réservations, karaoké, spectacles, hors-site, fériés, internes) :
    - Champs : `id`, `name`, `date` (ISO YYYY-MM-DD), `time` (HH:MM, optionnel), `type` (∈ `reservation`/`karaoke`/`spectacle`/`hors_bochica`/`ferie`/`interne`), `status` (∈ `confirme`/`attente`/`annule`), `capacity`, `contactName`, `contactPhone`, `contactEmail`, `notes`, `createdAt`, `updatedAt`
    - Accès : admin + chef
  - `payroll` — paie hebdomadaire (un doc par semaine ISO `YYYY-Www`) :
    - `weekId`, `weekStart`, `totalTips`, `serviceHours` `{dk: {start,end}}`, `actualShifts` `{empId: {dk: {start,end}}}`, `notes`, `createdAt`/`updatedAt`
    - Indépendant des shifts planifiés dans `employees[id].shifts` — permet de saisir l'horaire **réel** sans toucher au planning
  - `settings/payroll` — `tipShares: { cuisine, service }` (par défaut 0.25 / 0.75) + `defaultServiceHours` par jour de semaine
  - `expenses` — dépenses (description, supplier, amount, tps, tvq, date, category, type, notes, isFixedAuto)
  - `revenues` — revenus (description, amount, tps, tvq, date, notes)
  - `expenseCategories` — catégories personnalisées de dépenses (name, type)
  - `fixedExpenseTemplates` — modèles frais fixes auto (supplier, category, amount, tps, tvq)
  - `logs` — historique des actions
  - `settings/sections` — catégories d'inventaire :
    - **Nouveau champ `all`** (array) : liste unifiée ordonnée (par défaut + personnalisées), modifiable entièrement
    - **Champ `custom`** (array) : préservé pour rétrocompatibilité avec anciens clients
    - Fallback : si `all` absent → `[...DEFAULT_SECTIONS, ...custom]`

## 🎨 Design System Bochica (aligné sur le site web — palette Crème Papier)

### Palette
- **Accent principal** : jaune impact `--accent: #F7B32C` (CTA, prix, actif)
- **Accent hover** : ambre `--accent-hover: #E09E1E`
- **Accent soft** : crème-jaune tint `--accent-soft: #fef2d4`
- **Accent warm** : jaune brûlé `--accent-warm: #8a6a1a` (petits eyebrows)
- **Accent text** : noir chaud `--accent-text: #0e0d0c` (contraste AA sur jaune)
- **Accent RGB** : `--accent-rgb: 247,179,44` (pour `rgba()` dans shadows/focus)
- **Fonds clair** : crème papier `--bg: #f5f1e8`, `--surface: #ffffff`, `--surface2: #ede3d2`, `--surface3: #e5d9c4`
- **Texte** : noir chaud `--text: #0e0d0c`, `--text2: rgba(14,13,12,.72)`, `--text3: rgba(14,13,12,.5)`
- **Tricolore Colombie** : jaune `#F7B32C`, bleu `#4a90e2`, rouge `#e74c3c`
- **États stock** : rouge `#d9534f`, jaune-ambré `#b45309` (distinct de l'accent vif), vert `#7dbf66`
- **Bordures** : `rgba(14,13,12,.1)` (subtile) / `rgba(14,13,12,.25)` (marquée)
- **Sidebar** : toujours sombre (`--header-from: #0a0907` → `--header-to: #14110f`) avec texte `--on-dark: #f5f1e8`

### Dark mode adapté on-brand
- Fonds : `#14110f`, `#1c1815` (chaleureux, pas gris bleuté)
- Accent : jaune `#F7B32C` (identique au clair — le jaune reste visible sur fond sombre)
- Accent hover dark : jaune clairci `#ffc94a`

### Typographie (aligné site web)
- **Display / titres** : `Bebas Neue` — h1-h6, stats numériques, prix, logo, topbar
- **Corps** : `Inter` (300-800) — UI, formulaires, body, boutons
- **Mono** : `JetBrains Mono` (400, 500, 600) — kickers techniques, tags, classe `.kicker`
- **`font-synthesis: none`** sur body — évite les faux bold/italic sur Bebas qui n'a qu'un poids
- **Tailles fixes des titres** (Bebas étant condensé, on majore ~25% pour équilibrer) :
  - `h1` : 48px · `h2` : 38px · `h3` : 28px · `h4` : 22px · `h5` : 18px · `h6` : 15px (uppercase + letter-spacing)
  - `.topbar-title` : 26px
  - `.recipe-view__title` : 42px
- **Échelle générale** (pour UI et body) : `--fs-xs` (11) → `--fs-sm` (13) → `--fs-base` (14) → `--fs-md` (16) → `--fs-lg` (18) → `--fs-xl` (22) → `--fs-2xl` (28) → `--fs-3xl` (36)

### Espacement
Échelle 4/8 : `--sp-1` (4) → `--sp-2` (8) → `--sp-3` (12) → `--sp-4` (16) → `--sp-5` (20) → `--sp-6` (24) → `--sp-7` (32) → `--sp-8` (48)

### Border-radius
`--radius-sm` (4) → `--radius-md` (8) → `--radius-lg` (12) → `--radius-xl` (16) → `--radius-pill` (20) → `--radius-full` (50%)

### Ombres et transitions
- `--shadow-sm/md/lg/modal`
- Ombres accent : `rgba(var(--accent-rgb), …)` — dynamiques (jaune en clair ET en dark)
- `--transition-fast/base`

## 📱 PWA (Progressive Web App)

### Installation
- **iOS Safari** : Bouton Partager → "Sur l'écran d'accueil"
- **Android Chrome** : Bandeau auto "Ajouter à l'écran d'accueil" ou menu ⋮ → "Installer"
- **Desktop Chrome/Edge** : Icône d'installation dans la barre d'adresse

### Configuration (`manifest.json`)
- `name` : "Bochica — Gestion"
- `short_name` : "Bochica"
- `display` : "standalone" (sans barre d'adresse)
- `theme_color` : `#F7B32C` (jaune impact)
- `background_color` : `#f5f1e8` (crème papier)
- **Shortcuts** : raccourcis vers Inventaire, Tâches, Dépenses

### Service Worker (`sw.js`)
- **Stratégie cache** : cache-first pour app shell (HTML, CSS, JS, fonts)
- **Stratégie réseau** : network-only pour Firebase (données toujours fraîches)
- **App shell** : inclut `icons.js` et `i18n.js` (ajoutés au cache)
- **Mise à jour** : incrémenter `CACHE_VERSION` dans sw.js après un déploiement majeur
- **Version actuelle** : `v1.4.0`

## ✅ Fonctionnalités

### 📦 Inventaire
- Stats desktop : total produits, à commander, bientôt bas, en stock (4 cartes en haut)
- Stock, statuts (rouge/jaune/vert), drag & drop pour réordonner, archivage, notes
- **Gestion avancée des catégories** (via engrenage ⚙️) :
  - Liste unifiée : toutes les catégories (par défaut + personnalisées) sont modifiables, supprimables, réordonnables
  - Le champ « Nouvelle catégorie » est **en haut** de la modale
  - **Drag & drop** (grip `⋮⋮`) pour réordonner
  - Renommer → **batch update Firestore** : tous les produits sont automatiquement mis à jour
  - Supprimer → les produits sont déplacés vers « Autre » (ou la première catégorie restante)
  - Compteur de produits par catégorie + badge « défaut »
- **Onglets catégories** : scroll horizontal avec fondu aux extrémités + bouton `⌄` « Voir toutes » (wrap multi-lignes)
- **Recherche fluide** : focus restauré après chaque frappe (plus de bug de saisie mot par mot)
- Vue tableau desktop, vue cartes mobile

### 📋 Rapport / Historique / Tâches
- Rapport imprimable, log d'actions, Kanban 3 colonnes (drag & drop)

### 👥 Employés & Horaires
- Fiche employé + grille horaire semaine (Matin/Soir/Journée/Congé)
- Section employé (cuisine / service / autre) — utilisée pour le pool de pourboires
- Taux horaire par employé + option salarié (heures fixes hebdomadaires)

### 💵 Salaires & Pourboires
- Page séparée pour saisir les **heures réelles** travaillées (peuvent différer du planifié)
- **Inputs `<input type="time">`** : saisie à la minute près (pas seulement par tranches de 30 min)
- **Comparaison planifié vs réel** : chaque ligne affiche `Réel / Planifié` + colonne **Écart** avec couleur (vert si plus, rouge si moins)
- **Cellule en surbrillance ambrée** quand l'heure réelle diffère du planifié
- **Heures de service configurables** globalement via modale (settings/payroll.defaultServiceHours par jour 0-6) — fixes par défaut, modifiables n'importe quand
- **Pourboires saisis par jour** dans une grille (un input par jour) — le **total semaine** se calcule automatiquement
- **Répartition automatique des pourboires** :
  - Cuisine (`section === "cuisine"`) → pool 25% par défaut
  - Service + Admin (`section === "service"` ou `"other"`) → pool 75% par défaut
  - Pourcentages modifiables via la modale « Répartition »
  - Calcul au prorata des heures éligibles (heures dans la fenêtre de service du jour)
- **Bouton « Copier → S{n+1} »** : duplique heures réelles + pourboires vers la semaine suivante (avec confirmation si la cible contient déjà des données)
- **Bouton « Reprendre du planifié »** : initialise les heures réelles avec l'horaire planifié de la semaine
- Calcul salaire = heures réelles totales × taux (ou heures fixes × taux pour les salariés)
- Total à payer par employé = salaire + pourboire

### 💰 Dépenses & Revenus
- Calcul TPS/TVQ auto, catégories personnalisables, frais fixes auto
- Stats : revenus, dépenses, taxes, profit/déficit
- Graphiques : barres 6 mois (revenus/dépenses/profit) + doughnut par catégorie

### 🍽️ Menu / 🏪 Fournisseurs
- Items par catégorie avec toggle disponible
- Fiches fournisseurs avec produits liés

### 🧂 Ingrédients (food cost)
- Séparés des produits d'inventaire
- Coût par unité utilisé pour calculer le food cost des items du menu

### 📅 Événements (calendrier)
- Page **Événements** sous Liste d'ingrédients
- **3 vues** : Calendrier mensuel (grille 7×6), Ce mois-ci (liste), À venir (30 jours)
- **6 types** (couleurs distinctes + icônes dédiées) : Réservation privée (bleu, `users`), Soirée karaoké (violet, `mic`), Soirée spectacle (orange, `music`), Événement hors Bochica (slate, `map-pin`), Journée fériée (rouge, `flag`), Événement interne (vert, `briefcase`)
- **3 statuts** : Confirmé, En attente, Annulé (annulé = barré dans le calendrier)
- Champs par événement : nom, date, heure optionnelle, type, statut, nombre de personnes (capacité), contact (nom + tél + courriel), notes
- **Calendrier mensuel** : navigation mois précédent/suivant, bouton « Aujourd'hui » pour revenir, highlight du jour courant (badge jaune), clic sur une case vide pour créer un événement à cette date, clic sur une pill pour l'éditer, max 3 événements visibles par case + indicateur « +N autres », légende couleurs en bas
- **Filtre par type** (tous / réservation / spéciale / férié / interne) avec compteurs
- **Recherche texte** (nom, contact, notes) avec focus préservé
- **Affichage relatif** : « Aujourd'hui », « Demain », « Dans 3 jours », « Il y a 2 jours »
- **Widget dashboard** : « Prochains événements » (5 max, dans les 60 jours, hors annulés)
- Duplication via dropdown ⋯
- Accès : admin + chef

### 🛒 Liste d'ingrédients (commandes / approvisionnement)
- Section **distincte** des Ingrédients (food cost) — orientée liste de courses
- Champs par item : nom, fournisseur, catégorie, notes
- **3 fournisseurs fixes** : Costco (bleu), Viandex (rouge), Gordon (vert)
- **5 catégories** : Protéine, Légume, Produit laitier, Épicerie, Autre
- **Onglets de filtrage** par fournisseur (avec compteurs)
- **Recherche texte** (nom + notes) avec focus préservé entre les frappes
- **Tri** : par fournisseur (groupé en sections colorées) ou par nom (A→Z)
- Couleurs vives par fournisseur — sections desktop séparées par bandeau coloré
- Vue mobile : cartes avec bord coloré gauche selon fournisseur
- Duplication via dropdown ⋯
- Accès : admin + chef

### 📖 Recettes (livre de cuisine)
- Recettes complètes avec ingrédients, étapes, conseils
- **Éditeur markdown** intégré avec toolbar (gras, italique, barré, listes à puces, numérotées)
- Raccourcis clavier : **Ctrl/⌘+B** (gras), **Ctrl/⌘+I** (italique)
- Parser markdown sécurisé (pas d'XSS — échappement HTML puis injection de tags contrôlés)
- Rétrocompat auto : les vieilles recettes en texte brut s'affichent comme listes
- Impression : header jaune avec texte noir (contraste AA)

### 🔁 Duplication universelle
- Option **Dupliquer** dans tous les dropdowns ⋯ : produits, recettes, menu, fournisseurs, ingrédients, employés, dépenses, revenus, tâches
- Ajoute « (Copie) » au nom, génère un nouvel ID, réinitialise `createdAt`/`updatedAt`
- Ajustements par collection : `products` → sortOrder à la fin, stock 0, désarchivé · `menu` → disponible par défaut
- Logue l'action dans l'historique

### 🌙 Général
- **Logo BOCHICA cliquable** (sidebar) → ramène au dashboard (admin) ou inventaire (employé). 36px, sans les barres tricolore
- **Dropdowns ⋯** : ferment au clic extérieur + Escape (avant, ils restaient ouverts)
- Dark mode (toggle, localStorage)
- Mobile responsive
- Session persistante
- PWA installable
- Recherche globale Cmd/Ctrl+K
- Bilingue FR/ES (toggle sidebar)

## 📝 Markdown dans les recettes

### Syntaxe supportée
- `**gras**` → **gras**
- `*italique*` → *italique*
- `~~barré~~` → ~~barré~~
- `- puce` (ou `* `, `• `) au début de ligne → liste à puces
- `1. étape` au début de ligne → liste numérotée (le numéro réel est automatique)
- Ligne vide → nouveau paragraphe

### Fonctions clés (dans `utils.js`)
- `renderMarkdown(text)` — parser sécurisé : échappe le HTML puis injecte nos tags contrôlés
- `autoMarkdownList(text, type)` — rétrocompat : préfixe les lignes d'un texte legacy sans markers
- `mdToolbar(textareaId)` — génère la toolbar HTML
- `mdWrap(id, before, after)` — enveloppe la sélection (gras, italique, barré)
- `mdPrefixLines(id, prefix)` — préfixe les lignes (toggle — supprime si déjà présent)
- `mdAttachShortcuts(textareaId)` — attache Ctrl/Cmd+B et +I

## ♿ Accessibilité

- **`<html lang="fr-CA">`** au lieu de `fr` (cohérence régionale)
- **Landmarks ARIA** : `<aside>` sidebar, `<main>`, `<header>` topbar, `<nav>` sidebar-nav
- **PIN-pad accessible** : `aria-label` sur chaque bouton, `role="alert"` sur l'erreur, `aria-live` sur affichage chiffres saisis
- **Navigation clavier** : Tab partout + chiffres/Backspace/Escape sur PIN
- **Focus visible** : outline 2px jaune (`var(--accent)`) global via `:focus-visible`
- **Dropdowns** : Escape pour fermer, clic extérieur pour fermer
- **Logo sidebar** : `aria-label="Retour au tableau de bord"` + focus visible
- **Modale catégories** : drag avec `aria-label="Glisser pour réordonner"` sur le handle
- **Toolbar markdown** : `role="toolbar"` + `aria-label` sur chaque bouton
- **`prefers-reduced-motion`** respecté
- **Contraste AA** : accent jaune avec texte noir (pas texte blanc sur jaune)
- **Topbar** : `aria-live="polite"` sur badge alerte

## 🔧 Constantes importantes (config.js)
- `ADMIN_PIN` = "0000"
- `EMPLOYEE_PIN` = "1111"
- `TPS_RATE` = 0.05
- `TVQ_RATE` = 0.09975
- `DEFAULT_SECTIONS` = ["Cuisine", "Emballage", "Bar", "Autre"] (servent de fallback + de référence pour le badge « défaut »)
- `SHIFT_TYPES` = Matin (#3b82f6), Soir (#8b5cf6), Journée (#22c55e), Congé (#94a3b8)
- `TASK_COLS` = ["À faire", "En cours", "Complété"]
- `MENU_CATS` = ["Entrées", "Plats principaux", "Desserts", "Boissons", "Autres"]
- `EXPENSE_CATS` = tableau objets `{ name, type }` fixe/variable

## 🚧 Contraintes importantes
- Aucune installation locale — tout via GitHub.com + Vercel
- **Vanilla JS uniquement** — pas de React, pas de build
- **CSS externalisé** dans `css/style.css` (utiliser les tokens, ne pas hardcoder les couleurs)
- Pour les couleurs dans les `style="..."` inline JS : utiliser `var(--token)` plutôt que `#hex`
- Chaque fichier JS = une section de l'app
- L'ordre des scripts dans index.html est critique (icons.js et i18n.js avant utils.js)
- **Bumper `CACHE_VERSION`** dans `sw.js` après un déploiement pour forcer la mise à jour chez les utilisateurs PWA
- Pour déboguer : F12 → Console → messages en rouge

## 📝 CHANGELOG

### 11 mai 2026 — Types d'événements étendus (v3.7.1) 🎤🎵
- **`EVENT_TYPES` passe de 4 à 6 valeurs** : `reservation`, `karaoke`, `spectacle`, `hors_bochica`, `ferie`, `interne`
- Ancien type `special` retiré (rétrocompat conservée dans `tEventType`, `tEventTypeShort`, `eventTypeIcon` et le CSS au cas où des événements en base utilisent encore ce slug)
- **3 nouvelles icônes** ajoutées à `icons.js` : `mic` (karaoké), `music` (spectacle), `map-pin` (hors Bochica)
- **3 nouveaux tokens CSS** : `--ev-karaoke` (#a855f7 violet), `--ev-spectacle` (#f97316 orange), `--ev-hors-bochica` (#64748b slate) avec variantes `*-soft` et adaptations dark mode
- Variantes ajoutées partout : `.ev-cal-pill--{karaoke,spectacle,hors_bochica}`, `.ev-type-pill--{...}`, `.ev-type-tab--{...}.is-active`, `.ev-card--{...}`, `.ev-legend-dot--{...}`
- Légende du calendrier mise à jour avec les 6 types
- `renderEvents()` : comptes par type calculés dynamiquement via `EVENT_TYPES.forEach` (plus de hardcoding)
- Bumper `CACHE_VERSION` à `v3.7.1`

### 11 mai 2026 — Événements / Calendrier (v3.7.0) 📅
- Nouvelle page **Événements** sous Liste d'ingrédients (admin + chef)
- Nouveau module `js/pages-events.js` (~470 lignes) :
  - `renderEvents()` — switcher de vue (calendrier / mois / à venir) + filtre type + recherche
  - `renderEventCalendar()` — grille 7×6 cases (42), navigation mois prev/next, click case vide → créer événement à cette date, max 3 pills par case + « +N autres », jour courant en pill jaune
  - `renderEventMonthList()` — liste chronologique des événements du mois (filtré)
  - `renderEventUpcoming()` — liste chronologique des 30 prochains jours
  - `openEventModal()` / `saveEvent()` — CRUD complet avec validation type/statut
  - Helpers : `todayISO()`, `isoToLocalDate()`, `daysBetween()`, `formatRelativeDate()`, `formatLongDate()`, `tEventType()`, `tEventTypeShort()`, `tEventStatus()`, `eventTypeIcon()`
- **Nouvelle collection Firestore `events`** : `id`, `name`, `date`, `time`, `type` (4 valeurs fixes), `status` (3 valeurs fixes), `capacity`, `contactName`, `contactPhone`, `contactEmail`, `notes`, `createdAt`, `updatedAt`
- **4 types fixes** (couleurs vives) : reservation (#4a90e2 bleu), special (#F7B32C jaune accent), ferie (#e74c3c rouge), interne (#7dbf66 vert)
- **3 statuts** : confirme (vert), attente (jaune ambré, italique), annule (rouge, barré)
- **Widget dashboard** : `renderDashUpcomingEvents()` affiche les 5 prochains événements à venir (60 jours, hors annulés) avec pill type + date relative
- **Règle Firestore** : `match /events/{doc=**}` lecture authentifiée + écriture admin/chef
- **Permissions** : ajout de `"evenements"` à `ROLE_PERMISSIONS.global_admin` et `.chef`
- **Sidebar** : nouvel item « Événements » sous Liste d'ingrédients (icône `calendar`)
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `events`)
- **CSS** : ~460 lignes ajoutées (`.ev-calendar`, `.ev-calendar__grid`, `.ev-cal-pill--{type}`, `.ev-card`, `.ev-type-pill--{type}`, `.ev-status-pill--{status}`, `.ev-views`, `.ev-type-tabs`, etc.) — couleurs vives par type, dark mode adapté, responsive mobile (cases compactes, heure cachée sur mobile)
- Tokens CSS dédiés : `--ev-reservation`, `--ev-special`, `--ev-ferie`, `--ev-interne` (+ variantes `*-soft`)
- Bumper `CACHE_VERSION` à `v3.7.0` + ajout de `pages-events.js` à l'app shell

### 4 mai 2026 — Liste d'ingrédients (v3.6.0) 🛒
- Nouvelle page **Liste d'ingrédients** sous Recettes (admin + chef)
- Nouveau module `js/pages-shopping.js` (~300 lignes) :
  - `renderShoppingList()` — vue avec onglets fournisseurs, recherche texte, tri (fournisseur/nom), groupement automatique par fournisseur en mode tri
  - `openShoppingModal()` / `saveShoppingItem()` — CRUD complet
  - Helpers `tShoppingSupplier()` / `tShoppingCategory()` pour libellés FR
- **Nouvelle collection Firestore `shoppingList`** : items avec `name`, `supplier` (3 valeurs fixes), `category` (5 valeurs fixes), `notes`, `createdAt`, `updatedAt`
- **3 fournisseurs fixes** : Costco (#4a90e2 bleu), Viandex (#e74c3c rouge), Gordon (#7dbf66 vert)
- **5 catégories** : Protéine, Légume, Produit laitier, Épicerie, Autre
- **Filtres** :
  - Onglets fournisseurs (Tous + 3 fournisseurs) avec compteurs et couleur active vive
  - Recherche texte (nom + notes) avec focus préservé entre frappes
  - Sélecteur de tri : par fournisseur (groupé en sections) ou par nom A→Z
- **Vue desktop** : tableau avec bande colorée gauche selon fournisseur ; sections séparées par titre coloré quand groupé
- **Vue mobile** : cartes avec bord coloré gauche, pills fournisseur+catégorie, notes en italique
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `shoppingList`)
- **Règle Firestore** : `match /shoppingList/{doc=**}` lecture authentifiée + écriture admin/chef
- **Permissions** : ajout de `"shopping"` à `ROLE_PERMISSIONS.global_admin` et `.chef`
- **Sidebar** : nouvel item « Liste d'ingrédients » sous Recettes (icône `cart`)
- **CSS** : ~300 lignes ajoutées (`.shopping-tabs`, `.shopping-pill--{costco,viandex,gordon}`, `.shopping-cat-pill--{cat}`, `.shopping-section`, `.shopping-row-mobile`, etc.) — couleurs vives propres à chaque fournisseur, dark mode adapté
- Bumper `CACHE_VERSION` à `v3.6.0` + ajout de `pages-shopping.js` à l'app shell

### 3 mai 2026 — Salaires & Pourboires v2 (v3.4.1) 💵
- **Inputs `<input type="time">`** à la place des selects 30 min : saisie précise à la minute près (ex. 13h17)
- **Pourboires par jour** : grille de 7 inputs (un par jour ouvert) au lieu d'un seul total ; le total semaine se calcule automatiquement (`tipsByDay: {dk: amount}` dans Firestore)
- **Comparaison planifié vs réel** :
  - Colonne « Réel / Planifié » dans le résumé de chaque ligne (ex. `25h / 23h`)
  - Nouvelle colonne « Écart » avec couleur (vert/rouge) et flèche ▲/▼
  - Hint planifié `📅 P:13:00→22:00` affiché sous l'input quand pas encore de saisie réelle
  - Indicateur visuel (cellule ambrée + barre latérale jaune) quand l'heure réelle diffère du planifié
- **Heures de service** déplacées en config globale (settings/payroll.defaultServiceHours par jour de semaine 0-6) :
  - Modifiables n'importe quand via la nouvelle modale « Heures de service »
  - S'appliquent automatiquement à toutes les semaines (passées et futures)
  - Affichées en sous-titre dans l'entête de chaque colonne jour
- **Bouton « Copier → S{n+1} »** : nouvelle action `duplicatePayrollToNextWeek()` qui copie actualShifts + tipsByDay vers la semaine suivante (remappage des clés de date), avec confirmation si la cible contient déjà des données
- Suppression de la carte « Heures de service » de la page principale (remplacée par la modale)
- Suppression du champ unique `totalTips` (remplacé par `tipsByDay` ; rétrocompat pour anciennes semaines)
- Bumper `CACHE_VERSION` à `v3.4.1`

### 3 mai 2026 — Salaires & Pourboires (v3.4.0) 💵
- Nouvelle page **Salaires & Pourboires** sous Employés & Horaires (admin seul)
- Nouveau module `js/pages-payroll.js` (~470 lignes) :
  - `renderSalaires()` — vue hebdomadaire avec sélecteur de semaine, fenêtre de service, total pourboires, pools cuisine/service, tableau heures réelles + salaires + pourboires
  - Helper `intersectShiftHours(shift, window)` — calcule l'intersection entre un shift et la fenêtre de service du jour (gère les chevauchements de minuit)
  - `getActualShift(empId, dk)` — fallback automatique sur l'horaire planifié si pas encore de saisie réelle
  - `subscribePayrollWeek()` — listener Firestore dynamique abonné/désabonné à chaque changement de semaine
- **Nouvelle collection Firestore `payroll`** : un doc par semaine ISO (`YYYY-Www`) avec `totalTips`, `serviceHours`, `actualShifts` (séparés des shifts planifiés)
- **Nouveaux settings `settings/payroll`** : `tipShares` (cuisine 25% / service 75% par défaut) + `defaultServiceHours`
- **Règles Firestore** : `match /payroll/{doc=**}` admin only
- Calcul automatique :
  - Salaire = heures réelles × taux (ou heures fixes × taux pour les salariés)
  - Pool cuisine = `totalTips × 0.25` réparti au prorata des heures de service des employés cuisine
  - Pool service = `totalTips × 0.75` réparti au prorata des heures de service des employés service+other
  - Badge ★ visible sur les cellules où la fenêtre de service ne couvre pas tout le shift
- Modale « Répartition » pour ajuster les % cuisine/service (validation : somme = 100%)
- Bouton « Reprendre du planifié » : initialise les heures réelles avec l'horaire planifié de la semaine
- Bumper `CACHE_VERSION` à `v3.4.0` + ajout de `pages-payroll.js` à l'app shell

### 24 avril 2026 — Cohérence design + fix bugs (v3.2.1 → v3.3.0) 🎨
- **2 bugs pré-existants corrigés** (v3.2.1) :
  - `autoApplyFixedExpenses` : `t.xxx` → `tpl.xxx` (les frais fixes mensuels s'appliquent maintenant correctement)
  - `openFixedTemplatesModal` : même fix sur la boucle `.map(tpl => …)`
- **Phase 2 du plan d'audit — migration inline styles** (v3.3.0) :
  - 25 nouvelles classes CSS utilitaires : `.text-muted`, `.text-secondary`, `.text-accent`, `.text-danger`, `.text-warning`, `.text-success`, `.text-left/center/right`, `.flex-1`, `.flex-row/col/center/between`, `.items-start/center`, `.gap-1..4`, `.mt-1..4`, `.mb-1..4`, `.fs-xs..lg`, `.font-*`, `.fw-*`, `.w-full`, `.empty-state-icon`, `.item-meta`
  - 6 nouvelles classes spécifiques : `.stats-grid`, `.stat-card` (+ variantes `--red/yellow/green`), `.month-picker`, `.month-picker__btn`, `.month-picker__label`
  - **67 inline styles migrés** vers des classes (282 → 215 restants)
  - Les 215 restants contiennent des valeurs dynamiques (couleurs interpolées, displays toggle, dimensions très spécifiques) — conservés en inline intentionnellement
  - Stats cards inventaire refactorées complètement
  - Sélecteur mois/année des dépenses refactor en `.month-picker`
  - Empty states unifiés via `.empty-state-icon`

### 24 avril 2026 — Refactor code (v3.2.0) 🧱
- **Découpage de `pages-admin.js`** (3570 lignes) en 4 modules par domaine métier :
  - `pages-hr.js` (1018 L) : Employés, Horaires, Coverage chart, imports, salaires fixes
  - `pages-finance.js` (1138 L) : Dépenses, Revenus, Catégories, Frais fixes, Rapports, Charts dépenses
  - `pages-kitchen.js` (737 L) : Menu, Fournisseurs, Ingrédients, Recettes
  - `pages-dashboard.js` (516 L) : Dashboard, Taxes, helpers taxes, autoApplyFixedExpenses
- **Suppression** de `renderMenuAnalysisLEGACY` (~183 lignes de code mort)
- Pas de changement fonctionnel, uniquement réorganisation
- 2 bugs pré-existants détectés (non corrigés, à traiter séparément) :
  - Dans `autoApplyFixedExpenses` : référence `t.supplier` au lieu de `tpl.supplier`
  - Dans `openFixedTemplatesModal` : même confusion `t` (i18n) vs `tpl` (variable)

### 24 avril 2026 — Système de toasts (v3.1.0) 💬
- Nouvelle fonction globale `toast(message, type, duration)` dans `utils.js`
- 35+ appels `alert()` natifs remplacés par des toasts (success/error/warning/info)
- Nouveau conteneur `#toasts` dans `index.html`, styles `.toast*` dans `style.css`
- Animation slide-in/out, auto-dismiss, accessible (`aria-live`, `role="alert"`)
- Position bottom-right desktop, top-full mobile

### 24 avril 2026 — Migration Firebase Auth + règles Firestore (v3.0.0) 🔐
- **Retrait du système SHA-256 côté client** (AUTH_ACCOUNTS, AUTH_SALT, hashPassword, verifyLogin supprimés)
- **Firebase Authentication** (Email/Password provider) pour la gestion des identifiants
- Nouveau mapping `AUTH_USER_EMAILS` dans `config.js` : username → email interne
- **Rôle lu depuis `/users/{uid}.role`** après login (vérifiable côté serveur)
- Nouveau fichier **`firestore.rules`** : protection complète par rôle (global_admin / chef / employee)
- Nouveau fichier **`FIREBASE_AUTH_SETUP.md`** : procédure migration initiale
- `auth.js` refondu : `initAuth()` + `onAuthStateChanged` remplacent `restoreSession()`
- `logout()` utilise `firebase.auth().signOut()`
- Messages d'erreur Firebase mappés en français (user-friendly)
- Anciennes sessions localStorage automatiquement nettoyées au chargement
- SDK `firebase-auth-compat.js` ajouté dans `index.html`

### 23 avril 2026 — Séance d'améliorations (v1.2.0 → v1.4.0)
- **v1.4.0 — Duplication universelle + fermeture dropdowns**
  - Option « Dupliquer » ajoutée dans 11 dropdowns (produits desktop/mobile, recettes, menu, fournisseurs, ingrédients desktop/mobile, employés, dépenses, revenus, tâches)
  - Fonction générique `duplicateItem(collection, id, nameField)` — ajoute « (Copie) », réinitialise timestamps, ajustements par collection
  - Dropdowns ⋯ ferment au clic extérieur + touche Escape (bug corrigé)
  - Nouvelle icône `copy`
- **v1.3.1 — Logo cliquable**
  - Le « BOCHICA » en haut à gauche devient un bouton qui ramène au dashboard (admin) ou inventaire (employé)
  - Logo agrandi : 18px → 36px
  - Suppression des 3 barres tricolore (jaune/bleu/rouge) sous le logo
- **v1.3.0 — Titres agrandis + éditeur markdown recettes**
  - Tailles de titres majorées de ~25% (Bebas étant condensé paraissait trop petit) : h1 48px, h2 38px, h3 28px, topbar 26px, recipe-view title 42px
  - **Éditeur markdown** pour ingrédients, étapes, conseils de recettes : toolbar (gras, italique, barré, listes puces/numérotées) + raccourcis Ctrl/⌘+B et +I
  - Parser markdown sécurisé (anti-XSS) avec rétrocompat auto pour anciennes recettes
  - Nouvelles icônes : bold, italic, list, list-ordered, strikethrough
- **v1.2.1 — Drag & drop catégories**
  - Remplacement des flèches ↑↓ par du drag & drop HTML5 natif
  - Handle `⋮⋮` (grip-vertical) + barre d'insertion jaune lumineuse au-dessus/en-dessous selon la position
  - Champ d'ajout déplacé en haut de la modale
- **v1.2.0 — Alignement design avec le site web (palette Crème Papier)**
  - Palette complètement refondue : bordeaux → jaune impact `#F7B32C`, crème `#f5f1e8`, texte noir chaud `#0e0d0c`
  - Typographie : Fraunces → Bebas Neue pour tous les titres
  - Nouvelle police mono : JetBrains Mono (classe `.kicker`)
  - Login screen : gradient noir → ambre, logo Bebas Neue 52px
  - Graphiques : profit line en jaune, palette doughnut revue
  - PWA : `theme_color` → jaune, `background_color` → crème
  - Ombres dynamiques via `rgba(var(--accent-rgb),...)`
  - `font-synthesis: none` globalement (évite faux bold/italic sur Bebas)
- **v1.1.1 — Recherche corrigée**
  - Bug du champ recherche qui ne prenait qu'un caractère à la fois → focus restauré après chaque renderPage via `requestAnimationFrame`
- **v1.1.0 — Gestion complète des catégories + onglets**
  - Modale « Gérer les catégories » refondue : toutes les catégories (défaut + custom) modifiables, supprimables, réordonnables
  - Schéma Firestore `settings/sections` étendu avec champ `all` (liste unifiée) + rétrocompat avec `custom`
  - Renommage → batch update de tous les produits concernés
  - Suppression → migration auto des produits vers « Autre »
  - Bouton « Voir toutes » sur la barre d'onglets (mode wrap multi-lignes)
  - Fondu aux extrémités du scroll horizontal (indicateur visuel)
  - Ajout de `icons.js` et `i18n.js` dans l'APP_SHELL du service worker

### 18 avril 2026 — Refactoring design + PWA (v1.0.0)
- Design system unifié avec le site web (première version bordeaux + Fraunces)
- CSS externalisé dans `css/style.css` (700+ lignes structurées avec tokens)
- Dark mode on-brand (chaleureux, pas gris bleuté)
- 80 couleurs hardcodées migrées vers tokens CSS dans les modules JS
- PWA installable : manifest.json + sw.js + icônes 192/512
- Login refait avec couleurs Bochica
- Accessibilité : PIN-pad ARIA, landmarks, focus visible, prefers-reduced-motion
- Animations modale : fadeIn + slideUp

## 📝 Reste à faire
- [ ] Optimiser `icon-maskable-512.png` (actuellement copie de icon-512.png — devrait avoir un padding pour la "safe zone" Android)
- [ ] Tester l'installation PWA sur iOS et Android
- [ ] Ajouter une page « À propos » / « Versions » pour suivre les mises à jour
- [ ] Considérer un mode hors ligne avec indication visuelle (badge « offline »)
- [ ] Notifications push (anniversaires employés, frais fixes du mois, etc.)
- [ ] Drag & drop tactile (mobile) pour les catégories — actuellement desktop-only (HTML5 native drag)
- [ ] Migration optionnelle des anciennes recettes (ajout auto des `- ` en base) au lieu du fallback à l'affichage
