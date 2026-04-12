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
├── state.js                ← Variables globales (products, employees, etc.)
├── utils.js                ← Fonctions utilitaires (fmtMoney, getStatus, modals, dark mode...)
├── auth.js                 ← Connexion PIN, logout
├── sidebar.js              ← Navigation, sidebar, renderPage()
├── firebase-listeners.js   ← Listeners Firestore temps réel
├── inventaire.js           ← Page inventaire, cartes produits, stock, drag & drop
├── modals-produits.js      ← Modals : produit, note, catégorie, réception, archivage
├── pages-secondaires.js    ← Pages : rapport, historique, tâches + modals tâches
└── pages-admin.js          ← Pages : employés, horaires, dépenses, menu, fournisseurs + leurs modals

## 🔥 Firebase
- **Projet** : bochica-inventaire
- **Collections Firestore** :
  - `products` — inventaire (nom, stock, minimum, section, fournisseur, orderQty, orderUnit)
  - `suppliers` — fournisseurs (nom, contact, email, notes)
  - `employees` — employés (nom, rôle, phone, email, pin, shifts)
  - `tasks` — tâches (titre, description, statut, priorité, assigné, date limite)
  - `menu` — items du menu (nom, description, prix, catégorie, disponible)
  - `expenses` — dépenses (description, montant, date, catégorie, fournisseur)
  - `logs` — historique des actions
  - `settings/sections` — catégories personnalisées

## ✅ Fonctionnalités existantes
- **Inventaire** : stock, statuts (rouge/jaune/vert), drag & drop, archivage, notes, sections
- **Rapport** : produits à commander, export imprimable
- **Historique** : log de toutes les actions
- **Tâches** : kanban 3 colonnes (À faire / En cours / Complété), priorités, assignation
- **Employés & Horaires** : fiche employé, grille horaire semaine, quarts (Matin/Soir/Journée/Congé)
- **Dépenses** : suivi par période (semaine/mois/année), catégories, stats
- **Menu** : items par catégorie, toggle disponible/indisponible
- **Fournisseurs** : fiches avec produits liés
- **Dark mode** : toggle, sauvegardé en localStorage
- **Mobile responsive** : sidebar cachée, cartes au lieu de tableau

## 🚧 Contraintes importantes
- **Aucune installation locale possible** — tout se fait via GitHub.com + Vercel
- **Vanilla JS uniquement** — pas de React, pas de build step
- **Modifications** : chaque fichier JS = une section de l'app
- Vercel redéploie automatiquement à chaque commit GitHub

## 📝 Fonctionnalités à ajouter (liste évolutive)
- [ ] À compléter selon les besoins futurs...
