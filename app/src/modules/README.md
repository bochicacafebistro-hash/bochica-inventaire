# Modules

Chaque dossier ici = un domaine de l'app (inventaire, paie, finances…).

## Règles

1. **Un module ne touche jamais au code d'un autre module.** S'il a besoin
   de quelque chose de partagé, ça va dans `src/core/` (données, auth) ou
   `src/ui/` (composants visuels).
2. **Aucun nom de collection Firestore en dur dans les pages.** Toujours
   passer par `useCollection` / `tenantCollection` (voir `src/core/data/`),
   qui tiennent compte du restaurant courant.
3. **La logique métier (calculs de paie, taxes, pourboires…) va dans des
   fonctions pures `*.logic.ts`**, sans React ni Firebase, pour pouvoir la
   tester et la comparer à l'ancienne app.

## Structure type

```
modules/rapports/
├── index.ts            ← déclaration du module (id, libellé, icône, rôles, page)
├── RapportsPage.tsx    ← page principale
├── rapports.data.ts    ← types + accès Firestore du module
├── rapports.logic.ts   ← calculs purs
└── components/         ← composants propres au module
```

## Migrer un module

1. Créer le dossier et son `index.ts` avec `status: "migrated"`.
2. Dans `registry.ts`, importer le module et retirer sa ligne `legacy(...)`.
3. Vérifier `firestore.rules` (à la racine du dépôt) si de nouveaux accès sont nécessaires.
