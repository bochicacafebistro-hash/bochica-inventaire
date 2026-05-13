# 📋 CONTEXTE — Projet Bochica Inventaire

> ⚠️ **Dernière mise à jour : 12 mai 2026** — nouvelle page **Simulation paie** (v3.10.0) : scénarios hypothétiques RH (admin seulement). Création d'une simulation à partir de l'horaire planifié courant → copie figée (baseline) + version modifiable. Modification libre des noms, taux horaires, sections, heures par jour, pourboires totaux, parts cuisine/service. Ajout d'employés fictifs (futures embauches) et retrait d'employés (départs). Comparaison côte à côte du réel vs la simulation avec écart $ et % par employé + totaux (heures, masse salariale, pourboires, total à payer). Persistance Firestore (`payrollSimulations`) → plusieurs scénarios sauvegardables.

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
│   ├── pages-simulations.js ← Simulation paie (scénarios RH hypothétiques, comparaison côte à côte)
│   ├── pages-finance.js    ← Dépenses, revenus, catégories, frais fixes, rapports, charts dépenses
│   ├── pages-kitchen.js    ← Menu, fournisseurs, ingrédients, recettes
│   ├── pages-shopping.js   ← Liste d'ingrédients (commandes par fournisseur)
│   ├── pages-events.js     ← Événements / calendrier (réservations, soirées, etc.)
│   ├── pages-quotes.js     ← Soumissions (devis clients + génération PDF jsPDF)
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
<script src="js/pages-simulations.js"></script>
<script src="js/pages-finance.js"></script>
<script src="js/pages-kitchen.js"></script>
<script src="js/pages-shopping.js"></script>
<script src="js/pages-events.js"></script>
<script src="js/pages-quotes.js"></script>
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
  - `quotes` — **soumissions** (devis pour clients) — admin uniquement :
    - Champs : `id`, `quoteNumber` (YYYY-NNN), `clientName`, `clientCompany`, `clientPhone`, `clientEmail`, `eventDate`, `eventTime`, `eventVenue` (∈ `bochica`/`client`/`autre`), `eventAddress`, `guestCount`, `packageId`, `packageSnapshot` (copie figée du forfait), `beerAddon`, `customLines[]` ({description, amount}), `depositAmount`, `depositPaid`, `validUntil`, `notes`, `status` (∈ `brouillon`/`envoyee`/`acceptee`/`refusee`/`expiree`), `createdAt`, `updatedAt`, `createdBy`
  - `quoteTemplates` — **forfaits par défaut** (base des soumissions) — admin écriture, admin+chef lecture :
    - Champs : `id`, `name`, `label`, `pricePerPerson`, `accentColor` (∈ `yellow`/`red`/`blue`/`green`), `entree`, `plat`, `boisson`, `beerPrice`, `sortOrder`
    - Seed automatique au 1er lancement (Essentiel 22$ + Gourmand 27$) via `DEFAULT_QUOTE_TEMPLATES` dans `config.js`
  - `payrollSimulations` — **scénarios paie hypothétiques** (admin seulement) :
    - Champs : `id`, `name`, `description`, `baseWeekRef` (ex: `2026-W19`), `createdAt`, `updatedAt`, `createdBy`
    - `baseline` : SNAPSHOT FIGÉ au moment de la création (référence "réel" pour comparaison)
    - `simulation` : COPIE MODIFIABLE — l'utilisateur édite seulement celle-ci
    - Structure commune (`baseline` et `simulation`) : `{ employees[], serviceHours, tipShares, totalTips, openDays }`
    - `employees[]` = `[{ id, name, section, hourlyRate, isSalaried, fixedWeeklyHours, role, isFictional, shifts }]`
    - **shifts indexés par jour de semaine (0=Lun..6=Dim)** plutôt que par date — la sim est indépendante d'une semaine particulière
    - `isFictional: true` pour les employés ajoutés dans la simulation (futures embauches)
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

### 📈 Simulation paie (scénarios hypothétiques RH)
- Page **Simulation paie** (admin seulement) sous Salaires & Pourboires
- **Création** depuis l'horaire planifié courant : snapshot figé (baseline) + version modifiable (simulation)
- Donne un nom + description au scénario (ex : « Embauche serveuse été », « Hausse salaire cuisine +2$/h »)
- **Modifications possibles** sur la simulation :
  - Renommer un employé fictivement
  - Changer le taux horaire
  - Changer la section (cuisine / service / autre) → impacte la répartition des pourboires
  - Ajuster les heures de chaque jour (entrée/sortie par dropdown 30 min)
  - **Ajouter des employés fictifs** (badge « FICTIF ») pour tester une future embauche
  - **Retirer un employé** de la simulation (badge « RETIRÉ » dans la comparaison)
  - Modifier le total pourboires + parts cuisine/service
  - Modifier les heures de service par jour de semaine
  - Modifier les jours d'ouverture
