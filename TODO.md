# 📌 TODO — Bochica Inventaire

> Liste vivante des améliorations identifiées mais pas encore implémentées.
> Mise à jour : **29 mai 2026**

---

## ⏳ À reconsidérer à moyen terme (proposées le 29 mai 2026)

> L'utilisateur souhaite stabiliser l'app actuelle (pointage, salaires, planning) avant d'ajouter ces gros chantiers. À revisiter quand le système est rodé en production.

### ⚖️ Conformité Québec (Loi sur les normes du travail) — **PRIORITÉ haute**

- [ ] **Heures supplémentaires automatiques** : détection au-delà de 40 h/semaine → taux × 1,5×. Ligne séparée dans la paie (« 40 h régulières + 5 h sup × 1,5 = 47,5 h équivalent »). Seuil et taux configurables dans les paramètres.
- [ ] **Vacances accumulées (4% / 6%)** : calcul automatique à chaque paie. Affichage du solde par employé dans sa fiche. Inclus dans le PDF de paie. 6% après 3 ans d'ancienneté.
- [ ] **Jours fériés payés** : calcul de l'indemnité de jour férié selon la formule officielle (1/20 du salaire des 4 dernières semaines).
- [ ] **Déductions automatiques** : RRQ, AE, RQAP avec taux 2026 à jour (paramètres). Optionnel — si l'admin utilise déjà un logiciel de paie séparé.

### 💵 Workflow paie (impact direct)

- [ ] **Pourboires cash vs cartes** : séparation pour déclaration fiscale (les pourboires cartes sont déclarés automatiquement par le POS, les cash le sont volontairement). 2 inputs au lieu d'un dans « Pourboires de la semaine ». Total combiné inchangé, mais le rapport PDF affiche la séparation.
- [ ] **Verrouillage partiel par employé** : permet de verrouiller un employé (déjà payé) sans verrouiller toute la semaine. Utile pour les paies fractionnées.

### 📧 Communication employés

- [ ] **Email hebdomadaire automatique** : chaque dimanche soir, chaque employé reçoit un mail avec son horaire de la semaine à venir + ses heures et son pourboire de la semaine passée + total à payer. Requiert un compte SendGrid gratuit (3000 mails/mois).
- [ ] **SMS d'horaire** : alternative à l'email pour les employés sans email. Twilio ou Brevo.
- [ ] **Notifications PWA push** : alerte sur la tablette quand quelqu'un oublie sa sortie. Rappel de début de shift (« David, tu commences dans 15 min »). Nécessite Firebase Cloud Messaging.

### 🛡️ Sécurité du pointage (anti-fraude)

- [ ] **Géolocalisation au pointage** : vérifie que le pointage se fait depuis le resto (rayon configurable, ex. 100 m). Bloque ou alerte si fait depuis ailleurs. Gratuit, utilise l'API Geolocation du navigateur. Demande consentement utilisateur la première fois.
- [ ] **Photo selfie au pointage** (optionnel) : selfie webcam capturé au moment du punch, stocké compressé dans Firestore. Empêche les employés de pointer pour un collègue. Optionnel par configuration.

### 📅 Demandes des employés (workflow RH)

- [ ] **Demandes de congés** : page dédiée où l'employé (via son PIN) peut demander un congé avec date début/fin + raison. Notification à l'admin qui approuve/refuse. Si approuvé → marque automatiquement le shift comme « Congé » dans le planning.
- [ ] **Échange de shifts entre employés** : Marie ne peut pas travailler vendredi, propose un échange à Paul. Paul accepte ou refuse. Si accepté + admin approuve → shifts inversés automatiquement.
- [ ] **Notifications de demandes** : badge dans la sidebar admin pour signaler les demandes en attente.

### 📊 Analyse mensuelle/annuelle

- [ ] **Vue cumulée par employé** : nouveau bouton « Stats employé » dans Salaires. Stats du mois en cours : heures totales, salaire brut, pourboires, bonus $/h moyen. Stats annuelles YTD : total payé, jours travaillés, vacances accumulées. Comparaison vs mois/année précédent. Graphique de tendance (revenus + heures par semaine).
- [ ] **Forecast / Prédiction des ventes** : basé sur les rapports Cluster déjà importés. « Vendredi prochain devrait faire ~3500 $ basé sur les 4 derniers vendredis ». Suggère un budget heures basé sur le ratio cible.
- [ ] **Heatmap de couverture mensuelle** : vue mois entier sur le dashboard. Identifie les jours/heures où on manque chroniquement de monde. Aide à ajuster les embauches.

### 📤 Exports & intégrations comptables

- [ ] **Sync avec logiciel comptable** : export en format compatible Acomba, Sage 50 ou QuickBooks. Évite la double saisie pour le comptable du resto. Format CSV bien structuré au minimum.
- [ ] **Bulletins de paie individuels PDF** : un PDF par employé style fiche de paie officielle (avec déductions si on les calcule). À distribuer en main propre ou par email.
- [ ] **Export Excel des Salaires** : feuille consolidée + feuille par employé. SheetJS déjà chargé donc rapide à ajouter.

### 🏠 Dashboard amélioré

- [ ] **Widget « Maintenant »** : qui travaille en ce moment, avec photo/initiales. Combien d'heures déjà pointées aujourd'hui par employé. Heures restantes prévues.
- [ ] **Widget « Alertes de pointage »** : compteur des oublis non corrigés (entrées sans sorties sur jours passés).

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
