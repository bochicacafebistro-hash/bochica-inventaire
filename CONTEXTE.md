# 📋 CONTEXTE — Projet Bochica Inventaire

> ⚠️ **Mise à jour majeure : 18 avril 2026** — refactoring design system pour s'aligner sur le site web bochicacafebistro.ca + PWA installable.

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
│   └── style.css           ← Design system complet (700+ lignes)
├── js/
│   ├── config.js           ← Config Firebase + constantes globales
│   ├── state.js            ← Variables globales
│   ├── utils.js            ← Fonctions utilitaires
│   ├── inventaire.js       ← Page inventaire, stock, drag & drop
│   ├── modals-produits.js  ← Modals produit, note, catégorie, réception
│   ├── pages-secondaires.js ← Pages rapport, historique, tâches
│   ├── pages-admin.js      ← Pages employés, dépenses, revenus, menu, fournisseurs
│   ├── sidebar.js          ← Navigation, sidebar, renderPage()
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

## 🎨 Design System Bochica (aligné sur le site web — palette Crème Papier)

### Palette
- **Accent principal** : jaune impact `--accent: #F7B32C` (CTA, prix, actif)
- **Accent hover** : ambre `--accent-hover: #E09E1E`
- **Accent soft** : crème-jaune tint `--accent-soft: #fef2d4`
- **Accent warm** : jaune brûlé `--accent-warm: #8a6a1a` (petits eyebrows)
- **Accent text** : noir chaud `--accent-text: #0e0d0c` (contraste AA sur jaune)
- **Fonds clair** : crème papier `--bg: #f5f1e8`, `--surface: #ffffff`, `--surface2: #ede3d2`, `--surface3: #e5d9c4`
- **Texte** : noir chaud `--text: #0e0d0c`, `--text2: rgba(14,13,12,.72)`, `--text3: rgba(14,13,12,.5)`
- **Tricolore Colombie** : jaune `#F7B32C`, bleu `#4a90e2`, rouge `#e74c3c`
- **États stock** : rouge `#d9534f`, jaune-ambré `#b45309`, vert `#7dbf66`
- **Bordures** : `rgba(14,13,12,.1)` (subtile) / `rgba(14,13,12,.25)` (marquée)

### Dark mode adapté on-brand
- Fonds : `#14110f`, `#1c1815` (chaleureux, pas gris bleuté)
- Accent : jaune `#F7B32C` (identique au clair — le jaune reste visible sur fond sombre)
- Accent hover dark : jaune clairci `#ffc94a`

### Typographie (aligné site web)
- **Display / titres** : `Bebas Neue` — h1-h6, stats numériques, prix, logo, eyebrows
- **Corps** : `Inter` (300-800) — UI, formulaires, body, boutons
- **Mono** : `JetBrains Mono` (400, 500, 600) — kickers techniques, tags, classe `.kicker`
- **Note** : `font-synthesis: none` sur body — évite les faux bold/italic sur Bebas qui n'a qu'un poids
- **Échelle** : `--fs-xs` (11) → `--fs-sm` (13) → `--fs-base` (14) → `--fs-md` (16) → `--fs-lg` (18) → `--fs-xl` (22) → `--fs-2xl` (28) → `--fs-3xl` (36)

### Espacement
Échelle 4/8 : `--sp-1` (4) → `--sp-2` (8) → `--sp-3` (12) → `--sp-4` (16) → `--sp-5` (20) → `--sp-6` (24) → `--sp-7` (32) → `--sp-8` (48)

### Border-radius
`--radius-sm` (4) → `--radius-md` (8) → `--radius-lg` (12) → `--radius-xl` (16) → `--radius-pill` (20) → `--radius-full` (50%)

### Ombres et transitions
- `--shadow-sm/md/lg/modal`
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
- `theme_color` : `#6b1a1f` (bordeaux)
- `background_color` : `#faf6f0` (crème)
- **Shortcuts** : raccourcis vers Inventaire, Tâches, Dépenses

### Service Worker (`sw.js`)
- **Stratégie cache** : cache-first pour app shell (HTML, CSS, JS, fonts)
- **Stratégie réseau** : network-only pour Firebase (données toujours fraîches)
- **Mise à jour** : incrémenter `CACHE_VERSION` dans sw.js après un déploiement majeur

## ✅ Fonctionnalités existantes (inchangées)

### 📦 Inventaire
- Stats desktop : total produits, à commander, en stock (3 cartes en haut)
- Stock, statuts (rouge/jaune/vert), drag & drop, archivage, notes, sections
- Sections par défaut : Cuisine, Emballage, Bar, Autre + sections personnalisées
- Vue tableau desktop, vue cartes mobile

