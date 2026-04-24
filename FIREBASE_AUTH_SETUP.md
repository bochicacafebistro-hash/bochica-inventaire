# 🔐 Migration vers Firebase Authentication

Procédure à suivre **une seule fois** pour passer de l'ancien système (SHA-256 côté client) à Firebase Authentication.

## Étape 1 — Activer Email/Password dans Firebase Console

1. Aller sur https://console.firebase.google.com/
2. Sélectionner le projet **bochica-inventaire**
3. Menu gauche → **Authentication** → **Get started** (si jamais activé)
4. Onglet **Sign-in method** → clique sur **Email/Password** → **Enable** → **Save**

## Étape 2 — Créer les 3 comptes + docs users (script automatique)

**Avant de pousser le code**, tu dois avoir des comptes Firebase Auth. Sinon personne ne pourra se connecter. Le plus simple : utiliser le script ci-dessous.

### Méthode A — Console du navigateur (recommandée)

1. Push le code (le SDK Firebase Auth sera chargé)
2. Ouvre l'app dans le navigateur
3. **Avant de tenter de te connecter**, ouvre la console (F12)
4. Colle le script ci-dessous et appuie Entrée :

```js
(async () => {
  const accounts = [
    { email: "bochica@bochica.app", password: "Bochica11309130!", role: "global_admin", displayName: "Admin Bochica" },
    { email: "chef@bochica.app",    password: "Bochica2024!",     role: "chef",         displayName: "Chef de cuisine" },
    { email: "employe@bochica.app", password: "Bochica2024!",     role: "employee",     displayName: "Employé" }
  ];
  // ⚠ Si tu veux garder le mot de passe "2024" pour l'employé, remplace ci-dessus.
  // Mais 4 chiffres = 13 bits d'entropie, extrêmement faible. Recommandé : Bochica2024!

  for (const acc of accounts) {
    try {
      // Créer le compte Auth
      const cred = await firebase.auth().createUserWithEmailAndPassword(acc.email, acc.password);
      console.log("✓ Compte créé :", acc.email, "uid=" + cred.user.uid);
      // Créer le doc /users/{uid} avec le rôle
      await firebase.firestore().collection("users").doc(cred.user.uid).set({
        email: acc.email,
        role: acc.role,
        displayName: acc.displayName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log("  → doc /users/" + cred.user.uid + " écrit");
      await firebase.auth().signOut();
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        console.log("⊙ Déjà existant :", acc.email, "— ignoré");
      } else {
        console.error("✗ Erreur pour", acc.email, ":", err.code, err.message);
      }
    }
  }
  console.log("\n═══ Initialisation terminée. Rafraîchis la page et connecte-toi. ═══");
})();
```

5. Rafraîchis la page → écran de login → tape `Bochica` + mot de passe → tu devrais être connecté

### Méthode B — Console Firebase (manuelle)

Si le script console échoue, tu peux créer les comptes manuellement :

1. Firebase Console → Authentication → Users → **Add user**
2. Créer successivement :
   - bochica@bochica.app + mot de passe fort
   - chef@bochica.app + mot de passe fort
   - employe@bochica.app + mot de passe fort
3. Noter les **UID** générés (un par compte)
4. Firebase Console → Firestore → **Start collection** → `users`
5. Pour chaque UID, créer un document `users/{uid}` avec les champs :
   - `email` (string) = l'email
   - `role` (string) = "global_admin" | "chef" | "employee"
   - `displayName` (string) = "Admin Bochica" / etc.

## Étape 3 — Appliquer les Firestore Security Rules

Les nouvelles règles vérifient l'authentification + le rôle côté serveur. Le fichier `firestore.rules` dans ce repo contient les règles à appliquer :

1. Firebase Console → Firestore → **Règles**
2. **Remplacer tout le contenu** par celui du fichier `firestore.rules`
3. **Publier**

**Attention** : avant de publier les règles, les 3 comptes + leurs docs `/users/{uid}` doivent exister, sinon personne ne pourra se connecter (les règles vérifient `users/{uid}.role`).

## Étape 4 — Vérifier

Se connecter avec chaque compte et vérifier que :
- ✅ **Bochica** : accès à toutes les pages (dashboard, inventaire, dépenses, menu, etc.)
- ✅ **Chef** : accès uniquement à inventaire, menu, ingrédients, recettes
- ✅ **Employe** : accès uniquement à inventaire (stock)

## 💾 Rappels sécurité

- **Les mots de passe ne sont plus stockés en clair ni en hash côté client** — Firebase les stocke bcrypt-hashés sur leurs serveurs
- **Rate-limiting** intégré : après 5-10 tentatives échouées, Firebase bloque le compte pendant 30-60s
- **Les règles Firestore** bloquent l'accès direct à la BD sans authentification
- **Le rôle est vérifié côté serveur** (les règles lisent `users/{uid}.role`) — un utilisateur ne peut pas se faire passer pour un autre rôle même en bidouillant le JS du navigateur
