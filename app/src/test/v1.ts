/// <reference types="node" />
/**
 * Accès au code de l'ancienne app (v1) pour les tests de parité : on extrait
 * une fonction de js/*.js et on la fait tourner à côté de la version v2 sur
 * les mêmes données. Si le dossier v1 n'est pas disponible (ex. plus tard,
 * quand la v1 sera retirée), les tests de parité sont simplement ignorés.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V1_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../js");
export const hasV1 = existsSync(V1_DIR);

/** Source d'une fonction nommée (déclaration `function nom(`), accolades équilibrées. */
export function v1Source(file: string, name: string): string {
  const src = readFileSync(resolve(V1_DIR, file), "utf8");
  const start = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) throw new Error(`v1 : ${name} introuvable dans ${file}`);
  let depth = 0;
  let i = src.indexOf("{", start);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

/**
 * Charge plusieurs fonctions v1 dans un même bac à sable, avec des variables
 * globales simulées (ex. `employees`). Renvoie les fonctions demandées.
 */
export function loadV1<T extends Record<string, (...a: never[]) => unknown>>(file: string, names: string[], globals: Record<string, unknown> = {}): T {
  const body = names.map((n) => v1Source(file, n)).join("\n");
  const keys = Object.keys(globals);
  const factory = new Function(...keys, `${body}\nreturn { ${names.join(", ")} };`);
  return factory(...keys.map((k) => globals[k])) as T;
}

/** Générateur pseudo-aléatoire reproductible (mêmes cas à chaque test). */
export function rng(seed = 42) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
