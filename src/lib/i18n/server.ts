import "server-only";

import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { fr } from "./fr";
import { en } from "./en";
import { DEFAULT_LOCALE, LOCALES, makeTranslator, type Dictionary, type Locale } from "./types";

const DICTIONARIES: Record<Locale, Dictionary> = { FR: fr, EN: en };

/** Cookie posé à la connexion, pour que la langue survive au chargement suivant. */
export const LOCALE_COOKIE = "myshelf_locale";

function parse(value: string | undefined | null): Locale | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (LOCALES as readonly string[]).includes(upper) ? (upper as Locale) : null;
}

/**
 * Détermine la langue d'affichage, du plus explicite au plus approximatif :
 * le choix enregistré dans le profil, puis un cookie (utile avant même d'avoir
 * un compte), puis la préférence annoncée par le navigateur, et enfin le
 * français.
 */
export async function getLocale(): Promise<Locale> {
  const user = await getCurrentUser();
  if (user) return parse(user.locale) ?? DEFAULT_LOCALE;

  const cookieStore = await cookies();
  const fromCookie = parse(cookieStore.get(LOCALE_COOKIE)?.value);
  if (fromCookie) return fromCookie;

  const accept = (await headers()).get("accept-language") ?? "";
  // « fr-CA,fr;q=0.9,en;q=0.8 » → on ne retient que la première langue connue.
  for (const part of accept.split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2);
    const match = parse(code);
    if (match) return match;
  }

  return DEFAULT_LOCALE;
}

/** Fonction de traduction pour la langue en cours, dans un composant serveur. */
export async function getT() {
  const locale = await getLocale();
  return makeTranslator(locale, DICTIONARIES[locale], fr);
}

/** Langue et dictionnaire, pour les passer à un composant client. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, dictionary: DICTIONARIES[locale] };
}
