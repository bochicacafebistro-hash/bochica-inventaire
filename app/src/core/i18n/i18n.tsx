/**
 * Traduction FR / ES (espace employé, navigation, briques communes).
 *
 * Chaque module déclare ses textes ainsi :
 *   const fr = { title: "Tâches" };
 *   export const MESSAGES: Messages<typeof fr> = { fr, es: { title: "Tareas" } };
 * (TypeScript refuse une clé espagnole manquante ou en trop) et les lit avec
 * `const m = useMessages(MESSAGES)`. Les modules réservés à l'admin
 * restent en français.
 *
 * La langue est mémorisée sur l'appareil (comme la v1 : clé
 * « bochica-ui-lang »), pour que la tablette de l'équipe reste en espagnol.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type Lang = "fr" | "es";
export const LANGS: { value: Lang; label: string }[] = [
  { value: "fr", label: "FR" },
  { value: "es", label: "ES" },
];
const STORAGE_KEY = "bochica-ui-lang";

export type Messages<M extends Record<string, string>> = { fr: M; es: { [K in keyof M]: string } };

function readStored(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "fr";
  } catch {
    return "fr";
  }
}

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<LangState>({ lang: "fr", setLang: () => {} });

export function LangProvider({ children, initial }: { children: ReactNode; initial?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initial ?? readStored());
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* stockage indisponible */
    }
    document.documentElement.lang = l === "es" ? "es" : "fr-CA";
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext).lang;
export const useSetLang = () => useContext(LangContext).setLang;

/** Textes du module dans la langue courante. */
export function useMessages<M extends Record<string, string>>(dict: Messages<M>): M {
  const lang = useLang();
  return (lang === "es" ? dict.es : dict.fr) as M;
}

/** Locale Intl de la langue (dates, nombres). */
export const localeOf = (lang: Lang) => (lang === "es" ? "es-ES" : "fr-CA");

/** « {n} tâche(s) » → remplace les {clés}. */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Textes communs aux briques partagées (fenêtres, recherche, navigation…). */
const COMMON_FR = {
    close: "Fermer",
    cancel: "Annuler",
    confirm: "Confirmer",
    delete: "Supprimer",
    save: "Enregistrer",
    saving: "Enregistrement…",
    edit: "Modifier",
    duplicate: "Dupliquer",
    clearSearch: "Effacer la recherche",
    search: "Rechercher…",
    actions: "Actions",
    loadingSession: "Vérification de la session…",
    notMigrated: "Pas encore migré",
    legacyText:
      "Ce module fonctionne encore dans l'application actuelle. Tes données sont les mêmes des deux côtés : ce que tu modifies là-bas apparaîtra ici une fois le module migré.",
    openLegacy: "Ouvrir dans l'app actuelle",
    notFoundEyebrow: "Erreur 404",
    notFoundTitle: "Page introuvable",
    notFoundText: "Cette page n'existe pas ou tu n'y as pas accès.",
    errorPrefix: "Erreur",
    impossible: "{what} impossible : {msg}",
};

export const COMMON: Messages<typeof COMMON_FR> = {
  fr: COMMON_FR,
  es: {
    close: "Cerrar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    delete: "Eliminar",
    save: "Guardar",
    saving: "Guardando…",
    edit: "Editar",
    duplicate: "Duplicar",
    clearSearch: "Borrar la búsqueda",
    search: "Buscar…",
    actions: "Acciones",
    loadingSession: "Verificando la sesión…",
    notMigrated: "Aún no migrado",
    legacyText:
      "Este módulo todavía funciona en la aplicación actual. Tus datos son los mismos en ambos lados: lo que cambies allá aparecerá aquí cuando el módulo esté migrado.",
    openLegacy: "Abrir en la app actual",
    notFoundEyebrow: "Error 404",
    notFoundTitle: "Página no encontrada",
    notFoundText: "Esta página no existe o no tienes acceso.",
    errorPrefix: "Error",
    impossible: "{what}: imposible ({msg})",
  },
};

export const useCommon = () => useMessages(COMMON);