- **Comparaison côte à côte** : tableau Réel | Simulation | Écart $ avec % par employé + ligne TOTAL
- **4 KPI en haut** : Heures totales, Masse salariale, Pourboires distribués, Total à payer (avec écart $/%)
- **Code couleur sémantique** :
  - Coûts qui augmentent (masse salariale, total) → rouge
  - Coûts qui baissent → vert
  - Pourboires qui montent → vert (positif pour l'équipe)
  - Heures qui montent → vert (plus de couverture)
- **Bouton « Réinitialiser au réel »** : écrase la simulation par le snapshot baseline
- **Duplication** : créer une variante d'une simulation existante
- **Plusieurs scénarios sauvegardés** simultanément (Firestore `payrollSimulations`)
- **Persistance sans toucher au réel** : aucune modification de la simulation n'affecte les vrais employés, horaires ou paie
- Reset automatique à la liste quand on clique sur « Simulation paie » dans la sidebar (sortie propre de l'éditeur)

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

### 🧾 Soumissions (devis avec génération PDF)
- Page **Soumissions** (admin seulement) sous Événements
- **CRUD complet** : créer, modifier, dupliquer, supprimer une soumission
- **Numérotation auto** : format `YYYY-NNN` (ex. `2026-001`) calculé à partir des soumissions existantes
- **Champs client** : nom, entreprise, téléphone, courriel
- **Champs événement** : date, heure, lieu (Bochica / chez le client / autre), adresse, nombre de personnes
- **Choix de forfait** : cartes radio interactives (couleur d'accent visible) → sélection d'un des forfaits configurés
- **Add-on bière** : toggle qui ajoute le prix bière du forfait × nombre de personnes
- **Lignes personnalisées** : ajout dynamique de suppléments (ex. « Décor 100$ ») ou rabais (montants négatifs)
- **Dépôt** : montant exigé + case « déjà versé », solde calculé automatiquement
- **Date de validité** : par défaut +30 jours, affichée sur le PDF
- **5 statuts** : Brouillon · Envoyée · Acceptée · Refusée · Expirée — changement rapide via dropdown ⋯
- **Snapshot du forfait** : copie figée des données du forfait au moment de la création (les PDF anciens restent corrects même si on modifie un template par la suite)
- **Génération PDF (jsPDF)** : design fidèle à `Menu_Forfaits.pdf` :
  - Logo BOCHICA + sous-titre « Restaurant Colombien » + tricolore jaune/bleu/rouge
  - Titre « Soumission » + numéro centré
  - Bloc Client + Bloc Événement (2 colonnes, fond crème)
  - Carte forfait avec barre latérale colorée (selon `accentColor`), prix en rouge, séparateur pointillé, bullets bleus pour Entrée / Plat / Boisson
  - Section bière sur fond jaune si activée
  - Liste des suppléments (rabais en vert)
  - Sous-total → TPS 5% → TVQ 9,975% → TOTAL en gras
  - Si dépôt : ligne « Dépôt versé/exigé » + « Solde à payer »
  - Notes + footer « Soumission valide jusqu'au … »
  - Nom de fichier : `Bochica_Soumission_{numéro}_{client}.pdf`
- **Forfaits éditables** : modale « Gérer les forfaits » accessible via toolbar
  - Modifier nom, étiquette, prix/personne, couleur d'accent (jaune/rouge/bleu/vert), contenu (entrée/plat/boisson), prix bière
  - Ajouter de nouveaux forfaits (illimité)
  - Supprimer un forfait (avertissement si des soumissions l'utilisent)
- **Seed automatique** : au premier lancement, 2 forfaits par défaut sont créés (L'Essentiel 22$ avec accent jaune, Le Gourmand 27$ avec accent rouge) — calqués sur le PDF original

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

### 12 mai 2026 — Sim : Mt/jour + Ventes prévues + Ratio salaires (v3.10.5) 💰📊
- **Nouveau tfoot dans le tableau de simulation** (3 lignes, comme dans Employés & Horaires) :
  - **Heures / jour** : total des heures travaillées chaque jour ouvert
  - **Mt / jour** : coût salarial brut par jour (salariés au prorata du nb de jours ouverts, horaires × taux pour les autres)
  - **Ventes prévues** : Mt/jour ÷ ratio salaires/ventes — sert à projeter les ventes nécessaires pour respecter le ratio cible
- **Nouveau paramètre dans « Paramètres globaux »** : champ `Ratio salaires / ventes (%)` (défaut 32%, modifiable) avec hint « Base : X% · Cible <32% ». Stocké dans `simulation.salesRatio` + `baseline.salesRatio` (snapshot du `scheduleSettings.salesRatio` lors de la création).
- **`computeSimScenario`** étendu pour retourner `dayTotalsHours[7]` et `dayTotalsCost[7]` (indexés 0=Lun..6=Dim, 0 pour jours non ouverts). Logique salariés alignée avec `pages-hr.js` (coût hebdo fixe réparti sur les jours ouverts).
- **`createSimFromPlanned`** snapshoote maintenant aussi `salesRatio` dans le baseline.
- Nouvelle fonction `updateSimSalesRatio(simId, percentStr)`.
- **CACHE_VERSION** bumpé à `v3.10.5`

### 12 mai 2026 — Hauteur uniforme taux/section (v3.10.4) 📏
- **Sim** : `height:24px` + `box-sizing:border-box` + `line-height:1` forcés sur `.sim-rate-input` ET `.sim-section-select` pour qu'ils s'alignent parfaitement côte à côte (avant : hauteur dépendait du browser/UA-styles).
- **CACHE_VERSION** bumpé à `v3.10.4`

### 12 mai 2026 — Cellule employé sim ultra-compacte (v3.10.3) 📏
- **Page Simulation paie — cellule employé compactée drastiquement** :
  - Retrait de l'icône `$` et du label `$/h` (info implicite — pas besoin de la rappeler)
  - Retrait des "mini-fields" englobants (`.sim-mini-field`) avec leur padding et bordure interne
  - Remplacé par : input taux direct (`.sim-rate-input`) + select section direct (`.sim-section-select`), sans wrapper
  - Largeur colonne emp : **220px → 160px** (gain de 60px de largeur pour les colonnes jours)
  - min-height ligne : 48px → 44px
  - Spinners natifs cachés sur l'input taux (`-webkit-appearance:none`)
  - Chevron du select customisé en SVG inline pour gagner ~10px (vs chevron natif)
  - Min-width table : 1100px → 1000px
- **CACHE_VERSION** bumpé à `v3.10.3`

### 12 mai 2026 — Refonte UI Salaires & Simulation (v3.10.2) 🎨🔧
- **Page Salaires & Pourboires** :
  - **Retrait des badges « Auto-importé »** dans chaque cellule (bruit visuel énorme). L'info reste accessible via le tooltip de la cellule + le fond bleuté discret.
  - **Inputs `type="time"` compactés** : retrait de l'icône native d'horloge Webkit (`::-webkit-calendar-picker-indicator { display:none }`), retrait des spinners, police 13px mono, centré, padding 3px×2px. Largeur min réduite à 54px.
  - **Cellule « Réel / Planif » sur une ligne** : `12.5h / 14h` au lieu d'empilé. Police 14px pour le réel, 10px mono pour le planifié.
  - **Bug visuel « +H » corrigé** : quand l'écart est zéro, on affiche `=` (vert) ou `—` au lieu d'un `+H` orphelin.
  - **Badges cuisine/service** plus discrets (9px, padding 1×5).
  - **Pourboire du jour** rendu discret (9px mono, sans fond) — l'info reste lisible sans dominer la cellule.
  - **Largeur min table** = 1100px → scroll horizontal propre au lieu de chevauchement.
- **Page Simulation paie** :
  - **KPI tuiles** : valeur descendue de 28px à 22px pour respiration.
  - **Cellule employé** compactée : nom 14px, taux+section mini-fields 10-11px avec padding 2×5.
  - **Hauteur de ligne** auto avec min-height 48px (au lieu de fixe 42px) pour accueillir nom + champs.
  - **Largeur min table** = 1100px.
  - **Toast d'erreur clair** si les règles Firestore `/payrollSimulations` ne sont pas publiées (`permission-denied` → message « ⚠ Règles Firestore manquantes… ») : aide l'admin à diagnostiquer le bug « sim disparaît au reload ».
- **CACHE_VERSION** bumpé à `v3.10.2`

### 12 mai 2026 — Fix race condition au démarrage + tableaux compacts (v3.10.1) 🐞🔠
- **Fix bug critique** : à l'ouverture de l'app, les données n'apparaissaient pas tant qu'on ne rechargeait pas la page manuellement. Cause : les listeners Firestore avec filtre `if (isLoggedIn && activePage === "X")` ne déclenchaient pas de render si leur snapshot arrivait APRÈS `applyLogin` et que la page active (souvent `dashboard`) ne matchait pas le filtre. Beaucoup de listeners (`expenses`, `revenues`, `tasks`, `menuItems`, `fixedExpenseTemplates`) étaient concernés.
- **Solution** : nouveau helper `shouldRender(collKey, ...activePages)` qui retourne toujours `true` au PREMIER snap de chaque collection (peu importe la page), puis applique le filtre habituel pour les snaps suivants. Ajout d'un Set global `_firstSnapshots` dans `state.js`, reset au logout dans `auth.js`.
- **Filtres `activePage` élargis** au passage : `employees` re-render aussi sur `salaires`/`simulations`/`dashboard` ; `expenses`/`revenues` re-render aussi sur `dashboard`/`taxes` ; `tasks`/`menuItems` re-render aussi sur `dashboard`.
- **Tableau Horaire + Simulation rendus plus compacts** :
  - Police descendue de `var(--fs-lg)` (18px) à `var(--fs-base)` (14px) sur : nom employé, heures (Entr/Sort), résumés (Heures/Taux/Total), tfoot (Heures/jour, Mt/jour, Ventes…)
  - Ligne Écart KPI : 20px → 16px (`var(--fs-md)`) pour rester légèrement plus gros que le reste
  - Hauteur de ligne 54px → 42px pour suivre la nouvelle taille
  - Mobile (≤900px) : hauteur 48px → 38px, polices `fs-md` → `fs-sm` (13px)
  - Sim : `.sim-input-name` 16px → 14px pour cohérence
- **CACHE_VERSION** bumpé à `v3.10.1`

### 12 mai 2026 — Simulation paie (v3.10.0) 📈🧮
- **Nouvelle page Simulation paie** sous Salaires & Pourboires (admin seulement)
- **Modèle de données** : nouvelle collection Firestore `payrollSimulations` avec `baseline` (snapshot figé du planifié) + `simulation` (copie modifiable)
- **Nouveau fichier** `js/pages-simulations.js` (~600 lignes) avec :
  - `renderSimulations()` : liste des scénarios sauvegardés (cartes avec comparaison rapide réel/sim + écart $)
  - `renderSimulationEditorHTML()` : éditeur complet d'une simulation (KPI + paramètres globaux + tableau employés + comparaison)
  - `computeSimScenario()` : calculs de salaires + pourboires (réutilise `hoursFromShift`, `intersectShiftHours`)
  - `createSimFromPlanned()` : snapshot depuis horaire planifié courant — conversion shifts par date → par index de jour de semaine (0=Lun..6=Dim)
  - CRUD complet : créer, modifier, dupliquer, réinitialiser au baseline, supprimer
  - Ajout/retrait d'employés fictifs (badge FICTIF / RETIRÉ / AJOUTÉ)
  - Édition de nom, taux, section, heures par jour, pourboires, parts cuisine/service, heures de service, jours ouverts
- **Sidebar** : nouvelle entrée « Simulation paie » sous Salaires (icône `trending-up`)
- **Permissions** : `simulations` ajouté à `ROLE_PERMISSIONS.global_admin.canAccess/canWrite`
- **Firestore rules** : règle `/payrollSimulations/{doc=**}` admin only (contient données financières + identité employés)
- **Listener Firestore** dans `firebase-listeners.js` avec préservation du focus dans l'éditeur (sinon perte de saisie après chaque update)
- **Reset automatique** de `_editingSimId` dans `navTo()` → clic sidebar « Simulation paie » = retour à la liste
- **CSS** : ~350 lignes (cartes de simulation, KPI tuiles, tableau côte à côte avec colonnes teintées, badges FICTIF/RETIRÉ/AJOUTÉ, dark mode adapté, responsive 900px / 640px)
- **Code couleur sémantique** : coûts qui montent = rouge, qui baissent = vert ; heures et pourboires qui montent = vert
- **Persistance multi-scénarios** : plusieurs simulations peuvent coexister, chacune avec son baseline figé
- **Indépendance temporelle** : shifts stockés par jour de semaine (0..6), pas par date → la sim n'est pas attachée à une semaine particulière
- **CACHE_VERSION** bumpé à `v3.10.0` + `pages-simulations.js` ajouté à l'app shell du SW

### 11 mai 2026 — Tableau uniforme + taille 18px (v3.9.3) 📐
- **Toutes les lignes employés à la MÊME HAUTEUR** : `height: 54px` sur `.schedule-emp-row` + `.schedule-emp-row td` (peu importe le contenu)
- **Toutes les colonnes d'heures (entrée/sortie) à la MÊME LARGEUR** : `width: 64px` strict
- **`table-layout: fixed`** activé sur la table → les largeurs déclarées sont respectées strictement (avant : auto-resize selon contenu)
- **Tailles descendues à `var(--fs-lg)` = 18px** uniformément (nom employé, heures, summary, total, footer)
- Largeurs ajustées :
  - Colonne employé : 170 → **150 px**
  - Colonnes entrée/sortie : 64 px (uniforme)
  - Colonnes summary : 80 → **70 px**
  - Min-width select heure : 72 → **60 px**
  - Table min-width : 980 → **920 px**
- Mobile : tout à `var(--fs-md)` (16px), height 48px, colonnes entrée/sortie 58px, employé 130px
- Bumper `CACHE_VERSION` à `v3.9.3`

### 11 mai 2026 — Tailles redescendues à 22px (28px coupait les heures) (v3.9.2) 📐
- 28px était trop gros : les heures « HH:MM » étaient coupées en « 11:0 » dans les cellules entrée/sortie
- **Tout redescendu à `var(--fs-xl)` (22px)** uniformément :
  - Nom employé, heures entrée/sortie (selects), Heures/Taux/Total, totaux footer — toutes au même format **22px**
- Largeurs ajustées en conséquence :
  - Colonne employé : 200 → **170 px**
  - Min-width select heure : 80 → **72 px** (juste assez pour « 22:00 » à 22px mono)
  - Largeur colonne summary : 96 → **80 px**
  - Table min-width : 1100 → **980 px**
- Mobile : tout à `var(--fs-lg)` (18px) avec colonnes proportionnellement réduites
- Bumper `CACHE_VERSION` à `v3.9.2`

### 11 mai 2026 — Cellule employé simplifiée + tout à 28px (v3.9.1) 🔠
- **Cellule employé simplifiée** dans la grille horaire :
  - Avant : grip + nom + pill section (Cuisine/Service/Autre) + rôle
  - **Après : grip + nom seulement** — interface plus épurée et plus lisible
  - (les sections + rôles restent éditables via la modale Fiche employé, juste pas affichés dans le tableau)
- **TOUS les chiffres et le nom de l'employé au même format** que la cellule Total : **`var(--fs-2xl)` = 28px**
  - `.schedule-emp-name` : `fs-lg` (18) → **`fs-2xl` (28)** + `font-weight: 700`
  - `.schedule-time` : `fs-lg` (18) → **`fs-2xl` (28)**, min-width 66 → 80px
  - `.schedule-td--summary` (Heures/Taux/Total) : déjà à 28px
  - `.schedule-td--total` : déjà à 28px
  - `.schedule-tfoot-val` : `fs-xl` (22) → **`fs-2xl` (28)**
  - `.schedule-tfoot-row td` : `fs-xl` (22) → **`fs-2xl` (28)**
- **Grip drag&drop** : icône passée de 14px → 16px pour rester proportionné
- **Largeur table min** : 920 → **1100 px** (la colonne employé est à 200px minimum)
- **Mobile** : tout à `var(--fs-xl)` (22px) — taille moyenne pour rester lisible sur petit écran sans casser le scroll horizontal. Table min-width 820 → 980 px
- Bumper `CACHE_VERSION` à `v3.9.1`

### 11 mai 2026 — Padding réduit + chiffres encore plus gros (v3.9.0) 📏
- **Padding aggressivement réduit** dans les cases d'heures pour libérer l'espace :
  - `.schedule-table td/th` : `6px 4px` → **`3px 4px`** (vertical divisé par 2)
  - `.schedule-td--cell` : `2px` → **`1px`**
  - `.schedule-time` (select) : `6px 2px` → **`1px 1px`** + `line-height:1.1` pour rendu compact
- **`.schedule-time` agrandi** : `fs-md` (16px) → **`fs-lg` (18px)**
- Mobile : `.schedule-time` aussi mis à `fs-md` (16px) avec mêmes paddings réduits
- Bumper `CACHE_VERSION` à `v3.9.0`

### 11 mai 2026 — Numéros encore plus gros (v3.8.9) 🔢
- Chaque taille du tableau Employés montée d'un cran supplémentaire :
  - `.schedule-time` (heures entrée/sortie) : `fs-base` (14px) → **`fs-md` (16px)**
  - `.schedule-td--summary` (Heures / Taux / Total) : `fs-xl` (22px) → **`fs-2xl` (28px)**
  - `.schedule-td--total` : `fs-xl` (22px) → **`fs-2xl` (28px)**
  - `.schedule-tfoot-val` (totaux par jour) : `fs-lg` (18px) → **`fs-xl` (22px)**
  - `.schedule-tfoot-row td` (label de ligne foot) : `fs-lg` (18px) → **`fs-xl` (22px)**
- Largeurs ajustées : colonne summary 84 → **96 px**, min-width des selects time 60 → **66 px**
- Mobile : pareil, un cran de plus partout — table min-width 780 → 820 px
- Bumper `CACHE_VERSION` à `v3.8.9`

### 11 mai 2026 — 2 couleurs vives qui contrastent (v3.8.8) 🟡🔵
- **Retour à 2 couleurs distinctes** au lieu de 2 tons d'une même couleur :
  - Lignes paires (0, 2, 4...) → **jaune Bochica** `#F7B32C` (`247,179,44`)
  - Lignes impaires (1, 3, 5...) → **bleu Colombie** `#4a90e2` (`74,144,226`)
- **Opacités vives** (0.45 base, 0.65 total) pour que les couleurs ressortent bien sans masquer le texte
- **Hover** : 0.60 / 0.80 — la ligne survolée s'illumine clairement
- **Uniformité par ligne maintenue** : toutes les cellules d'une même ligne ont exactement la même couleur, peu importe si remplie ou vide
- **CSS simplifié** : les sélecteurs `.is-odd` / `.is-even` sont retirés (la couleur RGB est injectée directement par le JS via `--emp-rgb`)
- Bumper `CACHE_VERSION` à `v3.8.8`

### 11 mai 2026 — Jaune plus vif, alternance plus marquée (v3.8.7) 🟨
- Opacités du zébré employés **rehaussées** pour mieux voir la différence entre les 2 tons :
  - Ton foncé : 0.22 → **0.38**
  - Ton clair : 0.08 → **0.15**
  - Cellule total (foncé) : 0.35 → **0.55**
  - Cellule total (clair) : 0.20 → **0.32**
  - Hover foncé : 0.35 → **0.52**
  - Hover clair : 0.18 → **0.28**
- Dark mode ajusté proportionnellement (0.40 / 0.18 / 0.58 / 0.35)
- Bumper `CACHE_VERSION` à `v3.8.7`

### 11 mai 2026 — Zébré jaune Bochica uniforme (v3.8.6) 🟡
- **Couleur** : retour au **jaune Bochica `247,179,44`** (l'accent de marque) au lieu du gris
- **Uniformité par ligne** : toutes les cellules d'une même ligne ont maintenant la **même opacité** — peu importe si la cellule contient des heures (`.is-filled`) ou non
  - Avant : la cellule remplie était plus foncée que la vide → effet "tache" sur la ligne
  - Après : ligne entière du même ton → effet zébré franc et lisible
- **2 tons d'opacité** :
  - Ligne impaire (`.is-odd`) — ton foncé : opacité 0.22
  - Ligne paire (`.is-even`) — ton clair : opacité 0.08
- **Cellule TOTAL** (la dernière colonne) : légèrement plus marquée (0.35 / 0.20) pour rester un point d'ancrage visuel
- **Hover** : ligne entière s'illumine en même couleur (0.35 / 0.18) — pas de variation par cellule
- **Dark mode** : opacités calibrées (0.25 / 0.10) — le jaune accent reste visible sur fond sombre
- Bumper `CACHE_VERSION` à `v3.8.6`

### 11 mai 2026 — Zébré 1 couleur 2 tons + chiffres plus gros (v3.8.5) ⚫⚪
- **Tableau Employés & Horaires** : passage à un **vrai zébré** sur une seule couleur (gris noir chaud `14,13,12`) avec deux opacités différentes :
  - Lignes impaires (`.is-odd`) — ton plus foncé : opacités 0.06 / 0.10 / 0.14 / 0.18 (cellule / emp+summary / total / filled)
  - Lignes paires (`.is-even`) — ton plus clair : opacités 0.02 / 0.04 / 0.08 / 0.12
  - Plus de couleur de marque par ligne — sobre et professionnel
- **Hover** : utilise maintenant l'accent jaune Bochica (`rgba(var(--accent-rgb), .14)` → `.25` selon cellule) pour bien signaler la ligne survolée sans rendre le tableau bruyant
- **Bande latérale colorée à gauche retirée** (`border-left-color: transparent !important`) — l'identification par employé se fait uniquement par leur nom maintenant
- **Chiffres plus gros et plus foncés** dans tout le tableau :
  - `.schedule-time` (heures entrée/sortie) : `var(--fs-sm)` → `var(--fs-base)` (13 → 14px), `font-weight: 700`, font-family JetBrains Mono pour meilleure lisibilité numérique
  - `.schedule-td--summary` (Heures / Taux / Total) : `var(--fs-lg)` → `var(--fs-xl)` (18 → 22px), `font-weight: 700`, largeur 78 → 84px
  - `.schedule-td--total` (cellule total payé) : `font-weight: 600` → `800` (extra-bold), couleur noir chaud au lieu de jaune pour meilleur contraste
  - `.schedule-tfoot-val` (totaux par jour en bas) : `var(--fs-md)` → `var(--fs-lg)` (16 → 18px), `font-weight: 700`
- **Mobile** : tailles ajustées en proportion (`fs-md` → `fs-lg` pour summary, ajout de `font-weight: 700` sur `.schedule-time` et `.schedule-tfoot-val`)
- **Dark mode** : opacités calibrées avec `245,241,232` (crème) à la place de `14,13,12` (noir) pour le bon contraste sur fond sombre
- JS : nouvelle class `is-odd` / `is-even` injectée sur `<tr>` selon `rowIdx % 2`
- Bumper `CACHE_VERSION` à `v3.8.5`

### 11 mai 2026 — Palette Employés simplifiée (v3.8.4) 🎨
- **Tableau Employés & Horaires** : palette `EMP_RGB` réduite de **8 couleurs → 2 couleurs** en alternance
  - Avant : bleu, jaune, rouge, vert, violet, orange, teal, rose (cyclées sur `sortOrder`)
  - Après : **jaune Bochica `247,179,44`** + **bleu Colombie `74,144,226`** alternés par `rowIdx % 2`
- Effet zébré sobre, cohérent avec la marque (les 2 couleurs principales du design system)
- Alternance basée sur la position visible (rowIdx) plutôt que sur `sortOrder` → reste cohérente après réordonnement drag & drop
- Aucun changement CSS requis : les rules `.schedule-emp-row .schedule-td--*` utilisent déjà `rgba(var(--emp-rgb), ...)` avec opacités calibrées qui fonctionnent avec les nouvelles couleurs
- Le graphique de couverture horaire (`DAY_COLORS`) garde ses 7 couleurs distinctes — nécessaires pour distinguer les courbes des 7 jours superposés
- Bumper `CACHE_VERSION` à `v3.8.4`

### 11 mai 2026 — QR code vers le menu en ligne (v3.8.3) 📱
- Nouveau bloc dans le footer du PDF de soumission :
  - **QR code 26×26 mm à gauche** pointant vers `https://bochicacafebistro.ca/`
  - Titre **« Consultez notre menu en ligne »**
  - Sous-titre **« Scannez ce code QR avec votre téléphone ou visitez : »**
  - URL en **jaune/accent** cliquable (textWithLink jsPDF)
  - Note **« Découvrez tous nos plats colombiens authentiques. »**
  - Ligne séparatrice avant les mentions légales (pourboire / taxes / validité)
- Nouvelle lib externe : **`qrcode-generator@1.4.4`** chargée via CDN dans `index.html` (defer)
- Nouveau helper **`drawQRCode(doc, text, x, y, sizeMm)`** dans `pages-quotes.js` :
  - QR vectoriel — chaque module dessiné comme un petit rectangle noir via `doc.rect()`
  - Rendu parfait à l'impression (pas de raster, pas de pixellisation)
  - Fallback gracieux : si la lib n'est pas chargée, le PDF est généré sans QR mais le reste fonctionne
  - Fond blanc derrière le QR pour assurer la lisibilité sur le fond crème
- Bumper `CACHE_VERSION` à `v3.8.3`

### 11 mai 2026 — Fix PDF : totaux + apostrophes + mention pourboire (v3.8.2) 🔧
- **Validation `guestCount ≥ 1`** ajoutée à `saveQuote()` — empêche de sauver une soumission avec 0 personnes (qui donnait des totaux à 0,00 $ dans le PDF). Champ rendu `required` dans le formulaire.
- **Bug `\'essentiel` corrigé** : `esc()` de utils.js utilise `\\\'` pour échapper l'apostrophe (correct pour les onclick mais visible dans les inputs HTML). Solution locale à `pages-quotes.js` :
  - Nouveau helper **`attrEsc(s)`** : échappement HTML correct avec `&#39;` pour les apostrophes — utilisé pour TOUS les `value="..."` et `placeholder="..."` des modales soumission/forfaits
  - Nouveau helper **`pdfStr(s)`** : retire `\'` → `'` et `&quot;` → `"` — appliqué :
    - à toutes les valeurs lues du formulaire dans `saveQuote()` et `saveTemplate()` (nettoyage avant sauvegarde → BD propre)
    - à tous les textes affichés dans `generateQuotePDF()` (forfait, client, événement, custom lines, notes)
    - aux libellés des cartes de soumission dans la liste
  - Les valeurs en BD sont progressivement nettoyées à chaque sauvegarde
- **Mention pourboire/service** ajoutée au footer PDF :
  - Ligne **rouge en gras** : « Le service (pourboire) n'est pas inclus dans les montants ci-dessus. »
  - Suivie de la mention des taxes (TPS 5 % + TVQ 9,975 %) et de la date de validité
- Bumper `CACHE_VERSION` à `v3.8.2`

### 11 mai 2026 — Fix bière + prix éditable par soumission (v3.8.1) 🍺
- **Bug PDF corrigé** : l'emoji 🍺 s'affichait comme « Ø<ßz » dans le PDF (jsPDF helvetica ne supporte pas l'Unicode > Latin-1). Remplacé par un cercle décoratif dessiné + texte ASCII pur
- **Wording corrigé** : « Ajout d'une bière » → « **Boisson remplacée par une bière** » (c'est une substitution, pas un ajout au menu existant)
- **Prix bière éditable par soumission** : nouveau champ « Prix de la bière par personne » dans le formulaire de soumission, sous la case à cocher
  - Pré-rempli automatiquement avec le `beerPrice` du forfait sélectionné
  - Se met à jour quand on change de forfait (sauf si l'utilisateur l'a modifié manuellement — détecté via `data-touched`)
  - Permet d'offrir un rabais ponctuel (ex. 5,00 $ au lieu de 7,00 $)
  - Stocké dans `packageSnapshot.beerPrice` pour conservation historique
- Modale **Gérer les forfaits** : label précisé « Prix par défaut bière de substitution » + texte d'aide
- CSS : nouveau bloc `.quote-beer-block` enveloppant le toggle + champ prix avec hint italique

### 11 mai 2026 — Soumissions + génération PDF (v3.8.0) 🧾📄
- Nouvelle page **Soumissions** (admin seulement) avec CRUD complet sur les devis clients
- Nouveau module `js/pages-quotes.js` (~570 lignes) :
  - `renderQuotes()` — liste des soumissions avec onglets statut + recherche
  - `renderQuoteCards()` — cartes avec n° soumission, total, client, événement, actions
  - `openQuoteModal()` / `saveQuote()` — formulaire complet (client / événement / forfait radio / lignes custom / dépôt / validité / statut)
  - `openQuoteTemplatesModal()` — gestion des forfaits éditables (ajouter / modifier / supprimer)
  - `generateQuotePDF()` — génération PDF jsPDF style Bochica (~200 lignes de dessin)
  - `computeQuoteTotal()` — calcul sous-total + TPS + TVQ + dépôt + solde
  - `generateQuoteNumber()` — numérotation auto YYYY-NNN
  - Helpers : `tQuoteStatus()`, `tQuoteVenue()`, `quoteAccentHex()`, `seedQuoteTemplates()`
- **Nouvelle collection `quotes`** (admin only) + **`quoteTemplates`** (admin write + chef read)
- **Seed automatique** : `DEFAULT_QUOTE_TEMPLATES` dans `config.js` → 2 forfaits créés au 1er lancement (L'Essentiel 22$ jaune, Le Gourmand 27$ rouge, bière +7$) — calqués sur `Menu_Forfaits.pdf`
- **Snapshot du forfait** : chaque soumission enregistre une copie figée du forfait → modifier un template ne casse pas les anciennes soumissions/PDF
- **Génération PDF (jsPDF)** : reproduction fidèle du style Menu_Forfaits.pdf
  - Logo BOCHICA + sous-titre + tricolore jaune/bleu/rouge centré
  - Titre Soumission + n°
  - 2 blocs info (Client + Événement) côte à côte sur fond crème
  - Carte forfait avec barre latérale colorée selon `accentColor`, prix par personne en rouge, séparateur pointillé, bullets bleus
  - Section bière en jaune si activée
  - Lignes custom (rabais en vert)
  - Calcul détaillé sous-total → taxes → total → dépôt → solde
  - Footer « Soumission valide jusqu'au … »
- **5 statuts** : brouillon (gris) · envoyée (bleu) · acceptée (vert) · refusée (rouge, atténué) · expirée (ambre, atténué)
- **Numérotation YYYY-NNN** calculée à partir des soumissions existantes de l'année
- **Lignes personnalisées dynamiques** : ajout/retrait à la volée, support montants négatifs (rabais)
- **Règles Firestore** : `match /quotes/{doc=**}` admin only, `match /quoteTemplates/{doc=**}` admin write + chef read
- **Permissions** : ajout de `"soumissions"` à `ROLE_PERMISSIONS.global_admin` seulement
- **Sidebar** : nouvel item « Soumissions » sous Événements (icône `receipt`)
- **Duplication** intégrée à `DUPLICATE_CONFIG` (collection `quotes`)
- **CSS** : ~360 lignes ajoutées (`.quote-tabs`, `.quote-card`, `.quote-status-pill--{status}`, `.quote-package-card--{color}`, `.quote-tpl-editor`, etc.) — dark mode adapté, responsive mobile
- Bumper `CACHE_VERSION` à `v3.8.0` + ajout de `pages-quotes.js` à l'app shell

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
