# Bochica — v2 (React)

Nouvelle version de l'app de gestion, construite **à côté** de l'ancienne
(racine du dépôt) et branchée sur **la même base Firestore**. On migre
module par module ; les modules pas encore migrés affichent un lien vers
l'app actuelle (badge « V1 » dans le menu).

## Stack

- React 19 + TypeScript + Vite
- React Router (routes générées à partir du registre des modules)
- Firebase (SDK modulaire) — Auth + Firestore
- CSS Modules + tokens du design system Bochica (`src/ui/tokens.css`)
- Icônes : lucide-react

## Architecture — « monolithe modulaire »

```
src/
├── core/                 ← partagé, sans UI métier
│   ├── firebase.ts       ← init Firebase (config surchargeable par VITE_FIREBASE_*)
│   ├── auth/             ← connexion, rôles (users/{uid}.role)
│   ├── tenant/           ← restaurant courant (préparation multi-restaurant)
│   └── data/             ← SEUL endroit qui connaît les chemins Firestore
├── ui/                   ← composants visuels génériques + thème
├── app/                  ← coquille : routeur, menu, connexion
└── modules/              ← un dossier par domaine (voir modules/README.md)
    ├── registry.ts       ← liste de tous les modules (migrés ou V1)
    └── accueil/
```

### Multi-restaurant (tenant)

Aucune page n'écrit un nom de collection en dur : tout passe par
`useCollection("products")` / `tenantCollection(tenant, "products")`.
Aujourd'hui le tenant Bochica a `layout: "root"` (collections à la racine,
comme l'ancienne app). Pour vendre l'app à d'autres restaurants, on passera
à `restaurants/{id}/…` en changeant une seule ligne + une migration de données.

## Développement

```bash
cd app
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build dans dist/
```

## Déploiement Vercel (projet séparé de l'ancienne app)

1. Vercel → **Add New… → Project** → importer `bochica-inventaire`.
2. **Root Directory : `app`** (framework détecté : Vite). Nom suggéré : `bochica-v2`.
3. Deploy. Les routes SPA sont gérées par `vercel.json`.

Pour que **l'ancienne app** ne se redéploie pas à chaque changement dans `app/` :
projet Vercel `bochica-inventaire` → Settings → Git → **Ignored Build Step** →
commande personnalisée :

```bash
git diff --quiet HEAD^ HEAD -- . ':(exclude)app'
```

## Sécurité

`firestore.rules` à la racine du dépôt reste la **source unique** des règles
pour les deux apps. Toute nouvelle collection ou accès doit y être ajouté.