### 📋 Rapport / Historique / Tâches
- Rapport imprimable, log d'actions, Kanban 3 colonnes

### 👥 Employés & Horaires
- Fiche employé + grille horaire semaine

### 💰 Dépenses & Revenus
- Calcul TPS/TVQ auto, catégories personnalisables, frais fixes auto
- Stats : revenus, dépenses, taxes, profit/déficit
- Graphiques : barres 6 mois + camembert par catégorie

### 🍽️ Menu / 🏪 Fournisseurs
- Items par catégorie avec toggle disponible
- Fiches fournisseurs avec produits liés

### 🌙 Général
- Dark mode (toggle, localStorage)
- Mobile responsive
- Session persistante
- **PWA installable** (nouveau!)
- **Saisie clavier PIN** (nouveau!)

## ♿ Accessibilité (post-refactoring)

- **`<html lang="fr-CA">`** au lieu de `fr` (cohérence régionale)
- **Landmarks ARIA** : `<aside>` sidebar, `<main>`, `<header>` topbar, `<nav>` sidebar-nav
- **PIN-pad accessible** : `aria-label` sur chaque bouton, `role="alert"` sur l'erreur, `aria-live` sur affichage chiffres saisis
- **Navigation clavier** : Tab partout + chiffres/Backspace/Escape sur PIN
- **Focus visible** : outline 2px bordeaux global via `:focus-visible`
- **`prefers-reduced-motion`** respecté
- **Topbar** : `aria-live="polite"` sur badge alerte

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
- **Vanilla JS uniquement** — pas de React, pas de build
- **CSS externalisé** dans `css/style.css` (utiliser les tokens, ne pas hardcoder les couleurs)
- Pour les couleurs dans les `style="..."` inline JS : utiliser `var(--token)` plutôt que `#hex`
- Chaque fichier JS = une section de l'app
- L'ordre des scripts dans index.html est critique
- Pour déboguer : F12 → Console → messages en rouge

## 📝 CHANGELOG

### 23 avril 2026 — Alignement design avec le site web (palette Crème Papier)
- **Palette complètement refondue** : bordeaux → jaune impact `#F7B32C`, crème `#f5f1e8`, texte noir chaud `#0e0d0c`
- **Typographie** : Fraunces → **Bebas Neue** pour tous les titres, stats et displays
- **Nouvelle police mono** : JetBrains Mono pour les kickers techniques (classe `.kicker`)
- **Login screen** : gradient noir → ambre (au lieu de noir → bordeaux), logo Bebas Neue 52px
- **Graphiques** : profit line en jaune accent, palette doughnut revue (jaune Bochica en tête)
- **PWA** : `theme_color` → jaune `#F7B32C`, `background_color` → crème `#f5f1e8`
- **Ombres** : passage à `rgba(var(--accent-rgb),...)` pour être dynamiques au dark mode
- **`font-synthesis: none`** globalement — évite les faux bold/italic sur Bebas Neue
- Service Worker `v1.2.0` (force rafraîchissement du cache)

### 18 avril 2026 — Refactoring design + PWA (branche `refactor/design-system`)
- **Design system unifié** avec le site web (bordeaux + crème + tricolore Colombie)
- **Typographie** : Fraunces (titres) + Inter (corps), au lieu de system-ui
- **CSS externalisé** dans `css/style.css` (700+ lignes structurées avec tokens)
- **Dark mode** revu pour rester on-brand (chaleureux, pas gris bleuté)
- **80 couleurs hardcodées** migrées vers tokens CSS dans les modules JS
- **PWA installable** : manifest.json + sw.js + icônes 192/512
  - Cache app shell offline, données Firebase toujours fraîches
  - Shortcuts : Inventaire, Tâches, Dépenses
- **Login refait** : couleurs Bochica (gradient noir → bordeaux), logo Fraunces avec accent jaune sur "CA"
- **Accessibilité** :
  - PIN-pad avec aria-label, aria-live, support clavier complet (chiffres + Backspace + Escape)
  - Landmarks ARIA (`<aside>`, `<main>`, `<header>`, `<nav>`)
  - `<html lang="fr-CA">`, focus visible global, prefers-reduced-motion respecté
- **Animations** modale : fadeIn + slideUp pour transitions plus fluides

## 📝 Reste à faire (post-refactoring)
- [ ] Optimiser icon-maskable-512.png (actuellement copie de icon-512.png — devrait avoir un padding pour le "safe zone" Android)
- [ ] Tester l'installation PWA sur iOS et Android
- [ ] Ajouter une page "À propos" / "Versions" pour suivre les mises à jour
- [ ] Considérer un mode hors ligne avec indication visuelle (badge "offline")
- [ ] Notifications push (anniversaires employés, frais fixes du mois, etc.)
