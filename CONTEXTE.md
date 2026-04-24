# 📋 CONTEXTE — Projet Bochica Inventaire

> ⚠️ **Dernière mise à jour : 23 avril 2026** — alignement complet avec le site web (palette Crème Papier + Bebas Neue), gestion avancée des catégories, éditeur markdown pour les recettes, duplication universelle, logo cliquable.

## 🏠 Description
Application web de **gestion interne** pour le restaurant colombien Bochica.
- Hébergement : **Vercel** via **GitHub** (100% web, aucune installation locale)
- Base de données : **Firebase Firestore** (temps réel)
- **Installable comme PWA** sur mobile et desktop (Add to Home Screen)
- Pas de SEO — outil interne (`<meta name="robots" content="noindex, nofollow">`)

## 🔗 Liens
- GitHub : https://github.com/bochicacafebistro-hash/bochica-inventaire
- Vercel : https://bochica-inventaire.vercel.app

## 🔑 Connexion PIN
- Admin : `0000`
- Employé : `1111`
- Session sauvegardée dans localStorage (pas de déconnexion au rechargement)
- **Saisie clavier supportée** : chiffres pour entrer le PIN, Backspace pour effacer un chiffre, Escape/Delete pour effacer tout

## 🗂️ Structure des fichiers
```
bochica-inventaire/
├── index.html              ← HTML squelette (CSS externalisé)
├── manifest.json           ← Configuration PWA
├── sw.js                   ← Service Worker (cache offline)
├── favicon.ico
├── CONTEXTE.md             ← ce fichier
├── README.md
├── css/
│   └── style.css           ← Design system complet (2400+ lignes)
├── js/
│   ├── config.js           ← Config Firebase + constantes globales
│   ├── state.js            ← Variables globales (products, allSections, etc.)
│   ├── icons.js            ← Bibliothèque d'icônes Lucide SVG inline
│   ├── i18n.js             ← Traductions FR/ES
│   ├── utils.js            ← Utils, markdown parser, toolbar, duplicateItem, dropdowns
│   ├── inventaire.js       ← Page inventaire, stock, drag & drop produits
│   ├── modals-produits.js  ← Modals produit, note, catégorie (drag & drop), réception
│   ├── pages-secondaires.js ← Pages rapport, historique, tâches
│   ├── pages-admin.js      ← Dashboard, employés, dépenses, revenus, menu, fournisseurs, ingrédients, recettes
│   ├── sidebar.js          ← Navigation, sidebar, renderPage(), goHome()
│   ├── auth.js             ← Connexion PIN, logout, session, support clavier
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
<script src="js/pages-admin.js"></script>
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
