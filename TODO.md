# 📌 TODO — Bochica Inventaire

> Liste vivante des améliorations identifiées mais pas encore implémentées.
> Mise à jour : **12 mai 2026**

---

## 🔒 Sécurité (sprint à venir — demandé par l'utilisateur le 12 mai 2026)

> **À traiter lors d'une session dédiée.** L'utilisateur a explicitement demandé qu'on fasse ce chantier un autre jour.

- [ ] **2FA pour l'admin global** via Firebase Auth (SMS ou TOTP). Le compte admin accède à toutes les données financières — la 2FA est prudente.
- [ ] **Auto-logout après inactivité** (~30 min). Important pour les iPads/écrans partagés en cuisine ou en service. Détecter via `visibilitychange` + un timer reset sur mousemove/keydown.
- [ ] **Logs d'audit enrichis** : pour les changements sensibles (salaires, dépenses > 500$, suppressions), stocker `before`/`after` dans `/logs`. Permet de retracer qui a changé quoi.
- [ ] **Validation côté serveur** dans `firestore.rules` : vérifier la forme des documents (ex : `request.resource.data.amount is number && request.resource.data.amount >= 0`) en plus de l'auth. Empêche les écritures malformées même avec le bon rôle.
- [ ] **Rotation/expiration de session** : forcer une réauthentification périodique (ex : tous les 30 jours), surtout pour `global_admin`.
- [ ] **Confirmation par mot de passe** avant les actions critiques (suppression de masse, verrouillage de paie, export). Pattern « danger zone ».
- [ ] **Limitation des tentatives de login** : Firebase Auth a déjà du rate-limiting mais on peut afficher des messages clairs après N échecs.

---

## 💰 Valeurs business (priorité haute, à proposer ensuite)

- [ ] **Food cost automatique sur le menu** : calculer `coût_recette / prix` pour chaque item, afficher avec code couleur (vert < 28%, jaune 28-35%, rouge > 35%). Données déjà présentes (`ingredients` + `menu.recipe`).
- [ ] **Prix suggéré sur la modale d'un item de menu** : « Prix suggéré pour 30% food cost : X $ » à côté du champ prix.
- [ ] **Déduction automatique d'inventaire depuis les ventes** : quand un revenu est enregistré, optionnellement lier à des items du menu et déduire les ingrédients du stock.
- [ ] **Prévisions de ventes** : moyenne des 8 dernières semaines par jour de semaine → alimente la colonne « Ventes prévues ».
- [ ] **Module disponibilités employés** : grille où l'employé saisit ses dispos pour la semaine (via PIN code, accès limité à sa fiche).

---

## 🐛 Dette technique

- [ ] **Tests unitaires** sur les calculs financiers critiques (salaires, pourboires, TPS/TVQ, food cost). Pas besoin d'un framework — un `tests.html` avec `console.assert` suffit.
- [ ] **Backup automatique Firestore** via Cloud Function (export quotidien vers Cloud Storage).
- [ ] **Pagination/virtualisation** des grandes listes (`expenses`/`revenues` limités à 500 — ça va devenir lourd).
- [ ] **Centraliser les calculs de pourboires** : la logique cuisine/service est dupliquée entre `pages-payroll.js` et `pages-simulations.js`.

---

## 📱 Mobile / PWA

- [ ] **Vue mobile dédiée pour Salaires & Sim** : actuellement les tableaux 14-colonnes scrollent horizontalement — refondre en vue « par jour » avec sélecteur en haut.
- [ ] **Notifications push** (Firebase Cloud Messaging) pour alertes critiques : ruptures stock, paie à verrouiller, réservation à venir.
- [ ] **Persistence offline Firestore** : `enablePersistence()` + badge « Hors ligne » dans la topbar.

---

## 🎨 Quick wins UX

- [ ] **Toast « Annuler »** après suppression (5-10s) — pattern Gmail.
- [ ] **Sauvegarde localStorage** des filtres actifs (inventaire catégorie, shopping fournisseur, etc.).
- [ ] **Export Excel** sur Inventaire / Dépenses / Salaires / Soumissions (SheetJS déjà chargé).
- [ ] **Cmd/Ctrl+Enter** pour soumettre une modale.
- [ ] **Mode plein écran** pour Salaires et Simulation (cacher la sidebar).
- [ ] **Recherche globale Cmd+K** étendue aux clients (soumissions), événements, dépenses.

---

## 🎯 Idées en vrac (à creuser)

- Calculateur de coût d'événement automatique depuis le menu (pour devis plus rapides).
- Comparaison année sur année dans le dashboard.
- Module clients / loyauté (suivi des réservations récurrentes).
- Photos sur les items du menu et recettes.
- Gestion des allergènes (réglementation Québec).
- Suivi des achats récurrents (« Tu commandes toujours du poulet le mardi »).
