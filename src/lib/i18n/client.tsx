"use client";

import { createContext, useContext, useMemo } from "react";
import { fr } from "./fr";
import { DEFAULT_LOCALE, makeTranslator, type Dictionary, type Locale } from "./types";

type I18nValue = { locale: Locale; dictionary: Dictionary };

const I18nContext = createContext<I18nValue>({ locale: DEFAULT_LOCALE, dictionary: fr });

/**
 * Rend la langue disponible aux composants clients.
 *
 * Le dictionnaire est un simple objet de chaînes : il traverse sans peine la
 * frontière serveur/client, contrairement à une fonction de traduction.
 */
export function I18nProvider({ value, children }: { value: I18nValue; children: React.ReactNode }) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  const { locale, dictionary } = useContext(I18nContext);
  return useMemo(() => makeTranslator(locale, dictionary, fr), [locale, dictionary]);
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
