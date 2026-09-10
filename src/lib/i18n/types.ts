/** Langues proposées. La liste est volontairement courte pour commencer. */
export const LOCALES = ["FR", "EN"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "FR";

/** Code BCP 47, pour l'attribut `lang` et pour `Intl`. */
export const BCP47: Record<Locale, string> = { FR: "fr", EN: "en" };

/** Nom de la langue dans la langue elle-même : c'est ainsi qu'on choisit. */
export const LOCALE_NAMES: Record<Locale, string> = { FR: "Français", EN: "English" };

/**
 * Un dictionnaire associe des clés à du texte. Une valeur peut être :
 * - une chaîne simple ;
 * - une paire `{ one, other }` quand le texte dépend d'un nombre, chaque
 *   langue appliquant sa propre règle d'accord.
 *
 * Les variables s'écrivent `{nom}` et sont remplacées à l'affichage.
 */
export type Phrase = string | { one: string; other: string };
export type Dictionary = Record<string, Phrase>;

export type Vars = Record<string, string | number>;

/**
 * Choisit la forme singulier ou pluriel.
 *
 * Le français accorde au singulier pour 0 et 1 (« 0 échange »), l'anglais
 * seulement pour 1 (« 0 trades »). C'est la seule divergence d'accord entre
 * les deux langues, on la traite ici plutôt que dans chaque dictionnaire.
 */
export function pluralForm(locale: Locale, count: number): "one" | "other" {
  if (locale === "FR") return Math.abs(count) < 2 ? "one" : "other";
  return Math.abs(count) === 1 ? "one" : "other";
}

/** Remplace les `{variables}` d'un texte. */
export function interpolate(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Construit la fonction de traduction d'une langue.
 *
 * Une clé absente renvoie la clé elle-même : mieux vaut un texte laid et
 * repérable qu'une page vide, et les tests le détectent immédiatement.
 */
export function makeTranslator(locale: Locale, dict: Dictionary, fallback: Dictionary) {
  return function t(key: string, vars?: Vars): string {
    const phrase = dict[key] ?? fallback[key];
    if (phrase === undefined) return key;

    if (typeof phrase === "string") return interpolate(phrase, vars);

    const count = Number(vars?.count ?? 0);
    return interpolate(phrase[pluralForm(locale, count)], vars);
  };
}

export type Translator = ReturnType<typeof makeTranslator>;
