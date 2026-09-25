/**
 * Initialisation Firebase (SDK modulaire).
 *
 * La config web Firebase n'est pas secrète : la sécurité repose sur
 * firestore.rules (à la racine du dépôt, partagé avec l'ancienne app).
 * Chaque valeur peut être surchargée par une variable VITE_FIREBASE_*.
 */
import { initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyC27HzALz_DolN5huqGwVBsKTLHg37rUuc",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "bochica-inventaire.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "bochica-inventaire",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "bochica-inventaire.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "261321722710",
  appId: env.VITE_FIREBASE_APP_ID || "1:261321722710:web:5a7aa0039fa0fd1a20a4f7",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);

setPersistence(auth, browserLocalPersistence).catch((err) =>
  console.warn("Persistance Auth locale indisponible :", err),
);

export const LEGACY_APP_URL: string =
  env.VITE_LEGACY_APP_URL || "https://bochica-inventaire.vercel.app";
